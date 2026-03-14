import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-[-0.01em] transition-[transform,box-shadow,opacity,background-color] duration-150 ring-offset-background disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12),_0_1px_3px_rgba(0,0,0,0.4)] hover:bg-primary/90 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),_0_0_18px_hsl(var(--foreground)/0.14),_0_2px_8px_rgba(0,0,0,0.4)] active:scale-[0.98]",
        secondary: "btn-secondary bg-secondary text-secondary-foreground hover:bg-secondary/70",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "btn-outline border border-border bg-transparent hover:bg-secondary hover:text-foreground",
        ghost: "btn-ghost hover:bg-secondary"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-6"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
