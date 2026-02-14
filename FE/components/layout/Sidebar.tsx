"use client";

import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CalendarClock,
  Compass,
  Gauge,
  LayoutDashboard,
  Layers,
  ListChecks,
  Radar,
  Route,
  Scale,
  SearchCode,
  Sparkles,
  Timer,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavigationSection = {
  label: string;
  items: Array<{
    label: string;
    href: string;
    icon: LucideIcon;
  }>;
};

const navSections: NavigationSection[] = [
  {
    label: "demo flow",
    items: [
      { label: "overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "assignment intelligence", href: "/dashboard/assignments/asg-thermo-2", icon: Compass },
      { label: "insights", href: "/dashboard/insights", icon: TrendingUp },
      { label: "copilot q&a", href: "/dashboard/copilot-mode", icon: Bot }
    ]
  },
  {
    label: "member 1: foundation + modeling",
    items: [
      { label: "sync center", href: "/dashboard/sync-center", icon: Route },
      { label: "timeline intelligence", href: "/dashboard/timeline-intelligence", icon: CalendarClock },
      { label: "change impact", href: "/dashboard/change-impact", icon: Radar },
      { label: "workload forecast", href: "/dashboard/workload-forecast", icon: Gauge },
      { label: "risk prediction", href: "/dashboard/risk-prediction", icon: AlertTriangle },
      { label: "effort estimation", href: "/dashboard/effort-estimation", icon: Timer }
    ]
  },
  {
    label: "member 2: semantic intelligence",
    items: [
      { label: "assignment breakdown", href: "/dashboard/assignment-breakdown", icon: ListChecks },
      { label: "content locator", href: "/dashboard/content-locator", icon: SearchCode },
      { label: "knowledge gaps", href: "/dashboard/knowledge-gaps", icon: BrainCircuit },
      { label: "rubric scoring", href: "/dashboard/rubric-scoring", icon: Scale }
    ]
  },
  {
    label: "member 3: optimization + copilot",
    items: [
      { label: "smart reminders", href: "/dashboard/smart-reminders", icon: Sparkles },
      { label: "submission + grade", href: "/dashboard/submission-grade-tracker", icon: Layers },
      { label: "study plan optimizer", href: "/dashboard/study-plan-optimizer", icon: CalendarClock },
      { label: "prioritization engine", href: "/dashboard/prioritization-engine", icon: TrendingUp },
      { label: "copilot mode", href: "/dashboard/copilot-mode", icon: Bot }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-80 shrink-0 border-r border-border/80 bg-white/85 p-4 backdrop-blur md:block">
      <p className="px-2 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        navigation
      </p>

      <nav className="space-y-4">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/12 text-foreground"
                      : "text-foreground/85 hover:bg-secondary/80"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-primary/80")} />
                  <span className="capitalize">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
