"use client";

import { Clock3, Loader2, PlayCircle, ShieldAlert, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  getDemoAssignmentIntelligence,
  startDemoSession,
  type DemoAssignmentIntelligence
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssignmentIntelligencePage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;

  const [payload, setPayload] = useState<DemoAssignmentIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionDuration = useMemo(() => payload?.sessionPlan[0]?.durationMinutes ?? 60, [payload]);

  const loadAssignment = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await getDemoAssignmentIntelligence(assignmentId);
      setPayload(data);
    } catch (error) {
      setPayload(null);
      const message = error instanceof Error ? error.message : "failed to load assignment intelligence";
      setErrorMessage(message);
      toast.error("unable to load assignment", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  async function handleStartSession() {
    if (!payload || isStarting) {
      return;
    }

    setIsStarting(true);
    try {
      const started = await startDemoSession({
        assignmentId: payload.assignmentId,
        plannedMinutes: sessionDuration
      });

      toast.success("optimized study session started", {
        description: `${started.adaptiveNote}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to start session";
      toast.error("could not start session", { description: message });
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        loading assignment intelligence...
      </div>
    );
  }

  if (!payload) {
    const reconnectNeeded =
      errorMessage?.toLowerCase().includes("session expired") ||
      errorMessage?.toLowerCase().includes("authentication required");
    const notFound = errorMessage?.toLowerCase().includes("not found");

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">assignment intelligence unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{errorMessage ?? "we couldn't load this assignment right now."}</p>
          {notFound ? (
            <p>
              This assignment may have been removed or is not in your active synced course set yet.
              Sync courses and retry.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void loadAssignment()}>
              retry
            </Button>
            {reconnectNeeded ? (
              <Link href={"/login" as any}>
                <Button size="sm" variant="secondary">
                  reconnect d2l
                </Button>
              </Link>
            ) : null}
            <Link href={"/dashboard/study-plan-optimizer" as any}>
              <Button size="sm" variant="secondary">
                back to optimizer
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{payload.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{payload.courseName}</p>
          <div className="flex flex-wrap gap-2">
            <Badge>
              <Target className="mr-1 h-3 w-3" /> complexity {payload.complexityScore}
            </Badge>
            <Badge variant="secondary">
              <Clock3 className="mr-1 h-3 w-3" /> effort {payload.effortHours}h
            </Badge>
            <Badge variant="destructive">
              <ShieldAlert className="mr-1 h-3 w-3" /> risk {payload.riskScore}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            recommended start: {new Date(payload.recommendedStartDate).toLocaleDateString()} · next step: {" "}
            <span className="text-foreground">{payload.highestLeverageNextStep}</span>
          </p>
          <Button onClick={() => void handleStartSession()} disabled={isStarting}>
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {isStarting ? "starting optimized session..." : "start optimized study session"}
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ai assignment breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.checklist.map((item) => (
              <div key={item.id} className="rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50">
                <p className="text-sm">{item.text}</p>
                <p className="text-xs text-muted-foreground">category: {item.category}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ai content locator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payload.contentLocator.map((resource) => (
              <div key={`${resource.priority}-${resource.resource}`} className="rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50">
                <p className="text-sm font-medium">
                  #{resource.priority} {resource.module} {" -> "} {resource.lecture}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resource.resource} ({resource.section})
                </p>
                <p className="text-xs text-muted-foreground">why: {resource.whyRelevant}</p>
                <p className="text-xs text-muted-foreground">confidence: {(resource.confidence * 100).toFixed(0)}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">recommended execution plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payload.sessionPlan.map((session) => (
            <div key={session.label} className="rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50">
              <p className="text-sm font-medium">
                {session.label} · {session.durationMinutes} min
              </p>
              <p className="text-xs text-muted-foreground">{session.objective}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">risk drivers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {payload.riskDrivers.map((driver) => (
            <p key={driver}>- {driver}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
