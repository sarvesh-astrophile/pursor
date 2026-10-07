import UserMenu from "@/features/auth/components/user-menu";
import type { Id } from "@pursor/backend/convex/_generated/dataModel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@pursor/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";
import { useProjectById, useRenameProject } from "../hooks/use-projects";
import { useRef, useState } from "react";
import { Input } from "@pursor/ui/components/input";
import { Button } from "@pursor/ui/components/button";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit03Icon } from "@hugeicons/core-free-icons";

export function NavBar({ projectId }: { projectId: Id<"projects"> }) {
  const project = useProjectById(projectId);
  const renameProject = useRenameProject(projectId);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editing = useRef(false);
  const [newName, setNewName] = useState(project?.name ?? "");
  const handleStartRename = () => {
    if (!project || isSaving) return;
    setNewName(project.name);
    editing.current = true;
    setIsRenaming(true);
  };

  const handleSaveRename = async () => {
    if (!editing.current) return;
    editing.current = false;
    setIsRenaming(false);
    const name = newName.trim();
    if (!project || !name || name === project.name) return;

    setIsSaving(true);
    try {
      await renameProject({ name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename project.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <nav className="flex justify-between items-center gap-x-2 p-2 bg-sidebar border-b">
      <div className="flex items-center gap-x-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link to="/" className="flex items-center gap-x-2">
                    <img src="/logo.svg" alt="Pursor" className="size-4" />
                    Pursor
                  </Link>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isRenaming ? (
                  <Input
                    autoFocus
                    aria-label="Project name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    onBlur={() => void handleSaveRename()}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        editing.current = false;
                        setIsRenaming(false);
                      }
                    }}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStartRename}
                    disabled={!project || isSaving}
                    className="cursor-pointer gap-1 disabled:cursor-default"
                    aria-label="Rename project"
                  >
                    <span>{project?.name ?? "Loading..."}</span>
                    {project && (
                      <HugeiconsIcon
                        icon={Edit03Icon}
                        className="size-3.5 text-muted-foreground inline"
                      />
                    )}
                  </Button>
                )}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <UserMenu />
    </nav>
  );
}
