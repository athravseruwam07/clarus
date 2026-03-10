"use client";

import { BookOpen, Loader2, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { ApiError, getCourses, syncCourses, type Course } from "@/lib/api";
import { CourseList } from "@/components/courses/CourseList";
import { CourseSkeleton } from "@/components/courses/CourseSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeCourseCount = useMemo(() => courses.filter((course) => course.isActive).length, [courses]);

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

      const message = error instanceof Error ? error.message : "Failed to load courses";
      toast.error("Unable to load courses", { description: message });
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
      toast.success("Courses synced", {
        description: `${result.coursesSynced} courses updated.`
      });
      await loadCourses();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      toast.error("Sync failed", { description: message });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/65 via-primary/20 to-transparent" />
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" />
              Courses
            </CardTitle>
            <CardDescription>
              {courses.length === 0
                ? "Sync your D2L courses to build this page."
                : `${activeCourseCount} active course${activeCourseCount === 1 ? "" : "s"} across ${courses.length} total enrollment${
                    courses.length === 1 ? "" : "s"
                  }.`}
            </CardDescription>
          </div>

          <Button onClick={() => void handleSyncCourses()} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {isSyncing ? "Syncing courses..." : "Sync courses"}
          </Button>
        </CardHeader>
        <CardContent>{isLoadingCourses ? <CourseSkeleton /> : <CourseList courses={courses} />}</CardContent>
      </Card>
    </div>
  );
}
