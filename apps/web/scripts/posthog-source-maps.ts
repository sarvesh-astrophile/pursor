import { execFileSync } from "node:child_process";

type RunCLI = (args: string[], env: NodeJS.ProcessEnv) => void;

export function uploadPostHogSourceMaps(
  directory: string,
  env: NodeJS.ProcessEnv,
  run: RunCLI = (args, cliEnv) => {
    execFileSync("bunx", ["--no-install", "posthog-cli", ...args], {
      env: cliEnv,
      stdio: "inherit",
    });
  },
) {
  if (!env.POSTHOG_CLI_API_KEY || !env.POSTHOG_CLI_PROJECT_ID) return;
  const args = [
    "--directory",
    directory,
    "--release-name",
    "pursor-web",
    "--release-version",
    env.VITE_APP_RELEASE || "development",
  ];
  const cliEnv = {
    ...process.env,
    POSTHOG_CLI_API_KEY: env.POSTHOG_CLI_API_KEY,
    POSTHOG_CLI_PROJECT_ID: env.POSTHOG_CLI_PROJECT_ID,
    POSTHOG_CLI_HOST: env.POSTHOG_CLI_HOST || "https://us.posthog.com",
  };
  run(["sourcemap", "inject", ...args], cliEnv);
  run(["sourcemap", "upload", ...args, "--delete-after"], cliEnv);
}
