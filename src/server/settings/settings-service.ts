import { AuditAction } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { PreferencesInput } from "@/lib/validations/profile";
import { createAuditLog } from "@/server/audit/audit-service";

export async function getUserSettingsBundle(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });
}

export async function updateUserProfile(
  userId: string,
  input: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | undefined;
  },
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      avatarUrl: input.avatarUrl ?? null,
    },
    include: {
      settings: true,
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.PROFILE_UPDATED,
    resourceType: "user",
    resourceId: userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return user;
}

export async function updateUserPreferences(
  userId: string,
  input: PreferencesInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      defaultCurrency: input.defaultCurrency,
      preferredStrategy: input.preferredStrategy,
      hybridRateWeight: input.hybridRateWeight,
      hybridBalanceWeight: input.hybridBalanceWeight,
      monthlyDebtBudget: input.monthlyDebtBudget,
      notifyDueSoon: input.notifyDueSoon,
      notifyOverdue: input.notifyOverdue,
      notifyMinimumRisk: input.notifyMinimumRisk,
      notifyMonthlyReport: input.notifyMonthlyReport,
      emailRemindersEnabled: input.emailRemindersEnabled,
      upcomingDueDays: input.upcomingDueDays,
      timezone: input.timezone,
      language: input.language,
    },
    update: {
      defaultCurrency: input.defaultCurrency,
      preferredStrategy: input.preferredStrategy,
      hybridRateWeight: input.hybridRateWeight,
      hybridBalanceWeight: input.hybridBalanceWeight,
      monthlyDebtBudget: input.monthlyDebtBudget,
      notifyDueSoon: input.notifyDueSoon,
      notifyOverdue: input.notifyOverdue,
      notifyMinimumRisk: input.notifyMinimumRisk,
      notifyMonthlyReport: input.notifyMonthlyReport,
      emailRemindersEnabled: input.emailRemindersEnabled,
      upcomingDueDays: input.upcomingDueDays,
      timezone: input.timezone,
      language: input.language,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      timezone: input.timezone,
      locale: input.language === "es" ? "es-DO" : "en-US",
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return settings;
}

export async function updateUserMembershipPlan(
  userId: string,
  input: {
    membershipTier: "FREE" | "NORMAL" | "PRO";
  },
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      membershipTier: input.membershipTier,
      membershipBillingStatus: input.membershipTier === "FREE" ? "FREE" : "ACTIVE",
      membershipActivatedAt: input.membershipTier === "FREE" ? null : new Date(),
      membershipCurrentPeriodEnd: null,
      membershipCancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
    update: {
      membershipTier: input.membershipTier,
      membershipBillingStatus: input.membershipTier === "FREE" ? "FREE" : "ACTIVE",
      membershipActivatedAt:
        input.membershipTier === "FREE"
          ? null
          : new Date(),
      membershipCurrentPeriodEnd: null,
      membershipCancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "membership",
    resourceId: settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { membershipTier: input.membershipTier },
  });

  return settings;
}
