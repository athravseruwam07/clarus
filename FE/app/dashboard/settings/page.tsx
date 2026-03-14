"use client";

import { ArrowLeft, CalendarSync, Copy, ExternalLink, Loader2, Moon, RefreshCcw, Sun } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_UI_SETTINGS,
  type UiSettings,
  applyUiSettings,
  loadAndApplyUiSettings,
  writeUiSettings
} from "@/lib/uiSettings";
import { type CalendarFeedAccessResponse, getCalendarFeedAccess } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeedAccessResponse | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  useEffect(() => {
    setSettings(loadAndApplyUiSettings());
  }, []);

  const loadCalendarFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const payload = await getCalendarFeedAccess();
      setCalendarFeed(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load calendar integration";
      toast.error("Calendar integration unavailable", { description: message });
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarFeed();
  }, [loadCalendarFeed]);

  function setTheme(theme: UiSettings["theme"]) {
    const next = { ...settings, theme };
    setSettings(next);
    writeUiSettings(next);
    applyUiSettings(next);
  }

  async function copyFeedUrl() {
    if (!calendarFeed?.feedUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(calendarFeed.feedUrl);
      toast.success("Calendar feed URL copied");
    } catch {
      toast.error("Unable to copy URL", {
        description: "Copy is blocked in this browser context. Select and copy manually."
      });
    }
  }

  function preferredWebcalUrl(feed: CalendarFeedAccessResponse): string {
    try {
      const parsed = new URL(feed.webcalUrl || feed.feedUrl);
      if (parsed.protocol === "webcal:") {
        return parsed.toString();
      }
      return `webcal://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch {
      return feed.webcalUrl;
    }
  }

  function isLocalFeed(feed: CalendarFeedAccessResponse): boolean {
    try {
      const parsed = new URL(feed.feedUrl);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
    } catch {
      return false;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure theme and integrations.</p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Theme</CardTitle>
            <Badge variant="secondary">{settings.theme === "dark" ? "Dark" : "Light"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "rounded-lg border px-4 py-4 text-left transition-colors",
                settings.theme === "dark"
                  ? "border-primary/45 bg-primary/15"
                  : "border-border bg-secondary/20 hover:bg-secondary/35"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Moon className="h-4 w-4" />
                <p className="font-medium">Dark</p>
              </div>
              <p className="text-xs text-muted-foreground">Black background with light text.</p>
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "rounded-lg border px-4 py-4 text-left transition-colors",
                settings.theme === "light"
                  ? "border-primary/45 bg-primary/15"
                  : "border-border bg-secondary/20 hover:bg-secondary/35"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <p className="font-medium">Light</p>
              </div>
              <p className="text-xs text-muted-foreground">White background with dark text.</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarSync className="h-4 w-4 text-primary" />
              Calendar Integration
            </CardTitle>
            <Badge variant="secondary">Auto-updating feed</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Subscribe your Google, Apple, or Outlook calendar to your Clarus feed. Clarus updates this feed whenever
            your timeline is synced.
          </p>

          {isLoadingFeed ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing subscription link...
            </div>
          ) : calendarFeed ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription URL</p>
                <Input value={calendarFeed.feedUrl} readOnly className="font-mono text-xs" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => void copyFeedUrl()}>
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
                {isLocalFeed(calendarFeed) ? (
                  <a
                    href={calendarFeed.feedUrl}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open feed URL
                  </a>
                ) : (
                  <a
                    href={preferredWebcalUrl(calendarFeed)}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in calendar app
                  </a>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => void loadCalendarFeed()}>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh link
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Link expires on {new Date(calendarFeed.expiresAt).toLocaleString()}.
              </p>
            </>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadCalendarFeed()}>
              <RefreshCcw className="h-4 w-4" />
              Generate link
            </Button>
          )}

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Google Calendar: Add calendar from URL and paste the subscription link.</p>
            {calendarFeed && isLocalFeed(calendarFeed) ? (
              <p>
                Apple Calendar (localhost): Copy URL, then use File, New Calendar Subscription, and paste the link.
              </p>
            ) : (
              <p>Apple Calendar: File, New Calendar Subscription, then paste the link.</p>
            )}
            <p>Outlook: Add calendar, Subscribe from web, then paste the link.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
