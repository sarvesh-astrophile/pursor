# Repository notes

- Bun workspace (`apps/*`, `packages/*`); run commands from the root unless a package is specified. `bun run dev` starts the web Vite server and Convex; `bun run dev:web` starts only the web Vite server. Run `bun run --filter @pursor/infra dev` for Alchemy/Cloudflare development separately. First-time Convex setup: `bun run dev:setup`, then put the Convex URLs in `apps/web/.env` as required by `apps/web/.env.schema`.
- `apps/web` is TanStack Start on port 3001. Routes live under `apps/web/src/routes`; `src/router.tsx` wires Convex into TanStack Query/Router, and `src/routes/__root.tsx` provides SSR auth context. `apps/web/src/routeTree.gen.ts` is generated; edit route files instead.
- `packages/backend/convex` owns Convex functions, auth and schema; read its `AGENTS.md` before working there. Convex-generated code under `convex/_generated` is ignored; run the backend dev/setup task to generate it. `packages/ui` supplies shared components via `@pursor/ui/components/*` and styles via `@pursor/ui/globals.css`; `packages/infra/alchemy.run.ts` deploys the web app to Cloudflare.
- Bun's automatic `.env` loading is disabled (`bunfig.toml`). Web env contracts live in `apps/web/.env.schema`; after changing it, run `bun run env:generate` to refresh `apps/web/src/env.ts`. Web public Convex values are read through `src/env.public.ts`; Alchemy loads deployment env from `packages/infra/.env.schema` via Varlock. Run standalone Varlock tools from the owning package directory.
- For verification use `bun run lint` and `bun run check-types`; the latter builds the web app before `tsc --noEmit` and may require configured Convex env/generated code. It does not include the backend, which has no `check-types` script: run `bunx tsc --noEmit -p convex/tsconfig.json` from `packages/backend` after generating bindings. Focused type checks: `bun run --filter @pursor/ui check-types` or `bun run --filter @pursor/infra check-types`. `bun run check` runs `oxlint && oxfmt --write` (it edits files), despite its name. Backend function tests run with `bun run test` from `packages/backend`; AI trace tests run with `bun test tests/ai-telemetry.test.js` there.
- `bun run deploy` / `bun run destroy` target Alchemy's default personal stage; production requires `bunx alchemy deploy --stage production` from `packages/infra`.

## Durable AI agent

- `packages/backend/convex/convex.config.ts` mounts Better Auth, `@convex-dev/agent`, `@convex-dev/workflow`, and `@context-dot-dev/convex`. Declare backend environment variables there and read the typed `env` from `./_generated/server`.
- `packages/backend/convex/agentDemo.ts` implements the fixed “who are you” demo. It uses OpenCode Zen with `@ai-sdk/openai-compatible`, base URL `https://opencode.ai/zen/v1`, and API model ID `deepseek-v4.1-flash` (DeepSeek V4.1 Flash). API requests use the bare model ID; the `opencode/` prefix is for OpenCode CLI configuration.
- Set `OPENCODE_API_KEY` in the Convex deployment environment. Keep it out of frontend env files and source control. It is optional in the env contract, but the demo requires it and reports a setup error when absent.
- From `packages/backend`, run `bunx convex run agentDemo:start '{}'`, then `bunx convex run agentDemo:status '{"workflowId":"YOUR_WORKFLOW_ID"}'`. Start returns a workflow ID; completed status contains `result: { threadId, text }`. These entrypoints are internal and intended for CLI/dashboard use; any future public wrapper needs authentication and ownership checks.
- Keep the workflow handler deterministic. Create the thread and save the prompt in the `prepareThread` mutation step, then call the LLM through the `generateReply` action step. With the installed Agent version, its helpers require a regular Convex context; wrap them in mutation/action steps rather than passing the workflow step context directly.
- The action step retries up to three attempts with exponential backoff and reuses `promptMessageId` to avoid duplicating user prompts. SDK retries are disabled (`maxRetries: 0`) so the Workflow component controls retries. Agent messages and completed workflow records persist; workflow cleanup must be explicit.
- After changing component registration or env declarations, regenerate bindings with `bunx convex codegen` from `packages/backend`. Use `bunx convex dev --once` to deploy to the configured development instance and typecheck. These commands contact the configured Convex deployment; generated files under `_generated` remain ignored.
- `packages/backend/convex/contextAgent.ts` accepts a custom research prompt and exposes `searchWeb`, `readPage`, and `lookupBrand` tools backed by `new ContextDev(components.contextDev)`. Use `createTool({ inputSchema, execute })` with the installed Agent version. Tool execution stays inside the generation action; allow multiple model steps with `stepCountIs` and reserve the final step for a tool-free answer.
- `CONTEXT_DEV_API_KEY` is required by the component env contract and passed through `app.env.CONTEXT_DEV_API_KEY`; configure it in the Convex deployment before deploying. Research also requires `OPENCODE_API_KEY`. Run `bunx convex run contextAgent:start '{"prompt":"Research Convex with source links"}'`, then `bunx convex run contextAgent:status '{"workflowId":"YOUR_WORKFLOW_ID"}'` from `packages/backend`.
- Context.dev does not persist scraped data in Convex, but Agent tool messages do persist. Bound tool output sizes. Workflow action retries may repeat model/tool requests and consume additional credits; prompt reuse does not make external requests exactly-once.
- `/dashboard` hosts `apps/web/src/components/research-chat.tsx`, using TanStack AI `useChat` and `src/lib/convex-chat.ts`. The custom connection translates Convex query subscriptions into incremental AG-UI text, tool-argument, and tool-result events; it does not use simulated responses. Use the browser-safe `@tanstack/ai/client` entrypoint for protocol types and `EventType`.
- `researchGeneration.generateReply` is a Node action using `agent.streamText` with `saveStreamDeltas: { chunking: "word", throttleMs: 100 }`; `contextAgent.generateReply` delegates across runtimes for CLI compatibility. It waits for the stream to finish inside the Workflow action. Tools live in `lib/researchTools.ts`. `chat.progress` reads the latest current-turn stream with `listStreams`/`syncStreams`, and `convex/lib/chatStream.ts` converts its native chunks into a cumulative text/tool snapshot. The adapter emits only new suffixes, ignores old-workflow snapshots, and tracks stream changes on retries. Keep stream queries behind the same ownership checks as messages.
- The dashboard uses shared Card/InputGroup components and `MessageScrollerProvider` with `autoScroll`, the latest user message as an anchor, and a jump-to-end button. Do not restore unconditional `scrollIntoView` on every delta: it overrides readers who scroll up. Tool headers stay visible while JSON payloads are expandable; tools stay outside Typeset.
- `packages/backend/convex/chat.ts` exposes authenticated `send` and `progress` endpoints. `chatSessions` stores Better Auth user ownership, the Agent thread, and the active workflow/prompt order. Check ownership before reading messages or writing prompts; reject overlapping runs per session. Follow-ups reuse the Agent thread. The playground transcript is in memory and resets on page reload; backend messages remain persisted.
- Run focused chat adapter checks with `bun test src/lib/convex-chat.test.js` from `apps/web`. They exercise the real TanStack stream processor, incremental text before completion, native Agent tool chunks, duplicate subscription updates, stale workflows, follow-up session reuse, errors, and subscription cleanup on abort.
- `packages/ui/src/styles/typeset.css` is downloaded from `https://ui.shadcn.com/typeset.css` and imported after Tailwind in `globals.css`. The `.typeset-chat` preset and existing Geist font imports style dashboard assistant Markdown. Keep tool cards and other surfaces outside the Typeset container.

## PostHog integration

- Configuration and activation are documented in `docs/posthog.md`. Web project token/host/release are public `VITE_*` values in the Varlock contract; source-map and dashboard API keys are server/build-only. Alchemy imports and forwards the public values.
- `@posthog/convex` is mounted in `convex.config.ts`. `POSTHOG_PROJECT_TOKEN` must exist because the component requires it; an empty string disables application telemetry. Event/exception helpers in `convex/posthog.ts` catch delivery-scheduling failures.
- Use the Better Auth user `_id` consistently for browser/backend/AI `distinct_id`. `AnalyticsProvider` synchronizes identity after auth resolves and resets on confirmed logout/account changes, including persisted browser identity. Use one history-based pageview strategy.
- `researchTurns` persists ownership, correlation IDs, attempt count, and status. `chat.complete` is an idempotent Workflow completion callback; never capture lifecycle events in the reactive `chat.progress` query. `researchTelemetry.beginAttempt` validates prompt/thread before incrementing attempts.
- The installed AI SDK 7 needs `@ai-sdk/otel`, per-call `telemetry.integrations`, and custom `enrichSpan` attributes. Old `experimental_telemetry.metadata` examples are incompatible. Node-only async context/exporter code lives in `lib/aiTelemetry.ts` and Node actions in `researchGeneration.ts`. All retries share a persisted turn trace/parent; each attempt has its own span. Finalization exports the root with its persisted IDs/timing.
- Prompt/result recording is opt-in via `POSTHOG_AI_RECORD_CONTENT=true`. Flush after streaming completes and catch exporter failures so they never trigger another paid generation. Model pricing must be verified for OpenCode/DeepSeek; dashboard queries expose pricing coverage.
- `src/start.ts` captures server request errors with the edge PostHog client. Browser exceptions include router boundaries and handled chat failures. Native Convex exception reporting is an optional Pro integration and can duplicate explicit reports.
- The Vite+ source-map hook runs CLI injection/upload for client/server output when `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID` are set; upload failure fails the build. `bun run analytics:setup` from `apps/web` provisions dashboards with an admin key; `--dry-run` prints definitions.

## Context7 library IDs

Prefer these official, stack-specific documentation sources when querying Context7:

- Convex: `/websites/convex_dev`
- Convex Better Auth: `/websites/labs_convex_dev_better-auth`
- TanStack Start (React): `/websites/tanstack_start_framework_react`
- TanStack Router: `/tanstack/router`
- AI SDK: `/websites/ai-sdk_dev`
- OpenCode: `/anomalyco/opencode`
- Context.dev: `/websites/context_dev`
- TanStack AI: `/tanstack/ai`

For library-specific questions or implementation details, use the Context7 MCP tools: call `resolve-library-id` to find an ID unless one is listed above, then call `query-docs` with that ID and a focused question. Query separate concepts separately.

## File tree

Project files and useful generated entrypoints are shown below; dependency, build, cache, and generated directories are summarized rather than expanded.

```text
pursor/
├── AGENTS.md                          # Instructions for agents working in this workspace
├── README.md                          # Setup, env, UI, and deployment overview
├── bts.jsonc                          # Better-T-Stack scaffold metadata
├── bun.lock                           # Bun lockfile
├── bunfig.toml                        # Disables Bun's automatic .env loading
├── package.json                       # Workspace globs, dependency catalog, root scripts
├── tsconfig.json                      # Extends the shared TS config
├── vite.config.ts                     # Workspace Vite+ lint, format, staged-file rules
├── .oxlintrc.json                     # Oxlint configuration
├── .oxfmtrc.json                      # Oxfmt configuration
├── .gitignore                         # Ignore rules for env, builds, and generated files
├── apps/
│   └── web/                           # TanStack Start app on port 3001
│       ├── .env.schema                # Varlock contract for public Convex URLs
│       ├── .env                       # Local values (ignored; do not commit)
│       ├── .gitignore                 # App-specific build/env ignore rules
│       ├── bunfig.toml                # Disables Bun's automatic .env loading
│       ├── components.json            # App shadcn aliases
│       ├── package.json               # Web build, dev, dev:bare, typecheck scripts
│       ├── tsconfig.json              # Web TS aliases (@/* and shared UI)
│       ├── vite.config.ts             # TanStack Start, React, Tailwind, port 3001
│       ├── public/
│       │   └── robots.txt
│       └── src/
│           ├── env.ts                 # GENERATED by Varlock; do not edit
│           ├── env.public.ts          # Public Convex env values from Vite
│           ├── index.css              # Imports shared UI globals
│           ├── router.tsx             # Convex/TanStack Query + SSR router integration
│           ├── routeTree.gen.ts       # GENERATED by TanStack Router; do not edit
│           ├── components/
│           │   ├── features/auth/
│           │   │   └── auth-loading.tsx # Styled session-check loading state
│           │   ├── github-sign-in-button.tsx # Shared GitHub OAuth sign-in button
│           │   ├── header.tsx         # App navigation and theme toggle
│           │   ├── loader.tsx         # Router pending state
│           │   ├── mode-toggle.tsx    # Light/dark/system theme menu
│           │   ├── sign-in-form.tsx   # Email/password and GitHub sign-in
│           │   ├── sign-up-form.tsx   # Email/password sign-up and GitHub sign-in
│           │   ├── theme-provider.tsx # Persisted theme context and pre-hydration script
│           │   └── user-menu.tsx
│           ├── lib/
│           │   ├── auth-client.ts     # Better Auth React client with Convex plugin
│           │   └── auth-server.ts     # React Start auth handler/token helpers
│           └── routes/
│               ├── __root.tsx         # SSR auth, theme provider, document shell
│               ├── index.tsx          # Home route + Convex health query
│               ├── _auth/
│               │   ├── route.tsx      # Auth layout, sign-in/up forms, session loading state
│               │   └── dashboard.tsx  # Authenticated Context.dev chat playground
│               └── api/auth/
│                   └── $.ts           # GET/POST Better Auth route
└── packages/
    ├── backend/                      # Convex service
    │   ├── AGENTS.md                  # Additional Convex-specific agent instructions
    │   ├── .env.local                 # Local Convex configuration (ignored)
    │   ├── .gitignore
    │   ├── package.json               # convex dev / dev:setup scripts
    │   ├── .agents/skills/            # Convex task-specific agent guidance
    │   └── convex/
    │       ├── README.md              # Convex starter examples
    │       ├── agentDemo.ts           # Internal Workflow + Agent demo using OpenCode Zen / DeepSeek
    │       ├── contextAgent.ts        # Durable Context.dev research agent with search, page, and brand tools
    │       ├── chat.ts                # Authenticated chat send/progress + durable reply workflow
    │       ├── auth.config.ts         # Better Auth provider config
    │       ├── auth.ts                # Better Auth, optional GitHub OAuth, current-user query
    │       ├── convex.config.ts       # Better Auth, Agent, Workflow, Context.dev + typed backend env
    │       ├── healthCheck.ts         # Public health query
    │       ├── http.ts                # Registers auth HTTP routes
    │       ├── privateData.ts         # Auth-aware query
    │       ├── schema.ts              # Chat session ownership + active workflow metadata
    │       ├── tsconfig.json
    │       └── _generated/           # Ignored Convex API/types + ai/guidelines.md
    ├── config/
    │   ├── package.json
    │   └── tsconfig.base.json         # Shared strict TS options
    ├── infra/
    │   ├── .env.schema                # Varlock deployment env imports
    │   ├── alchemy.run.ts             # Cloudflare website deployment entrypoint
    │   ├── package.json               # Alchemy dev/deploy/destroy scripts
    │   └── tsconfig.json
    └── ui/                            # Shared shadcn-style React UI
        ├── components.json            # Shared shadcn config
        ├── package.json               # Subpath exports for components/styles
        ├── postcss.config.mjs
        ├── tsconfig.json
        └── src/
            ├── styles/globals.css     # Tailwind, Vega theme tokens, Geist/Geist Mono fonts
            ├── lib/utils.ts           # Classname utility
            ├── hooks/
            │   ├── .gitkeep
            │   └── use-mobile.ts      # Responsive sidebar hook
            └── components/            # Shared shadcn primitives and message UI
                ├── accordion.tsx
                ├── alert-dialog.tsx
                ├── alert.tsx
                ├── aspect-ratio.tsx
                ├── attachment.tsx
                ├── avatar.tsx
                ├── badge.tsx
                ├── breadcrumb.tsx
                ├── bubble.tsx
                ├── button-group.tsx
                ├── button.tsx
                ├── calendar.tsx
                ├── card.tsx
                ├── carousel.tsx
                ├── chart.tsx
                ├── checkbox.tsx
                ├── collapsible.tsx
                ├── combobox.tsx
                ├── command.tsx
                ├── context-menu.tsx
                ├── dialog.tsx
                ├── direction.tsx
                ├── drawer.tsx
                ├── dropdown-menu.tsx
                ├── empty.tsx
                ├── field.tsx
                ├── hover-card.tsx
                ├── input-group.tsx
                ├── input-otp.tsx
                ├── input.tsx
                ├── item.tsx
                ├── kbd.tsx
                ├── label.tsx
                ├── marker.tsx
                ├── menubar.tsx
                ├── message-scroller.tsx
                ├── message.tsx
                ├── native-select.tsx
                ├── navigation-menu.tsx
                ├── pagination.tsx
                ├── popover.tsx
                ├── progress.tsx
                ├── questionnaire.tsx
                ├── radio-group.tsx
                ├── resizable.tsx
                ├── scroll-area.tsx
                ├── select.tsx
                ├── separator.tsx
                ├── sheet.tsx
                ├── sidebar.tsx
                ├── skeleton.tsx
                ├── slider.tsx
                ├── sonner.tsx
                ├── spinner.tsx
                ├── switch.tsx
                ├── table.tsx
                ├── tabs.tsx
                ├── textarea.tsx
                ├── toast.tsx
                ├── toggle-group.tsx
                ├── toggle.tsx
                └── tooltip.tsx
```
