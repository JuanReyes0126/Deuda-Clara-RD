"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEGAL_DISCLAIMER_COPY } from "@/config/legal";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { readAuthResponse } from "@/features/auth/lib/read-auth-response";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptLegal: boolean;
};

function buildNameValidation(message: string) {
  return {
    validate: {
      minLength: (value: string) => value.trim().length >= 2 || message,
      maxLength: (value: string) =>
        value.trim().length <= 60 || "No puede exceder 60 caracteres.",
    },
    setValueAs: (value: string) => value.trim(),
  } as const;
}

const emailValidation = {
  required: "Correo electrónico inválido.",
  pattern: {
    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Correo electrónico inválido.",
  },
  setValueAs: (value: string) => value.trim().toLowerCase(),
} as const;

const passwordValidation = {
  validate: {
    minLength: (value: string) =>
      value.length >= 8 || "La contraseña debe tener al menos 8 caracteres.",
    maxLength: (value: string) =>
      value.length <= 72 || "La contraseña no puede exceder 72 caracteres.",
    uppercase: (value: string) =>
      /[A-Z]/.test(value) ||
      "La contraseña debe incluir al menos una mayúscula.",
    lowercase: (value: string) =>
      /[a-z]/.test(value) ||
      "La contraseña debe incluir al menos una minúscula.",
    number: (value: string) =>
      /\d/.test(value) || "La contraseña debe incluir al menos un número.",
  },
} as const;

const firstNameValidation = buildNameValidation("El nombre es obligatorio.");
const lastNameValidation = buildNameValidation("El apellido es obligatorio.");

export function RegisterForm({
  initialError = null,
  csrfToken,
}: {
  initialError?: string | null;
  csrfToken: string;
}) {
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const form = useForm<RegisterFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptLegal: false,
    },
  });
  const acceptLegalField = form.register("acceptLegal", {
    validate: (value) =>
      value || "Debes aceptar los Términos y Condiciones y la Política de Privacidad.",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithCsrf("/api/auth/registrar", {
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
      <input type="hidden" name="csrfToken" value={csrfToken} />
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
          <Input id="firstName" {...form.register("firstName", firstNameValidation)} />
          <p className="text-sm text-rose-600">{form.formState.errors.firstName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" {...form.register("lastName", lastNameValidation)} />
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
          {...form.register("email", emailValidation)}
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
            {...form.register("password", passwordValidation)}
          />
          <p className="text-sm text-rose-600">{form.formState.errors.password?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword", {
              validate: (value, formValues) =>
                value === formValues.password || "Las contraseñas no coinciden.",
            })}
          />
          <p className="text-sm text-rose-600">
            {form.formState.errors.confirmPassword?.message}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/45 px-4 py-4 text-sm leading-7 text-muted">
        Tu contraseña debe tener al menos 8 caracteres, incluir una mayuscula, una minuscula y un numero.
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-white/85 px-4 py-4">
        <div className="flex items-start gap-3">
          <input
            id="acceptLegal"
            type="checkbox"
            className="mt-1 size-4 rounded border-border"
            aria-invalid={form.formState.errors.acceptLegal ? "true" : "false"}
            name={acceptLegalField.name}
            ref={acceptLegalField.ref}
            onBlur={acceptLegalField.onBlur}
            onChange={(event) => {
              acceptLegalField.onChange(event);
              setHasAcceptedLegal(event.target.checked);
            }}
          />
          <div className="min-w-0 text-sm leading-7 text-muted">
            <Label
              htmlFor="acceptLegal"
              className="inline cursor-pointer text-sm leading-7 text-muted"
            >
              Acepto los{" "}
            </Label>
            <Link href="/terms" className="font-semibold text-primary hover:text-primary-strong">
              Términos y Condiciones
            </Link>{" "}
            y la{" "}
            <Link
              href="/privacy"
              className="font-semibold text-primary hover:text-primary-strong"
            >
              Política de Privacidad
            </Link>
            .
          </div>
        </div>
        <p className="text-sm text-rose-600">{form.formState.errors.acceptLegal?.message}</p>
      </div>

      <p className="text-sm leading-7 text-muted">{LEGAL_DISCLAIMER_COPY}</p>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || !hasAcceptedLegal}
      >
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
