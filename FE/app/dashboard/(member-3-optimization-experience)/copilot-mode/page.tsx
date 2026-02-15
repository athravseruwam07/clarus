"use client";

import Link from "next/link";
import { Bot, ExternalLink, Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import {
  type CopilotMessageDTO,
  type CopilotThreadDTO,
  createCopilotThread,
  deleteCopilotThread,
  getCopilotMessages,
  listCopilotThreads,
  sendCopilotMessage
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LocalCopilotMessage extends CopilotMessageDTO {
  pending?: boolean;
  failed?: boolean;
}

const STARTER_PROMPTS = [
  "What should I do in the next 2 hours?",
  "What is most urgent this week?",
  "Create a weekend study plan."
];

function formatThreadTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getApiErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "request failed";
}

export default function CopilotModePage() {
  const [threads, setThreads] = useState<CopilotThreadDTO[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, LocalCopilotMessage[]>>({});

  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [composer, setComposer] = useState("");
  const [mobileThreadPickerOpen, setMobileThreadPickerOpen] = useState(false);

  const [threadError, setThreadError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const previousThreadRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(false);

  const activeMessages = useMemo(
    () => (activeThreadId ? messagesByThread[activeThreadId] ?? [] : []),
    [activeThreadId, messagesByThread]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      setIsLoadingThreads(true);
      setThreadError(null);
      try {
        const rows = await listCopilotThreads();
        if (cancelled) {
          return;
        }

        setThreads(rows);
        if (rows.length > 0) {
          setActiveThreadId((current) => current ?? rows[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          setThreadError(getApiErrorDetail(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingThreads(false);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof activeThreadId !== "string" || activeThreadId.length === 0) {
      return;
    }
    const threadId: string = activeThreadId;

    if (messagesByThread[threadId]) {
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      setIsLoadingMessages(true);
      setMessageError(null);
      try {
        const payload = await getCopilotMessages(threadId, { limit: 100 });
        if (cancelled) {
          return;
        }

        setMessagesByThread((current) => ({
          ...current,
          [threadId]: payload.messages
        }));
        shouldStickToBottomRef.current = true;
      } catch (error) {
        if (!cancelled) {
          setMessageError(getApiErrorDetail(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      }
    }

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeThreadId, messagesByThread]);

  useEffect(() => {
    const previousThreadId = previousThreadRef.current;
    const pane = messageScrollRef.current;

    if (previousThreadId && pane) {
      scrollPositionsRef.current.set(previousThreadId, pane.scrollTop);
    }

    previousThreadRef.current = activeThreadId;

    if (!activeThreadId) {
      return;
    }

    const restore = () => {
      const targetPane = messageScrollRef.current;
      if (!targetPane) {
        return;
      }

      const stored = scrollPositionsRef.current.get(activeThreadId);
      if (stored !== undefined) {
        targetPane.scrollTop = stored;
        return;
      }

      targetPane.scrollTop = targetPane.scrollHeight;
    };

    window.requestAnimationFrame(restore);
  }, [activeThreadId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    const pane = messageScrollRef.current;
    if (!pane) {
      return;
    }

    pane.scrollTop = pane.scrollHeight;
    shouldStickToBottomRef.current = false;
  }, [activeMessages]);

  async function handleCreateThread() {
    if (isCreatingThread) {
      return;
    }

    setIsCreatingThread(true);
    setThreadError(null);

    try {
      const created = await createCopilotThread();
      setThreads((current) => [created.thread, ...current]);
      setActiveThreadId(created.thread.id);
      setMessagesByThread((current) => ({
        ...current,
        [created.thread.id]: created.assistantMessage ? [created.assistantMessage] : []
      }));
      setMobileThreadPickerOpen(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
    } catch (error) {
      const detail = getApiErrorDetail(error);
      setThreadError(detail);
      toast.error("could not create chat", { description: detail });
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      await deleteCopilotThread(threadId);
      setThreads((current) => {
        const remaining = current.filter((thread) => thread.id !== threadId);
        setActiveThreadId((active) => (active === threadId ? remaining[0]?.id ?? null : active));
        return remaining;
      });
      setMessagesByThread((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      });
    } catch (error) {
      toast.error("could not delete chat", { description: getApiErrorDetail(error) });
    }
  }

  function updateThreadAfterAssistant(params: {
    threadId: string;
    assistantMessage: CopilotMessageDTO;
  }) {
    setThreads((current) => {
      const existing = current.find((thread) => thread.id === params.threadId);
      const nextCount = Math.max((existing?.messageCount ?? 0) + 2, 2);

      const updated: CopilotThreadDTO = {
        id: params.threadId,
        title: existing?.title ?? "New chat",
        lastMessageAt: params.assistantMessage.createdAt,
        messageCount: nextCount,
        preview: params.assistantMessage.content.slice(0, 160)
      };

      const without = current.filter((thread) => thread.id !== params.threadId);
      return [updated, ...without];
    });
  }

  async function handleSendMessage(rawMessage?: string) {
    const message = (rawMessage ?? composer).trim();
    if (!message || isSending) {
      return;
    }

    let threadId = activeThreadId;
    if (!threadId) {
      try {
        const created = await createCopilotThread();
        setThreads((current) => [created.thread, ...current]);
        setActiveThreadId(created.thread.id);
        setMessagesByThread((current) => ({ ...current, [created.thread.id]: [] }));
        threadId = created.thread.id;
      } catch (error) {
        toast.error("could not create chat", { description: getApiErrorDetail(error) });
        return;
      }
    }

    const optimisticId = `temp-user-${Date.now()}`;
    const optimisticMessage: LocalCopilotMessage = {
      id: optimisticId,
      role: "user",
      content: message,
      citations: [],
      actions: [],
      followUps: [],
      confidence: null,
      model: null,
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessagesByThread((current) => ({
      ...current,
      [threadId]: [...(current[threadId] ?? []), optimisticMessage]
    }));

    if (!rawMessage) {
      setComposer("");
    }
    setIsSending(true);
    setMessageError(null);
    shouldStickToBottomRef.current = true;

    try {
      const response = await sendCopilotMessage({
        threadId,
        message,
        context: {
          activePage: "/dashboard/copilot-mode"
        }
      });

      setMessagesByThread((current) => {
        const currentMessages = current[threadId] ?? [];
        const replaced = currentMessages.map((msg) =>
          msg.id === optimisticId
            ? {
                ...msg,
                id: response.userMessageId,
                pending: false,
                failed: false
              }
            : msg
        );

        return {
          ...current,
          [threadId]: [...replaced, response.assistantMessage]
        };
      });

      updateThreadAfterAssistant({
        threadId,
        assistantMessage: response.assistantMessage
      });
    } catch (error) {
      const detail = getApiErrorDetail(error);
      setMessageError(detail);
      toast.error("copilot request failed", { description: detail });

      setMessagesByThread((current) => {
        const currentMessages = current[threadId] ?? [];
        return {
          ...current,
          [threadId]: currentMessages.map((msg) =>
            msg.id === optimisticId
              ? {
                  ...msg,
                  pending: false,
                  failed: true
                }
              : msg
          )
        };
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  const hasAnyThread = threads.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="xl:hidden"
          onClick={() => setMobileThreadPickerOpen((value) => !value)}
        >
          {mobileThreadPickerOpen ? "hide chats" : "show chats"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCreateThread()} disabled={isCreatingThread}>
          {isCreatingThread ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          new chat
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className={cn("hidden xl:flex xl:flex-col", mobileThreadPickerOpen && "flex")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI Copilot</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 overflow-y-auto">
            {isLoadingThreads ? <p className="text-sm text-muted-foreground">loading chats...</p> : null}

            {threadError ? <p className="text-sm text-destructive">{threadError}</p> : null}

            {!isLoadingThreads && threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">start a chat to plan your week and prioritize work.</p>
            ) : null}

            {threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  className={cn(
                    "rounded-md border border-border/60 p-2 transition-colors",
                    isActive ? "bg-primary/10" : "bg-secondary/10 hover:bg-secondary/30"
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      setMobileThreadPickerOpen(false);
                    }}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{thread.preview ?? "no messages yet"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatThreadTime(thread.lastMessageAt)}</p>
                  </button>

                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleDeleteThread(thread.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="flex min-h-[70vh] flex-col">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base">
              {activeThreadId
                ? threads.find((thread) => thread.id === activeThreadId)?.title ?? "AI Copilot"
                : "AI Copilot"}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-0">
            <div ref={messageScrollRef} className="h-[56vh] space-y-3 overflow-y-auto px-6 pt-5">
              {isLoadingMessages ? <p className="text-sm text-muted-foreground">loading conversation...</p> : null}

              {!activeThreadId && !isLoadingThreads ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-secondary/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Ask for a ranked plan, assignment strategy, or what to focus on next.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setComposer(prompt);
                          void handleSendMessage(prompt);
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Best results come after syncing courses and calendar.
                    <span className="ml-2 inline-flex">
                      <Link href="/dashboard/timeline-intelligence" className="text-primary hover:underline">
                        open calendar sync
                      </Link>
                    </span>
                  </div>
                </div>
              ) : null}

              {activeThreadId && activeMessages.length === 0 && !isLoadingMessages ? (
                <div className="space-y-3 rounded-lg border border-dashed border-border/60 p-4">
                  <p className="text-sm text-muted-foreground">Start with one of these:</p>
                  <div className="flex flex-wrap gap-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <Button key={prompt} variant="outline" size="sm" onClick={() => void handleSendMessage(prompt)}>
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeMessages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-lg border px-4 py-3",
                      isAssistant
                        ? "border-border/60 bg-secondary/20"
                        : "ml-auto max-w-[80%] border-primary/30 bg-primary/15"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isAssistant ? <Bot className="h-3.5 w-3.5" /> : null}
                        <span>{isAssistant ? "AI Copilot" : "You"}</span>
                        {message.pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {message.failed ? <span className="text-destructive">failed</span> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatThreadTime(message.createdAt)}</span>
                    </div>

                    <div className="whitespace-pre-wrap text-sm text-foreground">{message.content}</div>

                    {isAssistant && message.actions.length > 0 ? (
                      <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          What to do now
                        </p>
                        <ul className="space-y-1 text-sm text-foreground">
                          {message.actions.map((action) => (
                            <li key={action} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {isAssistant && message.citations.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.citations.map((citation) => {
                          const text = citation.label;
                          if (citation.internalPath) {
                            return (
                              <Link
                                key={`${message.id}-${citation.id}`}
                                href={citation.internalPath as any}
                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {text}
                              </Link>
                            );
                          }

                          if (citation.href) {
                            return (
                              <a
                                key={`${message.id}-${citation.id}`}
                                href={citation.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {text}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            );
                          }

                          return (
                            <Badge key={`${message.id}-${citation.id}`} variant="secondary" className="text-xs">
                              {text}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : null}

                    {isAssistant && message.followUps.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.followUps.map((followUp) => (
                          <Button
                            key={`${message.id}-${followUp}`}
                            variant="outline"
                            size="sm"
                            disabled={isSending}
                            onClick={() => void handleSendMessage(followUp)}
                          >
                            {followUp}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/60 px-6 pb-5 pt-4">
              {messageError ? <p className="mb-2 text-sm text-destructive">{messageError}</p> : null}
              <div className="rounded-lg border border-border/70 bg-background/80 p-2">
                <textarea
                  ref={composerRef}
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={3}
                  placeholder="Ask for a plan, assignment strategy, or next best action..."
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <p className="text-xs text-muted-foreground">Enter to send. Shift+Enter for newline.</p>
                  <Button
                    onClick={() => void handleSendMessage()}
                    disabled={!composer.trim() || isSending || isLoadingThreads}
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    send
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasAnyThread && !isLoadingThreads ? (
        <p className="text-xs text-muted-foreground">
          No chats yet. Create one and ask Copilot to prioritize your week using synced courses, events, notes, and
          AI briefs.
        </p>
      ) : null}
    </div>
  );
}
