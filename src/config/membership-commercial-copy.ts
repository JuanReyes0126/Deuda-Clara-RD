import { formatMembershipCommercialSummary } from "@/lib/membership/plans";

export const MEMBERSHIP_COMMERCIAL_COPY = {
  cta: {
    primary: "Desbloquear y ahorrar ahora",
    secondary: "Empezar a pagar menos ahora",
  },
  loss: {
    currentOnly: "Este es tu escenario actual. Pero no es el más eficiente.",
    partialView: "Estás viendo una versión parcial de tu situación financiera.",
    hiddenDebts:
      "Hay deudas fuera de este análisis que también te están costando tiempo e intereses.",
    inefficientPlan:
      "Tu estrategia actual no es la que menos tiempo y dinero te cuesta.",
    monthlyLeak: "Cada mes sigues perdiendo dinero que podrías quedarte.",
    currentVsOptimized:
      "Primero ves lo que te cuesta seguir igual. Luego descubres cuánto podrías recortar.",
  },
  reinforcement: {
    riskFree: "Cancela fácil desde facturación. Sin riesgo.",
    ownership: "Tus datos y tu cuenta siguen siendo tuyos.",
    checkout: "Checkout seguro con Stripe y cobro en USD.",
  },
  growthHooks: {
    reminders: "Recordatorios que te ayudan a mantenerte al día.",
    progress: "Cada pago visible refuerza sensación de avance.",
    referrals: "Pronto: invita y desbloquea Pro.",
  },
} as const;

export function getCommercialUpgradeCta(requiredPlan: "Premium" | "Pro") {
  return requiredPlan === "Premium"
    ? MEMBERSHIP_COMMERCIAL_COPY.cta.primary
    : MEMBERSHIP_COMMERCIAL_COPY.cta.secondary;
}

export function getCommercialPriceSummary(requiredPlan: "Premium" | "Pro") {
  return requiredPlan === "Premium"
    ? formatMembershipCommercialSummary("NORMAL")
    : formatMembershipCommercialSummary("PRO");
}
