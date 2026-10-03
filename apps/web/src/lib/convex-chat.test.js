import { expect, test } from "bun:test";
import { StreamProcessor } from "@tanstack/ai/client";
import { readChatStream } from "@pursor/backend/convex/lib/chatStream";

import { createConvexChatConnection } from "./convex-chat";

function mockClient(initial) {
  let value = { workflowId: "current-workflow", ...initial };
  let notify;
  let unsubscribed = false;
  const sends = [];
  return {
    sends,
    get unsubscribed() {
      return unsubscribed;
    },
    update(next) {
      value = { workflowId: "current-workflow", ...next };
      notify?.();
    },
    client: {
      mutation: async (_reference, args) => {
        sends.push(args);
        return { sessionId: "test-session", workflowId: "current-workflow" };
      },
      watchQuery: () => ({
        localQueryResult: () => value,
        onUpdate: (listener) => {
          notify = listener;
          return () => {
            unsubscribed = true;
          };
        },
      }),
    },
  };
}

test("Convex tool updates round-trip through TanStack's real stream processor", async () => {
  const tool = { id: "search-1", name: "searchWeb", input: '{"query":"Convex"}', output: null };
  const mock = mockClient({ status: "inProgress", text: null, error: null, tools: [tool] });
  const connection = createConvexChatConnection(mock.client);
  const processor = new StreamProcessor();
  processor.addUserMessage("Research Convex");
  const stream = connection.connect(processor.getMessages(), {}, new AbortController().signal);
  const consumed = (async () => {
    for await (const chunk of stream) {
      processor.processChunk(chunk);
      if (chunk.type === "TOOL_CALL_END") {
        // Duplicate snapshots must not duplicate tool calls or results.
        const complete = {
          status: "completed",
          text: "Convex is reactive.",
          error: null,
          tools: [{ ...tool, output: '{"url":"https://convex.dev"}' }],
        };
        mock.update(complete);
        mock.update(complete);
      }
    }
  })();
  await consumed;
  const assistant = processor.getMessages().find((message) => message.role === "assistant");
  expect(assistant.parts.filter((part) => part.type === "tool-call")).toHaveLength(1);
  expect(assistant.parts.find((part) => part.type === "tool-call").state).toBe("complete");
  expect(assistant.parts.filter((part) => part.type === "tool-result")).toHaveLength(1);
  expect(assistant.parts.find((part) => part.type === "text").content).toBe("Convex is reactive.");
  expect(mock.unsubscribed).toBe(true);

  mock.update({ status: "completed", text: "Follow-up answer", error: null, tools: [] });
  for await (const _chunk of connection.connect([{ role: "user", content: "Tell me more" }], {})) {
    /* consume */
  }
  expect(mock.sends[1]).toEqual({ sessionId: "test-session", prompt: "Tell me more" });
});

test("failed workflows propagate errors and release subscriptions", async () => {
  const mock = mockClient({
    status: "failed",
    error: "Context.dev is out of credits",
    text: null,
    tools: [],
  });
  const connection = createConvexChatConnection(mock.client);
  const consume = async () => {
    for await (const _chunk of connection.connect([{ role: "user", content: "Search" }], {})) {
      /* consume */
    }
  };
  await expect(consume()).rejects.toThrow("Context.dev is out of credits");
  expect(mock.unsubscribed).toBe(true);
});

test("aborting a waiting chat unsubscribes without waiting for the workflow", async () => {
  const mock = mockClient({ status: "inProgress", error: null, text: null, tools: [] });
  const controller = new AbortController();
  const connection = createConvexChatConnection(mock.client);
  const stream = connection.connect([{ role: "user", content: "Search" }], {}, controller.signal);
  await stream.next(); // RUN_STARTED
  const waiting = stream.next();
  await Promise.resolve();
  controller.abort();
  expect((await waiting).done).toBe(true);
  expect(mock.unsubscribed).toBe(true);
});

test("cached results from an older workflow cannot finish a new turn", async () => {
  const mock = mockClient({
    workflowId: "old-workflow",
    status: "completed",
    text: "Old answer",
    error: null,
    tools: [],
  });
  const connection = createConvexChatConnection(mock.client);
  const stream = connection.connect([{ role: "user", content: "New question" }], {});
  await stream.next();
  const waiting = stream.next();
  await Promise.resolve();
  mock.update({ status: "completed", text: "New answer", error: null, tools: [] });
  const chunks = [(await waiting).value];
  for await (const chunk of stream) chunks.push(chunk);
  expect(chunks.find((chunk) => chunk.type === "TEXT_MESSAGE_CONTENT").delta).toBe("New answer");
  expect(mock.unsubscribed).toBe(true);
});

test("assistant text streams before completion without replaying duplicate snapshots", async () => {
  const mock = mockClient({
    streamId: "stream-1",
    status: "inProgress",
    text: "Hello",
    error: null,
    tools: [],
  });
  const connection = createConvexChatConnection(mock.client);
  const processor = new StreamProcessor();
  const deltas = [];
  for await (const chunk of connection.connect([{ role: "user", content: "Say hello" }], {})) {
    processor.processChunk(chunk);
    if (chunk.type === "TEXT_MESSAGE_CONTENT") {
      deltas.push(chunk.delta);
      if (chunk.delta === "Hello") {
        expect(processor.getMessages()[0].parts[0].content).toBe("Hello");
        const next = {
          streamId: "stream-1",
          status: "inProgress",
          text: "Hello world",
          error: null,
          tools: [],
        };
        mock.update(next);
        mock.update(next);
      } else {
        mock.update({
          streamId: "stream-1",
          status: "completed",
          text: "Hello world",
          error: null,
          tools: [],
        });
      }
    }
  }
  expect(deltas).toEqual(["Hello", " world"]);
  expect(processor.getMessages()[0].parts[0].content).toBe("Hello world");
});

test("native Agent chunks show a tool while arguments and its result are still arriving", async () => {
  const chunks = [
    { type: "tool-input-start", toolCallId: "tool-1", toolName: "searchWeb" },
    { type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '{"query":' },
  ];
  const snapshot = () => ({
    streamId: "stream-1",
    status: "inProgress",
    error: null,
    ...readChatStream(chunks),
  });
  const mock = mockClient(snapshot());
  const connection = createConvexChatConnection(mock.client);
  const processor = new StreamProcessor();
  for await (const chunk of connection.connect([{ role: "user", content: "Search Convex" }], {})) {
    processor.processChunk(chunk);
    if (chunk.type === "TOOL_CALL_ARGS" && chunk.delta === '{"query":') {
      const part = processor.getMessages()[0].parts[0];
      expect(part.name).toBe("searchWeb");
      expect(part.state).toBe("input-streaming");
      chunks.push(
        { type: "tool-input-delta", toolCallId: "tool-1", inputTextDelta: '"Convex"}' },
        {
          type: "tool-input-available",
          toolCallId: "tool-1",
          toolName: "searchWeb",
          input: { query: "Convex" },
        },
      );
      mock.update(snapshot());
    }
    if (chunk.type === "TOOL_CALL_END") {
      chunks.push(
        {
          type: "tool-output-available",
          toolCallId: "tool-1",
          output: '[{"url":"https://convex.dev"}]',
        },
        { type: "text-delta", id: "answer-1", delta: "Found Convex." },
      );
      mock.update({ ...snapshot(), status: "completed" });
    }
  }
  const parts = processor.getMessages()[0].parts;
  expect(parts.find((part) => part.type === "tool-call").arguments).toBe('{"query":"Convex"}');
  expect(parts.find((part) => part.type === "tool-call").state).toBe("complete");
  expect(parts.find((part) => part.type === "text").content).toBe("Found Convex.");
});

test("a retry's new stream can emit a replacement answer instead of dropping its text", async () => {
  const mock = mockClient({
    streamId: "attempt-1",
    status: "inProgress",
    text: "Partial first attempt",
    error: null,
    tools: [],
  });
  const connection = createConvexChatConnection(mock.client);
  const processor = new StreamProcessor();
  for await (const chunk of connection.connect([{ role: "user", content: "Research" }], {})) {
    processor.processChunk(chunk);
    if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta === "Partial first attempt") {
      mock.update({
        streamId: "attempt-2",
        status: "completed",
        text: "Successful retry",
        error: null,
        tools: [],
      });
    }
  }
  const text = processor
    .getMessages()
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "text")
    .map((part) => part.content);
  expect(text).toEqual(["Partial first attempt", "Successful retry"]);
});

test("native tool errors reach the transcript as failed tool calls", async () => {
  const snapshot = readChatStream([
    {
      type: "tool-input-available",
      toolCallId: "tool-1",
      toolName: "readPage",
      input: { url: "https://example.com" },
    },
    { type: "tool-output-error", toolCallId: "tool-1", errorText: "Page could not be read" },
  ]);
  const mock = mockClient({ ...snapshot, status: "completed", error: null });
  const processor = new StreamProcessor();
  for await (const chunk of createConvexChatConnection(mock.client).connect(
    [{ role: "user", content: "Read this page" }],
    {},
  ))
    processor.processChunk(chunk);
  const tool = processor.getMessages()[0].parts.find((part) => part.type === "tool-call");
  expect(tool.state).toBe("error");
});
