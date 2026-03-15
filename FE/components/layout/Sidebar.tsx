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
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

  return (
    <motion.aside
      animate={{ width: isOpen ? 220 : 60 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      className={cn(
        "hidden md:flex flex-col h-[calc(100vh-1rem)] shrink-0 overflow-hidden rounded-2xl",
        "sidebar-surface backdrop-blur-md",
        "sticky top-2 m-2 mr-3"
      )}
    >
      {/* Top: Logo */}
      <Link href="/dashboard" className="sidebar-brand flex h-14 shrink-0 items-center bg-surface-1 px-3 hover:opacity-80 transition-opacity duration-150">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border/70">
          <Image
            src="/Clarus-logo.svg"
            alt="Clarus"
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        </div>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.span
              key="logo-label"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="ml-2.5 text-sm font-semibold tracking-tight text-foreground overflow-hidden whitespace-nowrap"
            >
              Clarus
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Middle: Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const routePath = item.href.split(/[?#]/)[0];
          const isActive =
            pathname === routePath ||
            (routePath === "/dashboard/upcoming/assignments" && pathname.startsWith("/dashboard/upcoming"));

          return (
            <Link
              key={item.href}
              href={item.href as any}
              title={!isOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-[background-color,color] duration-150",
                !isOpen ? "justify-center" : "",
                isActive
                  ? "bg-primary/[0.12] text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] animate-slide-in"
                  : "text-foreground/80 hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-4 w-4 shrink-0", isActive ? "text-foreground" : "text-foreground/75")}
              />
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.span
                    key={`label-${item.href}`}
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="truncate overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings */}
      <div className="shrink-0 border-t border-border/40 p-2 space-y-0.5">
        <Link
          href={"/dashboard/settings" as any}
          title={!isOpen ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-foreground/78 transition-[background-color,color] duration-150 hover:bg-surface-2 hover:text-foreground",
            !isOpen ? "justify-center" : ""
          )}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.span
                key="settings-label"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden whitespace-nowrap"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>
    </motion.aside>
  );
}
