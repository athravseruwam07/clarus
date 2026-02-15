"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  type AssignmentAiBriefDTO,
  generateQuizBrief,
  getQuizBrief,
  getQuizOverview,
  type QuizOverviewDTO
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
import { AiWorkspacePanel } from "@/components/overview/AiWorkspacePanel";
import { KeyValueCard } from "@/components/overview/KeyValueCard";
import { NotesCard } from "@/components/overview/NotesCard";
import { OverviewHeader } from "@/components/overview/OverviewHeader";
import { OverviewLayout } from "@/components/overview/OverviewLayout";
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

export default function QuizOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const openUrlFromCalendar = searchParams.get("openUrl");

  const orgUnitId = params.orgUnitId as string;
  const quizId = params.quizId as string;

  const [overview, setOverview] = useState<QuizOverviewDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [aiBrief, setAiBrief] = useState<AssignmentAiBriefDTO | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const itemState = useItemState({ targetType: "quiz", targetKey: `${orgUnitId}:${quizId}` });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const payload = await getQuizOverview({ orgUnitId, quizId });
        if (cancelled) return;
        setOverview(payload);
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
  }, [orgUnitId, quizId]);

  useEffect(() => {
    let cancelled = false;
    setAiError(null);

    void (async () => {
      try {
        const cached = await getQuizBrief({ orgUnitId, quizId });
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
  }, [orgUnitId, quizId]);

  const handleGenerate = useCallback(async () => {
    if (isGenerating || !overview) {
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const payload = await generateQuizBrief({ orgUnitId, quizId });
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

      if (error instanceof ApiError && error.code === "session_expired") {
        setAiError("Your D2L session expired. Reconnect and try again.");
        return;
      }

      const message = error instanceof Error ? error.message : "failed to generate ai briefing";
      setAiError(message);
      toast.error("ai unavailable", { description: message });
    } finally {
      setIsGenerating(false);
    }
  }, [aiBrief, isGenerating, itemState, orgUnitId, overview, quizId]);

  const dueBadge = overview?.dueAt ? `Due ${formatLocal(overview.dueAt)}` : null;
  const openUrl = overview?.openUrl ?? openUrlFromCalendar;
  const courseLabel = useMemo(() => {
    if (!overview) return null;
    if (overview.courseCode) {
      return `${overview.courseCode} · ${overview.courseName ?? ""}`.trim();
    }
    return overview.courseName;
  }, [overview]);

  const instructionsText = normalizeRichText(overview?.instructionsText ?? overview?.descriptionText);

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>overview unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <Link
              href={"/login" as any}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              reconnect
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <OverviewHeader
        title={overview?.title ?? null}
        subtitle={courseLabel ?? null}
        badgeText={dueBadge}
        openUrl={openUrl ?? null}
        onBack={() => router.back()}
        isLoading={isLoading}
      />

      <OverviewLayout
        left={
          <>
            <NotesCard
              locationText={itemState.locationText}
              onLocationChange={itemState.setLocationText}
              notesText={itemState.notesText}
              onNotesChange={itemState.setNotesText}
              isSaving={itemState.isSaving}
              saveError={itemState.saveError}
            />

            <KeyValueCard
              title="details"
              items={[
                { label: "due", value: <span className="font-mono text-xs">{formatLocal(overview?.dueAt)}</span> },
                {
                  label: "availability",
                  value: (
                    <span className="font-mono text-xs">
                      {formatLocal(overview?.startAt)} {" -> "} {formatLocal(overview?.endAt)}
                    </span>
                  )
                },
                {
                  label: "status",
                  value: overview ? (
                    <Badge variant={overview.isActive ? "default" : "secondary"} className="text-[10px]">
                      {overview.isActive ? "active" : "inactive"}
                    </Badge>
                  ) : null
                }
              ]}
            />

            <Card className="card-glow">
              <CardHeader>
                <CardTitle className="text-base">instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-4 w-full" />
                    ))}
                  </div>
                ) : instructionsText ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{instructionsText}</p>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                    <p className="text-sm text-muted-foreground">no instructions provided by brightspace.</p>
                    {openUrl ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        open in brightspace for more details, then add notes above.
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        }
        right={
          <AiWorkspacePanel>
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
          </AiWorkspacePanel>
        }
      />
    </div>
  );
}
