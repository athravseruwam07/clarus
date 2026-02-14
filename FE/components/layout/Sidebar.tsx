import { CalendarClock, GraduationCap, Radar, RefreshCcw } from "lucide-react";

const menuItems = [
  {
    label: "courses",
    icon: GraduationCap
  },
  {
    label: "today",
    icon: CalendarClock
  },
  {
    label: "workload radar",
    icon: Radar
  },
  {
    label: "sync center",
    icon: RefreshCcw
  }
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/80 bg-white/85 p-4 backdrop-blur md:block">
      <p className="px-2 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        navigation
      </p>
      <nav className="space-y-1">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/85 transition-colors hover:bg-secondary/80"
          >
            <item.icon className="h-4 w-4 text-primary" />
            <span className="capitalize">{item.label}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
}
