"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";

export function HostUnlockForm() {
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/internal/host-gate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = await readJsonPayload<{ error?: string; redirectTo?: string }>(
        response,
      );

      if (!response.ok) {
        setErrorMessage(
          payload.error ?? "No se pudo verificar la clave secundaria.",
        );
        setIsSubmitting(false);
        return;
      }

      navigate(payload.redirectTo ?? "/host", { replace: true });
      router.refresh();
      return;
    } catch {
      setErrorMessage("No se pudo verificar la clave secundaria.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-12">
      <Card className="w-full p-6">
        <CardHeader>
          <CardTitle>Acceso interno protegido</CardTitle>
          <CardDescription>
            Esta capa adicional solo aplica al panel interno. Introduce la clave secundaria para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="hostPassword">
                Clave secundaria
              </label>
              <Input
                id="hostPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Verificando..." : "Entrar al panel"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  router.replace("/dashboard");
                  router.refresh();
                }}
              >
                Volver al dashboard
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
