import {
  createThread,
  listMessages,
  listStreams,
  saveMessage,
  syncStreams,
} from "@convex-dev/agent";
import type { UIMessageChunk } from "ai";
import { WorkflowManager, vWorkflowId, type WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { readChatStream, type ChatToolProgress } from "./lib/chatStream";

const workflow = new WorkflowManager(components.workflow);

export const send = mutation({
  args: { sessionId: v.optional(v.id("chatSessions")), prompt: v.string() },
  returns: v.object({ sessionId: v.id("chatSessions"), workflowId: vWorkflowId }),
  handler: async (
    ctx,
    args,
  ): Promise<{ sessionId: Id<"chatSessions">; workflowId: WorkflowId }> => {
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
    const workflowId = await workflow.start(ctx, internal.chat.reply, {
      threadId: session.threadId,
      promptMessageId: messageId,
    });
    await ctx.db.patch(sessionId, { workflowId, promptOrder: message.order });
    return { sessionId, workflowId };
  },
});

export const reply = workflow
  .define({
    args: { threadId: v.string(), promptMessageId: v.string() },
    returns: v.string(),
  })
  .handler(async (step, args): Promise<string> => {
    return await step.runAction(internal.contextAgent.generateReply, args, {
      retry: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
    });
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
