import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/features/auth/components/sign-in-form";
import SignUpForm from "@/features/auth/components/sign-up-form";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => {
    let destination = "/";
    if (
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      URL.canParse(search.redirect, "https://pursor.local")
    ) {
      const url = new URL(search.redirect, "https://pursor.local");
      if (url.origin === "https://pursor.local" && url.pathname !== "/login") {
        destination = `${url.pathname}${url.search}${url.hash}`;
      }
    }
    return { redirect: destination };
  },
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) {
      throw redirect({ href: search.redirect });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(false);
  const { redirect: redirectTo } = Route.useSearch();

  return showSignIn ? (
    <SignInForm redirectTo={redirectTo} onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm redirectTo={redirectTo} onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
