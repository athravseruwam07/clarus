import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-secondary/40 via-secondary/70 to-secondary/40 bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
