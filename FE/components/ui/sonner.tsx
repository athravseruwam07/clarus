"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        style: {
          background: "hsl(0 0% 9%)",
          border: "1px solid hsl(0 0% 20%)",
          color: "hsl(0 0% 94%)"
        }
      }}
    />
  );
}
