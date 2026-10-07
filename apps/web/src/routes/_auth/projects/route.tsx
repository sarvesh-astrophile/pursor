import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r p-4">hi</aside>
      <main className="min-w-0 flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
