"use client";

import {
  Bot,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Compass,
  Gauge,
  LayoutDashboard,
  SearchCode,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type NavigationItem =
  | {
      kind: "link";
      label: string;
      href: string;
      icon: LucideIcon;
    }
  | {
      kind: "group";
      label: string;
      baseHref: string;
      icon: LucideIcon;
      items: Array<{
        label: string;
        href: string;
      }>;
    };

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const navSections: NavigationSection[] = [
  {
    label: "workspace",
    items: [
      { kind: "link", label: "overview", href: "/dashboard", icon: LayoutDashboard },
      {
        kind: "link",
        label: "assignment intelligence",
        href: "/dashboard/assignments/asg-thermo-2",
        icon: Compass
      },
      { kind: "link", label: "insights", href: "/dashboard/insights", icon: TrendingUp },
      { kind: "link", label: "ai copilot", href: "/dashboard/copilot-mode", icon: Bot }
    ]
  },
  {
    label: "planning",
    items: [
      { kind: "link", label: "calendar", href: "/dashboard/timeline-intelligence", icon: CalendarClock },
      { kind: "link", label: "weekly workload", href: "/dashboard/workload-forecast", icon: Gauge }
    ]
  },
  {
    label: "coursework",
    items: [
      {
        kind: "group",
        label: "upcoming",
        baseHref: "/dashboard/upcoming",
        icon: CalendarRange,
        items: [
          { label: "assignments", href: "/dashboard/upcoming/assignments" },
          { label: "quizzes", href: "/dashboard/upcoming/quizzes" },
          { label: "exams", href: "/dashboard/upcoming/exams" }
        ]
      },
      { kind: "link", label: "content locator", href: "/dashboard/content-locator", icon: SearchCode }
    ]
  },
  {
    label: "optimization",
    items: [
      { kind: "link", label: "work plan optimizer", href: "/dashboard/study-plan-optimizer", icon: CalendarClock },
      { kind: "link", label: "copilot mode", href: "/dashboard/copilot-mode", icon: Bot }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const isUpcomingRoute = pathname.startsWith("/dashboard/upcoming");
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(isUpcomingRoute);

  useEffect(() => {
    if (isUpcomingRoute) {
      setIsUpcomingOpen(true);
    }
  }, [isUpcomingRoute]);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border/80 bg-card/50 p-4 backdrop-blur md:block">
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
              if (item.kind === "group") {
                const isActiveGroup = pathname.startsWith(item.baseHref);

                return (
                  <details
                    key={item.baseHref}
                    open={item.baseHref === "/dashboard/upcoming" ? isUpcomingOpen : isActiveGroup}
                    onToggle={(event) => {
                      if (item.baseHref !== "/dashboard/upcoming") {
                        return;
                      }

                      setIsUpcomingOpen((event.currentTarget as HTMLDetailsElement).open);
                    }}
                    className="space-y-1"
                  >
                    <summary
                      className={cn(
                        "flex cursor-pointer list-none items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors [&::-webkit-details-marker]:hidden",
                        isActiveGroup
                          ? "border-l-2 border-primary bg-primary/10 text-foreground animate-slide-in"
                          : "text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      <item.icon
                        className={cn("h-4 w-4", isActiveGroup ? "text-primary" : "text-muted-foreground")}
                      />
                      <span className="capitalize">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "ml-auto h-4 w-4 transition-transform",
                          (item.baseHref === "/dashboard/upcoming" ? isUpcomingOpen : isActiveGroup)
                            ? "rotate-180"
                            : "rotate-0"
                        )}
                      />
                    </summary>

                    <div className="space-y-1">
                      {item.items.map((subItem) => {
                        const isSubActive = pathname === subItem.href;

                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href as any}
                            className={cn(
                              "flex items-center gap-2 rounded-md py-1.5 pl-10 pr-3 text-sm transition-colors",
                              isSubActive
                                ? "border-l-2 border-primary bg-primary/10 text-foreground"
                                : "text-muted-foreground hover:bg-secondary/50"
                            )}
                          >
                            <span className={cn("h-1 w-1 rounded-full", isSubActive ? "bg-primary" : "bg-muted-foreground/40")} />
                            <span className="capitalize">{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              }

              const routePath = item.href.split(/[?#]/)[0];
              const isActive = pathname === routePath;

              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive ? "border-l-2 border-primary bg-primary/10 text-foreground animate-slide-in" : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
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
