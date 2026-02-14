"use client";

import { AlertTriangle, Link2Off, Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionBadgeState>("loading");

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
    <DashboardShell>
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">today</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              phase 2 will generate focused task blocks from live assignment signals.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">next 7 days</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              workload radar placeholder for heavy-week prediction and study planning.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">recently changed</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              upcoming change detection for due date and rubric updates.
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

            {isLoadingCourses ? <CourseSkeleton /> : <CourseList courses={courses} />}
          </div>

          <ConnectionStatus onChange={setConnectionState} />
        </section>
      </div>
    </DashboardShell>
  );
}
