export const membershipPlanCatalog = {
  FREE: {
    id: "FREE",
    label: "Base",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    annualSavingsUsd: 0,
    monthlyPriceDop: 0,
    annualPriceDop: 0,
    annualSavingsDop: 0,
    durationMonths: 0,
    recommendationUnlocked: false,
    guidanceLabel: "Base",
    headline: "Empieza y entiende tu situación",
    description:
      "Empieza, entiende tu panorama y valida si ya te está costando seguir sin una mejor estrategia.",
    outcome:
      "Entender tu problema, ver costo básico y descubrir si estás pagando más de lo necesario.",
    bestFor:
      "Quien quiere ordenar deudas y ver su situación actual antes de desbloquear optimización real.",
    features: [
      "Hasta 2 deudas activas",
      "Dashboard base con saldo total, pago mínimo y próximas fechas",
      "Recordatorios básicos por correo",
      "Simulador parcial para entender tu escenario actual",
    ],
  },
  NORMAL: {
    id: "NORMAL",
    label: "Premium",
    monthlyPriceUsd: 5,
    annualPriceUsd: 49,
    annualSavingsUsd: 11,
    monthlyPriceDop: 349,
    annualPriceDop: 2990,
    annualSavingsDop: 1198,
    durationMonths: 6,
    recommendationUnlocked: true,
    guidanceLabel: "Salida rápida 6 meses",
    headline: "Optimiza y paga menos",
    description:
      "La capa principal para dejar de improvisar y seguir una prioridad clara con una ruta premium de 6 meses.",
    outcome:
      "Ver tu mejor escenario, comparar rutas y decidir cómo salir antes pagando menos.",
    bestFor:
      "Quien ya entendió su problema y ahora necesita una mejor estrategia para resolverlo.",
    features: [
      "Hasta 10 deudas activas",
      "Plan recomendado completo y ahorro visible",
      "Simulador completo con comparación de escenarios",
      "Alertas inteligentes y recordatorios completos",
    ],
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    monthlyPriceUsd: 10,
    annualPriceUsd: 99,
    annualSavingsUsd: 21,
    monthlyPriceDop: 699,
    annualPriceDop: 5990,
    annualSavingsDop: 2398,
    durationMonths: 12,
    recommendationUnlocked: true,
    guidanceLabel: "Acompañamiento 12 meses",
    headline: "Control total y estrategia inteligente",
    description:
      "La capa extendida para sostener la lógica premium con más contexto, más automatización y seguimiento durante 12 meses.",
    outcome:
      "Tener más control, más contexto y una estrategia que se sienta mucho más viva y guiada.",
    bestFor:
      "Quien quiere control total, más inteligencia financiera y seguimiento extendido sin perder contexto.",
    features: [
      "Deudas ilimitadas y todo Premium desbloqueado",
      "Reoptimización y guía más inteligente",
      "Exportación CSV/PDF y reportes profundos",
      "Seguimiento y señales más ricas de progreso",
    ],
  },
} as const;

export type MembershipPlanId = keyof typeof membershipPlanCatalog;
export type MembershipPlan = (typeof membershipPlanCatalog)[MembershipPlanId];
export type MembershipBillingStatus = "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE";

function resolveMembershipPlan(plan: MembershipPlanId | MembershipPlan) {
  return typeof plan === "string" ? membershipPlanCatalog[plan] : plan;
}

export function formatMembershipMonthlyPriceUsd(plan: MembershipPlanId | MembershipPlan) {
  const resolvedPlan = resolveMembershipPlan(plan);

  return resolvedPlan.monthlyPriceUsd === 0
    ? "Gratis"
    : `US$${resolvedPlan.monthlyPriceUsd.toLocaleString("en-US")}/mes`;
}

export function formatMembershipAnnualPriceUsd(plan: MembershipPlanId | MembershipPlan) {
  const resolvedPlan = resolveMembershipPlan(plan);

  if (resolvedPlan.annualPriceUsd <= 0) {
    return null;
  }

  return `US$${resolvedPlan.annualPriceUsd.toLocaleString("en-US")}/año`;
}

export function formatMembershipAnnualSavingsUsd(plan: MembershipPlanId | MembershipPlan) {
  const resolvedPlan = resolveMembershipPlan(plan);

  if (resolvedPlan.annualSavingsUsd <= 0) {
    return null;
  }

  return `ahorras US$${resolvedPlan.annualSavingsUsd.toLocaleString("en-US")}`;
}

export function formatMembershipCommercialSummary(plan: MembershipPlanId | MembershipPlan) {
  const resolvedPlan = resolveMembershipPlan(plan);
  const annualPrice = formatMembershipAnnualPriceUsd(resolvedPlan);
  const annualSavings = formatMembershipAnnualSavingsUsd(resolvedPlan);

  return [
    formatMembershipMonthlyPriceUsd(resolvedPlan),
    annualPrice,
    annualSavings,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getMembershipPlan(plan: string | null | undefined) {
  if (!plan || !(plan in membershipPlanCatalog)) {
    return membershipPlanCatalog.FREE;
  }

  return membershipPlanCatalog[plan as MembershipPlanId];
}

export function hasMembershipAccess(
  tier: string | null | undefined,
  billingStatus: MembershipBillingStatus | null | undefined,
) {
  const membershipPlan = getMembershipPlan(tier);

  return membershipPlan.recommendationUnlocked && billingStatus === "ACTIVE";
}
