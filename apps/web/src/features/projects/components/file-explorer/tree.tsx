import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@pursor/ui/lib/utils";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import {
  useRenameFile,
  useDeleteFile,
  useCreateFile,
  useCreateFolder,
  useFolderContents,
} from "../../hooks/use-files";
import { LoadingRow } from "./loading-row";
import { CreateInput } from "./create-input";
import { RenameInput } from "./rename-input";

import { Id, Doc } from "@pursor/backend/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { TreeItemWrapper } from "./tree-item-wrapper";

export const Tree = ({
  item,
  level = 0,
  projectId,
  activeFileId,
  onOpenFile,
  onDeleteItem,
  onRenameItem,
  ancestorIds = [],
}: {
  item: Doc<"files">;
  level?: number;
  projectId: Id<"projects">;
  activeFileId?: Id<"files">;
  onOpenFile?: (file: Doc<"files">, ancestorIds: Id<"files">[]) => void;
  onDeleteItem?: (id: Id<"files">) => void;
  onRenameItem?: (id: Id<"files">, name: string) => void;
  ancestorIds?: Id<"files">[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const createFile = useCreateFile();
  const createFolder = useCreateFolder();
  const folderContents = useFolderContents({
    projectId,
    parentId: item._id,
    enabled: item.type === "folder" && isOpen,
  });

  const handleCreate = async (name: string) => {
    if (!creating) return;
    if (creating === "file") {
      await createFile({ parentId: item._id, name, content: "", projectId });
    } else {
      await createFolder({ parentId: item._id, name, projectId });
    }
    setCreating(null);
  };

  const handleRename = async (name: string) => {
    if (name !== item.name) {
      await renameFile({ id: item._id, newName: name });
      onRenameItem?.(item._id, name);
    }
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteFile({ id: item._id });
      onDeleteItem?.(item._id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renameInput = (
    <RenameInput
      type={item.type}
      level={level}
      initialValue={item.name}
      label={`Rename ${item.name}`}
      onSubmit={handleRename}
      onCancel={() => setIsRenaming(false)}
    />
  );

  const startCreating = (type: "file" | "folder") => {
    setIsOpen(true);
    setCreating(type);
  };

  if (item.type === "file") {
    if (isRenaming) return renameInput;
    const fileName = item.name;
    return (
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={activeFileId === item._id}
        onClick={() => onOpenFile?.(item, ancestorIds)}
        onDoubleClick={() => onOpenFile?.(item, ancestorIds)}
        onRename={() => setIsRenaming(true)}
        onDelete={() => void handleDelete()}
      >
        <FileIcon fileName={fileName} autoAssign className="size-4" />
        <span className="truncate text-sm">{fileName}</span>
      </TreeItemWrapper>
    );
  } else {
    const folderName = item.name;
    const folderRender = (
      <>
        <div className="flex items-center gap-0.5">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className={cn("size-4 shrink-0 text-muted-foreground", isOpen && "rotate-90")}
          />
          <FolderIcon folderName={folderName} className="size-4" />
        </div>
        <span className="truncate text-sm">{folderName}</span>
      </>
    );
    return (
      <>
        {isRenaming ? (
          renameInput
        ) : (
          <TreeItemWrapper
            item={item}
            level={level}
            onClick={() => setIsOpen((value) => !value)}
            onRename={() => setIsRenaming(true)}
            onDelete={() => void handleDelete()}
            onCreateFile={() => startCreating("file")}
            onCreateFolder={() => startCreating("folder")}
          >
            {folderRender}
          </TreeItemWrapper>
        )}
        {isOpen && (
          <>
            {folderContents === undefined && <LoadingRow level={level + 1} />}
            {creating && (
              <CreateInput
                key={creating}
                level={level + 1}
                onSubmit={handleCreate}
                type={creating}
                onCancel={() => setCreating(null)}
              />
            )}
            {folderContents?.map((subItem) => (
              <Tree
                key={subItem._id}
                item={subItem}
                level={level + 1}
                projectId={projectId}
                activeFileId={activeFileId}
                onOpenFile={onOpenFile}
                onDeleteItem={onDeleteItem}
                onRenameItem={onRenameItem}
                ancestorIds={[...ancestorIds, item._id]}
              />
            ))}
          </>
        )}
      </>
    );
  }
};
