import { PostHogProvider } from "@posthog/react";
import { api } from "@pursor/backend/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef, type ReactNode } from "react";

import { analyticsEnabled, posthog } from "@/lib/posthog";

function IdentitySync() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : "skip");
  const identified = useRef<string | null>(null);
  useEffect(() => {
    if (!analyticsEnabled || isLoading) return;
    const id = isAuthenticated ? user?._id : null;
    if (id === undefined) return;
    const previous = identified.current ?? posthog.get_property("$user_id");
    if (previous && previous !== id) posthog.reset();
    if (id && identified.current !== id) posthog.identify(id);
    identified.current = id ?? null;
  }, [isLoading, isAuthenticated, user?._id]);
  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <IdentitySync />
      {children}
    </PostHogProvider>
  );
}
