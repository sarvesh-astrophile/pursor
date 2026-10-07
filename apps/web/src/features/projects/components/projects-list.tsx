import { Spinner } from "@pursor/ui/components/spinner";
import { Button, buttonVariants } from "@pursor/ui/components/button";
import { Kbd } from "@pursor/ui/components/kbd";
import { Doc } from "@pursor/backend/convex/_generated/dataModel";
import { cn } from "@pursor/ui/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Globe02Icon,
  ArrowRight02Icon,
  GithubIcon,
  LoaderCircleIcon,
  Alert01Icon,
} from "@hugeicons/core-free-icons";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { useProjectsPartial } from "../hooks/use-projects";
import { useHotkey } from "@tanstack/react-hotkeys";

const formatTimeStamp = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

interface ProjectsListProps {
  onViewAll: () => void;
}

export const ProjectsList = ({ onViewAll }: ProjectsListProps) => {
  const projects = useProjectsPartial(6);
  const [mostRecent, ...rest] = projects ?? [];
  useHotkey("Mod+K", onViewAll, {
    preventDefault: true,
    ignoreInputs: false,
    requireReset: true,
  });

  if (projects === undefined) return <Spinner className="size-4" />;

  return (
    <div className="flex flex-col gap-4">
      {mostRecent && <ContinueCard project={mostRecent} />}
      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs text-muted-foreground">Recent Projects </h2>
            <Button
              className="text-xs text-muted-foreground"
              variant="ghost"
              onClick={onViewAll}
              aria-keyshortcuts="Meta+K Control+K"
            >
              <span>View All</span>
              <Kbd className="px-2">Cmd/Ctrl + K</Kbd>
            </Button>
          </div>
          <ul className="flex flex-col">
            {rest.map((project) => (
              <ProjectItem key={project._id} project={project} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

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

const ProjectItem = ({ project }: { project: Doc<"projects"> }) => {
  return (
    <Link
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "text-sm text-foreground/50 font-normal hover:text-foreground py-1 flex items-center gap-2 justify-between w-full group",
      )}
      to="/projects/$projectId"
      params={{ projectId: project._id }}
    >
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={getProjectIcon(project)}
          className={cn(
            "size-3.5 text-muted-foreground",
            project.importStatus === "importing" && "animate-spin motion-reduce:animate-none",
          )}
        />
        <h3 className="truncate">{project.name}</h3>
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground/60 transition-colors">
        {formatTimeStamp(project.updatedAt)}
      </span>
    </Link>
  );
};

const ContinueCard = ({ project }: { project: Doc<"projects"> }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">Last updated</span>
      <Button
        variant="outline"
        className="h-auto items-start justify-start p-4
        bg-background border flex flex-col gap-2 group"
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={getProjectIcon(project)}
              className="size-3.5 text-muted-foreground"
            />
            <span className="font-medium truncate">{project.name}</span>
          </div>
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform"
          />
        </div>
        <span className="text-xs text-muted-foreground">{formatTimeStamp(project.updatedAt)}</span>
      </Button>
    </div>
  );
};
