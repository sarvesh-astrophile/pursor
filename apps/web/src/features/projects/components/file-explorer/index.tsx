import { useState } from "react";
import { ScrollArea } from "@pursor/ui/components/scroll-area";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CopyMinusIcon,
  FilePlusCornerIcon,
  FolderPlusIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@pursor/ui/lib/utils";
import type { Doc, Id } from "@pursor/backend/convex/_generated/dataModel";
import { useProjectById } from "../../hooks/use-projects";
import { Button } from "@pursor/ui/components/button";
import { useCreateFile, useCreateFolder, useFolderContents } from "../../hooks/use-files";
import { CreateInput } from "./create-input";
import { LoadingRow } from "./loading-row";
import { Tree } from "./tree";

export const FileExplorer = ({
  projectId,
  activeFileId,
  onOpenFile,
  onDeleteItem,
  onRenameItem,
}: {
  projectId: Id<"projects">;
  activeFileId?: Id<"files">;
  onOpenFile?: (file: Doc<"files">, ancestorIds: Id<"files">[]) => void;
  onDeleteItem?: (id: Id<"files">) => void;
  onRenameItem?: (id: Id<"files">, name: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collapseKey, setCollapseKey] = useState(0);
  const project = useProjectById(projectId);
  const rootFiles = useFolderContents({ projectId, enabled: isOpen });
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const createFile = useCreateFile();
  const createFolder = useCreateFolder();
  const handleCreate = async (name: string) => {
    if (!creating) return;
    if (creating === "file") {
      await createFile({
        projectId,
        name,
        content: "",
        parentId: undefined,
      });
    } else if (creating === "folder") {
      await createFolder({
        projectId,
        name,
        parentId: undefined,
      });
    }
    setCreating(null);
  };
  return (
    <div className="h-full min-h-0 overflow-hidden bg-sidebar">
      <ScrollArea className="h-full w-full">
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
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsOpen(true);
                setCreating("file");
              }}
              variant="highlight"
              size="icon-xs"
              className=""
            >
              <HugeiconsIcon icon={FilePlusCornerIcon} color="currentColor" className="size-3.5" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsOpen(true);
                setCreating("folder");
              }}
              variant="highlight"
              size="icon-xs"
            >
              <HugeiconsIcon icon={FolderPlusIcon} color="currentColor" className="size-3.5" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setCollapseKey((prev) => prev + 1);
              }}
              variant="highlight"
              size="icon-xs"
            >
              <HugeiconsIcon icon={CopyMinusIcon} color="currentColor" className="size-3.5" />
            </Button>
          </div>
        </div>
        {isOpen && (
          <>
            {rootFiles === undefined && <LoadingRow level={0} />}
            {creating && (
              <CreateInput
                key={creating}
                type={creating}
                level={0}
                onCancel={() => setCreating(null)}
                onSubmit={handleCreate}
              />
            )}
            {rootFiles?.map((item) => (
              <Tree
                key={`${item._id}-${collapseKey}`}
                item={item}
                level={0}
                projectId={projectId}
                activeFileId={activeFileId}
                onOpenFile={onOpenFile}
                onDeleteItem={onDeleteItem}
                onRenameItem={onRenameItem}
              />
            ))}
          </>
        )}
      </ScrollArea>
    </div>
  );
};
