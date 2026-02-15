"use client";

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export function OverviewLayout(props: {
  tabs: Array<{
    id: string;
    label: string;
    icon?: LucideIcon;
    badge?: string;
    content: React.ReactNode;
  }>;
  defaultTab?: string;
  className?: string;
}) {
  const tabIds = useMemo(() => new Set(props.tabs.map((t) => t.id)), [props.tabs]);

  const [activeTab, setActiveTab] = useState(() => {
    if (props.defaultTab && tabIds.has(props.defaultTab)) return props.defaultTab;
    return props.tabs[0]?.id ?? "overview";
  });
  const [hasUserSelected, setHasUserSelected] = useState(false);

  useEffect(() => {
    if (!props.tabs.some((t) => t.id === activeTab)) {
      setActiveTab(props.tabs[0]?.id ?? "overview");
    }
  }, [activeTab, props.tabs]);

  useEffect(() => {
    if (hasUserSelected) return;
    if (!props.defaultTab) return;
    if (!tabIds.has(props.defaultTab)) return;
    setActiveTab(props.defaultTab);
  }, [hasUserSelected, props.defaultTab, tabIds]);

  return (
    <div className={cn("space-y-4", props.className)}>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/80 backdrop-blur md:-mx-6">
        <div className="px-4 md:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {props.tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setHasUserSelected(true);
                    setActiveTab(tab.id);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "border-b-2",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  <span className="capitalize">{tab.label}</span>
                  {tab.badge ? (
                    <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div role="tabpanel">
        {props.tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <div key={tab.id} className={isActive ? "animate-tab-enter" : "hidden"} aria-hidden={!isActive}>
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
