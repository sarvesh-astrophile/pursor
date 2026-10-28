import { cleanup, renderHook } from "@testing-library/react";
import type { OptimisticLocalStore } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { api } from "@pursor/backend/convex/_generated/api";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCreateFile, useCreateFolder, useDeleteFile, useRenameFile } from "./use-files";
import { isOptimisticFile } from "./file-optimistic-updates";

const state = vi.hoisted(() => ({ withOptimisticUpdate: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: () => ({ withOptimisticUpdate: state.withOptimisticUpdate }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const projectId = "project" as Id<"projects">;
const otherProjectId = "other-project" as Id<"projects">;
function file(
  id: string,
  name: string,
  type: "file" | "folder" = "file",
  parentId?: Id<"files">,
): Doc<"files"> {
  return {
    _id: id as Id<"files">,
    _creationTime: 1,
    updatedAt: 1,
    projectId,
    parentId,
    name,
    type,
  };
}

type CachedFolder = {
  args: FunctionArgs<typeof api.files.getFolderContents>;
  value: Doc<"files">[] | undefined;
};
function cachedStore(queries: CachedFolder[]) {
  const store: OptimisticLocalStore = {
    getQuery: vi.fn(),
    getAllQueries: vi.fn(() => queries) as OptimisticLocalStore["getAllQueries"],
    setQuery: vi.fn(),
  };
  return store;
}

test.each([
  { type: "file" as const, hook: useCreateFile },
  { type: "folder" as const, hook: useCreateFolder },
])(
  "optimistic $type creation updates only the matching loaded folder and preserves sorting",
  ({ type, hook }) => {
    renderHook(hook);
    const update = state.withOptimisticUpdate.mock.calls[0][0] as (
      store: OptimisticLocalStore,
      args: FunctionArgs<typeof api.files.createFile>,
    ) => void;
    const folder = file("folder", "z-folder", "folder");
    const existing = file("existing", "z-file");
    const root = [folder, existing];
    const queries: CachedFolder[] = [
      { args: { projectId }, value: root },
      { args: { projectId, parentId: folder._id }, value: [] },
      { args: { projectId: otherProjectId }, value: [] },
      { args: { projectId, parentId: "loading" as Id<"files"> }, value: undefined },
    ];
    const store = cachedStore(queries);
    update(store, { projectId, name: "a-new", content: "hello" });

    expect(store.setQuery).toHaveBeenCalledTimes(1);
    const result = vi.mocked(store.setQuery).mock.calls[0][2] as Doc<"files">[];
    const created = result.find((item) => item.name === "a-new")!;
    expect(isOptimisticFile(created._id)).toBe(true);
    expect(created).toMatchObject({
      projectId,
      name: "a-new",
      type,
      updatedAt: expect.any(Number),
    });
    if (type === "file") expect(created.content).toBe("hello");
    expect(result.map((item) => item.name)).toEqual(
      type === "file" ? ["z-folder", "a-new", "z-file"] : ["a-new", "z-folder", "z-file"],
    );
    expect(root).toEqual([folder, existing]);
    update(store, { projectId, name: "a-new", content: "hello" });
    const replay = vi.mocked(store.setQuery).mock.calls[1][2] as Doc<"files">[];
    expect(replay.find((item) => item.name === "a-new")?._id).toBe(created._id);
  },
);

test("creation handles nested folders, does not populate unloaded queries, and avoids duplicates", () => {
  renderHook(useCreateFile);
  const update = state.withOptimisticUpdate.mock.calls[0][0] as (
    store: OptimisticLocalStore,
    args: FunctionArgs<typeof api.files.createFile>,
  ) => void;
  const parentId = "folder" as Id<"files">;
  const nestedArgs = { projectId, parentId };
  const store = cachedStore([
    { args: { projectId }, value: [] },
    { args: nestedArgs, value: [] },
  ]);
  const args = { ...nestedArgs, name: "child", content: "" };
  update(store, args);
  expect(store.setQuery).toHaveBeenCalledWith(api.files.getFolderContents, nestedArgs, [
    expect.objectContaining({ name: "child", parentId }),
  ]);

  const unloaded = cachedStore([{ args: nestedArgs, value: undefined }]);
  update(unloaded, args);
  expect(unloaded.setQuery).not.toHaveBeenCalled();
  const duplicate = cachedStore([
    { args: nestedArgs, value: [file("existing", "child", "file", parentId)] },
  ]);
  update(duplicate, args);
  expect(duplicate.setQuery).not.toHaveBeenCalled();
});

test("rename updates all cached occurrences, re-sorts, and leaves original documents untouched", () => {
  renderHook(useRenameFile);
  const update = state.withOptimisticUpdate.mock.calls[0][0] as (
    store: OptimisticLocalStore,
    args: FunctionArgs<typeof api.files.renameFile>,
  ) => void;
  const folder = file("folder", "folder", "folder");
  const first = file("first", "a.ts");
  const target = file("target", "z.ts");
  const root = [folder, first, target];
  const store = cachedStore([
    { args: { projectId }, value: root },
    { args: { projectId, parentId: folder._id }, value: [] },
    { args: { projectId: otherProjectId }, value: [] },
  ]);
  update(store, { id: target._id, newName: "0.ts" });
  expect(store.setQuery).toHaveBeenCalledExactlyOnceWith(
    api.files.getFolderContents,
    { projectId },
    [folder, { ...target, name: "0.ts", updatedAt: expect.any(Number) }, first],
  );
  expect(root).toEqual([folder, first, target]);
  expect(target.name).toBe("z.ts");
});

test("folder deletion clears known descendants regardless of query order without changing unrelated caches", () => {
  renderHook(useDeleteFile);
  const update = state.withOptimisticUpdate.mock.calls[0][0] as (
    store: OptimisticLocalStore,
    args: FunctionArgs<typeof api.files.deleteFile>,
  ) => void;
  const target = file("target", "src", "folder");
  const child = file("child", "nested", "folder", target._id);
  const grandchild = file("grandchild", "deep", "folder", child._id);
  const leaf = file("leaf", "index.ts", "file", grandchild._id);
  const sibling = file("sibling", "README.md");
  const queries: CachedFolder[] = [
    { args: { projectId, parentId: grandchild._id }, value: [leaf] },
    { args: { projectId, parentId: child._id }, value: [grandchild] },
    { args: { projectId, parentId: target._id }, value: [child] },
    { args: { projectId }, value: [target, sibling] },
    { args: { projectId: otherProjectId }, value: [] },
    { args: { projectId, parentId: "loading" as Id<"files"> }, value: undefined },
  ];
  const store = cachedStore(queries);
  update(store, { id: target._id });
  for (const parentId of [target._id, child._id, grandchild._id]) {
    expect(store.setQuery).toHaveBeenCalledWith(
      api.files.getFolderContents,
      { projectId, parentId },
      [],
    );
  }
  expect(store.setQuery).toHaveBeenCalledWith(api.files.getFolderContents, { projectId }, [
    sibling,
  ]);
  expect(store.setQuery).toHaveBeenCalledTimes(4);
  // Convex owns rollback; the cached source values must remain intact.
  expect(queries[0].value).toEqual([leaf]);
  expect(queries[3].value).toEqual([target, sibling]);
});

test("file deletion removes only the target item", () => {
  renderHook(useDeleteFile);
  const update = state.withOptimisticUpdate.mock.calls[0][0] as (
    store: OptimisticLocalStore,
    args: FunctionArgs<typeof api.files.deleteFile>,
  ) => void;
  const target = file("target", "index.ts");
  const sibling = file("sibling", "README.md");
  const store = cachedStore([{ args: { projectId }, value: [target, sibling] }]);
  update(store, { id: target._id });
  expect(store.setQuery).toHaveBeenCalledExactlyOnceWith(
    api.files.getFolderContents,
    { projectId },
    [sibling],
  );
});
