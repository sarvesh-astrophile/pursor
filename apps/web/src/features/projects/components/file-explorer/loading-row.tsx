import { cn } from "@pursor/ui/lib/utils";
import { Spinner } from "@pursor/ui/components/spinner";
import { getItemPadding } from "./constants";

export const LoadingRow = ({ level, className }: { level: number; className?: string }) => {
  return (
    <div
      className={cn("h-5.5 flex items-center text-muted-foreground", className)}
      style={{ paddingLeft: getItemPadding(level, false) }}
    >
      <Spinner className="size-4 text-ring ml-0.5" />
    </div>
  );
};
