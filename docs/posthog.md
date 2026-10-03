# PostHog

Pursor integrates product analytics, AI observability, and error tracking across
TanStack Start, Cloudflare, and Convex.

## Enable event collection

### Pursor development project

| Setting                 | Value                                      |
| ----------------------- | ------------------------------------------ |
| Project ID              | `643614`                                   |
| Region                  | US Cloud                                   |
| Ingestion host          | `https://us.i.posthog.com`                 |
| API / CLI host          | `https://us.posthog.com`                   |
| Personal API key name   | `pursor dev`                               |
| Local release           | `development`                              |
| AI transcript recording | Enabled (`POSTHOG_AI_RECORD_CONTENT=true`) |

Open [project settings](https://us.posthog.com/project/643614/settings/project)
to find the project token. Manage personal API keys in PostHog's user settings.
The personal key is stored in the ignored `apps/web/.env` file; its value is not
part of this guide.

#### 1. Web environment

Use the following values in `apps/web/.env`. Replace the two personal-key
placeholders with the `pursor dev` key. The same key can be used for both roles.

```dotenv
VITE_POSTHOG_PROJECT_TOKEN=phc_pXEggHC5a8kMC9aZCCUStdq549oS975FuHrVo5qWz3Ec
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_APP_RELEASE=development
POSTHOG_CLI_PROJECT_ID=643614
POSTHOG_CLI_HOST=https://us.posthog.com
POSTHOG_CLI_API_KEY=<personal-api-key>
POSTHOG_ADMIN_API_KEY=<personal-api-key>
```

The personal key needs Error Tracking write access for source maps, plus
Dashboard and Insight read/write access for dashboard setup.

From the repository root:

```sh
bun run env:generate
bun run dev:web
```

Restart an already-running web server after editing `.env`.

#### 2. Convex development environment

From `packages/backend`:

```sh
bunx convex env set POSTHOG_PROJECT_TOKEN "phc_pXEggHC5a8kMC9aZCCUStdq549oS975FuHrVo5qWz3Ec"
bunx convex env set POSTHOG_HOST "https://us.i.posthog.com"
bunx convex env set POSTHOG_ENVIRONMENT "development"
bunx convex env set POSTHOG_RELEASE "development"
bunx convex env set POSTHOG_AI_RECORD_CONTENT "true"
bunx convex dev --once
```

The configured development deployment is `adorable-dog-737`. The backend project
token must match the frontend project token.

#### 3. Provision the dashboards

From `apps/web`:

```sh
bun run analytics:setup
```

This creates or reuses four dashboards and 14 insights in project `643614`.
The command prints their URLs. A `403` means the personal key lacks the required
Dashboard/Insight scopes or access to this project; a `401` means authentication
failed.

The development dashboards are provisioned:

| Dashboard   | Link                                                    |
| ----------- | ------------------------------------------------------- |
| Usage       | https://us.posthog.com/project/643614/dashboard/2165929 |
| Performance | https://us.posthog.com/project/643614/dashboard/2165930 |
| Reliability | https://us.posthog.com/project/643614/dashboard/2165931 |
| AI Cost     | https://us.posthog.com/project/643614/dashboard/2165932 |

#### 4. Verify events and AI traces

1. Open `/dashboard`, sign in, and send a prompt that uses `searchWeb` or `readPage`.
2. In PostHog Activity, look for `research_turn_started` and
   `research_turn_completed`.
3. In AI Observability, inspect the generation and tool spans, recorded content,
   token usage, and shared conversation ID.
4. Build from `apps/web` with `bun run build` to inject/upload client and server
   source maps. Check Error Tracking symbol sets for the `pursor-web` release.

For production, use its project token and deployment, set the environment to
`production`, and use the same Git commit for the frontend/backend release.

#### Verified setup

- Local web variables are configured in the ignored `apps/web/.env` file.
- Convex development variables are configured, with AI transcript recording enabled.
- All four dashboards and 14 insights were provisioned successfully.
- The web build successfully injected and uploaded 6 client and 13 server source-map
  chunks to the `pursor-web@development` release.
- `bunx convex dev --once` completed successfully against `adorable-dog-737`.

Restart the web development server and send a research prompt to check browser
events and AI traces in the live project.

### Other deployments

Create separate PostHog projects for development and production. Use matching
project tokens on the web app and its Convex deployment.

In `apps/web/.env`:

```dotenv
VITE_POSTHOG_PROJECT_TOKEN=phc_your_project_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_APP_RELEASE=your_git_commit
```

Run `bun run env:generate` from the root and restart the web dev server. Alchemy
imports the web environment contract and forwards these public values to the
deployed website.

From `packages/backend`:

```sh
bunx convex env set POSTHOG_PROJECT_TOKEN phc_your_project_token
bunx convex env set POSTHOG_HOST https://us.i.posthog.com
bunx convex env set POSTHOG_ENVIRONMENT development
bunx convex env set POSTHOG_RELEASE your_git_commit
bunx convex dev --once
```

For production, set the variables on the production Convex deployment using
`--prod`, set `POSTHOG_ENVIRONMENT` to `production`, and deploy the production web
stage with the matching public token and release.

For EU Cloud use `https://eu.i.posthog.com` as the ingestion host. The CLI/API
host is different: `https://eu.posthog.com` (US: `https://us.posthog.com`).

The Convex component requires `POSTHOG_PROJECT_TOKEN` to exist, even when
collection is disabled. To run without PostHog, set an empty string:

```sh
bunx convex env set POSTHOG_PROJECT_TOKEN ''
```

An empty frontend token disables browser/server capture, and an empty backend
token disables event scheduling and AI exports.

## Identity and events

The browser and backend use the Better Auth user `_id` as `distinct_id`. The
browser identifies once auth has resolved, resets on logout/account changes,
and clears an identified user persisted from a previous signed-in visit.

| Event                                                  | Source                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `$pageview`                                            | PostHog browser history tracking; no second router pageview handler |
| `research_prompt_selected`                             | Starter cards and composer menu                                     |
| `research_send_clicked`                                | User submission intent                                              |
| `research_tool_details_opened`                         | Expanded tool cards                                                 |
| `research_chat_reset`                                  | New conversation                                                    |
| `research_reply_first_visible`                         | First text delivered by the subscription adapter, once per turn     |
| `research_turn_started`                                | Accepted authenticated `chat.send` mutation                         |
| `research_generation_attempt_started/completed/failed` | Generation action invocation                                        |
| `research_tool_completed`                              | Real AI SDK tool completion; includes success and duration          |
| `research_turn_completed/failed/canceled`              | Idempotent Workflow completion callback                             |

First-browser-text latency includes submission, workflow scheduling, model/tool
work, and Convex subscription delivery. It measures adapter delivery rather than
DOM paint. Model time-to-first-token is a separate AI generation metric.

Business events contain prompt length and correlation metadata. They do not
include chat text or scraped tool payloads.

`researchTurns` stores trusted ownership, conversation/prompt/workflow IDs, trace
IDs, attempt count, and terminal status. Completion checks the workflow ID and
running status before scheduling terminal events. Follow-ups create a new turn
while reusing the Agent thread. Reactive `chat.progress` queries emit no events.

## AI observability

`researchGeneration.ts` runs in the Node runtime. `@ai-sdk/otel` is required by
the installed AI SDK 7; passing older telemetry `metadata` settings alone does
not instrument this SDK version.

The per-call OpenTelemetry integration produces model and tool spans. All spans
are enriched with the authenticated user, Agent thread (`$ai_session_id`), turn,
workflow, attempt, release, and environment. A persisted parent trace/span
context groups retries into one turn. The completion callback schedules a root
turn span with the original start/end timestamps. Each action invocation gets a
distinct attempt span and attempt ID.

The final turn span can arrive after its child spans. Both have the same trace ID
and parent relationship. CLI research/introduction demos are attributed to
`pursor:internal-demo` and tagged `source: internal_demo`.

Inputs and outputs are disabled by default. Enable transcript recording with:

```sh
bunx convex env set POSTHOG_AI_RECORD_CONTENT true
```

This enables model messages and tool arguments/results in AI traces. Existing
tool-output bounds still apply; recorded conversation histories also contribute
to export size. Use `false` to return to metadata-only recording.

The exporter is flushed after the stream completes, including failure paths.
Export/scheduling failures are logged and do not reject a successful model run.
SDK model retries remain disabled; Workflow owns generation retries.

PostHog receives model/provider, usage, duration, streaming timing, and tool
execution spans. Check AI Observability for `deepseek-v4.1-flash` pricing coverage
and configure custom model pricing if needed. Dashboard queries show
`priced_generations` beside estimated cost so missing prices are visible.
Estimated model cost excludes Context.dev credits.

## Error tracking

- Browser: automatic exceptions plus explicit route-boundary, submission, and
  subscription errors. Repeated explicit reports of the same Error object are
  suppressed.
- Convex: explicit generation and tool exceptions with user/turn/attempt context.
- TanStack Start: global request middleware captures thrown request errors and
  5xx responses. A framework-handled 5xx has a status-only fallback report; thrown
  errors retain their original stack. Server request failures use a system
  identity (`pursor:web-server`) and attach method/path without query strings.

Optional blanket Convex exception reporting can be enabled in the Convex
dashboard's **Deployment Settings → Integrations → PostHog Error Tracking**.
This requires Convex Pro. Native reporting uses token identifiers for
authenticated requests and deployment attribution for internal actions; it can
duplicate manually captured research exceptions.

## Production source maps

Set these in the build environment, or `apps/web/.env` for a local release build:

```dotenv
POSTHOG_CLI_API_KEY=phx_your_source_map_upload_key
POSTHOG_CLI_PROJECT_ID=your_numeric_project_id
POSTHOG_CLI_HOST=https://us.posthog.com
VITE_APP_RELEASE=your_git_commit
```

The upload key needs Error Tracking write access. Alchemy imports these build
inputs; only the public `VITE_*` values become Worker bindings.

The Vite+ plugin uses the PostHog CLI, making it independent of Rollup-specific
plugin hooks. With both credentials present, each client/server build generates
source maps, injects chunk/release metadata, uploads its output directory, and
deletes uploaded maps. Upload failure fails the release build so the deployed
assets match uploaded symbols. Without upload credentials, maps are not generated.

## Provision dashboards

Set `POSTHOG_ADMIN_API_KEY` in `apps/web/.env` to a personal API key with
`dashboard:read/write` and `insight:read/write` access, along with
`POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST`.

From `apps/web`:

```sh
bun run analytics:setup --dry-run
bun run analytics:setup
```

The script uses Varlock to load the owning package's environment. It creates
Usage, Performance, Reliability, and AI Cost dashboards with rolling 30-day SQL
table insights and prints their URLs. Rerunning reuses dashboards and skips
existing named tiles, preserving edits in PostHog.

## Verification

From the root:

```sh
bun run lint
bun run check-types
```

From `apps/web`:

```sh
bun run test
bun test src/lib/convex-chat.test.js
```

From `packages/backend`:

```sh
bun run test
bun test tests/ai-telemetry.test.js
bunx convex dev --once
```

After enabling real tokens, send a research prompt and a follow-up, expand a tool,
reset the chat, then sign out. Check one pageview per navigation, matching person
IDs, separate turn traces in one AI session, tool outcomes, and token usage. Check
a controlled frontend error on a release build resolves to source code. Review
the dashboard's pricing coverage before interpreting model cost totals.
