import { createThread, saveMessage } from "@convex-dev/agent";
import {
  WorkflowManager,
  vWorkflowId,
  type WorkflowId,
  type WorkflowStatus,
} from "@convex-dev/workflow";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";

const workflow = new WorkflowManager(components.workflow);
type ResearchResult = { threadId: string; text: string };

function requireKeys() {
  if (!env.OPENCODE_API_KEY) {
    throw new Error("Set OPENCODE_API_KEY in the Convex deployment environment first.");
  }
  if (!env.CONTEXT_DEV_API_KEY) {
    throw new Error("Set CONTEXT_DEV_API_KEY in the Convex deployment environment first.");
  }
  return env.OPENCODE_API_KEY;
}

export const start = internalMutation({
  args: { prompt: v.string() },
  returns: vWorkflowId,
  handler: async (ctx, { prompt }): Promise<WorkflowId> => {
    requireKeys();
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length > 8_000) {
      throw new Error("Prompt must contain between 1 and 8000 characters.");
    }
    return workflow.start(ctx, internal.contextAgent.research, { prompt: trimmed });
  },
});

export const research = workflow
  .define({
    args: { prompt: v.string() },
    returns: v.object({ threadId: v.string(), text: v.string() }),
  })
  .handler(async (step, { prompt }): Promise<ResearchResult> => {
    const prepared = await step.runMutation(internal.contextAgent.prepareThread, { prompt });
    const text = await step.runAction(internal.contextAgent.generateReply, prepared, {
      name: "Research with Context.dev",
      retry: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
    });
    return { threadId: prepared.threadId, text };
  });

export const prepareThread = internalMutation({
  args: { prompt: v.string() },
  returns: v.object({ threadId: v.string(), promptMessageId: v.string() }),
  handler: async (ctx, { prompt }): Promise<{ threadId: string; promptMessageId: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      title: prompt.slice(0, 100),
    });
    const { messageId } = await saveMessage(ctx, components.agent, { threadId, prompt });
    return { threadId, promptMessageId: messageId };
  },
});

export const generateReply = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    turnId: v.optional(v.id("researchTurns")),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    return await ctx.runAction(internal.researchGeneration.generateReply, args);
  },
});

export const status = internalQuery({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, { workflowId }): Promise<WorkflowStatus> => {
    return workflow.status(ctx, workflowId);
  },
});
