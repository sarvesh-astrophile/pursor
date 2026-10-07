import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: ProjectPage,
});

function ProjectPage({ projectId }: { projectId: string }) {
  return <div>Hi project {projectId}</div>;
}
