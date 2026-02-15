"use client";

import type React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KeyValueCard(props: {
  title: string;
  items: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
}) {
  return (
    <Card className={cn("card-glow", props.className)}>
      <CardHeader>
        <CardTitle className="text-base">{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <dl className="space-y-2">
          {props.items.map((item) => (
            <div key={item.label} className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="text-foreground/90">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

