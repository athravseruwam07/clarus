import { format } from "date-fns";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function Navbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border/80 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">clarus command center</p>
          <h1 className="text-lg font-semibold">Clarus Dashboard</h1>
        </div>
      </div>
      <Badge variant="secondary">{format(new Date(), "EEEE, MMM d")}</Badge>
    </header>
  );
}
