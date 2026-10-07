import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "@pursor/backend/convex/_generated/api";

const state = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => state.auth,
  useQuery: state.useQuery,
}));

import { useProjects, useProjectsPartial } from "./use-projects";

beforeEach(() => {
  state.auth = { isLoading: true, isAuthenticated: false };
  state.useQuery.mockReset();
  state.useQuery.mockImplementation((_query, args) => (args === "skip" ? undefined : []));
});
afterEach(cleanup);

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
