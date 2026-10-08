import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";
import { Allotment } from "allotment";
import { NavBar } from "@/features/projects/components/navbar";
import "allotment/dist/style.css";

export const Route = createFileRoute("/_auth/projects")({
  component: ProjectsLayout,
});

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;
const DEFAULT_MAIN_SIZE = 1000;


function ProjectsLayout() {
  const { projectId } = useParams({ strict: false });
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {projectId && (
        <div className="shrink-0">
          <NavBar projectId={projectId} />
        </div>
      )}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Allotment defaultSizes={[DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}>
          <Allotment.Pane
            snap
            minSize={MIN_SIDEBAR_WIDTH}
            maxSize={MAX_SIDEBAR_WIDTH}
            preferredSize={DEFAULT_CONVERSATION_SIDEBAR_WIDTH}
          >
            Sidebar Converstaion
          </Allotment.Pane>
          <Allotment.Pane>
            <Outlet />
          </Allotment.Pane>
        </Allotment>
      </main>
    </div>
  );
}
