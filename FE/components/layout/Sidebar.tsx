"use client";

import {
  Bot,
  CalendarClock,
  Gauge,
  ListTodo,
  Settings2,
  Target
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type NavigationItem = {
  kind: "link";
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavigationItem[] = [
  { kind: "link", label: "Calendar", href: "/dashboard/timeline-intelligence", icon: CalendarClock },
  { kind: "link", label: "Upcoming", href: "/dashboard/upcoming/assignments", icon: ListTodo },
  { kind: "link", label: "Weekly Workload", href: "/dashboard/workload-forecast", icon: Gauge },
  { kind: "link", label: "Study Plan Optimizer", href: "/dashboard/study-plan-optimizer", icon: Target },
  { kind: "link", label: "Clarus AI Chat", href: "/dashboard/copilot-mode", icon: Bot }
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNavIndex = navItems.findIndex((item) => isActiveHref(item.href));

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function handleOpen() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  }

  function handleClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 160);
  }

  function isActiveHref(href: string): boolean {
    const routePath = href.split(/[?#]/)[0];
    return (
      pathname === routePath ||
      (routePath === "/dashboard/upcoming/assignments" && pathname.startsWith("/dashboard/upcoming"))
    );
  }

  return (
    <div className="sticky top-2 z-30 m-2 mr-3 hidden h-[calc(100vh-1rem)] w-[60px] shrink-0 md:block">
      <div
        className="pointer-events-none absolute left-0 top-14 z-[3] h-px w-[220px] bg-border/22 transition-[clip-path] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ clipPath: `inset(0 ${isOpen ? 0 : 160}px 0 0 round 0)` }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[220px] rounded-2xl border border-border/26 bg-surface-1/72 shadow-[0_18px_48px_rgba(0,0,0,0.10),_0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur-2xl transition-[clip-path,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          clipPath: isOpen ? "inset(0 round 1rem)" : "inset(0 160px 0 0 round 1rem)"
        }}
      >
        {activeNavIndex >= 0 ? (
          <div
            className="absolute left-2 right-4 h-11 rounded-lg bg-primary/[0.10] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]"
            style={{ top: `${68 + activeNavIndex * 46}px` }}
          />
        ) : null}
      </div>

      <aside
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        className={cn(
          "absolute inset-y-0 left-0 flex h-full w-[60px] flex-col overflow-hidden rounded-2xl transition-[border-color,background-color,box-shadow] duration-300",
          isOpen
            ? "border-0 bg-transparent shadow-none"
            : "border border-border/35 bg-surface-1/58 shadow-[0_14px_36px_rgba(0,0,0,0.14),_0_2px_10px_rgba(0,0,0,0.06)] backdrop-blur-xl"
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "sidebar-brand relative z-[2] flex h-14 shrink-0 items-center justify-center px-3 transition-[background-color,opacity,border-color,box-shadow] duration-200",
            isOpen
              ? "pointer-events-none opacity-0"
              : "bg-surface-1/68 hover:bg-surface-1/78"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border/70">
            <Image
              src="/Clarus-logo.svg"
              alt="Clarus"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-1 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = isActiveHref(item.href);

            return (
              <Link
                key={item.href}
                href={item.href as any}
                title={item.label}
                className={cn(
                  "mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-[background-color,color] duration-200",
                  isActive
                    ? isOpen
                      ? "bg-transparent text-foreground shadow-none"
                      : "bg-primary/[0.12] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]"
                    : "text-foreground/80 hover:bg-surface-2/58 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-foreground/75")} />
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border/40 px-1 py-2">
          <Link
            href={"/dashboard/settings" as any}
            title="Settings"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-foreground/78 transition-[background-color,color] duration-200 hover:bg-surface-2/58 hover:text-foreground"
          >
            <Settings2 className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </aside>

      <aside
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        className={cn(
          "absolute inset-y-0 left-0 flex h-full w-[220px] flex-col overflow-hidden rounded-r-2xl rounded-l-none bg-transparent transition-[clip-path,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{
          clipPath: isOpen ? "inset(0 round 1rem)" : "inset(0 160px 0 60px round 1rem)"
        }}
      >
        <Link
          href="/dashboard"
          className="sidebar-brand relative z-[2] flex h-14 shrink-0 items-center gap-4 bg-transparent px-3 transition-[opacity,box-shadow] duration-200"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border/70">
            <Image
              src="/Clarus-logo.svg"
              alt="Clarus"
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
            Clarus
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = isActiveHref(item.href);

            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  "flex h-11 items-center rounded-lg pl-[60px] pr-4 text-sm transition-[background-color,color] duration-200",
                  isActive
                    ? isOpen
                      ? "bg-transparent text-foreground shadow-none"
                      : "bg-primary/[0.10] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)]"
                    : "text-foreground/80 hover:bg-surface-2/28 hover:text-foreground"
                )}
              >
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border/20 p-2">
          <Link
            href={"/dashboard/settings" as any}
            className="flex h-11 items-center rounded-lg pl-[60px] pr-4 text-sm text-foreground/78 transition-[background-color,color] duration-200 hover:bg-surface-2/28 hover:text-foreground"
          >
            <span className="whitespace-nowrap">Settings</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}
