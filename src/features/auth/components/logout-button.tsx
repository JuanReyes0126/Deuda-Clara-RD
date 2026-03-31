"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { buttonClasses } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <form
      action="/api/auth/logout?redirectTo=/login"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault();

        try {
          setIsLoading(true);

          const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });

          if (!response.ok) {
            toast.error("No pudimos cerrar la sesión ahora mismo.");
            setIsLoading(false);
            return;
          }

          toast.success("Sesión cerrada.");
          router.replace("/login");
          router.refresh();
        } catch {
          toast.error("No pudimos cerrar la sesión ahora mismo.");
          setIsLoading(false);
        }
      }}
    >
      <button
        type="submit"
        className={buttonClasses({ variant: "secondary", size: "sm" })}
        disabled={isLoading}
      >
        {isLoading ? "Saliendo..." : "Cerrar sesión"}
      </button>
    </form>
  );
}
