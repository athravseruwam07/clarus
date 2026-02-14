"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getD2LStatus, type ConnectionStatusResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ConnectionBadgeState = "loading" | "connected" | "expired" | "disconnected";

interface ConnectionStatusProps {
  onChange?: (state: ConnectionBadgeState) => void;
}

function resolveState(status: ConnectionStatusResponse): ConnectionBadgeState {
  if (status.connected) {
    return "connected";
  }

  return status.reason === "expired" ? "expired" : "disconnected";
}

function stateCopy(state: ConnectionBadgeState): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (state) {
    case "connected":
      return { label: "connected", variant: "default" };
    case "expired":
      return { label: "expired", variant: "destructive" };
    case "loading":
      return { label: "checking", variant: "secondary" };
    case "disconnected":
    default:
      return { label: "disconnected", variant: "outline" };
  }
}

export function ConnectionStatus({ onChange }: ConnectionStatusProps) {
  const [state, setState] = useState<ConnectionBadgeState>("loading");
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");

    try {
      const status = await getD2LStatus();
      const nextState = resolveState(status);
      setState(nextState);
      onChange?.(nextState);

      if (status.connected) {
        setLastVerifiedAt(status.lastVerifiedAt);
      } else {
        setLastVerifiedAt(null);
      }
    } catch {
      setState("disconnected");
      setLastVerifiedAt(null);
      onChange?.("disconnected");
    }
  }, [onChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copy = stateCopy(state);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Connection status</CardTitle>
          <CardDescription>live check against /d2l/api/lp/1.28/users/whoami</CardDescription>
        </div>
        <Badge variant={copy.variant}>{copy.label}</Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {lastVerifiedAt
            ? `verified ${formatDistanceToNowStrict(new Date(lastVerifiedAt), { addSuffix: true })}`
            : "no verified session yet"}
        </p>
        <Button size="sm" variant="secondary" onClick={() => void refresh()}>
          <RefreshCcw className="mr-1 h-4 w-4" />
          refresh
        </Button>
      </CardContent>
    </Card>
  );
}
