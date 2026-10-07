import { MessageScrollerItem } from "@pursor/ui/components/message-scroller";
import type { UIMessage } from "@tanstack/ai-react";
import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ToolCallCard } from "./tool-call-card";

export function ChatMessage({
  message,
  scrollAnchor,
  busy,
}: {
  message: UIMessage;
  scrollAnchor: boolean;
  busy: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <MessageScrollerItem
      messageId={message.id}
      scrollAnchor={scrollAnchor}
      className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
    >
      <article
        className={
          isUser
            ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-3"
            : "flex min-w-0 gap-3"
        }
      >
        {!isUser && (
          <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{isUser ? "You" : "Pursor"}</p>
          {message.parts.map((part, index) => {
            if (part.type === "text")
              return isUser ? (
                <p key={index} className="whitespace-pre-wrap text-sm">
                  {part.content}
                </p>
              ) : (
                <div key={index} className="typeset typeset-chat max-w-[28em] overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
                </div>
              );
            if (part.type !== "tool-call") return null;
            const result = message.parts.find(
              (item) => item.type === "tool-result" && item.toolCallId === part.id,
            );
            return (
              <ToolCallCard
                key={part.id}
                part={part}
                result={result?.type === "tool-result" ? result : undefined}
                busy={busy}
              />
            );
          })}
        </div>
      </article>
    </MessageScrollerItem>
  );
}
