import { expect, test } from "bun:test";
import { StreamProcessor } from "@tanstack/ai/client";

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
