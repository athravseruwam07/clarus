"use client";

import { format } from "date-fns";
import { FileText, NotebookPen, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  generateDropboxAssignmentBrief,
  getDropboxAssignmentBrief,
  getDropboxAssignmentOverview,
  type AssignmentAiBriefDTO,
  type DropboxAssignmentOverviewDTO
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AiBriefingCard } from "@/components/overview/AiBriefingCard";
import { AiChecklistCard } from "@/components/overview/AiChecklistCard";
import { AiScheduleCard } from "@/components/overview/AiScheduleCard";
import { NotesCard } from "@/components/overview/NotesCard";
import { OverviewHeader } from "@/components/overview/OverviewHeader";
import { OverviewLayout } from "@/components/overview/OverviewLayout";
import { normalizeRichText } from "@/components/overview/normalizeRichText";
import { useItemState } from "@/components/overview/useItemState";

function formatLocal(iso: string | null): string {
  if (!iso) {
    return "unknown";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return format(parsed, "PPpp");
}

function submissionTypeLabel(value: DropboxAssignmentOverviewDTO["submissionType"]): string {
  switch (value) {
    case "file":
      return "File upload";
    case "text":
      return "Text submission";
    case "file_or_text":
      return "File or text";
    case "on_paper":
      return "On paper";
    case "observed":
      return "Observed in person";
    default:
      return "Unknown";
  }
}

function completionTypeLabel(value: DropboxAssignmentOverviewDTO["completionType"]): string {
  switch (value) {
    case "on_submission":
      return "Complete on submission";
    case "due_date":
      return "Complete on due date";
    case "manually_by_learner":
      return "Manually by learner";
    case "on_evaluation":
      return "Complete on evaluation";
    default:
      return "Unknown";
  }
}

function dropboxTypeLabel(value: DropboxAssignmentOverviewDTO["dropboxType"]): string {
  switch (value) {
    case "individual":
      return "Individual";
    case "group":
      return "Group";
    default:
      return "Unknown";
  }
}

function sizeLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const rounded = index === 0 ? `${Math.round(value)}` : value.toFixed(1);
  return `${rounded} ${units[index]}`;
}

export default function DropboxAssignmentOverviewPage() {
  const router = useRouter();
  const params = useParams<{ orgUnitId: string; dropboxFolderId: string }>();
  const searchParams = useSearchParams();

  const orgUnitId = params.orgUnitId;
  const folderId = params.dropboxFolderId;
  const openUrl = searchParams.get("openUrl");

  const [overview, setOverview] = useState<DropboxAssignmentOverviewDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [aiBrief, setAiBrief] = useState<AssignmentAiBriefDTO | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const itemState = useItemState({ targetType: "dropbox", targetKey: `${orgUnitId}:${folderId}` });

  const courseLabel = useMemo(() => {
    if (!overview) {
      return null;
    }

    if (overview.courseCode && overview.courseName) {
      return `${overview.courseCode} · ${overview.courseName}`;
    }

    return overview.courseCode ?? overview.courseName ?? null;
  }, [overview]);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await getDropboxAssignmentOverview({ orgUnitId, folderId });
      setOverview(payload);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      const message = error instanceof Error ? error.message : "failed to load assignment overview";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [folderId, orgUnitId, router]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    let cancelled = false;
    setAiError(null);

    void (async () => {
      try {
        const cached = await getDropboxAssignmentBrief({ orgUnitId, folderId });
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
  }, [folderId, orgUnitId]);

  const handleGenerateAi = useCallback(async () => {
    if (isGenerating || !overview) {
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const payload = await generateDropboxAssignmentBrief({ orgUnitId, folderId });
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
  }, [aiBrief, folderId, isGenerating, itemState, orgUnitId, overview]);

  const dueBadge = overview?.dueAt ? `Due ${formatLocal(overview.dueAt)}` : null;
  const instructionsText = normalizeRichText(overview?.instructionsText ?? overview?.instructionsHtml ?? "");

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
        title={overview?.title ?? null}
        subtitle={courseLabel ?? "brightspace dropbox"}
        badgeText={dueBadge}
        openUrl={openUrl}
        onBack={() => router.back()}
        metadataItems={[
          {
            label: "availability",
            value: (
              <span className="font-mono text-[11px]">
                {formatLocal(overview?.availableFrom ?? null)} {" -> "} {formatLocal(overview?.availableUntil ?? null)}
              </span>
            )
          },
          {
            label: "points",
            value: <span className="font-mono text-[11px]">{overview?.pointsPossible ?? "unknown"}</span>
          },
          { label: "submission", value: <span className="text-foreground/80">{submissionTypeLabel(overview?.submissionType ?? "unknown")}</span> },
          { label: "completion", value: <span className="text-foreground/80">{completionTypeLabel(overview?.completionType ?? "unknown")}</span> },
          { label: "mode", value: <span className="text-foreground/80">{dropboxTypeLabel(overview?.dropboxType ?? "unknown")}</span> }
        ]}
        isLoading={isLoading}
      />

      <OverviewLayout
        defaultTab={!instructionsText ? "notes" : "overview"}
        tabs={[
          {
            id: "overview",
            label: "overview",
            icon: FileText,
            content: (
              <div className="space-y-4">
                <Card className="card-glow">
                  <CardHeader>
                    <CardTitle className="text-base">instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {isLoading || !overview ? (
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
                        <p className="mt-1 text-xs text-muted-foreground">use the notes tab to capture details.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="card-glow">
                  <CardHeader>
                    <CardTitle className="text-base">rubric</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading || !overview ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <Skeleton key={index} className="h-4 w-full" />
                        ))}
                      </div>
                    ) : overview.rubrics.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                        no rubric data available for this assignment.
                      </div>
                    ) : (
                      <details className="rounded-xl border border-border/80 bg-secondary/20 p-4">
                        <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                          view rubric criteria ({overview.rubrics.reduce((sum, r) => sum + r.criteria.length, 0)})
                        </summary>
                        <div className="mt-3 space-y-3">
                          {overview.rubrics.map((rubric) => (
                            <div key={rubric.rubricId} className="space-y-2">
                              <p className="text-sm font-medium text-foreground">{rubric.name}</p>
                              <div className="space-y-2">
                                {rubric.criteria.map((criterion) => (
                                  <details
                                    key={criterion.id}
                                    className="rounded-md border border-border/80 bg-card/30 px-3 py-2"
                                  >
                                    <summary className="cursor-pointer select-none text-sm text-foreground/90">
                                      {criterion.name}
                                    </summary>
                                    <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                                      {criterion.exemplaryText ?? "no criterion text available."}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>

                <Card className="card-glow">
                  <CardHeader>
                    <CardTitle className="text-base">attachments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isLoading || !overview ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <Skeleton key={index} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : overview.linkAttachments.length === 0 && overview.attachments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                        no attachments detected in this dropbox folder.
                      </div>
                    ) : (
                      <>
                        {overview.linkAttachments.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                              links
                            </p>
                            {overview.linkAttachments.map((link) => (
                              <a
                                key={link.linkId}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/50 hover:border-primary/20"
                              >
                                {link.name}
                              </a>
                            ))}
                          </div>
                        ) : null}

                        {overview.attachments.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                              files
                            </p>
                            {overview.attachments.map((file) => (
                              <div
                                key={file.fileId}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-secondary/30 px-3 py-2"
                              >
                                <span className="text-sm text-foreground">{file.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">{sizeLabel(file.sizeBytes)}</span>
                              </div>
                            ))}
                            <p className="text-xs text-muted-foreground">open in brightspace to download files.</p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
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
                  onGenerate={() => void handleGenerateAi()}
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
