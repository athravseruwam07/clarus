import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UrgencyLevel } from "@/lib/upcomingUtils";
import { urgencyBadgeProps } from "@/lib/upcomingUtils";

interface UpcomingItemCardProps {
  title: string;
  courseLabel: string | null;
  dateLabel: string;
  urgency: UrgencyLevel;
  overviewHref: string | null;
}

export default function UpcomingItemCard({
  title,
  courseLabel,
  dateLabel,
  urgency,
  overviewHref
}: UpcomingItemCardProps) {
  const badge = urgencyBadgeProps(urgency);

  const content = (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50 hover:border-primary/20">
      <div className="space-y-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {courseLabel ? (
            <span className="text-xs text-muted-foreground">{courseLabel}</span>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground">{dateLabel}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {overviewHref ? (
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none")}>
            view
          </span>
        ) : null}
      </div>
    </div>
  );

  if (overviewHref) {
    return <Link href={overviewHref as any}>{content}</Link>;
  }

  return content;
}
