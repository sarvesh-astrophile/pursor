import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

export default Alchemy.Stack(
  "pursor",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* Cloudflare.Website.Vite("web", {
      rootDir: "../../apps/web",
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        VITE_CONVEX_URL: Config.String("VITE_CONVEX_URL"),
        VITE_CONVEX_SITE_URL: Config.String("VITE_CONVEX_SITE_URL"),
        VITE_POSTHOG_PROJECT_TOKEN: Config.String("VITE_POSTHOG_PROJECT_TOKEN").pipe(
          Config.withDefault(""),
        ),
        VITE_POSTHOG_HOST: Config.String("VITE_POSTHOG_HOST").pipe(
          Config.withDefault("https://us.i.posthog.com"),
        ),
        VITE_APP_RELEASE: Config.String("VITE_APP_RELEASE").pipe(Config.withDefault("development")),
      },
      dev: {
        port: 3001,
      },
    });

    return {
      web: webWorker.url,
    };
  }),
);
