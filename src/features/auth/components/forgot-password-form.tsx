"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

type ForgotPasswordFormValues = {
  email: string;
};

const emailValidation = {
  required: "Correo electrónico inválido.",
  pattern: {
    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Correo electrónico inválido.",
  },
  setValueAs: (value: string) => value.trim().toLowerCase(),
} as const;

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<ForgotPasswordFormValues>({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    await fetchWithCsrf("/api/auth/recuperar-contrasena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setSuccessMessage(
      "Si el correo existe en el sistema, enviaremos un enlace seguro para recuperar acceso.",
    );
    setIsSubmitting(false);
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
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

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar enlace seguro"}
      </Button>
    </form>
  );
}
