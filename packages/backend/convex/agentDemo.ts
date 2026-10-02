import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent, createThread, saveMessage } from "@convex-dev/agent";
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
const resultValidator = v.object({ threadId: v.string(), text: v.string() });
type DemoResult = { threadId: string; text: string };

// Run from the Convex CLI or dashboard. Internal functions keep this demo
// from exposing an unauthenticated, paid model call to the public internet.
export const start = internalMutation({
  args: {},
  returns: vWorkflowId,
  handler: async (ctx): Promise<WorkflowId> => {
    if (!env.OPENCODE_API_KEY) {
      throw new Error("Set OPENCODE_API_KEY in the Convex deployment environment first.");
    }
    return workflow.start(ctx, internal.agentDemo.whoAreYou, {});
  },
});

export const whoAreYou = workflow
  .define({ args: {}, returns: resultValidator })
  .handler(async (step): Promise<DemoResult> => {
    const { threadId, promptMessageId } = await step.runMutation(
      internal.agentDemo.prepareThread,
      {},
    );
    const text = await step.runAction(
      internal.agentDemo.generateReply,
      { threadId, promptMessageId },
      {
        name: "Introduce the agent",
        retry: { maxAttempts: 3, initialBackoffMs: 1_000, base: 2 },
      },
    );
    return { threadId, text };
  });

export const prepareThread = internalMutation({
  args: {},
  returns: v.object({ threadId: v.string(), promptMessageId: v.string() }),
  handler: async (ctx): Promise<{ threadId: string; promptMessageId: string }> => {
    const threadId = await createThread(ctx, components.agent, {
      title: "Who are you?",
    });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: "who are you",
    });
    return { threadId, promptMessageId: messageId };
  },
});

export const generateReply = internalAction({
  args: { threadId: v.string(), promptMessageId: v.string() },
  returns: v.string(),
  handler: async (ctx, { threadId, promptMessageId }): Promise<string> => {
    if (!env.OPENCODE_API_KEY) {
      throw new Error("Set OPENCODE_API_KEY in the Convex deployment environment first.");
    }
    const opencode = createOpenAICompatible({
      name: "opencode",
      baseURL: "https://opencode.ai/zen/v1",
      apiKey: env.OPENCODE_API_KEY,
    });
    const agent = new Agent(components.agent, {
      name: "Pursor",
      languageModel: opencode.chatModel("deepseek-v4.1-flash"),
      instructions:
        "You are Pursor, a helpful AI assistant powered by DeepSeek V4.1 Flash through OpenCode Zen. Introduce yourself briefly when asked who you are.",
    });
    // Reuse the saved prompt on retries instead of adding another user message.
    const result = await agent.generateText(ctx, { threadId }, { promptMessageId, maxRetries: 0 });
    return result.text;
  },
});

export const status = internalQuery({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, { workflowId }): Promise<WorkflowStatus> => {
    return workflow.status(ctx, workflowId);
  },
});
