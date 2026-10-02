import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    GITHUB_CLIENT_ID: v.optional(v.string()),
    GITHUB_CLIENT_SECRET: v.optional(v.string()),
  },
});
app.use(betterAuth);

export default app;
