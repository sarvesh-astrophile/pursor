import contextDev from "@context-dot-dev/convex/convex.config";
import agent from "@convex-dev/agent/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";
import posthog from "@posthog/convex/convex.config";

const app = defineApp({
  env: {
    GITHUB_CLIENT_ID: v.optional(v.string()),
    GITHUB_CLIENT_SECRET: v.optional(v.string()),
    OPENCODE_API_KEY: v.optional(v.string()),
    CONTEXT_DEV_API_KEY: v.string(),
    POSTHOG_PROJECT_TOKEN: v.string(),
    POSTHOG_HOST: v.optional(v.string()),
    POSTHOG_ENVIRONMENT: v.optional(v.string()),
    POSTHOG_RELEASE: v.optional(v.string()),
    POSTHOG_AI_RECORD_CONTENT: v.optional(v.string()),
  },
});
app.use(betterAuth);
app.use(agent);
app.use(workflow);
app.use(posthog, {
  env: {
    POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
    POSTHOG_HOST: app.env.POSTHOG_HOST,
  },
});
app.use(contextDev, {
  env: { CONTEXT_DEV_API_KEY: app.env.CONTEXT_DEV_API_KEY },
});

export default app;
