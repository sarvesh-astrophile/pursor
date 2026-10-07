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
import { useProjectById } from "../hooks/use-projects";
import { useRenameProject } from "../hooks/use-projects";
import { useState } from "react";

export function NavBar({ projectId }: { projectId: Id<"projects"> }) {
  const project = useProjectById(projectId);
  const renameProject = useRenameProject(projectId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project?.name ?? "");

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
              <BreadcrumbPage>{project?.name ?? "Loading..."}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <UserMenu />
    </nav>
  );
}
