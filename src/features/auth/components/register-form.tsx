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
import { type RegisterInput, registerSchema } from "@/lib/validations/auth";
import { readAuthResponse } from "@/features/auth/lib/read-auth-response";

export function RegisterForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });

      const payload = await readAuthResponse(response);

      if (!response.ok) {
        setErrorMessage(payload.error ?? "No se pudo crear la cuenta.");
        return;
      }

      toast.success("Tu cuenta fue creada correctamente.");
      navigate(payload.redirectTo ?? "/onboarding", { replace: true });
      router.refresh();
    } catch (error) {
      console.error("Register request failed", error);
      setErrorMessage("No pudimos completar el registro ahora mismo. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form
      action="/api/auth/registrar"
      method="post"
      className="space-y-5"
      onSubmit={onSubmit}
    >
      <div className="rounded-[1.5rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.1))] p-4">
        <p className="text-sm font-semibold text-foreground">Que pasa despues de crear tu cuenta</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            "Defines tu presupuesto mensual y estrategia inicial.",
            "Registras tus primeras deudas para ver el panorama real.",
            "Luego decides si quieres seguir en Base o acelerar con Premium.",
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

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" {...form.register("firstName")} />
          <p className="text-sm text-rose-600">{form.formState.errors.firstName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" {...form.register("lastName")} />
          <p className="text-sm text-rose-600">{form.formState.errors.lastName?.message}</p>
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

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          <p className="text-sm text-rose-600">{form.formState.errors.password?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          <p className="text-sm text-rose-600">
            {form.formState.errors.confirmPassword?.message}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/45 px-4 py-4 text-sm leading-7 text-muted">
        Tu contraseña debe tener al menos 8 caracteres, incluir una mayuscula, una minuscula y un numero.
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta y continuar"}
      </Button>

      <p className="text-sm text-muted">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary-strong">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
