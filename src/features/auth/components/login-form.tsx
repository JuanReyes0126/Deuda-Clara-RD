"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { type LoginInput, loginSchema } from "@/lib/validations/auth";
import { readAuthResponse } from "@/features/auth/lib/read-auth-response";

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });

      const payload = await readAuthResponse(response);

      if (!response.ok) {
        setErrorMessage(payload.error ?? "No se pudo iniciar sesión.");
        return;
      }

      toast.success("Sesión iniciada correctamente.");
      navigate(payload.redirectTo ?? "/dashboard", { replace: true });
      router.refresh();
    } catch (error) {
      console.error("Login request failed", error);
      setErrorMessage("No pudimos iniciar la sesión ahora mismo. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form
      action="/api/auth/login"
      method="post"
      className="space-y-5"
      onSubmit={onSubmit}
    >
      <div className="rounded-[1.5rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.1))] p-4">
        <p className="text-sm font-semibold text-foreground">Al entrar recuperas tu contexto completo</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            "Tu dashboard con vencimientos y presion mensual.",
            "Tus alertas sin leer y el siguiente pago mas importante.",
            "Tu plan recomendado si ya activaste Premium o Pro.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm leading-7 text-muted"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          spellCheck={false}
          {...form.register("email")}
        />
        <p className="text-sm text-rose-600">{form.formState.errors.email?.message}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/recuperar-contrasena"
            className="text-sm font-medium text-primary hover:text-primary-strong"
          >
            Olvidé mi contraseña
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <p className="text-sm text-rose-600">{form.formState.errors.password?.message}</p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar a mi panel"}
      </Button>

      <p className="text-sm text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary hover:text-primary-strong">
          Crea una ahora
        </Link>
      </p>
    </form>
  );
}
