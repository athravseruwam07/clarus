import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import type { Course } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: Course;
}

const FALLBACK_IMAGE_STYLES = [
  "from-zinc-950 via-zinc-900 to-zinc-800",
  "from-neutral-950 via-neutral-900 to-neutral-800",
  "from-stone-950 via-stone-900 to-stone-800",
  "from-slate-950 via-zinc-900 to-stone-800",
  "from-neutral-900 via-zinc-800 to-stone-700",
  "from-zinc-900 via-neutral-800 to-zinc-700"
] as const;

function hashText(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function CourseCard({ course }: CourseCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const fallbackStyle = useMemo(() => {
    const index = hashText(course.id) % FALLBACK_IMAGE_STYLES.length;
    return FALLBACK_IMAGE_STYLES[index];
  }, [course.id]);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4001";
  const proxiedImageUrl = `${apiBaseUrl}/v1/courses/${encodeURIComponent(course.id)}/image?v=${encodeURIComponent(course.updatedAt)}`;
  const imageUrl = !imageFailed ? proxiedImageUrl : "";
  const codeLabel = (course.courseCode ?? course.courseName).slice(0, 44);
  const subtitle = course.courseCode && course.courseCode !== course.courseName ? course.courseCode : null;

  return (
    <Card className="h-full overflow-hidden border-border/80">
      <div className="relative h-36 border-b border-border/70 bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${course.courseName} cover`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={cn("h-full w-full bg-gradient-to-br", fallbackStyle)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
          <span className="max-w-[78%] truncate text-xs font-medium text-white/90">{codeLabel}</span>
          <Badge variant={course.isActive ? "default" : "outline"} className="border-white/20 bg-black/45 text-white">
            {course.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base leading-snug">{course.courseName}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
        </div>
        {course.courseHomeUrl ? (
          <a
            href={course.courseHomeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
          >
            Open in D2L
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0" />
    </Card>
  );
}
