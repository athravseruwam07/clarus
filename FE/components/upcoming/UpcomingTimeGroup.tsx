import { Badge } from "@/components/ui/badge";

interface UpcomingTimeGroupProps {
  label: string;
  count: number;
  children: React.ReactNode;
}

export default function UpcomingTimeGroup({ label, count, children }: UpcomingTimeGroupProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
          {label}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
