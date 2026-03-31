export const membershipPlanCatalog = {
  FREE: {
    id: "FREE",
    label: "Base",
    monthlyPriceUsd: 0,
    durationMonths: 0,
    recommendationUnlocked: false,
    guidanceLabel: "Base",
    description: "Gestión esencial de deudas, pagos y simulación simple.",
    outcome: "Ver tu situación actual y llevar control básico sin acompañamiento premium.",
    bestFor: "Quien está empezando a ordenar sus deudas.",
    features: [
      "Dashboard base con tu situación actual",
      "Registro de deudas y pagos",
      "Simulador simple",
      "Experiencia personalizada por usuario",
    ],
  },
  NORMAL: {
    id: "NORMAL",
    label: "Premium",
    monthlyPriceUsd: 5,
    durationMonths: 6,
    recommendationUnlocked: true,
    guidanceLabel: "Salida rápida 6 meses",
    description: "La opción premium enfocada en ayudarte a salir más rápido de tus deudas con una ruta guiada de 6 meses.",
    outcome: "Recibir un plan recomendado para recortar tiempo e intereses desde ahora.",
    bestFor: "Quien quiere salir más rápido y necesita claridad inmediata.",
    features: [
      "Plan recomendado desbloqueado",
      "Orden de pago optimizado",
      "Ruta guiada para acelerar tu salida en 6 meses",
      "Alertas premium del flujo sugerido",
    ],
  },
  PRO: {
    id: "PRO",
    label: "Pro",
    monthlyPriceUsd: 10,
    durationMonths: 12,
    recommendationUnlocked: true,
    guidanceLabel: "Acompañamiento 12 meses",
    description: "Incluye recomendaciones más profundas y seguimiento extendido durante 12 meses para quien quiera más acompañamiento.",
    outcome: "Mantener una ruta premium por más tiempo con más contexto y seguimiento.",
    bestFor: "Quien quiere acompañamiento extendido y consejos más detallados.",
    features: [
      "Todo lo del plan Premium",
      "Ruta guiada y seguimiento a 12 meses",
      "Consejos más detallados y contexto ampliado",
      "Flujo premium para sostener el plan",
    ],
  },
} as const;

export type MembershipPlanId = keyof typeof membershipPlanCatalog;
export type MembershipBillingStatus = "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE";

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
