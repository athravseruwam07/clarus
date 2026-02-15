"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb, Loader2, Clock, Layers, Target, Calendar, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getWorkloadForecast,
  type ForecastAssessment,
  type WorkloadForecastData,
  type WeekForecast,
  type WorkloadSeverity,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Severity colors                                                    */
/* ------------------------------------------------------------------ */

const SEVERITY_COLORS: Record<WorkloadSeverity, string> = {
  light: "hsl(142 71% 45%)",
  moderate: "hsl(38 92% 50%)",
  heavy: "hsl(0 72% 51%)",
  critical: "hsl(280 70% 55%)",
};

const SEVERITY_BADGE_VARIANT: Record<WorkloadSeverity, "success" | "secondary" | "destructive" | "default"> = {
  light: "success",
  moderate: "secondary",
  heavy: "destructive",
  critical: "destructive",
};

const COMPLEXITY_BADGE_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  low: "success",
  medium: "secondary",
  high: "destructive",
};

function WorkloadBars(props: {
  data: Array<{
    week: string;
    hours: number;
    severity: WorkloadSeverity;
    confidence: number;
  }>;
}) {
  const maxHours = Math.max(16, ...props.data.map((entry) => entry.hours));
  const heavyPct = Math.min(100, (10 / maxHours) * 100);
  const criticalPct = Math.min(100, (15 / maxHours) * 100);

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/10 p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>hours</span>
        <span>max {maxHours.toFixed(1)}h</span>
      </div>

      <div className="relative h-56 border border-border/50 bg-secondary/20">
        <div
          className="absolute left-0 right-0 border-t border-dashed border-amber-500/80"
          style={{ bottom: `${heavyPct}%` }}
        />
        <div className="absolute right-2 text-[10px] text-amber-400" style={{ bottom: `calc(${heavyPct}% + 2px)` }}>
          heavy (10h)
        </div>

        <div
          className="absolute left-0 right-0 border-t border-dashed border-red-500/80"
          style={{ bottom: `${criticalPct}%` }}
        />
        <div className="absolute right-2 text-[10px] text-red-400" style={{ bottom: `calc(${criticalPct}% + 2px)` }}>
          critical (15h)
        </div>

        <div className="absolute inset-0 flex items-end gap-3 px-3 pb-8 pt-3">
          {props.data.map((entry) => {
            const heightPct = Math.max(2, (entry.hours / maxHours) * 100);
            const barColor = SEVERITY_COLORS[entry.severity];

            return (
              <div key={entry.week} className="flex h-full min-w-0 flex-1 items-end">
                <div className="w-full">
                  <div className="relative h-[calc(100%_-_20px)] w-full rounded-sm bg-secondary/30">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-sm"
                      style={{ height: `${heightPct}%`, backgroundColor: barColor }}
                      title={`${entry.week}: ${entry.hours}h (${entry.severity}), confidence ${Math.round(
                        entry.confidence * 100
                      )}%`}
                    />
                  </div>
                  <div className="mt-1 truncate text-center text-[11px] text-muted-foreground">{entry.week}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview href builder (same logic as calendar page)                */
/* ------------------------------------------------------------------ */

function buildOverviewHref(a: ForecastAssessment): string | null {
  const params = new URLSearchParams();
  if (a.viewUrl) params.set("openUrl", a.viewUrl);
  const qs = params.toString();

  if (a.associatedEntityType === "D2L.LE.Dropbox.Dropbox" && a.associatedEntityId) {
    const base = `/dashboard/assignments/overview/${encodeURIComponent(a.orgUnitId)}/${encodeURIComponent(a.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (a.associatedEntityType === "D2L.LE.Content.ContentObject.TopicCO" && a.associatedEntityId) {
    const base = `/dashboard/content/overview/${encodeURIComponent(a.orgUnitId)}/${encodeURIComponent(a.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (a.associatedEntityType === "D2L.LE.Quizzing.Quiz" && a.associatedEntityId) {
    const base = `/dashboard/quizzes/overview/${encodeURIComponent(a.orgUnitId)}/${encodeURIComponent(a.associatedEntityId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  if (a.sourceType === "calendar") {
    const base = `/dashboard/calendar/overview/${encodeURIComponent(a.sourceId)}`;
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Weekly detail content (rendered inside the tabbed card)            */
/* ------------------------------------------------------------------ */

function WeekDetailContent({ week }: { week: WeekForecast }) {
  return (
    <div className="space-y-4">
      {/* Sub-header: date range + severity + confidence + hours */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{week.dateRange}</p>
        <div className="flex items-center gap-2">
          <Badge
            variant={SEVERITY_BADGE_VARIANT[week.severity]}
            className={
              week.severity === "critical"
                ? "bg-purple-500/15 text-purple-400 border-purple-500/20"
                : week.severity === "moderate"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                  : undefined
            }
          >
            {week.severity}
          </Badge>
          <span className="text-sm font-semibold font-mono">{week.featureVector.totalEstimatedHours}h</span>
        </div>
      </div>

      {/* Feature vector grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCell icon={<Layers className="h-3 w-3" />} label="Assessments" value={week.featureVector.assessmentCount} />
        <StatCell icon={<Clock className="h-3 w-3" />} label="Total Hours" value={`${week.featureVector.totalEstimatedHours}h`} />
        <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Target className="h-3 w-3" />
            <p className="text-[10px]">Deadline Cluster</p>
          </div>
          <p
            className="font-mono text-sm font-semibold"
            style={{
              color: week.featureVector.deadlineClusterScore === "low"
                ? "hsl(142 71% 45%)"
                : week.featureVector.deadlineClusterScore === "medium"
                  ? "hsl(38 92% 50%)"
                  : "hsl(0 72% 51%)",
            }}
          >
            {week.featureVector.deadlineClusterScore}
          </p>
        </div>
        <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <p className="text-[10px]">Complexity</p>
          </div>
          <p className="font-mono text-sm font-semibold" style={{ color: "hsl(142 71% 45%)" }}>low: {week.featureVector.complexityMix.low}</p>
          <p className="font-mono text-sm font-semibold" style={{ color: "hsl(38 92% 50%)" }}>medium: {week.featureVector.complexityMix.medium}</p>
          <p className="font-mono text-sm font-semibold" style={{ color: "hsl(0 72% 51%)" }}>high: {week.featureVector.complexityMix.high}</p>
        </div>
        <StatCell
          icon={<Calendar className="h-3 w-3" />}
          label="Types"
          value={Object.entries(week.featureVector.typeDistribution).map(([k, v]) => `${v} ${k}`).join(", ")}
        />
      </div>

      {/* Assessment list */}
      <div className="space-y-2">
        {week.assessments.map((a) => {
          const isDriver = week.topLoadDrivers.includes(a.id);
          const overviewHref = buildOverviewHref(a);
          return (
            <div
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border/50 bg-secondary/20 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                  {isDriver && <Badge className="text-[10px] px-1.5 py-0 bg-blue-600 text-white border-blue-600">most time needed</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.courseName} &middot; due {new Date(a.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {overviewHref && (
                  <Link
                    href={overviewHref as any}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "text-xs")}
                  >
                    view overview
                  </Link>
                )}
                <Badge
                  variant={COMPLEXITY_BADGE_VARIANT[a.complexity]}
                  className={`text-[10px] ${a.complexity === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : ""}`}
                >
                  {a.complexity}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">{a.estimatedHours}h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <p className="text-[10px]">{label}</p>
      </div>
      <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function WorkloadForecastPage() {
  const [data, setData] = useState<WorkloadForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(0);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const result = await getWorkloadForecast();
        setData(result);
        const firstWeekWithData = result.weeks.findIndex((week) => week.featureVector.assessmentCount > 0);
        setActiveWeek(firstWeekWithData >= 0 ? firstWeekWithData : 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to load weekly workload";
        toast.error("weekly workload unavailable", { description: message });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        loading weekly workload...
      </div>
    );
  }

  const chartData = data.weeks.map((w) => ({
    week: w.weekLabel,
    hours: w.featureVector.totalEstimatedHours,
    severity: w.severity,
    confidence: w.confidence,
  }));

  const allSuggestions = data.weeks.flatMap((w) => w.suggestions);

  return (
    <div className="space-y-6">
      {/* 1. Alert banner */}
      {data.heavyWeekCount > 0 && (
        <Alert variant="destructive" className="animate-fade-up">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {data.heavyWeekCount} Heavy Week{data.heavyWeekCount > 1 ? "s" : ""} Detected
          </AlertTitle>
          <AlertDescription>{data.overallSummary}</AlertDescription>
        </Alert>
      )}

      {/* 2. Bar chart */}
      <Card className="animate-fade-up" style={{ animationDelay: "50ms" }}>
        <CardHeader>
          <CardTitle className="text-base">4-Week Weekly Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkloadBars data={chartData} />
        </CardContent>
      </Card>

      {/* 3. Weekly detail — single card with tabs */}
      <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Weekly Breakdown</CardTitle>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveWeek((p) => Math.max(0, p - 1))}
                disabled={activeWeek === 0}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setActiveWeek((p) => Math.min(data.weeks.length - 1, p + 1))}
                disabled={activeWeek === data.weeks.length - 1}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 pt-2">
            {data.weeks.map((week, i) => (
              <button
                key={week.weekLabel}
                onClick={() => setActiveWeek(i)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === activeWeek
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                {week.weekLabel}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <WeekDetailContent week={data.weeks[activeWeek]} />
        </CardContent>
      </Card>

      {/* 4. Suggestions widget */}
      {allSuggestions.length > 0 && (
        <Card className="animate-fade-up" style={{ animationDelay: "450ms" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              Redistribution Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allSuggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-secondary/20 px-3 py-2"
              >
                <p className="text-sm text-foreground">{s.suggestion}</p>
                <Badge variant="outline" className="shrink-0 font-mono text-xs">
                  -{s.hoursSaved}h
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 5. Courses footer */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: "525ms" }}>
        <span className="text-xs text-muted-foreground">Courses in Forecast:</span>
        {data.courses.map((c) => (
          <Badge key={c} variant="secondary" className="text-xs">
            {c}
          </Badge>
        ))}
      </div>
    </div>
  );
}
