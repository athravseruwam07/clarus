"use client";

import { ChevronDown, ChevronUp, Filter, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import type { AssignmentAiBriefDTO } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Category = AssignmentAiBriefDTO["checklist"][number]["category"];

const CATEGORY_LABEL: Record<Category, string> = {
  planning: "planning",
  research: "research",
  writing: "writing",
  practice: "practice",
  rubric: "rubric",
  submission: "submission",
  review: "review",
  admin: "admin"
};

export function AiChecklistCard(props: {
  brief: AssignmentAiBriefDTO;
  checkedById: Record<string, boolean>;
  onToggleChecked: (id: string, checked: boolean) => void;
  className?: string;
}) {
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");

  const allItems = props.brief.checklist;

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return allItems;
    return allItems.filter((item) => item.category === categoryFilter);
  }, [allItems, categoryFilter]);

  const progress = useMemo(() => {
    const total = allItems.length;
    const done = allItems.reduce((sum, item) => sum + (props.checkedById[item.id] ? 1 : 0), 0);
    return { done, total };
  }, [allItems, props.checkedById]);

  return (
    <Card className={cn("card-glow", props.className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">ai checklist</CardTitle>
            <p className="text-xs text-muted-foreground">
              {progress.done} / {progress.total} done
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const anyExpanded = Object.values(expandedById).some(Boolean);
                if (anyExpanded) {
                  setExpandedById({});
                  return;
                }
                const next: Record<string, boolean> = {};
                filteredItems.forEach((item) => {
                  next[item.id] = true;
                });
                setExpandedById(next);
              }}
            >
              <ListChecks className="h-4 w-4" />
              {Object.values(expandedById).some(Boolean) ? "collapse" : "expand"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            <Filter className="mr-1 h-3 w-3" />
            category
          </Badge>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === "all" ? "secondary" : "ghost"}
            className={cn("h-7 px-2 text-xs", categoryFilter !== "all" ? "border border-border/60" : null)}
            onClick={() => setCategoryFilter("all")}
          >
            all
          </Button>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={categoryFilter === cat ? "secondary" : "ghost"}
              className={cn("h-7 px-2 text-xs", categoryFilter !== cat ? "border border-border/60" : null)}
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_LABEL[cat]}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="pr-1">
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const checked = props.checkedById[item.id] ?? false;
              const expanded = expandedById[item.id] ?? false;
              return (
                <div
                  key={item.id}
                  className="rounded-md border border-border/80 bg-secondary/20 px-3 py-2"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => props.onToggleChecked(item.id, e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground/90">{item.title}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.category}
                        </Badge>
                        {item.estimatedMinutes ? (
                          <span className="text-[10px] text-muted-foreground/80">{item.estimatedMinutes}m</span>
                        ) : null}
                      </div>

                      {expanded && item.details ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {item.details}
                        </p>
                      ) : null}
                    </div>

                    {item.details ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8"
                        onClick={() => setExpandedById((prev) => ({ ...prev, [item.id]: !expanded }))}
                        aria-label={expanded ? "collapse details" : "expand details"}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
