import "varlock/auto-load";

import { dashboardDefinitions } from "./posthog-dashboards";

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(dashboardDefinitions, null, 2));
} else {
  const token = process.env.POSTHOG_ADMIN_API_KEY;
  const projectId = process.env.POSTHOG_CLI_PROJECT_ID;
  const host = new URL(process.env.POSTHOG_CLI_HOST || "https://us.posthog.com").origin;
  if (!token || !projectId)
    throw new Error(
      "Set POSTHOG_ADMIN_API_KEY and POSTHOG_CLI_PROJECT_ID before provisioning dashboards.",
    );
  const base = `${host}/api/projects/${encodeURIComponent(projectId)}`;
  async function api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `PostHog ${path} returned ${response.status}: ${(await response.text()).slice(0, 1_000)}`,
      );
    return (await response.json()) as T;
  }
  for (const definition of dashboardDefinitions) {
    const found = await api<{ results: { id: number; name: string; deleted: boolean }[] }>(
      `dashboards/?search=${encodeURIComponent(definition.name)}&limit=100`,
    );
    let dashboard = found.results.find((item) => item.name === definition.name && !item.deleted);
    dashboard ??= await api<{ id: number; name: string; deleted: boolean }>("dashboards/", {
      name: definition.name,
      description:
        "Pursor research telemetry. Rolling 30-day window; model cost excludes Context.dev credits.",
    });
    const detail = await api<{ tiles: { insight?: { name: string }; deleted?: boolean }[] }>(
      `dashboards/${dashboard.id}/`,
    );
    const existing = new Set(
      detail.tiles.filter((tile) => !tile.deleted).map((tile) => tile.insight?.name),
    );
    for (const insight of definition.insights) {
      if (existing.has(insight.name)) continue;
      await api("insights/", {
        name: insight.name,
        description: "Managed by apps/web/scripts/setup-posthog.ts",
        dashboards: [dashboard.id],
        query: {
          kind: "DataVisualizationNode",
          display: "ActionsTable",
          source: { kind: "HogQLQuery", query: insight.sql },
        },
        tags: ["pursor"],
      });
    }
    console.log(`${definition.name}: ${host}/project/${projectId}/dashboard/${dashboard.id}`);
  }
}
