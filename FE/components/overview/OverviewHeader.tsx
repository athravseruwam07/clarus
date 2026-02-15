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
  isLoading?: boolean;
  reconnectHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        {props.isLoading ? (
          <Skeleton className="h-6 w-72" />
        ) : (
          <h1 className="text-lg font-semibold">{props.title ?? "overview"}</h1>
        )}
        <div className="text-sm text-muted-foreground">
          {props.isLoading ? <Skeleton className="h-4 w-48" /> : props.subtitle ?? "brightspace"}
        </div>
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
