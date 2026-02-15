"use client";

import type React from "react";

export function OverviewLayout(props: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">{props.left}</div>
      <div className="space-y-4">{props.right}</div>
    </div>
  );
}

