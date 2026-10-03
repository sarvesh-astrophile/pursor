import {
  createThread,
  listMessages,
  listStreams,
  saveMessage,
  syncStreams,
} from "@convex-dev/agent";
import type { UIMessageChunk } from "ai";
import {
  WorkflowManager,
  vWorkflowId,
  vResultValidator,
  type WorkflowId,
} from "@convex-dev/workflow";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, mutation, query, internalMutation } from "./_generated/server";
import { captureEvent } from "./posthog";
import { authComponent } from "./auth";
import { readChatStream, type ChatToolProgress } from "./lib/chatStream";

const workflow = new WorkflowManager(components.workflow);

export const send = mutation({
  args: { sessionId: v.optional(v.id("chatSessions")), prompt: v.string() },
  returns: v.object({
    sessionId: v.id("chatSessions"),
    workflowId: vWorkflowId,
    turnId: v.id("researchTurns"),
    threadId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    sessionId: Id<"chatSessions">;
    workflowId: WorkflowId;
    turnId: Id<"researchTurns">;
    threadId: string;
  }> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!env.OPENCODE_API_KEY || !env.CONTEXT_DEV_API_KEY) {
      throw new Error("Configure OPENCODE_API_KEY and CONTEXT_DEV_API_KEY in Convex to use chat.");
    }
    const prompt = args.prompt.trim();
    if (!prompt || prompt.length > 8_000) throw new Error("Enter 1–8000 characters.");
    let sessionId = args.sessionId;
    if (!sessionId) {
      const threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: prompt.slice(0, 100),
      });
      sessionId = await ctx.db.insert("chatSessions", { ownerId: user._id, threadId });
    }
    const session = await ctx.db.get(sessionId);
    if (!session || session.ownerId !== user._id) throw new Error("Chat not found.");
    if (session.workflowId) {
      const state = await workflow.status(ctx, session.workflowId as WorkflowId);
      if (state.type === "inProgress") throw new Error("Wait for the current reply to finish.");
    }
    const { messageId, message } = await saveMessage(ctx, components.agent, {
      threadId: session.threadId,
      prompt,
    });
    // Convex seeds Math.random deterministically for transaction retries.
    const hex = (length: number) =>
      Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const turnId = await ctx.db.insert("researchTurns", {
      ownerId: user._id,
      sessionId,
      threadId: session.threadId,
      promptMessageId: messageId,
      traceId: hex(32),
      rootSpanId: hex(16),
      attempts: 0,
      status: "running",
    });
    const workflowId = await workflow.start(
      ctx,
      internal.chat.reply,
      {
        threadId: session.threadId,
        promptMessageId: messageId,
        turnId,
      },
      { startAsync: true, onComplete: internal.chat.complete, context: { turnId } },
    );
    await ctx.db.patch(turnId, { workflowId });
    await ctx.db.patch(sessionId, { workflowId, promptOrder: message.order });
    await captureEvent(ctx, user._id, "research_turn_started", {
      session_id: sessionId,
      conversation_id: session.threadId,
      turn_id: turnId,
      workflow_id: workflowId,
      prompt_length: prompt.length,
      is_follow_up: !!args.sessionId,
    });
    return { sessionId, workflowId, turnId, threadId: session.threadId };
  },
});

export const reply = workflow
  .define({
    args: {
      threadId: v.string(),
      promptMessageId: v.string(),
      turnId: v.optional(v.id("researchTurns")),
    },
    returns: v.string(),
  })
  .handler(async (step, args): Promise<string> => {
    return await step.runAction(internal.contextAgent.generateReply, args, {
      retry: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
    });
  });

export const complete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ turnId: v.id("researchTurns") }),
  },
  returns: v.null(),
  handler: async (ctx, { workflowId, result, context }) => {
    const turn = await ctx.db.get(context.turnId);
    if (!turn || turn.workflowId !== workflowId || turn.status !== "running") return null;
    const status =
      result.kind === "success" ? "completed" : result.kind === "failed" ? "failed" : "canceled";
    const finishedAt = Date.now();
    await ctx.db.patch(turn._id, { status, finishedAt });
    await captureEvent(
      ctx,
      turn.ownerId,
      status === "completed"
        ? "research_turn_completed"
        : status === "failed"
          ? "research_turn_failed"
          : "research_turn_canceled",
      {
        session_id: turn.sessionId,
        conversation_id: turn.threadId,
        turn_id: turn._id,
        workflow_id: workflowId,
        attempts: turn.attempts,
        duration_ms: finishedAt - turn._creationTime,
        status,
      },
    );
    if (env.POSTHOG_PROJECT_TOKEN) {
      try {
        await ctx.scheduler.runAfter(0, internal.researchGeneration.finishTrace, {
          turnId: turn._id,
        });
      } catch (error) {
        console.warn("PostHog turn trace scheduling failed", error);
      }
    }
    return null;
  },
});

export const progress = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, { sessionId }) => {
    const user = await authComponent.getAuthUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.ownerId !== user._id || !session.workflowId) {
      throw new Error("Chat not found.");
    }
    const state = await workflow.status(ctx, session.workflowId as WorkflowId);
    const messages = await listMessages(ctx, components.agent, {
      threadId: session.threadId,
      paginationOpts: { cursor: null, numItems: 100 },
    });
    const tools: ChatToolProgress[] = [];
    const current = messages.page
      .filter((doc) => doc.order === session.promptOrder)
      .sort((a, b) => a.stepOrder - b.stepOrder);
    for (const doc of current) {
      if (!doc.message || typeof doc.message.content === "string") continue;
      for (const part of doc.message.content) {
        if (part.type === "tool-call") {
          tools.push({
            id: part.toolCallId,
            name: part.toolName,
            input: JSON.stringify(part.input),
            inputComplete: true,
            output: null,
            error: false,
          });
        } else if (part.type === "tool-result") {
          const tool = tools.find((item) => item.id === part.toolCallId);
          if (tool && part.output) {
            const output = part.output;
            const value = "value" in output ? output.value : output;
            tool.output = typeof value === "string" ? value : JSON.stringify(value);
            tool.error =
              output.type === "error-text" ||
              output.type === "error-json" ||
              output.type === "execution-denied";
          }
        }
      }
    }
    const streams = await listStreams(ctx, components.agent, {
      threadId: session.threadId,
      startOrder: session.promptOrder,
      includeStatuses: ["streaming", "finished", "aborted"],
    });
    // Retries may create another stream for this prompt. Show the latest attempt.
    const currentStreams = streams
      .filter((item) => item.order === session.promptOrder)
      .sort((a, b) => a.stepOrder - b.stepOrder);
    const stream = currentStreams[currentStreams.length - 1];
    const synced = stream
      ? await syncStreams(ctx, components.agent, {
          threadId: session.threadId,
          streamArgs: { kind: "deltas", cursors: [{ streamId: stream.streamId, cursor: 0 }] },
        })
      : undefined;
    const parts =
      synced?.kind === "deltas"
        ? ([...synced.deltas]
            .sort((a, b) => a.start - b.start)
            .flatMap((delta) => delta.parts) as UIMessageChunk[])
        : [];
    const live = readChatStream(parts);
    const merged = new Map(tools.map((tool) => [tool.id, tool]));
    for (const tool of live.tools) merged.set(tool.id, tool);
    return {
      workflowId: session.workflowId,
      streamId: stream?.streamId ?? null,
      status: state.type,
      text: live.text || (state.type === "completed" ? String(state.result) : ""),
      error: state.type === "failed" ? state.error : null,
      tools: [...merged.values()],
    };
  },
});
