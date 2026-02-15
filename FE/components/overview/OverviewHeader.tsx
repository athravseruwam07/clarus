"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function OverviewHeader(props: {
  title: string | null;
  subtitle: string | null;
  badgeText: string | null;
  openUrl: string | null;
  onBack: () => void;
  metadataItems?: Array<{ label: string; value: React.ReactNode }>;
  isLoading?: boolean;
  reconnectHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        {props.isLoading ? (
          <Skeleton className="h-6 w-72" />
        ) : (
          <h1 className="text-xl font-bold tracking-tight">{props.title ?? "overview"}</h1>
        )}
        <div className="text-sm text-muted-foreground">
          {props.isLoading ? <Skeleton className="h-4 w-48" /> : props.subtitle ?? "brightspace"}
        </div>
        {props.metadataItems && props.metadataItems.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/90">
            {props.metadataItems.map((item, idx) => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {item.label}
                </span>
                <span className="text-foreground/80">{item.value}</span>
                {idx < props.metadataItems!.length - 1 ? (
                  <span className="mx-1 text-muted-foreground/40">·</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.badgeText ? <Badge>{props.badgeText}</Badge> : null}

        <Button variant="secondary" size="sm" onClick={props.onBack}>
          <ArrowLeft className="h-4 w-4" />
          back
        </Button>

        {props.openUrl ? (
          <a
            href={props.openUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink className="h-4 w-4" />
            open in brightspace
          </a>
        ) : null}

        {props.reconnectHref ? (
          <Link href={props.reconnectHref as any} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            reconnect
          </Link>
        ) : null}
      </div>
    </div>
  );
}
