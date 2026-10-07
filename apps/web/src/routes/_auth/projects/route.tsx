import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";

import { NavBar } from "@/features/projects/components/navbar";
import { Id } from "@pursor/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_auth/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const { projectId } = useParams({ strict: false });
  return (
    <div className="w-full flex flex-col min-h-screen">
      {projectId && <NavBar projectId={projectId as Id<"projects">} />}
      <main className="min-w-0 flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
