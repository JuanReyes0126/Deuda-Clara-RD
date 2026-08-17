"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { readAuthResponse } from "@/features/auth/lib/read-auth-response";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

type LoginFormValues = {
  email: string;
  password: string;
  totpCode: string;
  recoveryCode: string;
};

const emailValidation = {
  required: "Correo electrónico inválido.",
  pattern: {
    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Correo electrónico inválido.",
  },
  setValueAs: (value: string) => value.trim().toLowerCase(),
} as const;

const passwordValidation = {
  required: "La contraseña es obligatoria.",
} as const;

const totpValidation = {
  validate: (value: string) =>
    value.trim() === "" || /^\d{6}$/.test(value.trim()) || "El código debe tener 6 dígitos.",
  setValueAs: (value: string) => value.trim(),
} as const;

const recoveryCodeValidation = {
  validate: (value: string) =>
    value.trim() === "" ||
    /^[A-Za-z0-9-]{8,20}$/.test(value.trim()) ||
    "El código de respaldo no es válido.",
  setValueAs: (value: string) => value.trim().toUpperCase(),
} as const;

export function LoginForm({
  initialError = null,
  csrfToken,
}: {
  initialError?: string | null;
  csrfToken: string;
}) {
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [mfaRequired, setMfaRequired] = useState(false);
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
      totpCode: "",
      recoveryCode: "",
    },
  });

  useEffect(() => {
    setIsPasskeySupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithCsrf("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });

      const payload = await readAuthResponse(response);

      if (!response.ok) {
        setMfaRequired(Boolean(payload.mfaRequired));
        setErrorMessage(payload.error ?? "No se pudo iniciar sesión.");
        return;
      }

      setMfaRequired(false);
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

  const handlePasskeyLogin = async () => {
    const emailIsValid = await form.trigger("email");

    if (!emailIsValid) {
      return;
    }

    setIsPasskeySubmitting(true);
    setErrorMessage(null);
    setMfaRequired(false);

    try {
      const email = form.getValues("email");
      const optionsResponse = await fetchWithCsrf("/api/auth/passkeys/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email }),
      });
      const optionsPayload = (await optionsResponse.json()) as {
        error?: string;
        options?: import("@simplewebauthn/browser").PublicKeyCredentialRequestOptionsJSON;
      };

      if (!optionsResponse.ok || !optionsPayload.options) {
        setErrorMessage(
          optionsPayload.error ?? "No se pudo iniciar con passkey.",
        );
        return;
      }

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const credential = await startAuthentication({
        optionsJSON: optionsPayload.options,
      });
      const verifyResponse = await fetchWithCsrf("/api/auth/passkeys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ credential }),
      });
      const verifyPayload = await readAuthResponse(verifyResponse);

      if (!verifyResponse.ok) {
        setErrorMessage(
          verifyPayload.error ?? "No se pudo completar el acceso con passkey.",
        );
        return;
      }

      toast.success("Acceso con passkey confirmado.");
      navigate(verifyPayload.redirectTo ?? "/dashboard", { replace: true });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error &&
        /cancel|abort|not allowed/i.test(error.message)
          ? "Se canceló la verificación con passkey."
          : "No se pudo completar el acceso con passkey.";

      setErrorMessage(message);
    } finally {
      setIsPasskeySubmitting(false);
    }
  };

  return (
    <form
      action="/api/auth/login"
      method="post"
      className="space-y-5"
      onSubmit={onSubmit}
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <div className="rounded-[1.5rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.1))] p-4">
        <p className="text-sm font-semibold text-foreground">Al entrar recuperas tu contexto completo</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            "Tu dashboard con vencimientos y presión mensual.",
            "Tus alertas sin leer y el siguiente pago más importante.",
            "Tu plan recomendado si ya activaste Premium o Pro.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-border/50 bg-white/80 px-4 py-3 text-sm leading-7 text-muted"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {mfaRequired ? (
        <div className="space-y-4 rounded-2xl border border-primary/12 bg-secondary/55 p-4">
          <div className="space-y-2">
            <Label htmlFor="totpCode">Código de verificación</Label>
            <Input
              id="totpCode"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              {...form.register("totpCode", totpValidation)}
            />
            <p className="text-sm text-rose-600">{form.formState.errors.totpCode?.message}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recoveryCode">Código de respaldo</Label>
            <Input
              id="recoveryCode"
              type="text"
              autoCapitalize="characters"
              maxLength={20}
              placeholder="ABCDE-12345"
              {...form.register("recoveryCode", recoveryCodeValidation)}
            />
            <p className="text-sm text-muted">
              Si no tienes acceso a tu app autenticadora, puedes usar uno de tus códigos de respaldo.
            </p>
            <p className="text-sm text-rose-600">{form.formState.errors.recoveryCode?.message}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username webauthn"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          spellCheck={false}
          {...form.register("email", emailValidation)}
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
          {...form.register("password", passwordValidation)}
        />
        <p className="text-sm text-rose-600">{form.formState.errors.password?.message}</p>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || isPasskeySubmitting}
      >
        {isSubmitting ? "Entrando..." : "Entrar a mi panel"}
      </Button>

      {isPasskeySupported ? (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={handlePasskeyLogin}
          disabled={isSubmitting || isPasskeySubmitting}
        >
          {isPasskeySubmitting ? "Verificando passkey..." : "Entrar con passkey"}
        </Button>
      ) : null}

      <p className="text-sm text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary hover:text-primary-strong">
          Crea una ahora
        </Link>
      </p>
    </form>
  );
}
