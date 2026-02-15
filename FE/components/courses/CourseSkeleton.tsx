import { Skeleton } from "@/components/ui/skeleton";

export function CourseSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="p-6 pt-5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
