import { redirect } from "next/navigation";

import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getCurrentSession } from "@/lib/auth/session";

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCurrentSession();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialError = getSearchParamValue(resolvedSearchParams.error);

  if (session) {
    redirect(session.user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthPageShell
      eyebrow="Cuenta nueva"
      title="Empieza a ordenar tus deudas con una vista clara y accionable."
      description="Crea tu cuenta, completa el onboarding inicial y construye un plan realista para salir de deudas en RD."
      asideTitle="Beneficios del producto"
      proofItems={[
        "Empiezas gratis",
        "Onboarding guiado",
        "Premium cuando quieras acelerar",
      ]}
      asideItems={[
        "Todo en RD$: saldos, intereses, mora y presupuesto mensual.",
        "Motor snowball, avalanche e hibrido para diferentes perfiles.",
        "Notificaciones por vencimiento, atraso y riesgo financiero.",
      ]}
    >
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold text-foreground">Crear cuenta</h2>
        <p className="text-sm leading-7 text-muted">
          Necesitamos pocos datos para activar tu panel y llevarte directo al onboarding.
        </p>
      </div>
      <RegisterForm initialError={initialError} />
    </AuthPageShell>
  );
}
