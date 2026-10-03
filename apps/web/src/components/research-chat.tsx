import { Button } from "@pursor/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pursor/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@pursor/ui/components/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@pursor/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@pursor/ui/components/input-group";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@pursor/ui/components/message-scroller";
import { Tooltip, TooltipContent, TooltipTrigger } from "@pursor/ui/components/tooltip";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { useConvex } from "convex/react";
import {
  ArrowUp,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Globe,
  Loader2,
  MessageCircleDashed,
  Plus,
  RotateCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createConvexChatConnection } from "@/lib/convex-chat";

const suggestions = [
  {
    icon: Search,
    title: "Search the web",
    description: "Find facts with sources",
    prompt: "Search the web for Convex's main features and summarize them with source links.",
  },
  {
    icon: Globe,
    title: "Read a page",
    description: "Turn a URL into insights",
    prompt: "Read https://docs.convex.dev/agents and summarize how agents use tools.",
  },
  {
    icon: Building2,
    title: "Look up a brand",
    description: "Explore a company's identity",
    prompt: "Look up stripe.com and summarize its brand metadata, including logo URLs.",
  },
];

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

export function ResearchChat() {
  const [conversation, setConversation] = useState(0);
  return (
    <ChatConversation key={conversation} onNewChat={() => setConversation((value) => value + 1)} />
  );
}

function ChatMessage({
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
            const failed = part.state === "error";
            const finished = !!result || part.state === "complete";
            const running = busy && !finished && !failed;
            const { label, icon: Icon } = toolLabels[part.name] ?? {
              label: part.name,
              icon: Sparkles,
            };
            return (
              <div
                key={part.id}
                className="not-typeset overflow-hidden rounded-xl border bg-muted/20"
              >
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
                <details className="group border-t">
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
                    {result?.type === "tool-result" && (
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
          })}
        </div>
      </article>
    </MessageScrollerItem>
  );
}

function ChatConversation({ onNewChat }: { onNewChat: () => void }) {
  const convex = useConvex();
  const connection = useMemo(() => createConvexChatConnection(convex), [convex]);
  const { messages, sendMessage, isLoading, error } = useChat({ connection });
  const [input, setInput] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastUserId = [...messages].reverse().find((message) => message.role === "user")?.id;
  const streaming =
    isLoading &&
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)?.parts.some((part) => part.type === "text" && part.content.length > 0);

  function send(text: string) {
    if (!text.trim() || isLoading) return;
    setInput("");
    void sendMessage(text.trim()).catch(() => {
      /* useChat exposes the error below. */
    });
  }

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={24}>
      <section className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-3 p-3 sm:p-6">
        <Card className="min-h-0 flex-1 gap-0 rounded-2xl [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardHeader className="gap-1 border-b">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Research chat
            </CardTitle>
            <CardDescription className="text-xs">
              DeepSeek V4.1 Flash · powered by Context.dev
            </CardDescription>
            <CardAction>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Start a new conversation"
                      onClick={onNewChat}
                      disabled={isLoading}
                    >
                      <RotateCw className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>New conversation</TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {messages.length === 0 ? (
              <Empty className="h-full border-0 px-5 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircleDashed />
                  </EmptyMedia>
                  <EmptyTitle>What would you like to explore?</EmptyTitle>
                  <EmptyDescription>
                    Ask a question, read a page, or discover a brand. Watch your agent's tools work
                    in real time.
                  </EmptyDescription>
                </EmptyHeader>
                <div className="grid w-full max-w-md gap-2 sm:grid-cols-3">
                  {suggestions.map(({ icon: Icon, title, description, prompt }) => (
                    <button
                      key={title}
                      disabled={isLoading}
                      onClick={() => send(prompt)}
                      className="flex flex-col items-start gap-2 rounded-xl border bg-background p-3 text-left transition-colors hover:bg-muted"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium">{title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </Empty>
            ) : (
              <MessageScroller>
                <MessageScrollerViewport aria-label="Research conversation">
                  <MessageScrollerContent
                    aria-busy={isLoading}
                    className="gap-6 p-(--card-spacing)"
                  >
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        scrollAnchor={message.id === lastUserId}
                        busy={
                          isLoading &&
                          message.role === "assistant" &&
                          message.id === messages.at(-1)?.id
                        }
                      />
                    ))}
                    {isLoading && (
                      <div
                        role="status"
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Loader2 className="size-3.5 animate-spin" />
                        {streaming ? "Writing the answer…" : "Thinking and gathering sources…"}
                      </div>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t">
            {error && (
              <div
                role="alert"
                className="w-full rounded-lg bg-destructive/10 p-3 text-xs text-destructive"
              >
                {error.message}
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
              className="w-full"
            >
              <InputGroup className="rounded-xl">
                <InputGroupTextarea
                  ref={composer}
                  aria-label="Message the research agent"
                  placeholder="Ask anything, or paste a URL…"
                  value={input}
                  maxLength={8000}
                  disabled={isLoading}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      send(input);
                    }
                  }}
                  className="min-h-16 max-h-40 px-3 py-3"
                />
                <InputGroupAddon align="block-end" className="pt-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <InputGroupButton
                          aria-label="Choose a research prompt"
                          size="icon-sm"
                          variant="outline"
                          disabled={isLoading}
                        >
                          <Plus />
                        </InputGroupButton>
                      }
                    />
                    <DropdownMenuContent align="start" side="top" className="w-48">
                      {suggestions.map(({ icon: Icon, title, prompt }) => (
                        <DropdownMenuItem
                          key={title}
                          onClick={() => {
                            setInput(prompt);
                            composer.current?.focus();
                          }}
                        >
                          <Icon />
                          {title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-[11px] text-muted-foreground">
                    {isLoading ? "Agent is working" : "3 tools available"}
                  </span>
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    className="ml-auto rounded-lg"
                    disabled={isLoading || !input.trim()}
                    aria-label="Send message"
                  >
                    <ArrowUp />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </CardFooter>
        </Card>
        <p className="text-center text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Check the sources behind every answer
        </p>
      </section>
    </MessageScrollerProvider>
  );
}
