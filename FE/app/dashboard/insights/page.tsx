"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

import { getDemoInsights, type DemoInsightsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INTENSITY_COLORS: Record<string, string> = {
  low: "hsl(142 71% 45%)",
  medium: "hsl(38 92% 50%)",
  high: "hsl(0 72% 51%)"
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-xs text-muted-foreground">
          {entry.name}: <span className="font-mono text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const [payload, setPayload] = useState<DemoInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getDemoInsights();
        setPayload(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to load insights";
        toast.error("insights unavailable", { description: message });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading || !payload) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        loading insights...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="animate-fade-up" style={{ animationDelay: "0ms" }}>
          <CardHeader>
            <CardTitle className="text-base">workload radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payload.workloadHeatmap} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(222 15% 18%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(222 15% 18%)" }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="estimatedHours" name="hours" radius={[4, 4, 0, 0]}>
                  {payload.workloadHeatmap.map((entry, index) => (
                    <Cell key={index} fill={INTENSITY_COLORS[entry.intensity] ?? INTENSITY_COLORS.low} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "75ms" }}>
          <CardHeader>
            <CardTitle className="text-base">risk forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={payload.riskForecast} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 15% 18%)" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(222 15% 18%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(222 15% 18%)" }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="riskScore"
                  name="risk"
                  stroke="hsl(0 72% 51%)"
                  fill="url(#riskGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <CardTitle className="text-base">behavior trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">average start lead</p>
              <p className="font-mono text-2xl font-semibold text-foreground">
                {payload.behaviorTrends.averageStartLeadDays}
                <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
              </p>
            </div>
            <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">snooze rate</p>
              <p className="font-mono text-2xl font-semibold text-foreground">
                {(payload.behaviorTrends.snoozeRate * 100).toFixed(0)}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">%</span>
              </p>
            </div>
            <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">estimate drift</p>
              <p className="font-mono text-2xl font-semibold text-foreground">
                {payload.behaviorTrends.estimatedVsActualDriftPct}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">%</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
