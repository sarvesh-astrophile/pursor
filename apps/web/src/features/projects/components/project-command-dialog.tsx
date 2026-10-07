import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@pursor/ui/components/command";
import { useProjects } from "../hooks/use-projects";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, GithubIcon, LoaderCircleIcon, Alert01Icon } from "@hugeicons/core-free-icons";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { cn } from "@pursor/ui/lib/utils";

const formatTimeStamp = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

interface ProjectCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getProjectIcon = (project: Doc<"projects">) => {
  switch (project.importStatus) {
    case "completed":
      return GithubIcon;
    case "importing":
      return LoaderCircleIcon;
    case "failed":
      return Alert01Icon;
    default:
      return Globe02Icon;
  }
};

export const ProjectCommandDialog = ({ open, onOpenChange }: ProjectCommandDialogProps) => {
  const projects = useProjects();
  const navigate = useNavigate();
  const handleProjectSelect = (projectId: Id<"projects">) => {
    void navigate({ to: "/projects/$projectId", params: { projectId } });
    onOpenChange(false);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search projects"
      description="Search for a project to open."
    >
      <Command>
        <CommandInput placeholder="Search projects..." />
        <CommandList>
          {projects === undefined ? (
            <div role="status" className="py-6 text-center text-sm text-muted-foreground">
              Loading projects...
            </div>
          ) : (
            <>
              <CommandEmpty>No projects found.</CommandEmpty>
              <CommandGroup>
                {projects.map((project) => (
                  <ProjectItem key={project._id} project={project} onSelect={handleProjectSelect} />
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};

interface ProjectItemProps {
  project: Doc<"projects">;
  onSelect: (projectId: Id<"projects">) => void;
}

const ProjectItem = ({ project, onSelect }: ProjectItemProps) => {
  return (
    <CommandItem
      className="group"
      value={project._id}
      keywords={[project.name]}
      onSelect={() => onSelect(project._id)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <HugeiconsIcon
          icon={getProjectIcon(project)}
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            project.importStatus === "importing" && "animate-spin motion-reduce:animate-none",
          )}
        />
        <h3 className="truncate">{project.name}</h3>
      </div>
      <CommandShortcut className="shrink-0 tracking-normal">
        {formatTimeStamp(project.updatedAt)}
      </CommandShortcut>
    </CommandItem>
  );
};
