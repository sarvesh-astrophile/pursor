import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

async function touchProject(ctx: MutationCtx, projectId: Id<"projects">) {
  await ctx.db.patch("projects", projectId, {
    updatedAt: Date.now(),
  });
}

export const getFiles = query({
  args: { projectId: v.id("projects") },
  returns: v.array(schema.doc("files")),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getFile = query({
  args: { projectId: v.id("files") },
  returns: schema.doc("files"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const file = await ctx.db.get("files", args.projectId);
    if (!file) {
      throw new Error("File not Found");
    }

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    return file;
  },
});

export const getFolderContents = query({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
  },
  returns: v.array(schema.doc("files")),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    // sort: folders first, then files alphabetically within each group
    return files.sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const createFile = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
    content: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    // Check if file with same name already exist in parent folder

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existing = files.find((file) => file.name === args.name && file.type === "file");
    if (existing) {
      throw new Error("File with this name already exists");
    }

    const fileId = await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      type: "file",
      content: args.content,
      updatedAt: Date.now(),
    });

    await touchProject(ctx, args.projectId);

    return fileId;
  },
});

export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    parentId: v.optional(v.id("files")),
    name: v.string(),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const project = await ctx.db.get("projects", args.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    // Check if folder with same name already exist in parent folder

    const files = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId).eq("parentId", args.parentId),
      )
      .collect();

    const existing = files.find((file) => file.name === args.name && file.type === "folder");
    if (existing) {
      throw new Error("Folder with this name already exists");
    }

    const folderId = await ctx.db.insert("files", {
      projectId: args.projectId,
      parentId: args.parentId,
      name: args.name,
      type: "folder",
      updatedAt: Date.now(),
    });

    await touchProject(ctx, args.projectId);

    return folderId;
  },
});

export const renameFile = mutation({
  args: {
    id: v.id("files"),
    newName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const file = await ctx.db.get("files", args.id);
    if (!file) throw new Error("File not Found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    // Check if file with same name already exist in parent folder

    const siblings = await ctx.db
      .query("files")
      .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId).eq("parentId", file.parentId),
      )
      .collect();

    const existing = siblings.find(
      (sibling) =>
        sibling.name === args.newName && sibling.type === file.type && sibling._id !== args.id,
    );

    if (existing) {
      throw new Error(`A ${file.type} with this name already exists in this folder`);
    }

    await ctx.db.patch("files", file._id, {
      name: args.newName,
      updatedAt: Date.now(),
    });

    await touchProject(ctx, file.projectId);

    return null;
  },
});

export const deleteFile = mutation({
  args: { id: v.id("files") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const file = await ctx.db.get("files", args.id);
    if (!file) throw new Error("File not Found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    // Recusively delete file/folder and all decendents
    const deleteRecursive = async (fileId: Id<"files">) => {
      const item = await ctx.db.get("files", fileId);
      if (!item) return;

      // if its a folder, we have to delte all children first
      if (item.type === "folder") {
        const children = await ctx.db
          .query("files")
          .withIndex("by_project_parent", (q) =>
            q.eq("projectId", item.projectId).eq("parentId", fileId),
          )
          .collect();
        for (const child of children) {
          await deleteRecursive(child._id);
        }
      }

      // Delete Storage file / binary if exists
      if (item.storageId) {
        await ctx.storage.delete(item.storageId);
      }

      // Delete the file/folder
      await ctx.db.delete("files", fileId);
    };

    await deleteRecursive(args.id);

    await touchProject(ctx, file.projectId);
    return null;
  },
});

export const updateFile = mutation({
  args: {
    id: v.id("files"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const file = await ctx.db.get("files", args.id);
    if (!file) throw new Error("File not Found");

    const project = await ctx.db.get("projects", file.projectId);

    if (!project) {
      throw new Error("Project not Found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Unauthorised to access this project");
    }

    // update file content
    await ctx.db.patch("files", args.id, {
      content: args.content,
      updatedAt: Date.now(),
    });

    await touchProject(ctx, file.projectId);

    return null;
  },
});
