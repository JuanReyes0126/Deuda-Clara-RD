"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { useEffect } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Registrar Service Worker para PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            console.log(
              "[PWA] Service Worker registrado con éxito:",
              registration.scope
            );
          })
          .catch((error) => {
            console.error("[PWA] Error al registrar Service Worker:", error);
          });
      });

      // Escuchar actualizaciones del Service Worker
      navigator.serviceWorker.addEventListener("updatefound", () => {
        const newWorker = navigator.serviceWorker.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Nueva versión disponible
              console.log("[PWA] Nueva versión disponible, recarga para actualizar");
              // Aquí podrías mostrar un toast notificando al usuario
            }
          });
        }
      });
    }
  }, []);

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
