import { PostHog } from "posthog-node/edge";

import { ENV } from "@/env.public";

export async function captureServerException(error: unknown, request: Request) {
  if (!ENV.VITE_POSTHOG_PROJECT_TOKEN) return;
  try {
    const client = new PostHog(ENV.VITE_POSTHOG_PROJECT_TOKEN, {
      host: ENV.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3_000,
      fetchRetryCount: 0,
    });
    await client.captureExceptionImmediate(error, "pursor:web-server", {
      category: "server_request",
      path: new URL(request.url).pathname,
      method: request.method,
      environment: import.meta.env.MODE,
      release: ENV.VITE_APP_RELEASE,
    });
  } catch (reportingError) {
    console.warn("PostHog server exception delivery failed", reportingError);
  }
}
