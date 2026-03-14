import type { Course } from "@/lib/api";
import { CourseCard } from "@/components/courses/CourseCard";

interface CourseListProps {
  courses: Course[];
  limit?: number;
}

export function CourseList({ courses, limit }: CourseListProps) {
  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
        No current-term courses found. Training and undated shells are hidden.
      </div>
    );
  }

  const visibleCourses = typeof limit === "number" ? courses.slice(0, limit) : courses;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visibleCourses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
