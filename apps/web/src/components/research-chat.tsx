import { Button } from "@pursor/ui/components/button";
import { Textarea } from "@pursor/ui/components/textarea";
import { useChat } from "@tanstack/ai-react";
import { useConvex } from "convex/react";
import { ArrowUp, Bot, Loader2, Plus, Search, Globe, Building2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createConvexChatConnection } from "@/lib/convex-chat";

const suggestions = [
  {
    icon: Search,
    title: "Search the web",
    prompt: "Search the web for Convex's main features and summarize them with source links.",
  },
  {
    icon: Globe,
    title: "Read a page",
    prompt: "Read https://docs.convex.dev/agents and summarize how agents use tools.",
  },
  {
    icon: Building2,
    title: "Look up a brand",
    prompt: "Look up stripe.com and summarize its brand metadata, including logo URLs.",
  },
];

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

export function ResearchChat() {
  const [conversation, setConversation] = useState(0);
  return (
    <ChatConversation key={conversation} onNewChat={() => setConversation((value) => value + 1)} />
  );
}

function ChatConversation({ onNewChat }: { onNewChat: () => void }) {
  const convex = useConvex();
  const connection = useMemo(() => createConvexChatConnection(convex), [convex]);
  const { messages, sendMessage, isLoading, error } = useChat({ connection });
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  function send(text: string) {
    if (!text.trim() || isLoading) return;
    setInput("");
    void sendMessage(text.trim()).catch(() => {
      /* useChat exposes the error below. */
    });
  }

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-4 py-6 sm:px-8">
      <header className="flex items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Research playground</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DeepSeek V4.1 Flash · Context.dev tools
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isLoading} onClick={onNewChat}>
          <Plus />
          New chat
        </Button>
      </header>

      <div
        className="flex-1 space-y-6 overflow-y-auto py-6"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center gap-5 text-center">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Bot className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Give your agent something to investigate</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search, read a URL, or look up a company. Tool activity appears alongside the
                answer.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3">
              {suggestions.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => send(prompt)}
                  className="flex items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors hover:bg-muted"
                >
                  <Icon className="size-4 text-primary" />
                  {title}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-3"
                : "mr-auto min-w-0 max-w-full"
            }
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {message.role === "user" ? "You" : "Pursor Research"}
            </p>
            {message.parts.map((part, index) => {
              if (part.type === "text")
                return message.role === "user" ? (
                  <p key={index} className="whitespace-pre-wrap text-sm">
                    {part.content}
                  </p>
                ) : (
                  <div key={index} className="typeset typeset-chat max-w-[28em] overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
                  </div>
                );
              if (part.type === "tool-call") {
                const result = message.parts.find(
                  (item) => item.type === "tool-result" && item.toolCallId === part.id,
                );
                return (
                  <details key={part.id} className="my-3 rounded-xl border bg-muted/30 p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      {part.name}{" "}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {part.state === "error" ? "Failed" : result ? "Completed" : "Running…"}
                      </span>
                    </summary>
                    <p className="mt-3 text-xs text-muted-foreground">Input</p>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                      {formatToolData(part.arguments)}
                    </pre>
                    {result?.type === "tool-result" && (
                      <>
                        <p className="mt-3 text-xs text-muted-foreground">Result</p>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                          {formatToolData(part.output ?? result.content)}
                        </pre>
                      </>
                    )}
                  </details>
                );
              }
              return null;
            })}
          </article>
        ))}
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Researching…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error.message}
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="rounded-2xl border bg-card p-3 shadow-sm"
      >
        <Textarea
          aria-label="Message the research agent"
          placeholder="Ask a question, paste a URL, or enter a company domain…"
          value={input}
          maxLength={8000}
          disabled={isLoading}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(input);
            }
          }}
          className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Enter to send · Shift+Enter for a new line
          </p>
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={isLoading || !input.trim()}
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </section>
  );
}
