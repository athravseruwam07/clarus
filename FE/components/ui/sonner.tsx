"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

import { UI_SETTINGS_EVENT, readUiSettings } from "@/lib/uiSettings";

export function Toaster() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    function syncTheme() {
      const settings = readUiSettings();
      setTheme(settings.theme);
    }

    syncTheme();
    window.addEventListener(UI_SETTINGS_EVENT, syncTheme as EventListener);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(UI_SETTINGS_EVENT, syncTheme as EventListener);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        style: {
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          color: "hsl(var(--foreground))"
        }
      }}
    />
  );
}
