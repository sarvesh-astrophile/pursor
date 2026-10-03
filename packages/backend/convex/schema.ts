import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chatSessions: defineTable({
    ownerId: v.string(),
    threadId: v.string(),
    workflowId: v.optional(v.string()),
    promptOrder: v.optional(v.number()),
  }),
});
