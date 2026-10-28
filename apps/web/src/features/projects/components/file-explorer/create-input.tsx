import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
  onSubmit: (name: string) => void | Promise<unknown>;
}) => {
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);

  const handleSubmit = async () => {
    if (submitted.current) return;
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      submitted.current = true;
      onCancel();
      return;
    }
    submitted.current = true;
    setIsPending(true);
    try {
      await onSubmit(trimmedValue);
    } catch (error) {
      submitted.current = false;
      setIsPending(false);
      toast.error(error instanceof Error ? error.message : "Unable to create item.");
      inputRef.current?.focus();
    }
  };
  return (
    <div
      className="w-full flex items-center gap-1 h-5.5 bg-accent/30"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <div className="flex items-center gap-0.5">
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
        ref={inputRef}
        autoFocus
        aria-label={`New ${type} name`}
        aria-busy={isPending}
        readOnly={isPending}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex min-w-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset focus:ring-ring"
        onBlur={() => void handleSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            void handleSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (submitted.current) return;
            submitted.current = true;
            onCancel();
          }
        }}
      />
    </div>
  );
};
