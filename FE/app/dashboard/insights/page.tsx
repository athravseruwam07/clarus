"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getDemoInsights, type DemoInsightsData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">workload radar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {payload.workloadHeatmap.map((week) => (
              <p key={week.week}>
                {week.week}: {week.estimatedHours}h ({week.intensity})
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">risk forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {payload.riskForecast.map((week) => (
              <p key={week.week}>
                {week.week}: risk {week.riskScore} ({week.label})
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">behavior trends</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>average start lead: {payload.behaviorTrends.averageStartLeadDays} days</p>
            <p>snooze rate: {(payload.behaviorTrends.snoozeRate * 100).toFixed(0)}%</p>
            <p>estimate drift: {payload.behaviorTrends.estimatedVsActualDriftPct}%</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">knowledge gaps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {payload.knowledgeGaps.map((gap) => (
            <div key={gap.concept} className="rounded-md border border-border/80 bg-white/70 px-3 py-2">
              <p className="font-medium text-foreground">{gap.concept}</p>
              <p>confidence: {(gap.confidence * 100).toFixed(0)}%</p>
              <p>{gap.recommendation}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
