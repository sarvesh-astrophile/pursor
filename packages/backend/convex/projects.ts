import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import schema from "./schema";

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new Error("Enter a project name.");
    }

    return await ctx.db.insert("projects", {
      name,
      ownerId: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const get = query({
  args: {},
  returns: v.array(schema.doc("projects")),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    return await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
  },
});

export const getById = query({
  args: { id: v.id("projects") },
  returns: schema.doc("projects"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const { id } = args;
    const project = await ctx.db.get("projects", id);
    if (!project) {
      throw new Error("Project not found.");
    }
    if (project.ownerId !== user._id) {
      throw new Error("Project not found.");
    }
    return project;
  },
});

export const rename = mutation({
  args: { id: v.id("projects"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const { id, name } = args;
    const project = await ctx.db.get("projects", id);
    if (!project) {
      throw new Error("Project not found.");
    }
    if (project.ownerId !== user._id) {
      throw new Error("Project not found.");
    }
    await ctx.db.patch("projects", id, { name: name, updatedAt: Date.now() });
  },
});

export const getPartial = query({
  args: { limit: v.number() },
  returns: v.array(schema.doc("projects")),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const { limit } = args;
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Limit must be a positive integer.");
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(limit);
  },
});
