import { useState } from "react";
import { ScrollArea } from "@pursor/ui/components/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@pursor/ui/lib/utils";
import { Id } from "@pursor/backend/convex/_generated/dataModel";
import { useProjectById } from "../../hooks/use-projects";
import { Button } from "@pursor/ui/components/button";

export const FileExplorer = ({ projectId }: { projectId: Id<"projects"> }) => {
  const [isOpen, setIsOpen] = useState(false);
  const project = useProjectById(projectId);
  return (
    <div className="h-full bg-sidebar">
      <ScrollArea>
        <div
          role="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group/project cursor-pointer w-full text-left flex font-mono items-center gap-0.5 h-5.5 bg-accent font-bold"
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <p className="text-xs uppercase line-clamp-1">{project?.name ?? "Loading..."}</p>
          <div className="opacity-0 group-hover/project:opacity-100 transition-none duration-0 flex items-center gap-0.5 ml-auto">
            <Button variant="ghost" size="icon" className="size-5 p-0">
              hi{" "}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
