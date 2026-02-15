"use client";

import type React from "react";

import { cn } from "@/lib/utils";

export function AiWorkspacePanel(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]", props.className)}>
      <div className="space-y-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">{props.children}</div>
    </div>
  );
}

