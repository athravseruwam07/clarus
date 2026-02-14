import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"]
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
    <html lang="en">
      <body className={spaceGrotesk.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
