import { expect, test, spyOn } from "bun:test";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { streamText, stepCountIs, tool } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { z } from "zod";

import { createAttemptTelemetry, finishTurnTrace } from "../convex/lib/aiTelemetry";

function collector() {
  const spans = [];
  return {
    spans,
    processor: () =>
      new SimpleSpanProcessor({
        export: (batch, callback) => {
          spans.push(...batch);
          callback({ code: 0 });
        },
        shutdown: async () => {},
      }),
  };
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
function stream(chunks, reason = "stop") {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start", warnings: [] },
        ...chunks,
        { type: "finish", finishReason: { unified: reason, raw: reason }, usage },
      ],
      chunkDelayInMs: null,
      initialDelayInMs: null,
    }),
  };
}

test("AI SDK 7 streams model and tool spans under the durable turn's trace", async () => {
  const output = collector();
  const config = {
    token: "local-test",
    traceId: "1".repeat(32),
    rootSpanId: "2".repeat(16),
    attributes: { "posthog.distinct_id": "user-1", $ai_session_id: "thread-1", turn_id: "turn-1" },
  };
  const telemetry = createAttemptTelemetry({ ...config, processor: output.processor() });
  const model = new MockLanguageModelV4({
    doStream: [
      stream(
        [
          {
            type: "tool-call",
            toolCallId: "search-1",
            toolName: "searchWeb",
            input: '{"query":"Convex"}',
          },
        ],
        "tool-calls",
      ),
      stream([
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Found sources." },
        { type: "text-end", id: "text-1" },
      ]),
    ],
  });
  const text = await telemetry.run(async () => {
    const result = streamText({
      model,
      prompt: "Research",
      tools: {
        searchWeb: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => "source",
        }),
      },
      stopWhen: stepCountIs(3),
      telemetry: {
        recordInputs: false,
        recordOutputs: false,
        integrations: [telemetry.integration],
      },
    });
    return await result.text;
  });
  await telemetry.finish();
  const startedAt = Date.now() - 1_000;
  await finishTurnTrace({ ...config, processor: output.processor() }, startedAt, Date.now(), false);
  expect(text).toBe("Found sources.");
  const attempt = output.spans.find((span) => span.name === "ai.research_attempt");
  const root = output.spans.find((span) => span.name === "ai.research_turn");
  expect(root.spanContext().spanId).toBe(config.rootSpanId);
  expect(attempt.parentSpanContext.spanId).toBe(config.rootSpanId);
  expect(output.spans.every((span) => span.spanContext().traceId === config.traceId)).toBe(true);
  const generations = output.spans.filter(
    (span) => span.attributes["gen_ai.operation.name"] === "chat",
  );
  expect(generations).toHaveLength(2);
  expect(generations[0].attributes["gen_ai.usage.input_tokens"]).toBe(10);
  expect(output.spans.some((span) => span.attributes["gen_ai.tool.name"] === "searchWeb")).toBe(
    true,
  );
  expect(output.spans.every((span) => span.attributes["posthog.distinct_id"] === "user-1")).toBe(
    true,
  );
  expect(
    output.spans.every(
      (span) =>
        !span.attributes["gen_ai.input.messages"] && !span.attributes["gen_ai.output.messages"],
    ),
  ).toBe(true);
});

test("retry attempts use different span IDs with the same parent trace", async () => {
  const output = collector();
  const config = {
    token: "local-test",
    traceId: "3".repeat(32),
    rootSpanId: "4".repeat(16),
    attributes: {},
  };
  for (let index = 0; index < 2; index++) {
    const attempt = createAttemptTelemetry({ ...config, processor: output.processor() });
    await attempt.run(async () => {});
    await attempt.finish(index === 0 ? new Error("Provider failed") : undefined);
  }
  expect(new Set(output.spans.map((span) => span.spanContext().spanId)).size).toBe(2);
  expect(output.spans.every((span) => span.parentSpanContext.spanId === config.rootSpanId)).toBe(
    true,
  );
  expect(output.spans.map((span) => span.status.code)).toEqual([2, 1]);
});

test("telemetry failures do not reject a successful generation", async () => {
  const warning = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const processor = {
      onStart() {},
      onEnd() {},
      forceFlush: async () => {
        throw new Error("Collector offline");
      },
      shutdown: async () => {},
    };
    const telemetry = createAttemptTelemetry({ token: "local-test", attributes: {}, processor });
    expect(await telemetry.run(async () => "Successful answer")).toBe("Successful answer");
    await expect(telemetry.finish()).resolves.toBeUndefined();
    expect(createAttemptTelemetry({ token: "", attributes: {} })).toBeUndefined();
    expect(warning).toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});

test("the real PostHog exporter flushes its OTLP request before completion", async () => {
  const requests = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        bytes: (await request.arrayBuffer()).byteLength,
      });
      return new Response(null, {
        status: 200,
        headers: { "content-type": "application/x-protobuf" },
      });
    },
  });
  try {
    const telemetry = createAttemptTelemetry({
      token: "local-test",
      host: `http://127.0.0.1:${server.port}`,
      attributes: { "posthog.distinct_id": "user-1" },
    });
    await telemetry.run(async () => "Answer");
    await telemetry.finish();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      path: "/i/v0/ai/otel",
      authorization: "Bearer local-test",
    });
    expect(requests[0].bytes).toBeGreaterThan(0);
  } finally {
    server.stop(true);
  }
});
