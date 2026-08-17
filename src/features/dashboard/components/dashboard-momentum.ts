import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export function getMomentumSummary({
  data,
  isPremiumUnlocked,
}: {
  data: DashboardDto;
  isPremiumUnlocked: boolean;
}) {
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round(data.summary.paidVsPendingPercentage)),
  );

  if (data.summary.totalDebt <= 0) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Pendiente de activar",
      title: "Primero necesitamos una deuda para construir progreso real.",
      description:
        "En cuanto registres tu primera deuda, este bloque te mostrará avance, hitos y señales de ritmo.",
      progressLabel: "Sin progreso medible todavía",
    };
  }

  if (data.urgentDebt?.status === "LATE") {
    return {
      badgeVariant: "danger" as const,
      badgeLabel: "Riesgo de estancarte",
      title: "Hay presión real sobre tu flujo y conviene corregirla hoy.",
      description:
        "Tienes al menos una deuda atrasada. Resolver ese frente primero vale más que repartir dinero sin prioridad.",
      progressLabel: `${progressPct}% del camino visible entre pagado y pendiente`,
    };
  }

  if (data.riskAlerts.length > 0) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Ritmo bajo presión",
      title: "Todavía estás pagando, pero parte del flujo se sigue diluyendo.",
      description:
        "Las alertas de pago mínimo indican que el dinero no está bajando capital tan rápido como debería.",
      progressLabel: `${progressPct}% de avance visible`,
    };
  }

  if (data.recentPayments.length === 0) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Primer avance pendiente",
      title: "Ya hay deudas cargadas. Falta convertir eso en movimiento.",
      description:
        "El siguiente salto es registrar el primer pago para que el sistema pueda medir si tu plan empieza a rendir mejor.",
      progressLabel: `${progressPct}% del recorrido registrado`,
    };
  }

  if (isPremiumUnlocked && (data.planComparison?.monthsSaved ?? 0) > 0) {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Vas mejorando",
      title: "Tu estructura ya muestra una salida más eficiente que la actual.",
      description: data.planComparison?.interestSavings
        ? `El plan premium detecta ${formatCurrency(data.planComparison.interestSavings)} evitables y una ruta más corta si sostienes la prioridad.`
        : "La prioridad actual ya está trabajando a favor de una salida más corta.",
      progressLabel: `${progressPct}% de avance visible con ruta optimizada`,
    };
  }

  if (progressPct >= 35) {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Primer avance importante",
      title: "Ya hay suficiente movimiento para que el plan se sienta real.",
      description:
        "Todavía queda camino, pero tu historial ya muestra señales claras de avance y mejor lectura del flujo.",
      progressLabel: `${progressPct}% de avance visible`,
    };
  }

  return {
    badgeVariant: "warning" as const,
    badgeLabel: "Ritmo estable",
    title: "La base ya está montada; ahora toca sostener una sola prioridad.",
    description:
      "No parece haber una caída fuerte, pero todavía hay espacio para que el dinero rinda mejor y la salida se acorte.",
    progressLabel: `${progressPct}% del recorrido registrado`,
  };
}

export function getProgressMilestones({
  data,
  isPremiumUnlocked,
}: {
  data: DashboardDto;
  isPremiumUnlocked: boolean;
}) {
  return [
    {
      label: "Primera deuda",
      complete: data.summary.totalDebt > 0,
      detail: "Ya hay base para proyectar.",
    },
    {
      label: "Primer pago",
      complete: data.recentPayments.length > 0,
      detail: "Activa lectura real del avance.",
    },
    {
      label: "Prioridad visible",
      complete: Boolean(data.summary.recommendedDebtName || data.urgentDebt),
      detail: "Ya sabes qué deuda mirar primero.",
    },
    {
      label: "Plan premium",
      complete: isPremiumUnlocked,
      detail: "Desbloquea ahorro y orden optimizado.",
    },
  ];
}
