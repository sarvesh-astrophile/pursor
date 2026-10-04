import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { expect, test, vi } from "vitest";

vi.mock("@/components/sign-in-form", () => ({ default: () => null }));
vi.mock("@/components/sign-up-form", () => ({ default: () => null }));
vi.mock("@/features/auth/auth-loading", () => ({ default: () => null }));
vi.mock("@/features/projects/components/projects-view", () => ({ ProjectsView: () => null }));

import { Route as IndexRoute } from "../routes/_auth/index";
import { Route as AuthRoute } from "../routes/_auth/route";
import { Route as LoginRoute } from "../routes/login";

function setupRouter(isAuthenticated: boolean, initialEntry: string) {
  const root = createRootRoute({ beforeLoad: () => ({ isAuthenticated }) });
  // Supply the file-route metadata normally provided by the generated route tree.
  const auth = AuthRoute.update({
    id: "_auth",
    getParentRoute: () => root,
  } as Parameters<typeof AuthRoute.update>[0]);
  const login = LoginRoute.update({
    path: "/login",
    getParentRoute: () => root,
  } as Parameters<typeof LoginRoute.update>[0]);
  const loader = vi.fn(() => null);
  const projects = IndexRoute.update({
    path: "/",
    getParentRoute: () => auth,
    loader,
  } as Parameters<typeof IndexRoute.update>[0]);
  const dashboard = createRoute({
    path: "/dashboard",
    getParentRoute: () => auth,
    loader,
  });
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([projects, dashboard]), login]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  return { router, loader };
}

test.each(["/?tab=recent#list", "/dashboard"])(
  "signed-out users cannot run child loaders and retain their destination: %s",
  async (destination) => {
    const { router, loader } = setupRouter(false, destination);
    await router.load();
    expect(loader).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search.redirect).toBe(destination);
  },
);

test("authenticated users can load protected child routes", async () => {
  const { router, loader } = setupRouter(true, "/");
  await router.load();
  expect(loader).toHaveBeenCalledOnce();
  expect(router.state.location.pathname).toBe("/");
});

test("authenticated users return from login to the requested route", async () => {
  const { router, loader } = setupRouter(true, "/login?redirect=%2Fdashboard");
  await router.load();
  expect(router.state.location.pathname).toBe("/dashboard");
  expect(loader).toHaveBeenCalledOnce();
});

test.each(["https://example.com", "//example.com", "/\\example.com", "/login", "//["])(
  "login rejects unsafe or looping return destinations: %s",
  async (destination) => {
    const { router } = setupRouter(false, `/login?redirect=${encodeURIComponent(destination)}`);
    await router.load();
    expect(router.state.matches.find((match) => match.routeId === "/login")?.search.redirect).toBe(
      "/",
    );
  },
);

test("authenticated users visiting login without a destination go to Projects", async () => {
  const { router, loader } = setupRouter(true, "/login");
  await router.load();
  expect(router.state.location.pathname).toBe("/");
  expect(loader).toHaveBeenCalledOnce();
});
