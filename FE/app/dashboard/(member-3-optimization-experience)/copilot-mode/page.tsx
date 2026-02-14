"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { askDemoCopilot, type DemoCopilotResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function CopilotModePage() {
  const [message, setMessage] = useState("What should I do this weekend?");
  const [response, setResponse] = useState<DemoCopilotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleAskCopilot() {
    if (!message.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const payload = await askDemoCopilot(message.trim());
      setResponse(payload);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "copilot request failed";
      toast.error("copilot unavailable", { description: detail });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>conversational copilot mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask: I have 2 hours right now, what should I do?"
            />
            <Button onClick={() => void handleAskCopilot()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ask
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Try prompts: "What should I do this weekend?" or "I have 2 hours right now — what is best?"
          </p>
        </CardContent>
      </Card>

      {response ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">copilot answer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{response.answer}</CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">suggested plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {response.suggestedPlan.map((step) => (
                  <p key={step}>- {step}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">linked assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {response.linkedAssignments.map((item) => (
                  <div key={item.assignmentId} className="rounded-md border border-border/80 bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
