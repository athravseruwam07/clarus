"use client";

import { CalendarDays } from "lucide-react";

import type { TodoItem } from "@/lib/todoItems";

function startCase(text: string): string {
  if (!text) return text;
  return `${text[0]?.toUpperCase() ?? ""}${text.slice(1)}`;
}

export default function TodoChecklist(props: {
  items: TodoItem[];
  checkedIds: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <>
      {props.items.map((item) => (
        <label
          key={item.id}
          className="flex items-start gap-3 rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/40"
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={Boolean(props.checkedIds[item.id])}
            onChange={(event) => props.onToggle(item.id, event.target.checked)}
          />
          <div className="min-w-0">
            <a href={item.href} target="_blank" rel="noreferrer" className="block text-sm text-foreground hover:underline">
              {item.title}
            </a>
            <p className="text-xs text-muted-foreground">{item.action}</p>
            <p className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {startCase(item.dueText)}
            </p>
          </div>
        </label>
      ))}
    </>
  );
}
