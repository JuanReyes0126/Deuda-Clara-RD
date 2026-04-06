import type { MembershipBillingStatus, MembershipPlanId } from "@/lib/membership/plans";

type FeatureAccessDefinition = {
  maxActiveDebts: number;
  canUseAdvancedSimulation: boolean;
  canCompareScenarios: boolean;
  canSeeOptimizedSavings: boolean;
  canSeeFullPlanComparison: boolean;
  canAccessPremiumOptimization: boolean;
  canSeeRecommendedStrategy: boolean;
  canUseAdvancedExtraPayments: boolean;
  canUseAdvancedReminders: boolean;
  canReceiveAdvancedAlerts: boolean;
  canSeeExtendedInsights: boolean;
  canAccessProFollowup: boolean;
  canUseAutoStrategy: boolean;
  canUseDynamicReoptimization: boolean;
  canSeeStepByStepPlan: boolean;
  canExportReports: boolean;
  maxReportRangeDays: number;
  notificationHistoryLimit: number;
  balanceHistoryPoints: number;
  recentPaymentsLimit: number;
  riskAlertLimit: number;
  dueSoonLimit: number;
  upcomingTimelineLimit: number;
  allowedReminderDays: number[];
  featureBullets: string[];
};

export type PlanCapabilities = FeatureAccessDefinition;

export type MembershipAccessInput = {
  membershipTier?: string | null | undefined;
  membershipBillingStatus?: MembershipBillingStatus | null | undefined;
};

type FeatureAccessResolvable = MembershipAccessInput | ResolvedFeatureAccess;

export type ResolvedFeatureAccess = FeatureAccessDefinition & {
  requestedTier: MembershipPlanId;
  effectiveTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
  hasPaidAccess: boolean;
  isBase: boolean;
  isPremium: boolean;
  isPro: boolean;
  upgradeTargetTier: Extract<MembershipPlanId, "NORMAL" | "PRO">;
  upgradeTargetLabel: "Premium" | "Pro";
};

export type CapabilityBooleanKey = {
  [Key in keyof FeatureAccessDefinition]: FeatureAccessDefinition[Key] extends boolean
    ? Key
    : never;
}[keyof FeatureAccessDefinition];

export type CapabilityNumericKey = {
  [Key in keyof FeatureAccessDefinition]: FeatureAccessDefinition[Key] extends number
    ? Key
    : never;
}[keyof FeatureAccessDefinition];

const PLAN_FEATURES: Record<MembershipPlanId, FeatureAccessDefinition> = {
  FREE: {
    maxActiveDebts: 2,
    canUseAdvancedSimulation: false,
    canCompareScenarios: false,
    canSeeOptimizedSavings: false,
    canSeeFullPlanComparison: false,
    canAccessPremiumOptimization: false,
    canSeeRecommendedStrategy: false,
    canUseAdvancedExtraPayments: false,
    canUseAdvancedReminders: false,
    canReceiveAdvancedAlerts: false,
    canSeeExtendedInsights: false,
    canAccessProFollowup: false,
    canUseAutoStrategy: false,
    canUseDynamicReoptimization: false,
    canSeeStepByStepPlan: false,
    canExportReports: false,
    maxReportRangeDays: 31,
    notificationHistoryLimit: 8,
    balanceHistoryPoints: 3,
    recentPaymentsLimit: 3,
    riskAlertLimit: 1,
    dueSoonLimit: 2,
    upcomingTimelineLimit: 2,
    allowedReminderDays: [2, 0],
    featureBullets: [
      "Hasta 2 deudas activas",
      "Panorama base con saldo, pago mínimo y próximas fechas",
      "Recordatorios básicos por correo",
      "Simulación parcial para entender tu escenario actual",
    ],
  },
  NORMAL: {
    maxActiveDebts: 10,
    canUseAdvancedSimulation: true,
    canCompareScenarios: true,
    canSeeOptimizedSavings: true,
    canSeeFullPlanComparison: true,
    canAccessPremiumOptimization: true,
    canSeeRecommendedStrategy: true,
    canUseAdvancedExtraPayments: true,
    canUseAdvancedReminders: true,
    canReceiveAdvancedAlerts: true,
    canSeeExtendedInsights: true,
    canAccessProFollowup: false,
    canUseAutoStrategy: false,
    canUseDynamicReoptimization: false,
    canSeeStepByStepPlan: false,
    canExportReports: false,
    maxReportRangeDays: 90,
    notificationHistoryLimit: 40,
    balanceHistoryPoints: 8,
    recentPaymentsLimit: 8,
    riskAlertLimit: 3,
    dueSoonLimit: 4,
    upcomingTimelineLimit: 4,
    allowedReminderDays: [5, 2, 0],
    featureBullets: [
      "Hasta 10 deudas activas",
      "Simulador completo con comparación de escenarios",
      "Ahorro exacto y estrategia recomendada visibles",
      "Alertas inteligentes y recordatorios completos",
    ],
  },
  PRO: {
    maxActiveDebts: Number.MAX_SAFE_INTEGER,
    canUseAdvancedSimulation: true,
    canCompareScenarios: true,
    canSeeOptimizedSavings: true,
    canSeeFullPlanComparison: true,
    canAccessPremiumOptimization: true,
    canSeeRecommendedStrategy: true,
    canUseAdvancedExtraPayments: true,
    canUseAdvancedReminders: true,
    canReceiveAdvancedAlerts: true,
    canSeeExtendedInsights: true,
    canAccessProFollowup: true,
    canUseAutoStrategy: true,
    canUseDynamicReoptimization: true,
    canSeeStepByStepPlan: true,
    canExportReports: true,
    maxReportRangeDays: 365,
    notificationHistoryLimit: 100,
    balanceHistoryPoints: 12,
    recentPaymentsLimit: 12,
    riskAlertLimit: 5,
    dueSoonLimit: 6,
    upcomingTimelineLimit: 6,
    allowedReminderDays: [5, 2, 0],
    featureBullets: [
      "Deudas ilimitadas y todo Premium desbloqueado",
      "Reoptimización dinámica y estrategia más inteligente",
      "Exportación CSV/PDF y seguimiento profundo",
      "Más contexto, alertas y señales para control total",
    ],
  },
};

export const PLAN_CAPABILITIES: Record<MembershipPlanId, PlanCapabilities> =
  PLAN_FEATURES;

function normalizeMembershipTier(
  membershipTier?: string | null | undefined,
): MembershipPlanId {
  if (membershipTier === "NORMAL" || membershipTier === "PRO") {
    return membershipTier;
  }

  return "FREE";
}

function normalizeBillingStatus(
  billingStatus?: MembershipBillingStatus | null | undefined,
): MembershipBillingStatus {
  switch (billingStatus) {
    case "PENDING":
    case "ACTIVE":
    case "PAST_DUE":
    case "CANCELED":
    case "INACTIVE":
      return billingStatus;
    default:
      return "FREE";
  }
}

export function resolveFeatureAccess(
  input: FeatureAccessResolvable,
): ResolvedFeatureAccess {
  if ("effectiveTier" in input && "requestedTier" in input) {
    return input;
  }

  const requestedTier = normalizeMembershipTier(input.membershipTier);
  const billingStatus = normalizeBillingStatus(input.membershipBillingStatus);
  const hasPaidAccess = requestedTier !== "FREE" && billingStatus === "ACTIVE";
  const effectiveTier = hasPaidAccess ? requestedTier : "FREE";
  const definition = PLAN_FEATURES[effectiveTier];
  const upgradeTargetTier: Extract<MembershipPlanId, "NORMAL" | "PRO"> =
    effectiveTier === "NORMAL" ? "PRO" : "NORMAL";

  return {
    requestedTier,
    effectiveTier,
    billingStatus,
    hasPaidAccess,
    isBase: effectiveTier === "FREE",
    isPremium: effectiveTier === "NORMAL",
    isPro: effectiveTier === "PRO",
    upgradeTargetTier,
    upgradeTargetLabel: upgradeTargetTier === "PRO" ? "Pro" : "Premium",
    ...definition,
  };
}

export function getUserCapabilities(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input);
}

export function getMaxDebts(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).maxActiveDebts;
}

export function hasCapability(
  input: FeatureAccessResolvable,
  capabilityKey: CapabilityBooleanKey,
) {
  return resolveFeatureAccess(input)[capabilityKey];
}

export function assertCapability(
  input: FeatureAccessResolvable,
  capabilityKey: CapabilityBooleanKey,
  message = "Esta función no está disponible en tu plan actual.",
) {
  const access = resolveFeatureAccess(input);

  if (!access[capabilityKey]) {
    throw new Error(message);
  }

  return access;
}

export function canAccessUnlimitedDebts(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).maxActiveDebts >= Number.MAX_SAFE_INTEGER;
}

export function canAddMoreDebts(
  input: FeatureAccessResolvable & { activeDebtCount: number },
) {
  return input.activeDebtCount < resolveFeatureAccess(input).maxActiveDebts;
}

export function canUseAdvancedSimulation(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canUseAdvancedSimulation;
}

export function canUseFullSimulator(input: FeatureAccessResolvable) {
  return canUseAdvancedSimulation(input);
}

export function canCompareScenarios(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canCompareScenarios;
}

export function canSeeOptimizedSavings(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canSeeOptimizedSavings;
}

export function canSeeFullPlanComparison(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canSeeFullPlanComparison;
}

export function canAccessPremiumOptimization(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canAccessPremiumOptimization;
}

export function canSeeRecommendedStrategy(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canSeeRecommendedStrategy;
}

export function canUseAdvancedExtraPayments(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canUseAdvancedExtraPayments;
}

export function canUseAdvancedReminders(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canUseAdvancedReminders;
}

export function canReceiveAdvancedAlerts(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canReceiveAdvancedAlerts;
}

export function canReceiveSmartAlerts(input: FeatureAccessResolvable) {
  return canReceiveAdvancedAlerts(input);
}

export function canSeeExtendedInsights(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canSeeExtendedInsights;
}

export function canAccessProFollowup(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canAccessProFollowup;
}

export function canUseAutoStrategy(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canUseAutoStrategy;
}

export function canUseDynamicReoptimization(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canUseDynamicReoptimization;
}

export function canSeeStepByStepPlan(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).canSeeStepByStepPlan;
}

export function getPlanFeatureBullets(planId: MembershipPlanId) {
  return PLAN_FEATURES[planId].featureBullets;
}

export function getAllowedReminderDays(input: FeatureAccessResolvable) {
  return resolveFeatureAccess(input).allowedReminderDays;
}

export function getReportRangeDays(from: Date, to: Date) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.abs(Math.round((end.getTime() - start.getTime()) / 86_400_000)) + 1;
}

export function isReportRangeAllowed(
  input: FeatureAccessResolvable,
  from: Date,
  to: Date,
) {
  return getReportRangeDays(from, to) <= resolveFeatureAccess(input).maxReportRangeDays;
}

export function sanitizeReminderDaysForAccess(
  input: FeatureAccessResolvable,
  reminderDays: number[],
) {
  const allowedDays = new Set(getAllowedReminderDays(input));
  const filteredDays = [...new Set(reminderDays)]
    .filter((value) => allowedDays.has(value))
    .sort((left, right) => right - left);

  return filteredDays.length
    ? filteredDays
    : [...getAllowedReminderDays(input)];
}
