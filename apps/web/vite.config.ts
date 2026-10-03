import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { loadEnv } from "vite";
import { resolve } from "node:path";
import { uploadPostHogSourceMaps } from "./scripts/posthog-source-maps";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const uploadSourceMaps = !!env.POSTHOG_CLI_API_KEY && !!env.POSTHOG_CLI_PROJECT_ID;
  return {
    server: {
      port: 3001,
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      {
        name: "pursor-posthog-source-maps",
        apply: "build",
        closeBundle() {
          if (!uploadSourceMaps) return;
          const directory = resolve(this.environment.config.build.outDir);
          uploadPostHogSourceMaps(directory, env);
        },
      },
    ],
    build: { sourcemap: uploadSourceMaps ? true : false },
    ssr: {
      noExternal: ["@convex-dev/better-auth"],
    },
  };
});
