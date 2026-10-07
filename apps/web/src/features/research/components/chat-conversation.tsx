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
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@pursor/ui/components/message-scroller";
import { Tooltip, TooltipContent, TooltipTrigger } from "@pursor/ui/components/tooltip";
import { useChat } from "@tanstack/ai-react";
import { useConvex } from "convex/react";
import { ArrowUp, Loader2, MessageCircleDashed, Plus, RotateCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { captureBrowserException, captureResearchEvent } from "@/app/analytics/posthog";

import { createConvexChatConnection } from "../lib/convex-chat";
import { suggestions } from "../suggestions";
import { ChatMessage } from "./chat-message";

export function ChatConversation({ onNewChat }: { onNewChat: () => void }) {
  const convex = useConvex();
  const connection = useMemo(() => createConvexChatConnection(convex), [convex]);
  const { messages, sendMessage, isLoading, error } = useChat({ connection });
  useEffect(() => {
    if (error) captureBrowserException(error, { category: "chat_rendering" });
  }, [error]);
  const [input, setInput] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastUserId = [...messages].reverse().find((message) => message.role === "user")?.id;
  const streaming =
    isLoading &&
    messages.at(-1)?.role === "assistant" &&
    messages.at(-1)?.parts.some((part) => part.type === "text" && part.content.length > 0);

  function send(text: string) {
    if (!text.trim() || isLoading) return;
    captureResearchEvent("research_send_clicked", {
      prompt_length: text.trim().length,
      is_follow_up: messages.length > 0,
    });
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
                      onClick={() => {
                        captureResearchEvent("research_prompt_selected", {
                          prompt_kind: title,
                          source: "starter",
                        });
                        send(prompt);
                      }}
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
                            captureResearchEvent("research_prompt_selected", {
                              prompt_kind: title,
                              source: "composer",
                            });
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
