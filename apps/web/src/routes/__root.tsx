import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { Toaster } from "@pursor/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
  ErrorComponent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { captureBrowserException } from "@/lib/posthog";

import Header from "../components/header";

import appCss from "../index.css?url";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "My App",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
  errorComponent: RootError,
  beforeLoad: async (ctx) => {
    const token = await getAuth();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return {
      isAuthenticated: !!token,
      token,
    };
  },
});

function RootDocument() {
  const context = useRouteContext({ from: Route.id });
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="antialiased">
          <ThemeProvider defaultTheme="dark" storageKey="theme">
            <AnalyticsProvider>
              <div className="grid h-svh grid-rows-[auto_1fr]">
                <Header />
                <Outlet />
              </div>
              <ThemedToaster />
              <TanStackRouterDevtools position="bottom-left" />
            </AnalyticsProvider>
          </ThemeProvider>
          <Scripts />
        </body>
      </html>
    </ConvexBetterAuthProvider>
  );
}

function RootError(props: ErrorComponentProps) {
  useEffect(() => {
    captureBrowserException(props.error, { category: "route_rendering" });
  }, [props.error]);
  return <ErrorComponent {...props} />;
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} richColors />;
}
