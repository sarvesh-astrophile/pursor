import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "@pursor/backend/convex/_generated/api";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName } from "convex/server";

const state = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  useQuery: vi.fn(),
  withOptimisticUpdate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => state.auth,
  useQuery: state.useQuery,
  useMutation: () => ({ withOptimisticUpdate: state.withOptimisticUpdate }),
}));

import {
  useCreateProject,
  useProjects,
  useProjectsPartial,
  useRenameProject,
} from "./use-projects";

beforeEach(() => {
  state.auth = { isLoading: true, isAuthenticated: false };
  state.useQuery.mockReset();
  state.withOptimisticUpdate.mockReset();
  state.useQuery.mockImplementation((_query, args) => (args === "skip" ? undefined : []));
});
afterEach(cleanup);

function project(id: string, creationTime: number): Doc<"projects"> {
  return {
    _id: id as Id<"projects">,
    _creationTime: creationTime,
    name: id,
    ownerId: "owner",
    updatedAt: creationTime,
  };
}

function projectStore(projects: Doc<"projects">[]) {
  const full = [...projects];
  const partials = [
    { args: { limit: 1 }, value: projects.slice(0, 1) },
    { args: { limit: 3 }, value: projects.slice(0, 3) },
    { args: { limit: 6 }, value: undefined },
  ];
  const detail = projects[1];
  const store: OptimisticLocalStore = {
    getQuery: vi.fn((query, args) => {
      if (getFunctionName(query) === getFunctionName(api.projects.get)) return full;
      if (
        getFunctionName(query) === getFunctionName(api.projects.getById) &&
        args?.id === detail?._id
      ) {
        return detail;
      }
      return undefined;
    }) as OptimisticLocalStore["getQuery"],
    getAllQueries: vi.fn(() => partials) as OptimisticLocalStore["getAllQueries"],
    setQuery: vi.fn(),
  };
  return { store, full, partials, detail };
}

function optimisticUpdate() {
  return state.withOptimisticUpdate.mock.calls[0][0] as (
    store: OptimisticLocalStore,
    args: { name: string; id?: Id<"projects"> },
  ) => void;
}

function authenticate() {
  state.auth = { isLoading: false, isAuthenticated: true };
  state.useQuery.mockReturnValue({ _id: "owner" });
}

test("project queries wait for authentication and stop after logout", () => {
  const { result, rerender } = renderHook(() => ({
    projects: useProjects(),
    recent: useProjectsPartial(6),
  }));

  expect(result.current).toEqual({ projects: undefined, recent: undefined });
  expect(state.useQuery).toHaveBeenCalledWith(api.projects.get, "skip");
  expect(state.useQuery).toHaveBeenCalledWith(api.projects.getPartial, "skip");

  state.auth = { isLoading: false, isAuthenticated: false };
  state.useQuery.mockClear();
  rerender();
  expect(state.useQuery.mock.calls.every(([, args]) => args === "skip")).toBe(true);

  state.auth = { isLoading: false, isAuthenticated: true };
  state.useQuery.mockClear();
  rerender();
  expect(result.current).toEqual({ projects: [], recent: [] });
  expect(state.useQuery).toHaveBeenCalledWith(api.projects.get, {});
  expect(state.useQuery).toHaveBeenCalledWith(api.projects.getPartial, { limit: 6 });

  state.auth = { isLoading: false, isAuthenticated: false };
  state.useQuery.mockClear();
  rerender();
  expect(result.current).toEqual({ projects: undefined, recent: undefined });
  expect(state.useQuery.mock.calls.every(([, args]) => args === "skip")).toBe(true);
});

test("recent-project limits update while authenticated", () => {
  state.auth = { isLoading: false, isAuthenticated: true };
  const { rerender } = renderHook(({ limit }) => useProjectsPartial(limit), {
    initialProps: { limit: 6 },
  });
  expect(state.useQuery).toHaveBeenLastCalledWith(api.projects.getPartial, { limit: 6 });
  rerender({ limit: 10 });
  expect(state.useQuery).toHaveBeenLastCalledWith(api.projects.getPartial, { limit: 10 });
});

test("creation prepends to full and partial lists without exceeding their bounds", () => {
  authenticate();
  renderHook(() => useCreateProject());
  const projects = Array.from({ length: 100 }, (_, i) => project(`project-${i}`, 100 - i));
  const { store, full, partials } = projectStore(projects);

  optimisticUpdate()(store, { name: "  New project  " });

  const newProject = expect.objectContaining({ name: "New project", ownerId: "owner" });
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.get, {}, [
    newProject,
    ...projects.slice(0, 99),
  ]);
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.getPartial, { limit: 1 }, [newProject]);
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.getPartial, { limit: 3 }, [
    newProject,
    ...projects.slice(0, 2),
  ]);
  expect(store.setQuery).toHaveBeenCalledTimes(3);
  expect(full).toEqual(projects);
  expect(partials[0].value).toEqual(projects.slice(0, 1));
});

test("rename updates the mutation's project in detail and all lists without reordering", () => {
  authenticate();
  renderHook(() => useRenameProject("target" as Id<"projects">));
  const projects = [project("first", 3), project("target", 2), project("last", 1)];
  const { store, full, detail } = projectStore(projects);

  optimisticUpdate()(store, { id: projects[1]._id, name: "Renamed" });

  const renamed = expect.objectContaining({
    ...projects[1],
    name: "Renamed",
    updatedAt: expect.any(Number),
  });
  expect(store.setQuery).toHaveBeenCalledWith(
    api.projects.getById,
    { id: projects[1]._id },
    renamed,
  );
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.get, {}, [
    projects[0],
    renamed,
    projects[2],
  ]);
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.getPartial, { limit: 1 }, [projects[0]]);
  expect(store.setQuery).toHaveBeenCalledWith(api.projects.getPartial, { limit: 3 }, [
    projects[0],
    renamed,
    projects[2],
  ]);
  expect(store.setQuery).toHaveBeenCalledTimes(4);
  expect(full).toEqual(projects);
  expect(detail).toEqual(projects[1]);
});

test("optimistic updates wait for the current user", () => {
  state.auth = { isLoading: false, isAuthenticated: true };
  state.useQuery.mockReturnValue(undefined);
  renderHook(() => useCreateProject());
  const { store } = projectStore([]);
  optimisticUpdate()(store, { name: "New project" });
  expect(store.setQuery).not.toHaveBeenCalled();

  state.withOptimisticUpdate.mockClear();
  renderHook(() => useRenameProject("target" as Id<"projects">));
  optimisticUpdate()(store, { id: "target" as Id<"projects">, name: "Renamed" });
  expect(store.setQuery).not.toHaveBeenCalled();
});

test("rename binds the project ID and updates it when the hook's ID changes", async () => {
  authenticate();
  const mutate = vi.fn().mockResolvedValue(null);
  state.withOptimisticUpdate.mockReturnValue(mutate);
  const { result, rerender } = renderHook(({ id }) => useRenameProject(id), {
    initialProps: { id: "first" as Id<"projects"> },
  });
  await result.current({ name: "First name" });
  expect(mutate).toHaveBeenLastCalledWith({ id: "first", name: "First name" });

  rerender({ id: "second" as Id<"projects"> });
  await result.current({ name: "Second name" });
  expect(mutate).toHaveBeenLastCalledWith({ id: "second", name: "Second name" });
});
