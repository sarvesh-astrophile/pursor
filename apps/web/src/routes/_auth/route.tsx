import { Navigate, Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthLoadingState from "@/features/auth/components/auth-loading";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context, location }) => {
    if (!context.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const location = useLocation();

  return (
    <>
      <Authenticated>
        <Outlet />
      </Authenticated>
      <Unauthenticated>
        <Navigate to="/login" search={{ redirect: location.href }} replace />
      </Unauthenticated>
      <AuthLoading>
        <AuthLoadingState />
      </AuthLoading>
    </>
  );
}
