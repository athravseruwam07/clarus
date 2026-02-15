"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Link2Off, Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  disconnectD2L,
  getCourses,
  syncCourses,
  type Course
} from "@/lib/api";
import {
  ConnectionStatus,
  type ConnectionBadgeState
} from "@/components/auth/ConnectionStatus";
import { CourseList } from "@/components/courses/CourseList";
import { CourseSkeleton } from "@/components/courses/CourseSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const [bootFromConnect] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return new URLSearchParams(window.location.search).get("boot") === "1";
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionBadgeState>("loading");
  const [showStartupLoader, setShowStartupLoader] = useState(bootFromConnect);
  const [startupStepIndex, setStartupStepIndex] = useState(0);
  const [startupStepStartedAt, setStartupStepStartedAt] = useState(() => Date.now());
  const [startupPulse, setStartupPulse] = useState(0);

  const todoPlaceholders = useMemo(
    () => [
      "Draft problem set outline",
      "Review last lecture notes",
      "Schedule a 30 min study block",
      "Do a 10-question practice set",
      "Submit final file + double-check instructions"
    ],
    []
  );

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const nextCourses = await getCourses();
      setCourses(nextCourses);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        return;
      }

      const message = error instanceof Error ? error.message : "failed to load courses";
      toast.error("unable to load courses", { description: message });
    } finally {
      setIsLoadingCourses(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (bootFromConnect) {
      setShowStartupLoader(true);
      setStartupStepIndex(0);
      setStartupStepStartedAt(Date.now());
      setStartupPulse(0);
    }
  }, [bootFromConnect]);

  const startupDataReady = !isLoadingCourses;

  useEffect(() => {
    if (!showStartupLoader) {
      return;
    }

    const elapsed = Date.now() - startupStepStartedAt;
    const minStepDurationsMs = [600, 900, 700, 550] as const;
    const requiresDataReadyByStep = [
      true,
      !isLoadingCourses,
      true,
      startupDataReady
    ] as const;

    const minDurationMet = elapsed >= minStepDurationsMs[startupStepIndex];
    const dataReadyForCurrentStep = requiresDataReadyByStep[startupStepIndex];

    if (minDurationMet && dataReadyForCurrentStep) {
      if (startupStepIndex === 3) {
        setShowStartupLoader(false);
        if (bootFromConnect) {
          router.replace("/dashboard");
        }
      } else {
        setStartupStepIndex((current) => current + 1);
        setStartupStepStartedAt(Date.now());
      }
      return;
    }

    const remainingMinDuration = Math.max(
      0,
      minStepDurationsMs[startupStepIndex] - elapsed
    );
    const timeoutMs = dataReadyForCurrentStep
      ? Math.max(120, remainingMinDuration)
      : 250;
    const timeoutId = window.setTimeout(() => {
      setStartupPulse((current) => current + 1);
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [
    bootFromConnect,
    isLoadingCourses,
    router,
    showStartupLoader,
    startupPulse,
    startupStepStartedAt,
    startupDataReady,
    startupStepIndex
  ]);

  const startupSteps = useMemo(
    () => [
      {
        title: "confirming Brightspace connection",
        description: "connection received and session verified."
      },
      {
        title: "loading your courses",
        description: "pulling your Brightspace course list."
      },
      {
        title: "loading workspace modules",
        description: "starting your planning workspace."
      },
      {
        title: "preparing your workspace",
        description: "finishing setup and opening your dashboard."
      }
    ],
    []
  );

  if (showStartupLoader) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="w-full max-w-2xl border-primary/20 bg-card/90">
          <CardHeader>
            <CardTitle className="text-xl">Launching Clarus</CardTitle>
            <p className="text-sm text-muted-foreground">
              your Brightspace login worked. Clarus is now loading your workspace.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {startupSteps.map((step, index) => {
              const isDone = startupStepIndex > index;
              const isActive = startupStepIndex === index;

              return (
                <div key={step.title} className="rounded-md border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <CircleDashed className="h-4 w-4 text-muted-foreground/70" />
                      )}
                    </span>
                    <div>
                      <p className={cn("text-sm font-medium", isDone || isActive ? "text-foreground" : "text-muted-foreground")}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSyncCourses() {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncCourses();
      toast.success("courses synced", {
        description: `${result.coursesSynced} courses updated`
      });
      await loadCourses();
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync failed";
      toast.error("sync failed", { description: message });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (isDisconnecting) {
      return;
    }

    setIsDisconnecting(true);
    try {
      await disconnectD2L();
      toast.success("disconnected from d2l");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "disconnect failed";
      toast.error("disconnect failed", { description: message });
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="animate-fade-up" style={{ animationDelay: "0ms" }}>
          <CardHeader>
            <CardTitle className="text-base">calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Track your due dates, quizzes, exams, labs, and tutorials in one place.</p>
            <Link href={"/dashboard/timeline-intelligence" as any} className="text-primary hover:underline">
              open calendar
            </Link>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "75ms" }}>
          <CardHeader>
            <CardTitle className="text-base">to do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {todoPlaceholders.map((item) => (
              <label
                key={item}
                className="flex cursor-not-allowed items-center gap-3 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors"
              >
                <input type="checkbox" disabled className="h-4 w-4" />
                <span className="text-sm text-foreground/90">{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <CardTitle className="text-base">clarus ai chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Ask for study plans, prioritization help, and next steps from your synced course data.</p>
            <Link href={"/dashboard/copilot-mode" as any} className="text-primary hover:underline">
              open clarus ai chat
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleSyncCourses()}
              disabled={isSyncing || connectionState !== "connected"}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {isSyncing ? "syncing courses..." : "sync courses"}
            </Button>
            <Button variant="ghost" onClick={() => void handleDisconnect()} disabled={isDisconnecting}>
              <Link2Off className="h-4 w-4" />
              {isDisconnecting ? "disconnecting..." : "disconnect"}
            </Button>
          </div>

          {connectionState === "expired" || connectionState === "disconnected" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>reconnect required</AlertTitle>
              <AlertDescription>
                your saved d2l session is unavailable. reconnect from the login screen.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use calendar for upcoming assignment, quiz, exam, lab, and tutorial dates.
              </p>
              <Link
                href={"/dashboard/timeline-intelligence" as any}
                className="inline-flex rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/20 hover:bg-secondary/50"
              >
                open calendar workspace
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">courses</CardTitle>
            </CardHeader>
            <CardContent>{isLoadingCourses ? <CourseSkeleton /> : <CourseList courses={courses} />}</CardContent>
          </Card>
        </div>

        <ConnectionStatus onChange={setConnectionState} />
      </section>
    </div>
  );
}
