import { expect, test, vi } from "vitest";

import { uploadPostHogSourceMaps } from "./posthog-source-maps";

test("source maps are injected before upload with matching release metadata", () => {
  const run = vi.fn();
  const env = {
    POSTHOG_CLI_API_KEY: "local-test",
    POSTHOG_CLI_PROJECT_ID: "123",
    VITE_APP_RELEASE: "commit-123",
  };
  uploadPostHogSourceMaps("/build/client", env, run);
  uploadPostHogSourceMaps("/build/server", env, run);
  expect(run.mock.calls.map(([args]) => args[1])).toEqual(["inject", "upload", "inject", "upload"]);
  for (const [args, cliEnv] of run.mock.calls) {
    expect(args).toContain("commit-123");
    expect(cliEnv).toMatchObject({
      POSTHOG_CLI_API_KEY: "local-test",
      POSTHOG_CLI_PROJECT_ID: "123",
    });
  }
  expect(run.mock.calls[1]![0]).toContain("--delete-after");
});

test("unconfigured builds skip uploading and upload failures fail configured builds", () => {
  const run = vi.fn();
  uploadPostHogSourceMaps("/build/client", {}, run);
  expect(run).not.toHaveBeenCalled();
  run.mockImplementation((args: string[]) => {
    if (args[1] === "upload") throw new Error("Upload failed");
  });
  expect(() =>
    uploadPostHogSourceMaps(
      "/build/client",
      { POSTHOG_CLI_API_KEY: "local-test", POSTHOG_CLI_PROJECT_ID: "123" },
      run,
    ),
  ).toThrow("Upload failed");
});
