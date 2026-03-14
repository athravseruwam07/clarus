import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium tracking-[0.01em] transition-colors ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/20 ring-primary/10",
        secondary: "badge-secondary bg-secondary text-secondary-foreground border border-border/50 ring-white/5",
        destructive: "bg-destructive/15 text-destructive border border-destructive/20 ring-destructive/10",
        outline: "border border-border text-foreground ring-white/5",
        success: "bg-success/15 text-success border border-success/20 ring-success/10"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
