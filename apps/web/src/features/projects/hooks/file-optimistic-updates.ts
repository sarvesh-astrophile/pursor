import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "@pursor/backend/convex/_generated/api";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";

const TEMPORARY_ID_PREFIX = "optimistic:";

export const isOptimisticFile = (id: Id<"files">) => id.startsWith(TEMPORARY_ID_PREFIX);

function sortFolderContents(files: Doc<"files">[]) {
  return files.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function optimisticallyCreateFile(
  store: OptimisticLocalStore,
  args: FunctionArgs<typeof api.files.createFolder> & { content?: string },
  type: "file" | "folder",
) {
  const now = Date.now();
  const item: Doc<"files"> = {
    ...args,
    type,
    // Convex replays optimistic updates as query data changes. Use the unique
    // sibling key so a pending row keeps its identity across those replays.
    _id: `${TEMPORARY_ID_PREFIX}${JSON.stringify([args.projectId, args.parentId ?? null, type, args.name])}` as Id<"files">,
    _creationTime: now,
    updatedAt: now,
  };

  for (const { args: queryArgs, value } of store.getAllQueries(api.files.getFolderContents)) {
    if (
      value === undefined ||
      queryArgs.projectId !== args.projectId ||
      queryArgs.parentId !== args.parentId ||
      value.some((file) => file.type === type && file.name === args.name)
    )
      continue;

    store.setQuery(api.files.getFolderContents, queryArgs, sortFolderContents([...value, item]));
  }
}

export function optimisticallyRenameFile(
  store: OptimisticLocalStore,
  { id, newName }: FunctionArgs<typeof api.files.renameFile>,
) {
  const updatedAt = Date.now();
  for (const { args, value } of store.getAllQueries(api.files.getFolderContents)) {
    if (!value?.some((file) => file._id === id)) continue;
    const renamed = value.map((file) =>
      file._id === id ? { ...file, name: newName, updatedAt } : file,
    );
    store.setQuery(api.files.getFolderContents, args, sortFolderContents(renamed));
  }
}

export function optimisticallyDeleteFile(
  store: OptimisticLocalStore,
  { id }: FunctionArgs<typeof api.files.deleteFile>,
) {
  const queries = store.getAllQueries(api.files.getFolderContents);
  const removed = new Set<Id<"files">>([id]);

  // Cached queries may arrive in any order. Discover every known descendant
  // before filtering so reopening a deleted folder cannot reveal stale children.
  let previousSize;
  do {
    previousSize = removed.size;
    for (const { args, value } of queries) {
      if (args.parentId && removed.has(args.parentId)) {
        for (const file of value ?? []) removed.add(file._id);
      }
    }
  } while (removed.size !== previousSize);

  for (const { args, value } of queries) {
    if (value === undefined) continue;
    const remaining =
      args.parentId && removed.has(args.parentId)
        ? []
        : value.filter((file) => !removed.has(file._id));
    if (remaining.length !== value.length) {
      store.setQuery(api.files.getFolderContents, args, remaining);
    }
  }
}
