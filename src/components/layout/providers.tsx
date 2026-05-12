"use client";

import { useEffect } from "react";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Registrar Service Worker para PWA
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registrado:", registration);
        })
        .catch((error) => {
          console.error("SW fallo:", error);
        });
    }
  }, []);

  return <>{children}</>;
}
