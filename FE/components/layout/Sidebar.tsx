"use client";

import {
  Bot,
  CalendarClock,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Target
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavigationItem = {
  kind: "link";
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavigationItem[] = [
  { kind: "link", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { kind: "link", label: "Calendar", href: "/dashboard/timeline-intelligence", icon: CalendarClock },
  { kind: "link", label: "Upcoming", href: "/dashboard/upcoming/assignments", icon: ListTodo },
  { kind: "link", label: "Weekly Workload", href: "/dashboard/workload-forecast", icon: Gauge },
  { kind: "link", label: "Study Plan Optimizer", href: "/dashboard/study-plan-optimizer", icon: Target },
  { kind: "link", label: "Clarus AI Chat", href: "/dashboard/copilot-mode", icon: Bot }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border/80 bg-card/50 p-4 backdrop-blur md:sticky md:top-0 md:block">
      <p className="px-2 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        navigation
      </p>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const routePath = item.href.split(/[?#]/)[0];
          const isActive =
            pathname === routePath || (routePath === "/dashboard/upcoming/assignments" && pathname.startsWith("/dashboard/upcoming"));

          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-l-2 border-primary bg-primary/10 text-foreground animate-slide-in"
                  : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
