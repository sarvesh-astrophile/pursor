import { Edit03Icon, GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Id } from "@pursor/backend/convex/_generated/dataModel";
import { cn } from "@pursor/ui/lib/utils";
import { useState } from "react";

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
    <div
      className={cn(
        "flex items-center gap-2 h-full px-3 cursor-pointer text-muted-foreground border-r hover:bg-accent/30",
        isActive && "bg-background text-foreground",
      )}
      onClick={onClick}
    >
      <span className="text-sm">{label}</span>
    </div>
  );
};

export const ProjectIdView = ({ projectId }: { projectId: Id<"projects"> }) => {
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");
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
      <div className="flex-1 relative">
        <div className={cn("absolute inset-0", activeView === "editor" ? "visible" : "invisible")}>
          editor
        </div>
      </div>
      <div className="flex-1 relative">
        <div className={cn("absolute inset-0", activeView === "preview" ? "visible" : "invisible")}>
          preview
        </div>
      </div>
    </div>
  );
};
