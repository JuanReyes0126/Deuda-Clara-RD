"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "border border-border bg-card text-card-foreground shadow-soft",
          },
        }}
      />
    </>
  );
}
