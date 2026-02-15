"use client";

import { format } from "date-fns";
import { useMemo } from "react";

import { safeDateFromIso, sortByStartAt } from "@/lib/classifyEvent";
import {
  buildOverviewHref,
  computeUrgency,
  deduplicateBySource,
  filterExams,
  groupEventsByTime
} from "@/lib/upcomingUtils";
import UpcomingEmptyState from "@/components/upcoming/UpcomingEmptyState";
import UpcomingItemCard from "@/components/upcoming/UpcomingItemCard";
import UpcomingPageShell from "@/components/upcoming/UpcomingPageShell";
import UpcomingSkeleton from "@/components/upcoming/UpcomingSkeleton";
import UpcomingTimeGroup from "@/components/upcoming/UpcomingTimeGroup";

export default function UpcomingExamsPage() {
  return (
    <UpcomingPageShell>
      {({ events, isLoading }) => {
        const now = new Date();

        const grouped = useMemo(() => {
          const filtered = filterExams(events);
          const deduped = deduplicateBySource(filtered, "event");
          const sorted = [...deduped].sort(sortByStartAt);
          const futureOnly = sorted.filter((e) => {
            const d = safeDateFromIso(e.startAt);
            return d && d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
          });
          return groupEventsByTime(futureOnly, now);
        }, [events]);

        if (isLoading) return <UpcomingSkeleton />;
        if (grouped.length === 0) return <UpcomingEmptyState itemType="exams" />;

        return (
          <div className="space-y-4">
            {grouped.map((group) => (
              <UpcomingTimeGroup key={group.key} label={group.label} count={group.events.length}>
                {group.events.map((event) => {
                  const startAt = safeDateFromIso(event.startAt);
                  const endAt = event.endAt ? safeDateFromIso(event.endAt) : null;

                  let dateLabel: string;
                  if (startAt && endAt) {
                    dateLabel = `${format(startAt, "EEE, MMM d 'at' p")} \u2013 ${format(endAt, "p")}`;
                  } else if (startAt) {
                    dateLabel = format(startAt, "EEE, MMM d 'at' p");
                  } else {
                    dateLabel = "Date: TBD";
                  }

                  const urgency = startAt ? computeUrgency(startAt, now) : "upcoming";
                  const courseLabel = event.courseCode ?? event.courseName;

                  return (
                    <UpcomingItemCard
                      key={event.id}
                      title={event.title}
                      courseLabel={courseLabel}
                      dateLabel={dateLabel}
                      urgency={urgency}
                      overviewHref={buildOverviewHref(event)}
                    />
                  );
                })}
              </UpcomingTimeGroup>
            ))}
          </div>
        );
      }}
    </UpcomingPageShell>
  );
}
