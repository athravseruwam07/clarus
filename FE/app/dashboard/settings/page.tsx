"use client";

import { ArrowLeft, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_UI_SETTINGS,
  type UiSettings,
  applyUiSettings,
  loadAndApplyUiSettings,
  writeUiSettings
} from "@/lib/uiSettings";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);

  useEffect(() => {
    setSettings(loadAndApplyUiSettings());
  }, []);

  function setTheme(theme: UiSettings["theme"]) {
    const next = { ...settings, theme };
    setSettings(next);
    writeUiSettings(next);
    applyUiSettings(next);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Choose your app theme.</p>
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
    </div>
  );
}
