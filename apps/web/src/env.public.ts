// Alchemy validates deployment inputs with Varlock; Workers use native env bindings.
import type { PublicCoercedEnvSchema } from "./env";

export const ENV = {
  VITE_CONVEX_URL: import.meta.env?.VITE_CONVEX_URL ?? "",
  VITE_CONVEX_SITE_URL: import.meta.env?.VITE_CONVEX_SITE_URL ?? "",
  VITE_POSTHOG_PROJECT_TOKEN: import.meta.env?.VITE_POSTHOG_PROJECT_TOKEN,
  VITE_POSTHOG_HOST: import.meta.env?.VITE_POSTHOG_HOST,
  VITE_APP_RELEASE: import.meta.env?.VITE_APP_RELEASE ?? "development",
} satisfies Pick<
  PublicCoercedEnvSchema,
  | "VITE_CONVEX_URL"
  | "VITE_CONVEX_SITE_URL"
  | "VITE_POSTHOG_PROJECT_TOKEN"
  | "VITE_POSTHOG_HOST"
  | "VITE_APP_RELEASE"
>;
