"use client";

import type { AssignmentAiBriefDTO } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AiScheduleCard(props: { brief: AssignmentAiBriefDTO; className?: string }) {
  return (
    <Card className={cn("card-glow", props.className)}>
      <CardHeader>
        <CardTitle className="text-base">ai schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <details className="rounded-xl border border-border/70 bg-secondary/10 p-3">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground">
            view suggested sessions ({props.brief.schedule.length})
          </summary>
          <div className="mt-3 space-y-2">
            {props.brief.schedule.map((session) => (
              <div key={session.label} className="rounded-md border border-border/80 bg-secondary/20 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground/90">{session.label}</p>
                  <span className="font-mono text-xs text-muted-foreground">{session.durationMinutes} min</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{session.objective}</p>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

