"use client";

import { useEffect } from "react";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Registrar Service Worker para PWA
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registrado con éxito:", registration.scope);
          })
          .catch((error) => {
            console.error("Fallo al registrar SW:", error);
          });
      });
    }
  }, []);

  return <>{children}</>;
}
