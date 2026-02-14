import { format } from "date-fns";
import { BookMarked, CalendarRange } from "lucide-react";

import type { Course } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value: string | null): string {
  if (!value) {
    return "tbd";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "tbd";
  }

  return format(parsed, "MMM d, yyyy");
}

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Card className="h-full border-border/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{course.courseName}</CardTitle>
            <CardDescription>{course.courseCode ?? "no course code"}</CardDescription>
          </div>
          <Badge variant={course.isActive ? "default" : "outline"}>
            {course.isActive ? "active" : "inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" />
          org unit id: {course.brightspaceCourseId}
        </div>
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          {formatDate(course.startDate)} - {formatDate(course.endDate)}
        </div>
      </CardContent>
    </Card>
  );
}
