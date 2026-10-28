import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";
import { toast } from "sonner";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getItemPadding } from "./constants";

export const RenameInput = ({
  type,
  level,
  onCancel,
  onSubmit,
  initialValue = "",
  label,
}: {
  type: "file" | "folder";
  level: number;
  onCancel: () => void;
  onSubmit: (name: string) => void | Promise<unknown>;
  initialValue?: string;
  label?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard late blur events after Enter or Escape, including while submitting.
  const submitted = useRef(false);

  const form = useForm({
    defaultValues: { name: initialValue },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (!name) {
        onCancel();
        return;
      }
      try {
        await onSubmit(name);
      } catch (error) {
        submitted.current = false;
        toast.error(error instanceof Error ? error.message : "Unable to rename item.");
        inputRef.current?.focus();
      }
    },
  });

  const handleSubmit = () => {
    if (submitted.current) return;
    submitted.current = true;
    void form.handleSubmit();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }}
      className="w-full flex items-center gap-1 h-5.5 bg-accent/30"
      style={{ paddingLeft: getItemPadding(level, type === "file") }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <form.Field name="name">
            {(field) => (
              <>
                <div className="flex items-center gap-0.5">
                  {type === "folder" && (
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  {type === "file" && (
                    <FileIcon fileName={field.state.value} autoAssign className="size-4" />
                  )}
                  {type === "folder" && (
                    <FolderIcon folderName={field.state.value} className="size-4" />
                  )}
                </div>
                <input
                  ref={inputRef}
                  autoFocus
                  aria-label={label ?? `Rename ${type}`}
                  name={field.name}
                  aria-busy={isSubmitting}
                  readOnly={isSubmitting}
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="flex min-w-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-inset focus:ring-ring"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => {
                    field.handleBlur();
                    handleSubmit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (submitted.current) return;
                      submitted.current = true;
                      onCancel();
                    }
                  }}
                />
              </>
            )}
          </form.Field>
        )}
      </form.Subscribe>
    </form>
  );
};
