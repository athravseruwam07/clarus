"use client";

import { FileText, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  type AssignmentAiBriefDTO,
  generateCalendarEventBrief,
  getCalendarEventBrief,
  getCalendarEvent,
  type TimelineEventDTO
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiBriefingCard } from "@/components/overview/AiBriefingCard";
import { AiChecklistCard } from "@/components/overview/AiChecklistCard";
import { AiScheduleCard } from "@/components/overview/AiScheduleCard";
import { NotesCard } from "@/components/overview/NotesCard";
import { OverviewHeader } from "@/components/overview/OverviewHeader";
import { OverviewLayout } from "@/components/overview/OverviewLayout";
import { dateKindLabel, associatedEntityLabel, sourceLabel } from "@/components/overview/labels";
import { normalizeRichText } from "@/components/overview/normalizeRichText";
import { useItemState } from "@/components/overview/useItemState";

function formatLocal(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return date.toLocaleString();
}

export default function CalendarEventOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<TimelineEventDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [aiBrief, setAiBrief] = useState<AssignmentAiBriefDTO | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const itemState = useItemState({ targetType: "calendar_event", targetKey: eventId });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const payload = await getCalendarEvent(eventId);
        if (cancelled) return;
        setEvent(payload);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.code === "session_expired"
            ? "Your D2L session expired. Reconnect and try again."
            : error instanceof Error
              ? error.message
              : "failed to load overview";
        setErrorMessage(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    setAiError(null);

    void (async () => {
      try {
        const cached = await getCalendarEventBrief(eventId);
        if (cancelled) return;
        setAiBrief(cached);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "brief_not_found") {
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const courseLabel = useMemo(() => {
    if (!event) return null;
    if (event.courseCode) {
      return `${event.courseCode} · ${event.courseName ?? ""}`.trim();
    }
    return event.courseName;
  }, [event]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !event) {
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const payload = await generateCalendarEventBrief(eventId);
      setAiBrief(payload);
      itemState.resetChecked();
      toast.success(aiBrief ? "ai briefing regenerated" : "ai briefing generated");
    } catch (error) {
      if (error instanceof ApiError && error.code === "ai_not_configured") {
        setAiNotConfigured(true);
        setAiError("AI is not configured on the server yet.");
        return;
      }

      if (error instanceof ApiError && error.code === "db_schema_out_of_date") {
        setAiError("Server database schema is out of date. Run prisma db push and restart the backend.");
        return;
      }

      const message = error instanceof Error ? error.message : "failed to generate ai briefing";
      setAiError(message);
      toast.error("ai unavailable", { description: message });
    } finally {
      setIsGenerating(false);
    }
  }, [aiBrief, event, eventId, isGenerating, itemState]);

  const whenBadge = event ? `${dateKindLabel(event.dateKind)} ${formatLocal(event.startAt)}` : null;
  const friendlySource = event ? sourceLabel(event) : null;
  const friendlyType = event ? associatedEntityLabel(event.associatedEntityType) : null;
  const descriptionText = normalizeRichText(event?.description);

  const aiBadge = useMemo(() => {
    if (!aiBrief) return undefined;
    const total = aiBrief.checklist.length;
    const done = aiBrief.checklist.reduce((sum, item) => sum + (itemState.checkedById[item.id] ? 1 : 0), 0);
    return `${done}/${total}`;
  }, [aiBrief, itemState.checkedById]);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>overview unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <Link href={"/login" as any} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              reconnect
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <OverviewHeader
        title={event?.title ?? null}
        subtitle={courseLabel ?? null}
        badgeText={whenBadge}
        openUrl={event?.viewUrl ?? null}
        onBack={() => router.back()}
        metadataItems={[
          { label: "type", value: <Badge variant="secondary" className="text-[10px]">{friendlyType ?? ""}</Badge> },
          { label: "source", value: <span className="text-foreground/80">{friendlySource ?? ""}</span> }
        ]}
        isLoading={isLoading}
      />

      <OverviewLayout
        defaultTab={!descriptionText ? "notes" : "overview"}
        tabs={[
          {
            id: "overview",
            label: "overview",
            icon: FileText,
            content: (
              <Card className="card-glow">
                <CardHeader>
                  <CardTitle className="text-base">description</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-4 w-full" />
                      ))}
                    </div>
                  ) : descriptionText ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{descriptionText}</p>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                      <p className="text-sm text-muted-foreground">no description provided by brightspace.</p>
                      <p className="mt-1 text-xs text-muted-foreground">use the notes tab to capture details.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          },
          {
            id: "ai",
            label: "ai workspace",
            icon: Sparkles,
            badge: aiBadge,
            content: (
              <div className="space-y-4">
                <AiBriefingCard
                  brief={aiBrief}
                  isGenerating={isGenerating}
                  aiNotConfigured={aiNotConfigured}
                  aiError={aiError}
                  onGenerate={() => void handleGenerate()}
                />

                {aiBrief ? (
                  <>
                    <AiChecklistCard
                      brief={aiBrief}
                      checkedById={itemState.checkedById}
                      onToggleChecked={(id, checked) => {
                        itemState.setCheckedById((prev) => ({ ...prev, [id]: checked }));
                      }}
                    />
                    <AiScheduleCard brief={aiBrief} />
                  </>
                ) : (
                  <Card className="card-glow">
                    <CardHeader>
                      <CardTitle className="text-base">ai checklist</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      generate the briefing to get a checklist.
                    </CardContent>
                  </Card>
                )}
              </div>
            )
          },
          {
            id: "notes",
            label: "notes",
            icon: NotebookPen,
            content: (
              <NotesCard
                locationText={itemState.locationText}
                onLocationChange={itemState.setLocationText}
                notesText={itemState.notesText}
                onNotesChange={itemState.setNotesText}
                isSaving={itemState.isSaving}
                saveError={itemState.saveError}
              />
            )
          }
        ]}
      />
    </div>
  );
}
