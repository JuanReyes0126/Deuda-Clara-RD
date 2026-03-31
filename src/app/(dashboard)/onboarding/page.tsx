import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { OnboardingForm } from "@/features/settings/components/onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const [activeDebtCount, paymentCount] = await Promise.all([
    prisma.debt.count({
      where: {
        userId: user.id,
        archivedAt: null,
      },
    }),
    prisma.payment.count({
      where: {
        userId: user.id,
      },
    }),
  ]);
  const nextRoute =
    activeDebtCount === 0
      ? "/deudas?from=onboarding"
      : paymentCount === 0
        ? "/pagos?from=onboarding"
        : "/dashboard";
  const submitLabel =
    activeDebtCount === 0
      ? "Guardar y cargar mis deudas"
      : paymentCount === 0
        ? "Guardar y registrar mi primer pago"
        : "Guardar e ir al panel";
  const onboardingSteps = [
    {
      id: "debt",
      title: "Paso 1: registra una deuda",
      complete: activeDebtCount > 0,
      detail:
        activeDebtCount > 0
          ? `${activeDebtCount} deuda${activeDebtCount === 1 ? "" : "s"} cargada${activeDebtCount === 1 ? "" : "s"}.`
          : "Carga al menos una deuda para que la app pueda medir urgencia y costo real.",
    },
    {
      id: "payment",
      title: "Paso 2: registra un pago",
      complete: paymentCount > 0,
      detail:
        paymentCount > 0
          ? `${paymentCount} pago${paymentCount === 1 ? "" : "s"} registrado${paymentCount === 1 ? "" : "s"}.`
          : "Con el primer pago la app empieza a leer avance real, principal e intereses.",
    },
    {
      id: "plan",
      title: "Paso 3: revisa tu plan",
      complete: activeDebtCount > 0 && paymentCount > 0,
      detail:
        activeDebtCount > 0 && paymentCount > 0
          ? "Ya tienes suficiente base para revisar tu dashboard y tu ruta inicial."
          : "Este paso se habilita en cuanto tengas una deuda y un pago capturados.",
    },
  ];
  const completedOnboardingSteps = onboardingSteps.filter(
    (step) => step.complete,
  ).length;
  const onboardingProgressPct = Math.round(
    (completedOnboardingSteps / onboardingSteps.length) * 100,
  );
  const nextSteps =
    activeDebtCount === 0
      ? [
          "Registrar tus deudas principales",
          "Confirmar fechas de vencimiento",
          "Ver tu ruta inicial en el dashboard",
        ]
      : paymentCount === 0
        ? [
            "Registrar tu primer pago",
            "Ver cómo baja el saldo real",
            "Revisar tu progreso en el dashboard",
          ]
        : [
            "Entrar al dashboard",
            "Revisar tu fecha estimada de salida",
            "Ajustar estrategia o simulador si hace falta",
          ];

  return (
    <div className="grid gap-6">
      <Card className="p-8">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Onboarding inicial
          </p>
          <CardTitle>Configura tu punto de partida</CardTitle>
          <CardDescription>
            Antes de cargar deudas, define tu presupuesto mensual y cómo quieres
            que el sistema te ayude a priorizar pagos.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="p-8">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Activación guiada
          </p>
          <CardTitle>Empieza con estos 3 pasos</CardTitle>
          <CardDescription>
            No necesitas completarlo todo perfecto hoy. Solo avanza en este
            orden para que la app empiece a ayudarte de verdad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Progreso visible
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {completedOnboardingSteps}/{onboardingSteps.length} pasos
                </p>
              </div>
              <p className="text-sm text-muted">
                {onboardingProgressPct}% listo
              </p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,#0f584a_0%,#218471_100%)]"
                style={{ width: `${onboardingProgressPct}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {onboardingSteps.map((step) => (
              <div
                key={step.id}
                className="rounded-[1.5rem] border border-border bg-white p-5"
              >
                <p className="text-base font-semibold text-foreground">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="p-8">
        <CardContent>
          <OnboardingForm
            defaultValues={{
              monthlyDebtBudget: Number(user.settings?.monthlyDebtBudget ?? 0),
              preferredStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
              emailRemindersEnabled: user.settings?.emailRemindersEnabled ?? false,
              notifyDueSoon: user.settings?.notifyDueSoon ?? true,
              notifyOverdue: user.settings?.notifyOverdue ?? true,
              notifyMinimumRisk: user.settings?.notifyMinimumRisk ?? true,
            }}
            nextRoute={nextRoute}
            submitLabel={submitLabel}
            nextSteps={nextSteps}
          />
        </CardContent>
      </Card>
    </div>
  );
}
