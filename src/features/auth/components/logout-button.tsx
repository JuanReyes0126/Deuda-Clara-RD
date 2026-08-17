"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/cn";
import { buttonClasses } from "@/components/ui/button";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
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

          const response = await fetchWithCsrf("/api/auth/logout", {
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
        aria-label={isLoading ? "Saliendo" : "Cerrar sesión"}
        title="Cerrar sesión"
        className={cn(
          buttonClasses({ variant: "secondary", size: "sm" }),
          compact &&
            "size-10 rounded-2xl px-0 py-0 shadow-none sm:size-11",
        )}
        disabled={isLoading}
      >
        {compact ? (
          <LogOut className="size-[1.125rem]" />
        ) : isLoading ? (
          "Saliendo..."
        ) : (
          "Cerrar sesión"
        )}
      </button>
    </form>
  );
}
