import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { useState } from "react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getItemPadding } from "./constants";

export const CreateInput = ({
  type,
  level,
  onCancel,
  onSubmit,
}: {
  type: "file" | "folder";
  level: number;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  };
  return (
    <div
      className="w-full flex items-center gap-1 h-5.5 bg-accent/30"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="flex item-center gap-0.5">
        {type === "folder" && (
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        {type === "file" && <FileIcon fileName={value} autoAssign className="size-4" />}
        {type === "folder" && <FolderIcon folderName={value} className="size-4" />}
      </div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset foucs:ring-ring"
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
    </div>
  );
};
