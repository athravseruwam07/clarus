"use client";

import { MapPin, NotebookPen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NotesCard(props: {
  locationText: string;
  onLocationChange: (value: string) => void;
  notesText: string;
  onNotesChange: (value: string) => void;
  isSaving?: boolean;
  saveError?: string | null;
  className?: string;
}) {
  return (
    <Card className={cn("card-glow", props.className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">your notes</CardTitle>
        <div className="text-xs text-muted-foreground">
          {props.saveError ? "not saved" : props.isSaving ? "saving..." : "saved"}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.saveError ? <p className="text-xs text-destructive">{props.saveError}</p> : null}

        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={props.locationText}
            onChange={(e) => props.onLocationChange(e.target.value)}
            placeholder="location (optional)"
            className="pl-9"
          />
        </div>

        <div className="relative">
          <NotebookPen className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <textarea
            value={props.notesText}
            onChange={(e) => props.onNotesChange(e.target.value)}
            placeholder="add quick notes, what to bring, what to ask, reminders..."
            rows={5}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-secondary/50 px-9 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
