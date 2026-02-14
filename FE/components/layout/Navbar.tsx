import { format } from "date-fns";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function Navbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">clarus command center</p>
          <h1 className="text-sm font-semibold">Clarus Dashboard</h1>
        </div>
      </div>
      <Badge variant="outline" className="font-mono text-xs">{format(new Date(), "EEEE, MMM d")}</Badge>
    </header>
  );
}
