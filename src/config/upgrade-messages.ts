import {
  MEMBERSHIP_COMMERCIAL_COPY,
  getCommercialUpgradeCta,
} from "@/config/membership-commercial-copy";

export const UPGRADE_MESSAGES = {
  PARTIAL_VIEW: MEMBERSHIP_COMMERCIAL_COPY.loss.partialView,
  HIDDEN_DEBTS: MEMBERSHIP_COMMERCIAL_COPY.loss.hiddenDebts,
  INEFFICIENT_PLAN: MEMBERSHIP_COMMERCIAL_COPY.loss.currentOnly,
  INTEREST_LOSS: "Estás perdiendo dinero ahora mismo.",
  BETTER_SCENARIO: "Hay una mejor estrategia disponible.",
  BETTER_TIMELINE: "Podrías salir antes.",
  BETTER_SAVINGS: "Hay dinero que podrías dejar de perder.",
  DEBT_LIMIT_BASE:
    "Tienes más de 2 deudas activas. Para ver tu panorama completo, actualiza tu plan.",
  DEBT_LIMIT_CONTEXT:
    MEMBERSHIP_COMMERCIAL_COPY.loss.hiddenDebts,
  DEBT_LIMIT_DECISION:
    "Estás tomando decisiones sin ver toda tu realidad financiera.",
  SIMULATOR_CURRENT_ONLY: MEMBERSHIP_COMMERCIAL_COPY.loss.currentOnly,
  SIMULATOR_TIME_LOCKED: "Sabes cuánto tardas. Aún no ves cómo salir antes.",
  SIMULATOR_SAVINGS_LOCKED:
    "Hay tiempo e intereses que podrías dejar de perder con una mejor estrategia.",
  SIMULATOR_PREMIUM_CTA: getCommercialUpgradeCta("Premium"),
  PREMIUM_VALUE: "Optimiza y paga menos",
  PREMIUM_SUPPORT: "Descubre cuánto estás perdiendo y cómo empezar a pagar menos ahora.",
  PRO_VALUE: "Control total y estrategia inteligente",
  PRO_SUPPORT: "Mantén una estrategia más viva, más guiada y con menos dinero perdido.",
} as const;

export function getDebtLimitUpgradeNotes() {
  return [
    UPGRADE_MESSAGES.DEBT_LIMIT_BASE,
    UPGRADE_MESSAGES.DEBT_LIMIT_CONTEXT,
    UPGRADE_MESSAGES.DEBT_LIMIT_DECISION,
  ];
}

export function getSimulatorUpgradeNotes() {
  return [
    UPGRADE_MESSAGES.SIMULATOR_CURRENT_ONLY,
    UPGRADE_MESSAGES.SIMULATOR_TIME_LOCKED,
    UPGRADE_MESSAGES.SIMULATOR_SAVINGS_LOCKED,
  ];
}
