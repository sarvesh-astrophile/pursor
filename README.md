# pursor

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Convex** - Reactive backend-as-a-service platform
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Vite+** - Unified Vite toolchain, workspace task runner, linting, and formatting
- **PostHog** - Product analytics, AI model/tool observability, and error tracking

## PostHog

Analytics are integrated into the web app, Convex chat lifecycle, and AI generation
actions. See [the PostHog setup guide](docs/posthog.md) for project tokens, identity
stitching, transcript recording, source-map uploads, and dashboard provisioning.
From `apps/web`, `bun run analytics:setup` provisions Usage, Performance,
Reliability, and AI Cost dashboards once its API credentials are configured.

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
bun run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

The PostHog component requires a token environment variable. Set your project
token, or an empty value to keep analytics disabled, from `packages/backend`:

```bash
bunx convex env set POSTHOG_PROJECT_TOKEN ''
```

Copy environment variables from `packages/backend/.env.local` to `apps/*/.env`.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Your app will connect to the Convex cloud backend automatically.

## Durable AI Agent Demo

The backend combines `@convex-dev/workflow` and `@convex-dev/agent` to ask
**“who are you”** using **DeepSeek V4.1 Flash** through
[OpenCode Zen](https://opencode.ai/docs/zen/).
The supported API model ID is `deepseek-v4.1-flash`.

1. Get an OpenCode Zen API key from [OpenCode](https://opencode.ai/auth), with
   billing configured and access to the model enabled.
2. In the Convex dashboard, set `OPENCODE_API_KEY` on your development deployment.
   This is a backend secret; it does not belong in the web app's environment.
3. Run `bun run dev:server` from the repository root to deploy the components
   and generate Convex types.
4. From `packages/backend`, start the demo:

   ```bash
   bunx convex run agentDemo:start '{}'
   ```

   This returns a workflow ID immediately. Use it to check progress:

   ```bash
   bunx convex run agentDemo:status '{"workflowId":"YOUR_WORKFLOW_ID"}'
   ```

   Repeat the status call until `type` is `completed`. Its `result` contains
   `{ threadId, text }`, including the agent's introduction. A failed run returns
   `type: "failed"` and an `error`.

The workflow durably creates a conversation thread and saves the prompt before
running the LLM in an action step. The action has up to three attempts with
exponential backoff; each attempt reuses the saved prompt ID. The Agent component
persists the conversation, and the Workflow component retains progress and the
final result. The start and status functions are internal, accessible through
the CLI/dashboard. Workflow records remain available for inspection until cleaned
up through the Workflow component.

## Context.dev Research Agent

`packages/backend/convex/contextAgent.ts` adds a durable research agent powered
by the same DeepSeek/OpenCode model, with three Context.dev tools:

- `searchWeb`: live web search with source URLs.
- `readPage`: read a URL as Markdown (one-hour API cache, bounded page content).
- `lookupBrand`: retrieve company brand metadata and logos by domain.

Set both `OPENCODE_API_KEY` and `CONTEXT_DEV_API_KEY` in the Convex deployment's
environment settings. Get the Context.dev key from [Context.dev](https://context.dev).
The Context.dev component requires its key in the env contract, so configure it
before deploying the updated backend. Keep both keys out of frontend env files.

From `packages/backend`, deploy and start a research task:

```bash
bunx convex dev --once
bunx convex run contextAgent:start '{"prompt":"Research Convex and summarize its main features, with source links."}'
```

Use the returned workflow ID to retrieve the answer:

```bash
bunx convex run contextAgent:status '{"workflowId":"YOUR_WORKFLOW_ID"}'
```

Completed status contains `result: { threadId, text }`. For a brand lookup, try
`{"prompt":"Look up stripe.com and summarize its brand, including logo URLs."}`.
Each start creates a new persisted Agent thread. The model selects tools as
needed, with at most six model steps; the last step is reserved for the answer.
Tool calls and results are recorded in Agent messages. Context.dev itself does
not persist scraped data in Convex.

The entrypoints are internal CLI/dashboard functions. The workflow retries the
generation action up to three attempts and reuses the saved user prompt; retries
can repeat model and Context.dev requests and consume additional credits.

## Dashboard Chat Playground

Sign in and open `/dashboard` to test the Context.dev research agent. The chat
uses TanStack AI's `useChat` with a custom Convex connection adapter; real Agent
tool activity and assistant text are delivered through Convex subscriptions as
AG-UI events while generation is running. The Agent's `streamText` call persists
word-chunked deltas, throttled to 100 ms; the connection emits only new text and
tool arguments from each update.

- Try the **Search the web**, **Read a page**, and **Look up a brand** starter prompts.
- Tool cards show the live request and running/done/failed status. Expand them
  to inspect inputs, results, and failures.
- Send follow-up questions in the same conversation; **New chat** creates a fresh thread.
- Press Enter to send, or Shift+Enter for a new line.
- Use the composer's **+** menu to insert a research prompt.
- The transcript follows the stream while you're at the bottom, preserves your
  position when you scroll up, and offers a jump-to-latest button.

The backend requires authentication and checks chat ownership before sending or
reading. It allows one active reply per conversation. Agent messages stay in the
Agent component; `chatSessions` only stores ownership and current workflow metadata.
The simple playground keeps its visible transcript in memory, so reloading the
page starts a new chat. Backend records remain persisted.

The existing Geist font imports provide the font variables used by
`packages/ui/src/styles/typeset.css`. The `.typeset-chat` preset styles assistant
Markdown only; tool cards and user messages keep their own styling.

Run the connection adapter's integration checks from `apps/web`:

```bash
bun test src/features/research/lib/convex-chat.test.js
```

## GitHub Authentication

Both authentication forms offer **Continue with GitHub**, using Better Auth's built-in GitHub social provider and the existing Convex component.

1. Create an OAuth app in [GitHub Developer Settings](https://github.com/settings/developers).
2. For local development, set the homepage URL to `http://localhost:3001` and the authorization callback URL to `http://localhost:3001/api/auth/callback/github`.
3. In the Convex dashboard, select your development deployment and configure these environment variables:

   | Variable               | Value                                 |
   | ---------------------- | ------------------------------------- |
   | `SITE_URL`             | `http://localhost:3001`               |
   | `GITHUB_CLIENT_ID`     | Your GitHub OAuth app's client ID     |
   | `GITHUB_CLIENT_SECRET` | Your GitHub OAuth app's client secret |

4. Run `bun run dev`, open `/dashboard`, and choose **Continue with GitHub**.

The provider is enabled when both GitHub credentials are configured. Without them, email/password authentication remains available and the GitHub button reports a sign-in error.

GitHub credentials belong in the Convex deployment environment, not the frontend `.env` file. Keep the client secret out of source control.

For production, create a separate GitHub OAuth app with your production origin as its homepage URL and `https://your-app-domain.com/api/auth/callback/github` as its authorization callback URL. Configure that app's credentials and the production `SITE_URL` on the production Convex deployment.

The `/api/auth/callback/github` endpoint receives GitHub's OAuth response. After successful authentication, users are redirected to `/dashboard`; cancelled or failed authentication also returns there with an error message and a retry button.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@pursor/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

The web generator defaults to `src/app/components`, `src/app/lib`, and
`src/app/hooks`. Move feature-specific blocks into their owning feature and
update their imports. Create library/hook directories when they contain actual code.

## Web Code Organization

`apps/web/src` is organized by ownership:

```text
src/
├── app/
│   ├── components/    # Header, router loader, and theme toggle
│   ├── providers/     # Theme context and pre-hydration script
│   └── analytics/     # Browser/server PostHog integration, provider, and tests
├── features/
│   ├── auth/          # Auth components, client/server integration, route tests
│   ├── projects/      # Projects components and data hooks
│   └── research/      # Chat components, suggestions, streaming adapter/tests
├── routes/            # Route definitions, guards, loaders, and page composition
├── router.tsx         # Router and Convex/TanStack Query integration
├── start.ts           # Server request middleware
├── env.public.ts      # Browser-safe environment values
├── env.ts             # Generated environment types
├── routeTree.gen.ts   # Generated route tree
└── index.css          # Shared UI stylesheet import
```

- Put feature-owned components, hooks, and utilities under `features/<feature>`.
- Put application-wide shell, providers, and services under `app`.
- Keep generic UI primitives in `packages/ui` and backend functions in `packages/backend`.
- Keep tests alongside the area they verify. Auth route tests live in
  `features/auth/auth-routes.vitest.test.ts`, outside route discovery.
- Use `@/` imports across areas and relative imports within an area. Keep browser
  and server integrations as separate direct imports.
- Add subdirectories as needed rather than creating empty folder templates.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

For Cloudflare, Alchemy loads and validates deployment inputs with `varlock/auto-load` in its Node/Bun deployment process. Worker code reads native bindings; web clients use the framework's public env API through `src/env.public.ts` where needed. Alchemy supplies resource URLs and managed database credentials. In-Worker Varlock protections are deferred until an official Alchemy integration is available; see [the non-Wrangler deployment guidance](https://varlock.dev/integrations/cloudflare/#non-wrangler-deploy-tools-alchemy-sst-pulumi).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Deployment

### Alchemy

- Target: web on Cloudflare
- Configure provider accounts: `cd packages/infra && bunx alchemy profile edit`
- Local web + Convex dev: bun run dev
- Cloudflare/Alchemy dev: bun run --filter @pursor/infra dev
- Deploy: bun run deploy
- Destroy: bun run destroy

`alchemy profile edit` stores the selected Axiom, Cloudflare, Neon, PlanetScale, and/or Prisma provider profiles under `~/.alchemy`; no provider-specific setup command is required by this scaffold.

Deploys are staged and default to a personal `dev_<username>` stage. For production, run the deploy with an explicit stage from `packages/infra`:

```bash
cd packages/infra && bunx alchemy deploy --stage production
```

## Git Hooks and Formatting

- Optional native Vite+ hooks: `bun run hooks:setup`
- Docs: [Vite+ commit hooks](https://viteplus.dev/guide/commit-hooks)
- Run checks: `bun run check`

## Project Structure

```
pursor/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── backend/     # Convex backend functions and schema
```

## Available Scripts

- `bun run dev`: Start the web app and Convex backend in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:setup`: Setup and configure your Convex project
- `bun run check-types`: Check TypeScript types across all apps
- `bun run check`: Run Vite+ format/lint checks and workspace TypeScript checks
- `bun run lint`: Run Vite+ lint checks
- `bun run format`: Run Vite+ formatting
- `bun run staged`: Run Vite+ checks against staged files
- `bun run hooks:setup`: Install Vite+ native Git hooks with `vp config`
