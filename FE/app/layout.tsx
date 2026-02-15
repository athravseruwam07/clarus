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
  description: "AI-powered control system for D2L Brightspace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} noise-bg font-sans`}
        style={{ letterSpacing: "-0.011em" }}
      >
=======
    <html lang="en" suppressHydrationWarning>
      <body className={spaceGrotesk.className} suppressHydrationWarning>
>>>>>>> Stashed changes
=======
    <html lang="en" suppressHydrationWarning>
      <body className={spaceGrotesk.className} suppressHydrationWarning>
>>>>>>> Stashed changes
=======
    <html lang="en" suppressHydrationWarning>
      <body className={spaceGrotesk.className} suppressHydrationWarning>
>>>>>>> Stashed changes
        {children}
        <Toaster />
      </body>
    </html>
  );
}
