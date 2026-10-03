import { api } from "@pursor/backend/convex/_generated/api";
import type { Id } from "@pursor/backend/convex/_generated/dataModel";
import { EventType, type StreamChunk } from "@tanstack/ai/client";
import type { ConnectConnectionAdapter } from "@tanstack/ai-react";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";

type Progress = FunctionReturnType<typeof api.chat.progress>;

export function createConvexChatConnection(client: ConvexReactClient): ConnectConnectionAdapter {
  let sessionId: Id<"chatSessions"> | undefined;
  return {
    async *connect(messages, _data, signal, runContext): AsyncGenerator<StreamChunk> {
      const latest = [...messages].reverse().find((message) => message.role === "user");
      const prompt =
        latest && "parts" in latest
          ? latest.parts
              .filter((part) => part.type === "text")
              .map((part) => part.content)
              .join("\n")
          : latest && typeof latest.content === "string"
            ? latest.content
            : "";
      if (!prompt || signal?.aborted) return;
      const started = await client.mutation(api.chat.send, { sessionId, prompt });
      sessionId = started.sessionId;
      const threadId = runContext?.threadId ?? sessionId;
      const runId = runContext?.runId ?? crypto.randomUUID();
      const messageId = crypto.randomUUID();
      yield { type: EventType.RUN_STARTED, threadId, runId };

      const queue: (Progress | Error)[] = [];
      let wake: (() => void) | undefined;
      const watched = client.watchQuery(api.chat.progress, { sessionId });
      const notify = () => {
        try {
          const value = watched.localQueryResult();
          if (value) queue.push(value);
        } catch (error) {
          queue.push(error instanceof Error ? error : new Error(String(error)));
        }
        wake?.();
      };
      const unsubscribe = watched.onUpdate(notify);
      const onAbort = () => wake?.();
      signal?.addEventListener("abort", onAbort);
      notify();
      const called = new Set<string>();
      const completed = new Set<string>();
      try {
        while (!signal?.aborted) {
          const progress = queue.shift();
          if (!progress) {
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
            wake = undefined;
            continue;
          }
          if (progress instanceof Error) throw progress;
          // A cached subscription snapshot may still describe the preceding turn.
          if (progress.workflowId !== started.workflowId) continue;
          for (const tool of progress.tools) {
            if (!called.has(tool.id)) {
              called.add(tool.id);
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId: tool.id,
                toolCallName: tool.name,
                parentMessageId: messageId,
              };
              yield { type: EventType.TOOL_CALL_ARGS, toolCallId: tool.id, delta: tool.input };
              yield { type: EventType.TOOL_CALL_END, toolCallId: tool.id };
            }
            if (tool.output !== null && !completed.has(tool.id)) {
              completed.add(tool.id);
              yield {
                type: EventType.TOOL_CALL_RESULT,
                toolCallId: tool.id,
                messageId: `${tool.id}-result`,
                role: "tool",
                content: tool.output,
                metadata: tool.error ? { tanstack: { state: "output-error" } } : undefined,
              };
            }
          }
          if (progress.status === "failed" || progress.status === "canceled") {
            throw new Error(progress.error ?? "Research was canceled.");
          }
          if (progress.status === "completed") {
            yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" };
            yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: progress.text ?? "" };
            yield { type: EventType.TEXT_MESSAGE_END, messageId };
            yield { type: EventType.RUN_FINISHED, threadId, runId };
            return;
          }
        }
      } finally {
        unsubscribe();
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
