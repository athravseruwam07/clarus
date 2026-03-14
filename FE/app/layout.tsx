import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

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

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
  style: ["normal", "italic"]
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
    const validAccents = ["default", "teal", "violet", "amber"];

    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") || {};
    const theme = parsed.theme === "light" ? "light" : "dark";
    const accent = validAccents.includes(parsed.accent) ? parsed.accent : "default";

    const root = document.documentElement;
    root.classList.remove("light", "dark", "reduce-motion", "high-contrast", "minimal-effects",
                          "accent-teal", "accent-violet", "accent-amber");
    root.classList.add(theme);
    root.style.colorScheme = theme;

    if (accent !== "default") {
      root.classList.add("accent-" + accent);
    }
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} noise-bg font-sans`}
        style={{ letterSpacing: "-0.011em" }}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
