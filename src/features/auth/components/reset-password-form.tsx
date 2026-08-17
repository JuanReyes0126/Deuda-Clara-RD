"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

type ResetPasswordFormValues = {
  token: string;
  password: string;
  confirmPassword: string;
};

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

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    defaultValues: {
      token,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetchWithCsrf("/api/auth/restablecer-contrasena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrorMessage(payload.error ?? "No se pudo restablecer la contraseña.");
      setIsSubmitting(false);
      return;
    }

    toast.success("Tu contraseña fue actualizada.");
    router.push("/login");
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register("password", passwordValidation)}
        />
        <p className="text-sm text-rose-600">{form.formState.errors.password?.message}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
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

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Actualizando..." : "Restablecer contraseña"}
      </Button>
    </form>
  );
}
