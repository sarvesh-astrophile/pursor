import { ProjectIdView } from "@/features/projects/components/project-id-view";
import { createFileRoute } from "@tanstack/react-router";
import type { Id } from "@pursor/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  params: {
    parse: ({ projectId }) => ({
      projectId: projectId as Id<"projects">,
    }),
    stringify: ({ projectId }) => ({ projectId }),
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return <ProjectIdView projectId={projectId} />;
}
