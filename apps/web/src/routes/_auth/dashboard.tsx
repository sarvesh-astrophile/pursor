import { createFileRoute } from "@tanstack/react-router";

import { ResearchChat } from "@/components/research-chat";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardContent,
});

function DashboardContent() {
  return <ResearchChat />;
}
