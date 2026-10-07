import type { UIMessage } from "@tanstack/ai-react";
import {
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Globe,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { captureResearchEvent } from "@/app/analytics/posthog";

type MessagePart = UIMessage["parts"][number];
type ToolCallPart = Extract<MessagePart, { type: "tool-call" }>;
type ToolResultPart = Extract<MessagePart, { type: "tool-result" }>;

const toolLabels: Record<string, { label: string; icon: typeof Search }> = {
  searchWeb: { label: "Search the web", icon: Search },
  readPage: { label: "Read page", icon: Globe },
  lookupBrand: { label: "Look up brand", icon: Building2 },
};

function formatToolData(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2) ?? "";
}

function toolInputPreview(input: string): string {
  try {
    const value: unknown = JSON.parse(input);
    if (value && typeof value === "object") {
      for (const key of ["query", "url", "domain"]) {
        if (key in value) {
          const field: unknown = Reflect.get(value, key);
          if (typeof field === "string") return field;
        }
      }
    }
  } catch {
    /* The model may still be streaming tool arguments. */
  }
  return input || "Preparing the request…";
}

export function ToolCallCard({
  part,
  result,
  busy,
}: {
  part: ToolCallPart;
  result?: ToolResultPart;
  busy: boolean;
}) {
  const failed = part.state === "error";
  const finished = !!result || part.state === "complete";
  const running = busy && !finished && !failed;
  const { label, icon: Icon } = toolLabels[part.name] ?? {
    label: part.name,
    icon: Sparkles,
  };

  return (
    <div className="not-typeset overflow-hidden rounded-xl border bg-muted/20">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={toolInputPreview(part.arguments)}
          >
            {toolInputPreview(part.arguments)}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] ${failed ? "bg-destructive/10 text-destructive" : finished ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-background text-muted-foreground"}`}
        >
          {failed ? (
            <CircleAlert className="size-3" />
          ) : finished ? (
            <Check className="size-3" />
          ) : running ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          {failed ? "Failed" : finished ? "Done" : running ? "Running" : "Interrupted"}
        </span>
      </div>
      <details
        className="group border-t"
        onToggle={(event) => {
          if (event.currentTarget.open)
            captureResearchEvent("research_tool_details_opened", {
              tool_name: part.name,
            });
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          View tool call{" "}
          <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              {part.name} · input
            </p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-background p-2.5 font-mono text-xs whitespace-pre-wrap break-all">
              {formatToolData(part.arguments)}
            </pre>
          </div>
          {result && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {failed ? "Error" : "Result"}
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-background p-2.5 font-mono text-xs whitespace-pre-wrap break-all">
                {formatToolData(part.output ?? result.content)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
