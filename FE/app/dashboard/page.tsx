"use client";

import { AlertTriangle, ArrowRight, Link2Off, Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ApiError,
  disconnectD2L,
  getCourses,
  getDemoDashboardData,
  syncCourses,
  type Course,
  type DemoDashboardData
} from "@/lib/api";
import {
  ConnectionStatus,
  type ConnectionBadgeState
} from "@/components/auth/ConnectionStatus";
import { CourseList } from "@/components/courses/CourseList";
import { CourseSkeleton } from "@/components/courses/CourseSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoadmapByLane } from "@/lib/feature-roadmap";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const roadmapByLane = getRoadmapByLane();

  const [courses, setCourses] = useState<Course[]>([]);
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionBadgeState>("loading");

  const topTimelineItem = useMemo(() => demoData?.timeline[0] ?? null, [demoData]);
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

  const loadDemoData = useCallback(async () => {
    setIsLoadingDemo(true);

    try {
      const payload = await getDemoDashboardData();
      setDemoData(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to load dashboard intelligence";
      toast.error("demo intelligence unavailable", { description: message });
    } finally {
      setIsLoadingDemo(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
    void loadDemoData();
  }, [loadCourses, loadDemoData]);

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
      await Promise.all([loadCourses(), loadDemoData()]);
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
      <section className="grid gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => {
          const cards = [
            <Card key="leverage" className="animate-fade-up" style={{ animationDelay: "0ms" }}>
              <CardHeader>
                <CardTitle className="text-base">highest leverage task right now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {isLoadingDemo || !demoData ? (
                  <p>loading intelligence...</p>
                ) : (
                  <>
                    <p className="font-medium text-foreground">{demoData.highestLeverageTask.title}</p>
                    <p>{demoData.highestLeverageTask.reason}</p>
                    <p className="font-mono text-xs">
                      risk {demoData.highestLeverageTask.riskScore} · effort {demoData.highestLeverageTask.effortHours}h
                    </p>
                    <Link
                      href={`/dashboard/assignments/${demoData.highestLeverageTask.assignmentId}` as any}
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      open assignment intelligence
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>,

            <Card key="risk" className="animate-fade-up" style={{ animationDelay: "75ms" }}>
              <CardHeader>
                <CardTitle className="text-base">risk alert</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {isLoadingDemo || !demoData ? (
                  <p>loading risk model...</p>
                ) : (
                  <>
                    <p className="font-medium text-foreground">{demoData.riskAlert.headline}</p>
                    <p>{demoData.riskAlert.explanation}</p>
                    <p className="text-foreground/80">mitigation: {demoData.riskAlert.mitigation}</p>
                  </>
                )}
              </CardContent>
            </Card>,

            <Card key="workload" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
              <CardHeader>
                <CardTitle className="text-base">workload radar preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {isLoadingDemo || !demoData ? (
                  <p>loading forecast...</p>
                ) : (
                  <>
                    <p className="font-medium text-foreground">
                      {demoData.workloadPreview.weekLabel}: {demoData.workloadPreview.estimatedHours}h estimated
                    </p>
                    <p>{demoData.workloadPreview.recommendation}</p>
                    <Link href={"/dashboard/insights" as any} className="text-primary hover:underline">
                      open full insights view
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>,

            <Card key="todo" className="animate-fade-up" style={{ animationDelay: "225ms" }}>
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
          ];

          return cards[i];
        })}
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
              {isLoadingDemo || !demoData ? (
                <p className="text-sm text-muted-foreground">loading ranked timeline...</p>
              ) : (
                demoData.timeline.map((item) => (
                  <Link
                    key={item.assignmentId}
                    href={`/dashboard/assignments/${item.assignmentId}` as any}
                    className="block rounded-md border border-border/80 bg-secondary/30 p-3 transition-colors hover:bg-secondary/50 hover:border-primary/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.courseName}</p>
                      </div>
                      <Badge variant={item.recentlyChanged ? "destructive" : "secondary"}>
                        {item.recentlyChanged ? "recently changed" : "stable"}
                      </Badge>
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      priority {item.priorityScore} · risk {item.riskScore} · effort {item.effortHours}h
                    </p>
                  </Link>
                ))
              )}
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

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">feature workspaces</h2>
          <p className="text-sm text-muted-foreground">
            combined roadmap scaffolded for 3 parallel lanes (foundation, intelligence, optimization).
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {roadmapByLane.map((laneGroup) => (
            <Card key={laneGroup.lane} className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{laneGroup.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {laneGroup.features.map((feature) => (
                  <Link
                    key={feature.slug}
                    href={feature.route as any}
                    className="block rounded-md border border-border/80 bg-secondary/30 px-3 py-2 text-sm transition-colors hover:bg-secondary/50 hover:border-primary/20"
                  >
                    <p className="font-medium">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.summary}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {topTimelineItem ? (
        <section className="rounded-lg border border-border/80 bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground">
            end-to-end demo path: Dashboard, Open Assignment, Start Session, Insights, Copilot Q&A
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/assignments/${topTimelineItem.assignmentId}` as any}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              open assignment intelligence
            </Link>
            <Link href={"/dashboard/insights" as any} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              open insights
            </Link>
            <Link href={"/dashboard/copilot-mode" as any} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              open copilot q&a
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
