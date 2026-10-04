import { createFileRoute } from "@tanstack/react-router";

import { ProjectsView } from "@/features/projects/components/projects-view";

export const Route = createFileRoute("/_auth/")({
  component: ProjectsView,
});
