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
          background: "hsl(222 16% 11%)",
          border: "1px solid hsl(222 15% 18%)",
          color: "hsl(210 20% 93%)"
        }
      }}
    />
  );
}
