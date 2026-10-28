import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { cn } from "@pursor/ui/lib/utils";
import { Allotment } from "allotment";
import { useState } from "react";
import { FileExplorer } from "./file-explorer";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 350;
const DEFAULT_MAIN_SIZE = 1000;

const Tab = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2 h-full px-3 cursor-pointer text-muted-foreground border-r hover:bg-accent/30",
        isActive && "bg-background text-foreground",
      )}
      onClick={onClick}
    >
      <span className="text-sm">{label}</span>
    </button>
  );
};

export const ProjectIdView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");
  const [selection, setSelection] = useState<{
    file: Doc<"files">;
    ancestorIds: Id<"files">[];
  } | null>(null);
  const selected = selection?.file.projectId === projectId ? selection : null;
  return (
    <div className="h-full flex flex-col">
      <nav className="h-8.75 flex items-center bg-sidebar border-b">
        <Tab
          label="code"
          isActive={activeView === "editor"}
          onClick={() => setActiveView("editor")}
        />
        <Tab
          label="preview"
          isActive={activeView === "preview"}
          onClick={() => setActiveView("preview")}
        />
        <div className="flex flex-1 justify-end h-full">
          <div
            className="flex items-center gap-1.5 h-full
            px-3 cursor-pointer text-muted-foreground border-l hover:bg-accent/30"
          >
            <HugeiconsIcon icon={GithubIcon} className="size-3.5" />
            <span className="text-sm">Export</span>
          </div>
        </div>
      </nav>
      <div className="flex-1 min-h-0 relative">
        <div className={cn("absolute inset-0", activeView === "editor" ? "visible" : "invisible")}>
          <Allotment defaultSizes={[DEFAULT_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}>
            <Allotment.Pane
              snap
              minSize={MIN_SIDEBAR_WIDTH}
              maxSize={MAX_SIDEBAR_WIDTH}
              preferredSize={DEFAULT_SIDEBAR_WIDTH}
            >
              <FileExplorer
                key={projectId}
                projectId={projectId}
                activeFileId={selected?.file._id}
                onOpenFile={(file, ancestorIds) => setSelection({ file, ancestorIds })}
                onDeleteItem={(id) => {
                  setSelection((current) =>
                    current && (current.file._id === id || current.ancestorIds.includes(id))
                      ? null
                      : current,
                  );
                }}
                onRenameItem={(id, name) => {
                  setSelection((current) =>
                    current?.file._id === id
                      ? { ...current, file: { ...current.file, name } }
                      : current,
                  );
                }}
              />
            </Allotment.Pane>
            <Allotment.Pane>
              {selected ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b px-3 py-1 text-sm">
                    <span className="truncate">{selected.file.name}</span>
                    <button
                      type="button"
                      aria-label={`Close ${selected.file.name}`}
                      onClick={() => setSelection(null)}
                    >
                      Close
                    </button>
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto p-3 text-sm">
                    {selected.file.content ?? "No text content available."}
                  </pre>
                </div>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">
                  Select a file to view its contents.
                </p>
              )}
            </Allotment.Pane>
          </Allotment>
        </div>
        <div className={cn("absolute inset-0", activeView === "preview" ? "visible" : "invisible")}>
          preview
        </div>
      </div>
    </div>
  );
};
