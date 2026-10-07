import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return <div>Project ID: {projectId}</div>;
}
