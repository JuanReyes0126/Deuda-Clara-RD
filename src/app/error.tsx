"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Unhandled app error boundary", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-12">
      <Card className="w-full p-6">
        <CardHeader>
          <CardTitle>No pudimos cargar esta parte de la app</CardTitle>
          <CardDescription>
            Tu información no se perdió. Normalmente esto se resuelve al reintentar o revisando si la base de datos y el entorno están disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset}>Intentar de nuevo</Button>
          <Button
            variant="secondary"
            onClick={() => {
              router.replace("/dashboard");
              router.refresh();
            }}
          >
            Ir al dashboard
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            Volver al inicio
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
