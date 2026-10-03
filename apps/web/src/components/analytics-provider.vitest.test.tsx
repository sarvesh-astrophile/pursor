import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  user: undefined as { _id: string } | undefined,
  identify: vi.fn(),
  reset: vi.fn(),
  get_property: vi.fn(),
}));
vi.mock("convex/react", () => ({ useConvexAuth: () => state.auth, useQuery: () => state.user }));
vi.mock("@posthog/react", () => ({
  PostHogProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/posthog", () => ({ analyticsEnabled: true, posthog: state }));

import { AnalyticsProvider } from "./analytics-provider";

beforeEach(() => {
  vi.clearAllMocks();
  state.auth = { isLoading: true, isAuthenticated: false };
  state.user = undefined;
  state.get_property.mockReturnValue(undefined);
});
afterEach(cleanup);

test("waits for authenticated identity and identifies only once", () => {
  const app = render(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.identify).not.toHaveBeenCalled();
  state.auth = { isLoading: false, isAuthenticated: true };
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.identify).not.toHaveBeenCalled();
  expect(state.reset).not.toHaveBeenCalled();
  state.user = { _id: "user-1" };
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.identify).toHaveBeenCalledExactlyOnceWith("user-1");
});

test("auth loading preserves identity, while confirmed logout clears it", () => {
  state.auth = { isLoading: false, isAuthenticated: true };
  state.user = { _id: "user-1" };
  const app = render(<AnalyticsProvider>Chat</AnalyticsProvider>);
  state.auth = { isLoading: true, isAuthenticated: false };
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.reset).not.toHaveBeenCalled();
  state.auth = { isLoading: false, isAuthenticated: false };
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.reset).toHaveBeenCalledOnce();
});

test("a signed-out reload clears persisted browser identification", () => {
  state.auth = { isLoading: false, isAuthenticated: false };
  state.get_property.mockReturnValue("previous-user");
  render(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.reset).toHaveBeenCalledOnce();
  expect(state.identify).not.toHaveBeenCalled();
});

test("switching accounts resets before identifying the new user", () => {
  state.auth = { isLoading: false, isAuthenticated: true };
  state.user = { _id: "user-1" };
  const app = render(<AnalyticsProvider>Chat</AnalyticsProvider>);
  state.user = { _id: "user-2" };
  app.rerender(<AnalyticsProvider>Chat</AnalyticsProvider>);
  expect(state.reset).toHaveBeenCalledOnce();
  expect(state.identify).toHaveBeenLastCalledWith("user-2");
  expect(state.reset.mock.invocationCallOrder[0]).toBeLessThan(
    state.identify.mock.invocationCallOrder[1]!,
  );
});
