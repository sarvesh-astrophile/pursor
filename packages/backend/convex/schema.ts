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
  projects: defineTable({
    name: v.string(),
    ownerId: v.string(),
    updatedAt: v.optional(v.number()),
    importStatus: v.optional(v.union(v.literal("importing"), v.literal("completed"), v.literal("failed"))),
    exportStatus: v.optional(v.union(v.literal("exporting"), v.literal("completed"), v.literal("failed"), v.literal("canceled"))),
    exportRepoURL: v.optional(v.string()),
  }).index("by_ownerId", ["ownerId"]),
});
