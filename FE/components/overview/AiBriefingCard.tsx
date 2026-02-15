"use client";

import { Loader2, Sparkles } from "lucide-react";

import type { AssignmentAiBriefDTO } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AiBriefingCard(props: {
  brief: AssignmentAiBriefDTO | null;
  isGenerating: boolean;
  aiNotConfigured: boolean;
  aiError: string | null;
  onGenerate: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("card-glow", props.className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">ai briefing</CardTitle>
        {!props.aiNotConfigured ? (
          <Button size="sm" onClick={props.onGenerate} disabled={props.isGenerating}>
            {props.isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {props.isGenerating ? "generating..." : props.brief ? "regenerate" : "generate"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {props.aiNotConfigured ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
            AI not configured on server.
          </div>
        ) : null}

        {props.aiError ? (
          <Alert variant="destructive">
            <AlertTitle>ai unavailable</AlertTitle>
            <AlertDescription>{props.aiError}</AlertDescription>
          </Alert>
        ) : null}

        {!props.brief && !props.aiNotConfigured ? (
          <p className="text-muted-foreground">
            generate a brief, checklist, and suggested schedule based on the Brightspace context.
          </p>
        ) : null}

        {props.brief ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">tl;dr</p>
              <p className="text-sm text-foreground/90">{props.brief.tldr}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">deliverables</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {props.brief.deliverables.map((item) => (
                  <p key={item}>- {item}</p>
                ))}
              </div>
            </div>

            {props.brief.questionsToClarify.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                  questions to clarify
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {props.brief.questionsToClarify.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

