import { PostHog } from "@posthog/convex";

import { components } from "./_generated/api";
import { env, type ActionCtx, type MutationCtx } from "./_generated/server";

const posthog = new PostHog(components.posthog);
export function deploymentProperties() {
  return {
    environment: env.POSTHOG_ENVIRONMENT || "development",
    release: env.POSTHOG_RELEASE || "development",
  };
}

export async function captureEvent(
  ctx: MutationCtx | ActionCtx,
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
) {
  if (!env.POSTHOG_PROJECT_TOKEN?.trim()) return;
  try {
    await posthog.capture(ctx, {
      distinctId,
      event,
      properties: { ...deploymentProperties(), ...properties },
    });
  } catch (error) {
    console.warn("PostHog event scheduling failed", error);
  }
}

export async function captureException(
  ctx: MutationCtx | ActionCtx,
  distinctId: string,
  error: unknown,
  properties: Record<string, unknown> = {},
) {
  if (!env.POSTHOG_PROJECT_TOKEN?.trim()) return;
  try {
    await posthog.captureException(ctx, {
      distinctId,
      error,
      additionalProperties: { ...deploymentProperties(), ...properties },
    });
  } catch (reportingError) {
    console.warn("PostHog exception scheduling failed", reportingError);
  }
}
