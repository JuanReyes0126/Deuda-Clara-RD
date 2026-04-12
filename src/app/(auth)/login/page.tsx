import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentSession } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME } from "@/lib/security/csrf";

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getCurrentSession();
  const csrfToken = (await cookies()).get(CSRF_COOKIE_NAME)?.value ?? "";
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialError = getSearchParamValue(resolvedSearchParams.error);

  if (session) {
    redirect(session.user.onboardingCompleted ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthPageShell
      eyebrow="Acceso seguro"
      title="Vuelve a tu panel y revisa lo urgente sin perder contexto."
      description="Accede a tu espacio seguro para ver deudas, pagos, alertas y el plan inteligente de salida."
      asideTitle="Lo que verás al entrar"
      proofItems={[
        "Sesiones protegidas",
        "Alertas accionables",
        "Plan recomendado si eres Premium",
      ]}
      asideItems={[
        "Dashboard con deuda total, pagos mínimos y vencimientos cercanos.",
        "Recomendación automática de la deuda más urgente.",
        "Alertas de mora, intereses y riesgos por pagar solo mínimos.",
      ]}
    >
      <div className="space-y-2">
        <h2 className="font-display text-3xl font-semibold text-foreground">Iniciar sesión</h2>
        <p className="text-sm leading-7 text-muted">
          Tus sesiones están protegidas y los accesos relevantes quedan auditados.
        </p>
      </div>
      <LoginForm initialError={initialError} csrfToken={csrfToken} />
    </AuthPageShell>
  );
}
