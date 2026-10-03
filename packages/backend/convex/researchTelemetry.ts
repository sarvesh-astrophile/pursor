import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const beginAttempt = internalMutation({
  args: { turnId: v.id("researchTurns"), threadId: v.string(), promptMessageId: v.string() },
  handler: async (ctx, { turnId, threadId, promptMessageId }): Promise<Doc<"researchTurns">> => {
    const turn = await ctx.db.get(turnId);
    if (!turn || turn.status !== "running") throw new Error("Research turn is not running.");
    if (turn.threadId !== threadId || turn.promptMessageId !== promptMessageId)
      throw new Error("Research turn does not match this prompt.");
    const attempts = turn.attempts + 1;
    await ctx.db.patch(turnId, { attempts });
    return { ...turn, attempts };
  },
});

export const getTurn = internalQuery({
  args: { turnId: v.id("researchTurns") },
  handler: async (ctx, { turnId }): Promise<Doc<"researchTurns"> | null> => ctx.db.get(turnId),
});
