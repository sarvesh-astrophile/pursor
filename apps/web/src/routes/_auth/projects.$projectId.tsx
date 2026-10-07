import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_auth/projects/$projectId"!</div>;
}
