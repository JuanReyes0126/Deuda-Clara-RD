"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { TrustInlineNote } from "@/components/shared/trust-inline-note";
import {
  membershipPlanCatalog,
  type MembershipBillingStatus,
  type MembershipPlanId,
} from "@/lib/membership/plans";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import type { MembershipConversionSnapshotDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

type MembershipSourceContext =
  | "simulador"
  | "dashboard"
  | "reportes"
  | "notificaciones"
  | "planes"
  | null;

async function requestJson(
  url: string,
  method: "PATCH" | "POST",
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonPayload<{ error?: string; url?: string }>(
    response,
  );

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo guardar.");
  }

  return payload;
}

const billingStatusLabels: Record<MembershipBillingStatus, string> = {
  FREE: "Base",
  PENDING: "Checkout pendiente",
  ACTIVE: "Activa",
  PAST_DUE: "Pago pendiente",
  CANCELED: "Cancelada",
  INACTIVE: "Inactiva",
};

const billingStatusVariants: Record<
  MembershipBillingStatus,
  "default" | "warning" | "danger" | "success"
> = {
  FREE: "default",
  PENDING: "warning",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "danger",
  INACTIVE: "default",
};

function getPlanActionLabel({
  billingConfigured,
  canManageBilling,
  currentTier,
  isCurrent,
  isPremium,
  planId,
  planLabel,
}: {
  billingConfigured: boolean;
  canManageBilling: boolean;
  currentTier: MembershipPlanId;
  isCurrent: boolean;
  isPremium: boolean;
  planId: MembershipPlanId;
  planLabel: string;
}) {
  if (isCurrent) {
    if (billingConfigured && canManageBilling && planId !== "FREE") {
      return "Gestionar suscripción";
    }

    return "Plan activo";
  }

  if (billingConfigured && canManageBilling && currentTier !== "FREE") {
    if (planId === "FREE") {
      return "Volver a Base";
    }

    return "Cambiar en Stripe";
  }

  if (isPremium) {
    return "Activar Premium";
  }

  return `Elegir ${planLabel}`;
}

function getHighlightedActionLabel(
  planId: MembershipPlanId,
  sourceContext: MembershipSourceContext,
) {
  if (planId === "NORMAL") {
    if (sourceContext === "simulador") {
      return "Activar Premium y fijar ruta";
    }

    if (sourceContext === "reportes") {
      return "Activar Premium y corregir prioridad";
    }

    if (sourceContext === "notificaciones") {
      return "Activar Premium y ordenar alertas";
    }

    if (sourceContext === "dashboard") {
      return "Activar Premium y ver prioridad";
    }

    return "Activar Premium ahora";
  }

  if (sourceContext === "reportes") {
    return "Activar Pro y sostener seguimiento";
  }

  if (sourceContext === "notificaciones") {
    return "Activar Pro y mantener acompañamiento";
  }

  return "Activar Pro ahora";
}

function getConversionDeltaCopy(
  conversionSnapshot: MembershipConversionSnapshotDto,
) {
  if (
    conversionSnapshot.hasDebts &&
    conversionSnapshot.monthsSaved !== null &&
    conversionSnapshot.monthsSaved > 0
  ) {
    return `Podrías recortar ${conversionSnapshot.monthsSaved} meses frente a tu ritmo actual.`;
  }

  if (
    conversionSnapshot.hasDebts &&
    conversionSnapshot.interestSavings !== null &&
    conversionSnapshot.interestSavings > 0
  ) {
    return `Podrías evitar ${formatCurrency(conversionSnapshot.interestSavings)} en intereses.`;
  }

  return "Premium desbloquea la recomendación exacta y la convierte en una ruta ejecutable.";
}

function getCommercialNarrative({
  conversionSnapshot,
  sourceContext,
}: {
  conversionSnapshot: MembershipConversionSnapshotDto;
  sourceContext: MembershipSourceContext;
}) {
  if (!conversionSnapshot.hasDebts) {
    return {
      title:
        "Premium cobra más sentido cuando ya tienes una deuda real que optimizar.",
      description:
        "Base te deja organizarte. En cuanto registres una deuda, Premium podrá decirte si vas demasiado lento, qué deuda atacar primero y cómo recortar tiempo sin seguir adivinando.",
      bullets: [
        "Base sirve para ordenar datos y entender tu punto de partida.",
        "Premium convierte tus números en una secuencia clara de pago por 6 meses.",
        "Pro extiende esa guía con más acompañamiento durante 12 meses.",
      ],
    };
  }

  if (
    conversionSnapshot.riskAlertCount > 0 &&
    conversionSnapshot.dueSoonCount > 0
  ) {
    return {
      title:
        "Premium tiene más valor cuando ya hay urgencia real en tus deudas.",
      description:
        "Tu caso ya mezcla alertas de riesgo, vencimientos cercanos y una prioridad que compite por el mismo flujo. Aquí es donde una mejor secuencia de pago suele devolver el costo del plan más fácilmente.",
      bullets: [
        `${conversionSnapshot.riskAlertCount} alerta${conversionSnapshot.riskAlertCount === 1 ? "" : "s"} de riesgo detectada${conversionSnapshot.riskAlertCount === 1 ? "" : "s"}.`,
        `${conversionSnapshot.dueSoonCount} vencimiento${conversionSnapshot.dueSoonCount === 1 ? "" : "s"} cercano${conversionSnapshot.dueSoonCount === 1 ? "" : "s"} que conviene ordenar mejor.`,
        conversionSnapshot.urgentDebtName
          ? `La deuda que hoy más presiona es ${conversionSnapshot.urgentDebtName}.`
          : "El sistema ya detectó una deuda que debería ir primero.",
      ],
    };
  }

  if (
    conversionSnapshot.monthsSaved !== null &&
    conversionSnapshot.monthsSaved > 0
  ) {
    return {
      title: `Premium se justifica si quieres recuperar ${conversionSnapshot.monthsSaved} ${conversionSnapshot.monthsSaved === 1 ? "mes" : "meses"}.`,
      description:
        "Tu cuenta ya muestra una oportunidad concreta de acelerar la salida. En lugar de seguir comparando escenarios manualmente, Premium la convierte en una ruta clara y repetible.",
      bullets: [
        `Ritmo actual: ${conversionSnapshot.currentMonthsToDebtFree ?? "sin salida clara"} meses.`,
        `Ritmo optimizado: ${conversionSnapshot.optimizedMonthsToDebtFree ?? "por definir"} meses.`,
        `Acción sugerida hoy: ${conversionSnapshot.immediateAction}`,
      ],
    };
  }

  if (
    conversionSnapshot.interestSavings !== null &&
    conversionSnapshot.interestSavings > 0
  ) {
    return {
      title: `Hay ${formatCurrency(conversionSnapshot.interestSavings)} que podrías dejar de regalar en intereses.`,
      description:
        "Si tu meta es salir más rápido, Premium vale cuando te ayuda a mover dinero desde intereses hacia capital real. La diferencia no está en ver más datos, sino en decidir mejor qué pagar primero.",
      bullets: [
        `Interés mensual estimado hoy: ${formatCurrency(conversionSnapshot.estimatedMonthlyInterest)}.`,
        `Presupuesto actual registrado: ${formatCurrency(conversionSnapshot.currentMonthlyBudget)}.`,
        sourceContext === "reportes"
          ? "Vienes de reportes: aquí puedes convertir lectura en acción."
          : "Aquí puedes convertir visibilidad en una prioridad clara.",
      ],
    };
  }

  return {
    title:
      "Premium es la mejor puerta de entrada cuando ya quieres dejar de improvisar.",
    description:
      "Base sirve para ordenar. Pro sirve para extender el acompañamiento. Pero Premium sigue siendo la opción más directa para pasar de control básico a decisiones más claras y ejecutables.",
    bullets: [
      "Desbloquea el orden recomendado según tus deudas reales.",
      "Muestra ahorro potencial y reducción de tiempo antes de que te comprometas más.",
      "Te deja entrar al módulo premium sin la fricción de un plan demasiado largo.",
    ],
  };
}

function getCheckoutNarrative({
  conversionSnapshot,
  sourceContext,
  highlightedPlan,
}: {
  conversionSnapshot: MembershipConversionSnapshotDto;
  sourceContext: MembershipSourceContext;
  highlightedPlan: (typeof membershipPlanCatalog)[MembershipPlanId] | null;
}) {
  const trustItems = [
    "Checkout seguro con Stripe",
    "Puedes cambiar o cancelar desde facturación",
    "Tu cuenta y tus datos siguen siendo tuyos",
  ];

  if (conversionSnapshot.hasDebts && conversionSnapshot.urgentDebtName) {
    trustItems.push(
      `La prioridad detectada hoy es ${conversionSnapshot.urgentDebtName}`,
    );
  }

  if (conversionSnapshot.hasDebts && conversionSnapshot.riskAlertCount > 0) {
    trustItems.push(
      `Ya hay ${conversionSnapshot.riskAlertCount} alerta${conversionSnapshot.riskAlertCount === 1 ? "" : "s"} que se benefician de una prioridad más clara.`,
    );
  }

  if (sourceContext === "simulador") {
    return {
      title:
        "La idea es que dejes de comparar escenarios y pases a ejecutar uno.",
      description:
        "El simulador ya te dejó ver que sí hay margen para mejorar. El checkout solo desbloquea la capa que decide qué escenario ejecutar primero con tus deudas reales.",
      trustItems,
    };
  }

  if (sourceContext === "reportes") {
    return {
      title:
        "La idea es convertir el reporte en una decisión que cambie el próximo mes.",
      description:
        "Ya viste qué porcentaje se fue en capital y qué parte se sigue diluyendo. El pago del plan vale si te ayuda a corregir esa mezcla desde ahora.",
      trustItems,
    };
  }

  if (sourceContext === "notificaciones") {
    return {
      title:
        "La idea es que las alertas te lleven a un hábito, no a más ruido.",
      description:
        "Si ya tienes alertas y vencimientos compitiendo por atención, el plan premium te devuelve una secuencia más clara para actuar semana a semana.",
      trustItems,
    };
  }

  return {
    title: `La idea es simple: que ${highlightedPlan?.label ?? "Premium"} se pague solo con mejores decisiones.`,
    description:
      "Si tu estructura actual ya genera intereses, atrasos o semanas de indecisión, una mejor prioridad de pago puede devolver varias veces el costo mensual del plan.",
    trustItems,
  };
}

function getActivationSteps(sourceContext: MembershipSourceContext) {
  return [
    {
      title: "1. Pasas por Stripe",
      description:
        "El pago se procesa en un checkout seguro. No guardamos datos sensibles de tarjeta en la app.",
    },
    {
      title: "2. Se desbloquea tu plan",
      description:
        sourceContext === "simulador"
          ? "Vuelves con una ruta recomendada para dejar de comparar escenarios manualmente."
          : sourceContext === "reportes"
            ? "Vuelves con una prioridad más clara para corregir lo que el reporte te mostró."
            : sourceContext === "notificaciones"
              ? "Vuelves con seguimiento más guiado para que tus alertas se conviertan en rutina."
              : "Vuelves a tu panel y ya puedes abrir el plan recomendado, el ahorro estimado y la guía premium.",
    },
    {
      title: "3. Lo gestionas cuando quieras",
      description:
        "Si más adelante quieres cambiar o cancelar, lo haces desde facturación sin perder tu cuenta.",
    },
  ];
}

function getMembershipFitStory(
  conversionSnapshot: MembershipConversionSnapshotDto,
) {
  if (!conversionSnapshot.hasDebts) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Primero ordena tu base",
      title:
        "Base ya te sirve para organizarte; Premium entra cuando haya una deuda real que optimizar.",
      description:
        "Con deudas activas el sistema puede detectar meses recuperables, alertas de presión y una prioridad concreta. Sin esa base, lo mejor es empezar simple.",
    };
  }

  if ((conversionSnapshot.monthsSaved ?? 0) > 0) {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Fit claro para Premium",
      title: `Ya hay una oportunidad real de recortar ${conversionSnapshot.monthsSaved} ${conversionSnapshot.monthsSaved === 1 ? "mes" : "meses"}.`,
      description: `En tu caso, Premium no vende visibilidad genérica: vende una mejor prioridad de pago y una salida más corta. Hoy ya estás dejando ${formatCurrency(conversionSnapshot.estimatedMonthlyInterest)} en intereses estimados al mes.`,
    };
  }

  if (
    conversionSnapshot.riskAlertCount > 0 ||
    conversionSnapshot.dueSoonCount > 0
  ) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Hay urgencia real",
      title:
        "Tu estructura ya muestra señales suficientes para necesitar una guía más clara.",
      description: `Entre alertas, vencimientos y presión mensual, el valor de Premium está en devolverte una sola prioridad ejecutable y no más ruido. Tu estructura ya carga ${formatCurrency(conversionSnapshot.estimatedMonthlyInterest)} en intereses estimados este mes.`,
    };
  }

  return {
    badgeVariant: "warning" as const,
    badgeLabel: "Valor visible",
    title: "Ya se puede justificar una capa premium con tus propios números.",
    description: `Aunque todavía no haya un salto tan visible en meses, sí hay suficientes datos para pasar de control básico a decisiones más consistentes. Hoy mismo tu estructura proyecta ${formatCurrency(conversionSnapshot.estimatedMonthlyInterest)} en intereses del mes.`,
  };
}

function getPlanValueSignal({
  planId,
  conversionSnapshot,
}: {
  planId: MembershipPlanId;
  conversionSnapshot: MembershipConversionSnapshotDto;
}) {
  if (planId === "FREE") {
    return conversionSnapshot.hasDebts
      ? "Ya puedes ordenar tu base sin pagar mientras confirmas tu ritmo real."
      : "Te sirve para arrancar, cargar deudas y entender tu punto de partida.";
  }

  if (planId === "NORMAL") {
    if ((conversionSnapshot.monthsSaved ?? 0) > 0) {
      return `En tu caso, Premium podría recortar ${conversionSnapshot.monthsSaved} ${conversionSnapshot.monthsSaved === 1 ? "mes" : "meses"}.`;
    }

    return `En tu caso, ya hay ${formatCurrency(conversionSnapshot.estimatedMonthlyInterest)} al mes en intereses visibles.`;
  }

  if (conversionSnapshot.riskAlertCount > 0 || conversionSnapshot.dueSoonCount > 0) {
    return `Con ${conversionSnapshot.riskAlertCount} alertas y ${conversionSnapshot.dueSoonCount} vencimientos cercanos, Pro sostiene mejor el seguimiento.`;
  }

  return "Pro mantiene la misma lógica premium, pero con acompañamiento más largo.";
}

export function MembershipPanel({
  currentTier,
  billingStatus,
  billingConfigured,
  canManageBilling,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  highlightPlanId = null,
  sourceContext = null,
  conversionSnapshot,
  demoMode = false,
}: {
  currentTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
  billingConfigured: boolean;
  canManageBilling: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  highlightPlanId?: MembershipPlanId | null;
  sourceContext?: MembershipSourceContext;
  conversionSnapshot: MembershipConversionSnapshotDto;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const orderedPlans: MembershipPlanId[] = ["FREE", "NORMAL", "PRO"];
  const [activePlanId, setActivePlanId] = useState<MembershipPlanId | null>(
    null,
  );
  const handledCheckoutState = useRef<string | null>(null);
  const [checkoutOutcome, setCheckoutOutcome] = useState<
    "success" | "cancelled" | null
  >(null);
  const highlightedPlan = highlightPlanId
    ? membershipPlanCatalog[highlightPlanId]
    : null;
  const contextualMessage =
    sourceContext === "simulador"
      ? {
          eyebrow: "Vienes del simulador",
          title:
            "Ya comparaste escenarios. Ahora puedes convertir eso en una decisión clara.",
          description:
            "Premium toma esos datos y te entrega una ruta recomendada sin tener que seguir comparando manualmente escenario por escenario.",
        }
      : sourceContext === "dashboard"
        ? {
            eyebrow: "Vienes desde tu panel",
            title: "El siguiente salto es desbloquear el plan recomendado.",
            description:
              "Desde aquí puedes activar la capa premium para ver la comparación entre tu plan actual y el optimizado con ahorro y tiempo recortado.",
          }
        : sourceContext === "reportes"
          ? {
              eyebrow: "Vienes desde reportes",
              title:
                "Ya viste el dinero salir. Ahora toca decidir mejor qué hacer con él.",
              description:
                "Premium convierte el reporte en una lectura accionable: te muestra si realmente mejoraste frente al período anterior y qué deuda conviene priorizar después.",
            }
          : sourceContext === "notificaciones"
            ? {
                eyebrow: "Vienes desde notificaciones",
                title:
                  "No solo recibas alertas. Convierte esas señales en una rutina clara.",
                description:
                  "Premium usa tus alertas, tu progreso y tu prioridad real para empujarte con seguimiento semanal y acciones más concretas.",
              }
            : null;

  useEffect(() => {
    const checkoutStatus =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("checkout");

    if (!checkoutStatus || handledCheckoutState.current === checkoutStatus) {
      return;
    }

    handledCheckoutState.current = checkoutStatus;

    if (checkoutStatus === "success") {
      setCheckoutOutcome("success");
      toast.success("Tu pago fue recibido. Estamos actualizando tu plan.");
      router.refresh();
    }

    if (checkoutStatus === "cancelled") {
      setCheckoutOutcome("cancelled");
      toast.message("El checkout fue cancelado. Tu plan actual no cambió.");
    }

    const currentParams = new URLSearchParams(window.location.search);
    currentParams.delete("checkout");
    const nextQuery = currentParams.toString();
    router.replace(nextQuery ? `/planes?${nextQuery}` : "/planes");
  }, [router]);

  const conversionDeltaCopy = getConversionDeltaCopy(conversionSnapshot);
  const commercialNarrative = getCommercialNarrative({
    conversionSnapshot,
    sourceContext,
  });
  const checkoutNarrative = getCheckoutNarrative({
    conversionSnapshot,
    sourceContext,
    highlightedPlan,
  });
  const activationSteps = getActivationSteps(sourceContext);
  const fitStory = getMembershipFitStory(conversionSnapshot);
  const suggestedPlanId =
    highlightPlanId ?? (conversionSnapshot.hasDebts ? "NORMAL" : "FREE");
  const suggestedPlan = membershipPlanCatalog[suggestedPlanId];
  const planComparisonRef = useRef<HTMLElement | null>(null);
  const scrollToPlans = () => {
    planComparisonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="border-border shadow-soft rounded-[2rem] border bg-white/90 p-6 sm:p-8">
        <ModuleSectionHeader
          kicker="Planes"
          title="Elige la capa de ayuda que mejor encaja con tu momento."
          description="Base te organiza. Premium te dice qué pagar primero y te ayuda a salir más rápido. Pro mantiene esa lógica con más seguimiento."
          action={
            <Button className="w-full sm:w-auto" onClick={scrollToPlans}>
              Ver comparación
            </Button>
          }
        />
        <div className="border-primary/12 text-foreground mt-5 inline-flex max-w-5xl rounded-3xl border bg-[rgba(240,248,245,0.86)] px-5 py-4 text-sm leading-7">
          <span>
            <span className="text-primary font-semibold">Premium</span> es la
            opción pensada para salir más rápido: una ruta guiada de{" "}
            <span className="font-semibold">6 meses</span>.{" "}
            <span className="text-foreground font-semibold">Pro</span> mantiene
            esa base y extiende el acompañamiento por{" "}
            <span className="font-semibold">12 meses</span>.
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Badge variant={billingStatusVariants[billingStatus]}>
            Facturación {billingStatusLabels[billingStatus]}
          </Badge>
          <Badge variant={currentTier === "FREE" ? "default" : "success"}>
            Plan actual {membershipPlanCatalog[currentTier].label}
          </Badge>
          {currentPeriodEnd ? (
            <Badge variant="default">
              Corte actual hasta {formatDate(currentPeriodEnd)}
            </Badge>
          ) : null}
        </div>
        {cancelAtPeriodEnd ? (
          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
            Tu plan seguirá activo hasta{" "}
            {currentPeriodEnd
              ? formatDate(currentPeriodEnd)
              : "el fin del período actual"}{" "}
            y luego volverá a Base.
          </div>
        ) : null}
        {!billingConfigured && !demoMode ? (
          <div className="border-border text-muted mt-4 rounded-3xl border border-dashed px-5 py-4 text-sm leading-7">
            La facturación real todavía no está configurada en este entorno.
            Aquí seguimos permitiendo el cambio manual para pruebas locales.
          </div>
        ) : null}
        {contextualMessage && highlightedPlan ? (
          <div className="border-primary/15 mt-4 rounded-[1.75rem] border bg-[rgba(255,248,241,0.82)] px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <p className="section-kicker">
                  {contextualMessage.eyebrow}
                </p>
                <p className="text-foreground mt-3 break-words text-xl font-semibold">
                  {contextualMessage.title}
                </p>
                <p className="support-copy mt-2">
                  {contextualMessage.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="warning">
                  Plan sugerido {highlightedPlan.label}
                </Badge>
                <Badge variant="success">
                  US${highlightedPlan.monthlyPriceUsd}/mes
                </Badge>
              </div>
            </div>
          </div>
        ) : null}
        {highlightedPlan ? (
          <PrimaryActionCard
            className="mt-5"
            eyebrow="Recomendación principal"
            title={
              highlightedPlan.id === "NORMAL"
                ? "Premium es el punto natural si quieres dejar de improvisar."
                : `Pro tiene más sentido si ya quieres acompañamiento más largo.`
            }
            description={
              highlightedPlan.id === "NORMAL"
                ? "Te dice qué pagar primero, te ayuda a salir más rápido y convierte el ahorro visible en una ruta concreta."
                : "Mantiene la lógica premium, pero la extiende con más contexto y seguimiento durante 12 meses."
            }
            badgeLabel={`Plan sugerido ${highlightedPlan.label}`}
            badgeVariant="warning"
            primaryAction={{
              label: `Elegir ${highlightedPlan.label}`,
              onClick: scrollToPlans,
            }}
            secondaryAction={{
              label: currentTier === highlightedPlan.id ? "Ir al dashboard" : "Abrir simulador",
              onClick: () =>
                router.push(
                  currentTier === highlightedPlan.id
                    ? "/dashboard?focus=optimization"
                    : "/simulador",
                ),
              variant: "secondary",
            }}
            notes={[
              conversionSnapshot.monthsSaved && conversionSnapshot.monthsSaved > 0
                ? `Podrías recortar ${conversionSnapshot.monthsSaved} meses.`
                : "La propuesta se basa en tus deudas y pagos actuales.",
              conversionSnapshot.interestSavings && conversionSnapshot.interestSavings > 0
                ? `Ahorro potencial: ${formatCurrency(conversionSnapshot.interestSavings)}.`
                : "La idea es reducir improvisación y ordenar mejor tu flujo.",
            ]}
            tone="premium"
          />
        ) : null}
        {checkoutOutcome === "success" ? (
          <div className="mt-4 rounded-[1.9rem] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(240,248,245,0.92))] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
                  Pago recibido
                </p>
                <p className="text-foreground mt-3 break-words text-2xl font-semibold">
                  {billingStatus === "ACTIVE"
                    ? "Tu plan premium ya está activo."
                    : "Estamos actualizando tu plan premium."}
                </p>
                <p className="text-muted mt-2 text-sm leading-7">
                  {billingStatus === "ACTIVE"
                    ? "Ya puedes entrar al dashboard y abrir tu plan recomendado para empezar hoy."
                    : "Si todavía no ves el cambio reflejado, el webhook de Stripe suele tardar solo unos segundos en terminar la activación."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    router.push("/dashboard?welcome=premium&focus=optimization")
                  }
                >
                  Ir a mi plan recomendado
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push("/simulador")}
                >
                  Revisar simulador
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {checkoutOutcome === "cancelled" ? (
          <div className="mt-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">
                  Checkout cancelado
                </p>
                <p className="text-foreground mt-3 break-words text-xl font-semibold">
                  Tu cuenta sigue igual. Puedes retomar cuando quieras.
                </p>
                <p className="text-muted mt-2 text-sm leading-7">
                  Mientras tanto puedes seguir usando Base, revisar el simulador
                  o volver a intentarlo cuando te haga sentido.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/simulador")}
                >
                  Volver al simulador
                </Button>
                <Button onClick={() => setCheckoutOutcome(null)}>
                  Seguir en planes
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {conversionSnapshot.hasDebts ? (
          <div className="border-primary/12 mt-4 rounded-[1.9rem] border bg-[rgba(240,248,245,0.92)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <p className="section-kicker">
                  Lo que {highlightedPlan?.label ?? "Premium"} puede mejorar en
                  tu caso
                </p>
                <p className="text-foreground mt-3 break-words text-2xl font-semibold">
                  {conversionDeltaCopy}
                </p>
                <p className="support-copy mt-2">
                  {conversionSnapshot.immediateAction}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="warning">
                  Estrategia sugerida{" "}
                  {conversionSnapshot.recommendedStrategyLabel}
                </Badge>
                {conversionSnapshot.urgentDebtName ? (
                  <Badge variant="default">
                    Prioridad actual {conversionSnapshot.urgentDebtName}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-3xl bg-white/85 p-4">
                <p className="text-muted text-xs tracking-[0.16em] uppercase">
                  Deuda total
                </p>
                <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                  {formatCurrency(conversionSnapshot.totalDebt)}
                </p>
              </div>
              <div className="min-w-0 rounded-3xl bg-white/85 p-4">
                <p className="text-muted text-xs tracking-[0.16em] uppercase">
                  Ritmo actual
                </p>
                <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                  {conversionSnapshot.currentMonthsToDebtFree !== null
                    ? `${conversionSnapshot.currentMonthsToDebtFree} meses`
                    : "Sin salida clara"}
                </p>
              </div>
              <div className="min-w-0 rounded-3xl bg-white/85 p-4">
                <p className="text-muted text-xs tracking-[0.16em] uppercase">
                  Con recomendación
                </p>
                <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                  {conversionSnapshot.optimizedMonthsToDebtFree !== null
                    ? `${conversionSnapshot.optimizedMonthsToDebtFree} meses`
                    : "Por definir"}
                </p>
              </div>
              <div className="min-w-0 rounded-3xl bg-white/85 p-4">
                <p className="text-muted text-xs tracking-[0.16em] uppercase">
                  Interés mensual estimado
                </p>
                <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                  {formatCurrency(conversionSnapshot.estimatedMonthlyInterest)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-border text-muted mt-4 rounded-[1.75rem] border border-dashed px-5 py-4 text-sm leading-7">
            Todavía no tienes deudas activas registradas. Puedes mantenerte en
            Base para organizarte o activar Premium más adelante cuando quieras
            una recomendación real sobre tus propios datos.
          </div>
        )}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
        <div className="border-primary/12 shadow-soft rounded-[2rem] border bg-[rgba(240,248,245,0.92)] p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={fitStory.badgeVariant}>{fitStory.badgeLabel}</Badge>
            <Badge variant="default">Plan sugerido {suggestedPlan.label}</Badge>
          </div>
          <p className="text-foreground mt-4 break-words text-2xl font-semibold">
            {fitStory.title}
          </p>
          <p className="text-muted mt-3 text-sm leading-7">
            {fitStory.description}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-3xl border border-white/70 bg-white/85 p-4">
              <p className="text-muted text-xs tracking-[0.16em] uppercase">
                Deuda visible
              </p>
              <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                {formatCurrency(conversionSnapshot.totalDebt)}
              </p>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/70 bg-white/85 p-4">
              <p className="text-muted text-xs tracking-[0.16em] uppercase">
                Interés mensual estimado
              </p>
              <p className="value-stable text-foreground mt-2 text-[clamp(0.95rem,2.6vw,1.15rem)] font-semibold leading-tight">
                {formatCurrency(conversionSnapshot.estimatedMonthlyInterest)}
              </p>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/70 bg-white/85 p-4 md:col-span-2">
              <p className="text-muted text-xs tracking-[0.16em] uppercase">
                Señal más clara
              </p>
              <p className="text-foreground mt-2 break-words text-[clamp(1rem,3vw,1.25rem)] font-semibold leading-tight">
                {(conversionSnapshot.monthsSaved ?? 0) > 0
                  ? `${conversionSnapshot.monthsSaved} meses menos`
                  : conversionSnapshot.riskAlertCount > 0
                    ? `${conversionSnapshot.riskAlertCount} alertas`
                    : `${conversionSnapshot.dueSoonCount} vencimientos`}
              </p>
            </div>
          </div>
        </div>

        <div className="border-primary/15 rounded-[2rem] border bg-[rgba(255,248,241,0.92)] p-6 shadow-[0_18px_42px_rgba(240,138,93,0.08)]">
          <p className="section-kicker">
            Cómo elegir sin complicarte
          </p>
          <div className="mt-4 grid gap-3">
            <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
              <span className="font-semibold">Base:</span> para organizarte,
              registrar deudas y entender tu panorama real.
            </div>
            <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
              <span className="font-semibold">Premium:</span> la mejor opción si
              lo que quieres es salir más rápido con una guía clara de 6 meses.
            </div>
            <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
              <span className="font-semibold">Pro:</span> para quien quiere el
              mismo motor premium, pero con más seguimiento durante 12 meses.
            </div>
          </div>
          <div className="border-primary/12 text-foreground mt-4 rounded-3xl border bg-[rgba(240,248,245,0.9)] px-4 py-4 text-sm leading-7">
            En la mayoría de usuarios con urgencia real,{" "}
            <span className="font-semibold">Premium</span> es el punto natural
            de entrada porque convierte rápido el dolor visible en una prioridad
            accionable.
          </div>
        </div>
      </section>

      <section
        ref={planComparisonRef}
        className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]"
      >
        <div className="border-border shadow-soft rounded-[2rem] border bg-white/90 p-6">
          <p className="section-kicker">
            Qué cambia entre planes
          </p>
          <p className="support-copy mt-3 max-w-4xl">
            Aquí conviene comparar sin columnas estrechas: primero ves qué logra
            cada plan, luego cuánto cuesta y para quién tiene más sentido.
          </p>
          <div className="mt-4 grid gap-4">
            {orderedPlans.map((planId) => {
              const plan = membershipPlanCatalog[planId];
              const isCurrent = currentTier === plan.id;
              const isHighlighted = highlightPlanId === plan.id;
              const valueSignal = getPlanValueSignal({
                planId: plan.id,
                conversionSnapshot,
              });

              return (
                <div
                  key={plan.id}
                  className={`overflow-hidden rounded-[1.9rem] border ${
                    plan.id === "NORMAL"
                      ? "border-primary/20 bg-[rgba(240,248,245,0.92)]"
                      : "border-border bg-secondary/35"
                  } ${isHighlighted ? "ring-primary/10 shadow-[0_18px_42px_rgba(15,88,74,0.08)] ring-2" : ""}`}
                >
                  <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="p-6 sm:p-7">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isCurrent ? "success" : "default"}>
                          {isCurrent ? "Actual" : "Disponible"}
                        </Badge>
                        {isHighlighted && !isCurrent ? (
                          <Badge variant="warning">Sugerido</Badge>
                        ) : null}
                        <Badge variant="default">
                          {plan.id === "FREE"
                            ? "Control básico"
                            : plan.id === "NORMAL"
                              ? "Ruta rápida 6 meses"
                              : "Seguimiento 12 meses"}
                        </Badge>
                      </div>

                      <div className="mt-4">
                        <p className="text-foreground text-[clamp(1.55rem,3vw,2rem)] font-semibold leading-tight">
                          {plan.label}
                        </p>
                        <p className="text-foreground mt-3 max-w-4xl text-lg font-medium leading-8">
                          {plan.outcome}
                        </p>
                      </div>

                      <div className="mt-5 rounded-[1.55rem] border border-white/70 bg-white/88 px-5 py-5">
                        <p className="text-muted text-[11px] font-semibold uppercase tracking-[0.2em]">
                          Mejor para
                        </p>
                        <p className="text-foreground mt-3 text-sm leading-7">
                          {plan.bestFor}
                        </p>
                      </div>
                    </div>

                    <div className="border-border/70 bg-white/72 p-6 sm:p-7 2xl:border-l">
                      <div className="rounded-[1.7rem] border border-white/80 bg-white/95 px-5 py-5">
                        <p className="text-muted text-[11px] font-semibold uppercase tracking-[0.22em]">
                          Precio
                        </p>
                        <p className="value-stable text-foreground mt-3 text-[clamp(1.9rem,4vw,2.7rem)] font-semibold leading-none">
                          {plan.monthlyPriceUsd === 0
                            ? "Gratis"
                            : `US$${plan.monthlyPriceUsd}/mes`}
                        </p>
                      </div>

                      <div className="mt-4 rounded-[1.55rem] border border-white/70 bg-white/92 px-4 py-4 text-sm leading-7 text-foreground">
                        {plan.id === "FREE"
                          ? "Registro, pagos y panorama base."
                          : plan.id === "NORMAL"
                            ? "Prioridad clara, ahorro visible y guía corta."
                            : "La misma lógica premium con acompañamiento más largo."}
                      </div>

                      <div className="mt-4 rounded-[1.55rem] border border-white/70 bg-white/92 px-4 py-4 text-sm leading-7 text-muted">
                        {valueSignal}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-primary/15 rounded-[2rem] border bg-[rgba(255,248,241,0.92)] p-6 shadow-[0_18px_42px_rgba(240,138,93,0.08)]">
          <p className="section-kicker">
            Recomendación comercial
          </p>
          <p className="text-foreground mt-3 text-2xl font-semibold">
            {commercialNarrative.title}
          </p>
          <p className="support-copy mt-3">
            {commercialNarrative.description}
          </p>
          <div className="mt-5 grid gap-3">
            {commercialNarrative.bullets.map((bullet) => (
              <div
                key={bullet}
                className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm"
              >
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.14fr)_minmax(0,0.86fr)]">
        <div className="border-border shadow-soft rounded-[2rem] border bg-white/90 p-6">
          <p className="section-kicker">
            Qué pasa después de activar
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {activationSteps.map((step) => (
              <div
                key={step.title}
                className="border-border bg-secondary/35 rounded-[1.5rem] border p-6"
              >
                <p className="text-foreground text-lg font-semibold leading-tight">
                  {step.title}
                </p>
                <p className="text-muted mt-3 text-sm leading-7">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-primary/15 rounded-[2rem] border bg-[rgba(255,248,241,0.92)] p-6 shadow-[0_18px_42px_rgba(240,138,93,0.08)]">
          <p className="section-kicker">
            Antes de pagar
          </p>
          <p className="text-foreground mt-3 text-2xl font-semibold">
            {checkoutNarrative.title}
          </p>
          <p className="support-copy mt-3">
            {checkoutNarrative.description}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checkoutNarrative.trustItems.map((item) => (
              <div
                key={item}
                className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm leading-6"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <TrustInlineNote
        title="Antes de activar"
        notes={[
          "Tus datos siguen bajo tu control.",
          "No conectamos cuentas bancarias para recomendarte.",
          "Puedes cambiar de plan cuando lo necesites.",
        ]}
      />

      <section className="grid gap-6 2xl:grid-cols-2">
        {orderedPlans.map((planId) => {
          const plan = membershipPlanCatalog[planId];
          const isCurrent = currentTier === plan.id;
          const isPremium = plan.id === "NORMAL";
          const isPro = plan.id === "PRO";
          const isHighlighted = highlightPlanId === plan.id;
          const canManageCurrentPlan =
            billingConfigured &&
            canManageBilling &&
            isCurrent &&
            plan.id !== "FREE";
          const shouldDisableButton =
            demoMode || (isCurrent && !canManageCurrentPlan);
          const actionLabel = demoMode
            ? "Vista demo"
            : activePlanId === plan.id
              ? "Procesando..."
              : isHighlighted && !isCurrent && plan.id === "NORMAL"
                ? getHighlightedActionLabel(plan.id, sourceContext)
                : isHighlighted && !isCurrent && plan.id === "PRO"
                  ? getHighlightedActionLabel(plan.id, sourceContext)
                  : getPlanActionLabel({
                      billingConfigured,
                      canManageBilling,
                      currentTier,
                      isCurrent,
                      isPremium,
                      planId: plan.id,
                      planLabel: plan.label,
                    });
          const planCardClassName = isCurrent
            ? "border-primary/25 ring-2 ring-primary/10"
            : isHighlighted
              ? "border-primary/25 ring-2 ring-primary/10 shadow-[0_22px_44px_rgba(15,88,74,0.09)]"
              : isPremium
                ? "border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,248,245,0.95)_100%)] shadow-[0_22px_44px_rgba(15,88,74,0.09)]"
                : "";

          return (
            <Card key={plan.id} className={`p-6 ${planCardClassName}`}>
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{plan.label}</CardTitle>
                    <CardDescription className="mt-2 leading-7">
                      {plan.description}
                    </CardDescription>
                  </div>
                  <Badge variant={isCurrent ? "success" : "default"}>
                    {isCurrent ? "Actual" : "Disponible"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isHighlighted && !isCurrent ? (
                    <Badge variant="warning">Recomendado ahora</Badge>
                  ) : null}
                  {isPremium ? (
                    <Badge variant="warning">Más rápido</Badge>
                  ) : null}
                  {isPro ? (
                    <Badge variant="default">Más seguimiento</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="rounded-[1.6rem] border border-border/80 bg-white/80 px-5 py-5">
                  <p className="text-muted text-xs font-semibold uppercase tracking-[0.16em]">
                    Precio
                  </p>
                  <p className="text-foreground mt-3 text-4xl font-semibold">
                    {plan.monthlyPriceUsd === 0
                      ? "Gratis"
                      : `US$${plan.monthlyPriceUsd}/mes`}
                  </p>
                  <p className="text-muted mt-3 text-sm leading-7">
                    {plan.durationMonths > 0
                      ? `${plan.guidanceLabel} con recomendaciones premium`
                      : "Ideal para gestión básica y uso inicial"}
                  </p>
                </div>
                <div className="border-border/70 text-foreground mt-4 rounded-3xl border bg-white/80 px-4 py-3 text-sm leading-7">
                  <span className="font-semibold">Resultado esperado:</span>{" "}
                  {plan.outcome}
                </div>
                <div className="mt-3 rounded-3xl border border-border/70 bg-secondary/45 px-4 py-3 text-sm leading-7 text-foreground">
                  <span className="font-semibold">Mejor para:</span>{" "}
                  {plan.bestFor}
                </div>
                {plan.monthlyPriceUsd > 0 ? (
                  <div className="border-primary/12 text-foreground mt-3 rounded-3xl border bg-[rgba(240,248,245,0.9)] px-4 py-3 text-sm leading-7">
                    {getPlanValueSignal({
                      planId: plan.id,
                      conversionSnapshot,
                    })}
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="border-border bg-secondary/55 text-muted rounded-2xl border px-4 py-3 text-sm"
                    >
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={shouldDisableButton || activePlanId !== null}
                    onClick={async () => {
                      if (demoMode) {
                        return;
                      }

                      setActivePlanId(plan.id);

                      try {
                        if (billingConfigured) {
                          if (
                            canManageBilling &&
                            (currentTier !== "FREE" || isCurrent)
                          ) {
                            const payload = await requestJson(
                              "/api/billing/portal",
                              "POST",
                            );

                            if (!payload.url) {
                              throw new Error("No se pudo abrir el portal.");
                            }

                            window.location.assign(payload.url);
                            return;
                          }

                          if (plan.id === "FREE") {
                            throw new Error(
                              "Ese cambio se gestiona desde facturación.",
                            );
                          }

                          const payload = await requestJson(
                            "/api/billing/checkout",
                            "POST",
                            {
                              membershipTier: plan.id,
                              sourceContext: sourceContext ?? "planes",
                            },
                          );

                          if (!payload.url) {
                            throw new Error("No se pudo abrir el checkout.");
                          }

                          window.location.assign(payload.url);
                          return;
                        }

                        await requestJson("/api/settings/membership", "PATCH", {
                          membershipTier: plan.id,
                        });
                        toast.success(
                          `Tu cuenta ahora usa el plan ${plan.label}.`,
                        );
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No se pudo cambiar el plan.",
                        );
                      } finally {
                        setActivePlanId(null);
                      }
                    }}
                  >
                    {actionLabel}
                  </Button>
                  {plan.monthlyPriceUsd > 0 ? (
                    <p className="text-muted mt-3 text-center text-xs leading-6">
                      {sourceContext === "simulador"
                        ? "Después del checkout vuelves con una ruta recomendada basada en tu simulación."
                        : sourceContext === "reportes"
                          ? "Después del checkout vuelves con una prioridad más clara para corregir tu flujo."
                          : sourceContext === "notificaciones"
                            ? "Después del checkout vuelves con alertas más guiadas y seguimiento premium."
                            : "Checkout seguro con Stripe. Puedes gestionar tu suscripción después desde facturación."}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
