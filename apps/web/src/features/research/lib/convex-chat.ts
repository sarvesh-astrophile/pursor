import { api } from "@pursor/backend/convex/_generated/api";
import type { Id } from "@pursor/backend/convex/_generated/dataModel";
import { EventType, type StreamChunk } from "@tanstack/ai/client";
import type { ConnectConnectionAdapter } from "@tanstack/ai-react";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { captureBrowserException, captureResearchEvent } from "@/app/analytics/posthog";

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
      const submittedAt = Date.now();
      let started: FunctionReturnType<typeof api.chat.send>;
      try {
        started = await client.mutation(api.chat.send, { sessionId, prompt });
      } catch (error) {
        captureBrowserException(error, { category: "chat_submission", session_id: sessionId });
        throw error;
      }
      sessionId = started.sessionId;
      const threadId = runContext?.threadId ?? sessionId;
      const runId = runContext?.runId ?? crypto.randomUUID();
      let messageId = crypto.randomUUID();
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
      const inputs = new Map<string, string>();
      const inputsComplete = new Set<string>();
      let emittedText = "";
      let textStarted = false;
      let streamId: string | null = null;
      let firstTextVisible = false;
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
          if (progress.streamId && progress.streamId !== streamId) {
            if (textStarted) {
              yield { type: EventType.TEXT_MESSAGE_END, messageId };
              messageId = crypto.randomUUID();
              textStarted = false;
              emittedText = "";
            }
            streamId = progress.streamId;
          }
          for (const tool of progress.tools) {
            if (!called.has(tool.id)) {
              called.add(tool.id);
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId: tool.id,
                toolCallName: tool.name,
                parentMessageId: messageId,
              };
            }
            const previousInput = inputs.get(tool.id) ?? "";
            if (tool.input.startsWith(previousInput) && tool.input.length > previousInput.length) {
              yield {
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: tool.id,
                delta: tool.input.slice(previousInput.length),
              };
              inputs.set(tool.id, tool.input);
            }
            if (tool.inputComplete !== false && !inputsComplete.has(tool.id)) {
              inputsComplete.add(tool.id);
              let input: unknown;
              try {
                input = JSON.parse(tool.input);
              } catch {
                input = tool.input;
              }
              yield { type: EventType.TOOL_CALL_END, toolCallId: tool.id, input };
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
          const text = progress.text ?? "";
          if (text.startsWith(emittedText) && text.length > emittedText.length) {
            if (!firstTextVisible) {
              firstTextVisible = true;
              captureResearchEvent("research_reply_first_visible", {
                session_id: sessionId,
                workflow_id: started.workflowId,
                turn_id: started.turnId,
                conversation_id: started.threadId,
                latency_ms: Date.now() - submittedAt,
              });
            }
            if (!textStarted) {
              yield { type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" };
              textStarted = true;
            }
            yield {
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta: text.slice(emittedText.length),
            };
            emittedText = text;
          }
          if (progress.status === "failed" || progress.status === "canceled") {
            throw new Error(progress.error ?? "Research was canceled.");
          }
          if (progress.status === "completed") {
            if (textStarted) yield { type: EventType.TEXT_MESSAGE_END, messageId };
            yield { type: EventType.RUN_FINISHED, threadId, runId };
            return;
          }
        }
      } catch (error) {
        captureBrowserException(error, {
          category: "chat_subscription",
          session_id: sessionId,
          workflow_id: started.workflowId,
          turn_id: started.turnId,
        });
        throw error;
      } finally {
        unsubscribe();
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
