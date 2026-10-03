import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chatSessions: defineTable({
    ownerId: v.string(),
    threadId: v.string(),
    workflowId: v.optional(v.string()),
    promptOrder: v.optional(v.number()),
  }),
  researchTurns: defineTable({
    ownerId: v.string(),
    sessionId: v.id("chatSessions"),
    threadId: v.string(),
    promptMessageId: v.string(),
    workflowId: v.optional(v.string()),
    traceId: v.string(),
    rootSpanId: v.string(),
    attempts: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled"),
    ),
    finishedAt: v.optional(v.number()),
  }),
});
