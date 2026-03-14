import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Clarus",
  description: "AI-powered control system for D2L Brightspace",
  icons: {
    icon: "/Clarus-logo.svg",
    shortcut: "/Clarus-logo.svg",
    apple: "/Clarus-logo.svg"
  }
};

const uiSettingsBootstrapScript = `
(() => {
  try {
    const key = "clarus.ui.settings.v1";
    const defaults = {
      theme: "dark"
    };

    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") || {};
    const settings = {
      theme: parsed.theme === "light" ? "light" : defaults.theme
    };

    const root = document.documentElement;
    root.classList.remove("light", "dark", "reduce-motion", "high-contrast", "minimal-effects");
    root.classList.add(settings.theme);
    root.style.colorScheme = settings.theme;
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: uiSettingsBootstrapScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} noise-bg font-sans`}
        style={{ letterSpacing: "-0.011em" }}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
