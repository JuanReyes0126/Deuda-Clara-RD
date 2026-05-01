import { AuditAction } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { revokeOtherSessions, rotateCurrentSession } from "@/lib/auth/session";
import { buildMonthlyCashflowSnapshot } from "@/lib/finance/monthly-cashflow";
import {
  resolveFeatureAccess,
  sanitizeReminderDaysForAccess,
} from "@/lib/feature-access";
import { decryptSensitiveText, encryptSensitiveText } from "@/lib/security/encryption";
import {
  buildTotpProvisioningUri,
  createRecoveryCodes,
  createTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "@/lib/security/totp";
import type {
  AppShellUserDto,
  MembershipSettingsPublicDto,
  PasskeyPublicDto,
  UserPublicDto,
  UserSettingsPublicDto,
  UserSettingsViewModelDto,
} from "@/lib/types/app";
import type {
  DisableTotpInput,
  RegenerateRecoveryCodesInput,
  VerifyTotpSetupInput,
} from "@/lib/validations/auth";
import type { PreferencesInput } from "@/lib/validations/profile";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  buildMfaDisabledEmail,
  buildMfaEnabledEmail,
  buildRecoveryCodesRegeneratedEmail,
} from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError } from "@/server/observability/logger";
import { verifyPassword } from "@/server/auth/password";
import { ServiceError } from "@/server/services/service-error";

async function deliverSettingsSecurityEmailSafely(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  context: string;
}) {
  try {
    await sendTransactionalEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (error) {
    logServerError(`Settings security email delivery failed during ${input.context}`, {
      to: input.to,
      error,
    });
  }
}

function toUserPublic(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}): UserPublicDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

function toUserSettingsPublic(settings: {
  defaultCurrency: "DOP" | "USD";
  preferredStrategy: "SNOWBALL" | "AVALANCHE" | "HYBRID";
  hybridRateWeight: number;
  hybridBalanceWeight: number;
  monthlyIncome: unknown;
  monthlyHousingCost: unknown;
  monthlyGroceriesCost: unknown;
  monthlyUtilitiesCost: unknown;
  monthlyTransportCost: unknown;
  monthlyOtherEssentialExpenses: unknown;
  monthlyDebtBudget: unknown;
  notifyDueSoon: boolean;
  notifyOverdue: boolean;
  notifyMinimumRisk: boolean;
  notifyMonthlyReport: boolean;
  emailRemindersEnabled: boolean;
  preferredReminderDays: number[];
  preferredReminderHour: number;
  mfaTotpEnabled: boolean;
  mfaRecoveryCodesHashes?: string[];
  mfaRecoveryCodesRemaining?: number;
  upcomingDueDays: number;
  timezone: string;
  language: string;
  membershipTier?: "FREE" | "NORMAL" | "PRO";
  membershipBillingStatus?:
    | "FREE"
    | "PENDING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "INACTIVE";
}): UserSettingsPublicDto {
  const access = resolveFeatureAccess({
    membershipTier: settings.membershipTier,
    membershipBillingStatus: settings.membershipBillingStatus,
  });
  const preferredReminderDays = sanitizeReminderDaysForAccess(
    access,
    settings.preferredReminderDays,
  );

  const cashflow = buildMonthlyCashflowSnapshot({
    monthlyIncome:
      settings.monthlyIncome === null || settings.monthlyIncome === undefined
        ? null
        : Number(settings.monthlyIncome),
    monthlyHousingCost:
      settings.monthlyHousingCost === null || settings.monthlyHousingCost === undefined
        ? null
        : Number(settings.monthlyHousingCost),
    monthlyGroceriesCost:
      settings.monthlyGroceriesCost === null || settings.monthlyGroceriesCost === undefined
        ? null
        : Number(settings.monthlyGroceriesCost),
    monthlyUtilitiesCost:
      settings.monthlyUtilitiesCost === null || settings.monthlyUtilitiesCost === undefined
        ? null
        : Number(settings.monthlyUtilitiesCost),
    monthlyTransportCost:
      settings.monthlyTransportCost === null || settings.monthlyTransportCost === undefined
        ? null
        : Number(settings.monthlyTransportCost),
    monthlyOtherEssentialExpenses:
      settings.monthlyOtherEssentialExpenses === null ||
      settings.monthlyOtherEssentialExpenses === undefined
        ? null
        : Number(settings.monthlyOtherEssentialExpenses),
  });

  return {
    defaultCurrency: settings.defaultCurrency,
    preferredStrategy: settings.preferredStrategy,
    hybridRateWeight: settings.hybridRateWeight,
    hybridBalanceWeight: settings.hybridBalanceWeight,
    monthlyIncome: cashflow.monthlyIncome,
    monthlyHousingCost: cashflow.monthlyHousingCost,
    monthlyGroceriesCost: cashflow.monthlyGroceriesCost,
    monthlyUtilitiesCost: cashflow.monthlyUtilitiesCost,
    monthlyTransportCost: cashflow.monthlyTransportCost,
    monthlyOtherEssentialExpenses: cashflow.monthlyOtherEssentialExpenses,
    monthlyEssentialExpensesTotal: cashflow.monthlyEssentialExpensesTotal,
    monthlyDebtCapacity: cashflow.monthlyDebtCapacity,
    monthlyDebtBudget:
      settings.monthlyDebtBudget === null ||
      settings.monthlyDebtBudget === undefined
        ? null
        : Number(settings.monthlyDebtBudget),
    notifyDueSoon: settings.notifyDueSoon,
    notifyOverdue: settings.notifyOverdue,
    notifyMinimumRisk: access.canReceiveAdvancedAlerts
      ? settings.notifyMinimumRisk
      : false,
    notifyMonthlyReport: access.canReceiveAdvancedAlerts
      ? settings.notifyMonthlyReport
      : false,
    emailRemindersEnabled: settings.emailRemindersEnabled,
    preferredReminderDays,
    preferredReminderHour: settings.preferredReminderHour,
    mfaTotpEnabled: settings.mfaTotpEnabled,
    mfaRecoveryCodesRemaining:
      settings.mfaRecoveryCodesRemaining ??
      settings.mfaRecoveryCodesHashes?.length ??
      0,
    upcomingDueDays: settings.upcomingDueDays,
    timezone: settings.timezone,
    language: settings.language,
  };
}

function toMembershipSettingsPublic(settings: {
  membershipTier: "FREE" | "NORMAL" | "PRO";
  membershipBillingStatus:
    | "FREE"
    | "PENDING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "INACTIVE";
  membershipCurrentPeriodEnd: Date | string | null;
  membershipCancelAtPeriodEnd: boolean;
}): MembershipSettingsPublicDto {
  return {
    membershipTier: settings.membershipTier,
    membershipBillingStatus: settings.membershipBillingStatus,
    membershipCurrentPeriodEnd:
      settings.membershipCurrentPeriodEnd instanceof Date
        ? settings.membershipCurrentPeriodEnd.toISOString()
        : settings.membershipCurrentPeriodEnd ?? null,
    membershipCancelAtPeriodEnd: settings.membershipCancelAtPeriodEnd,
  };
}

function toPasskeyPublic(passkey: {
  id: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  name: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}): PasskeyPublicDto {
  return {
    id: passkey.id,
    name: passkey.name,
    deviceType:
      passkey.deviceType === "singleDevice" ? "singleDevice" : "multiDevice",
    backedUp: passkey.backedUp,
    transports: passkey.transports,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
  };
}

function toAppShellUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  settings: {
    membershipTier: "FREE" | "NORMAL" | "PRO";
  } | null;
}): AppShellUserDto {
  return {
    ...toUserPublic(user),
    membershipTier: user.settings?.membershipTier ?? "FREE",
  };
}

function toUserSettingsViewModel(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  passkeyCredentials?: Array<{
    id: string;
    deviceType: string;
    backedUp: boolean;
    transports: string[];
    name: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
  timezone: string;
  settings:
    | {
        defaultCurrency: "DOP" | "USD";
        preferredStrategy: "SNOWBALL" | "AVALANCHE" | "HYBRID";
        hybridRateWeight: number;
        hybridBalanceWeight: number;
        monthlyIncome: unknown;
        monthlyHousingCost: unknown;
        monthlyGroceriesCost: unknown;
        monthlyUtilitiesCost: unknown;
        monthlyTransportCost: unknown;
        monthlyOtherEssentialExpenses: unknown;
        monthlyDebtBudget: unknown;
        notifyDueSoon: boolean;
        notifyOverdue: boolean;
        notifyMinimumRisk: boolean;
        notifyMonthlyReport: boolean;
        emailRemindersEnabled: boolean;
        preferredReminderDays: number[];
        preferredReminderHour: number;
        mfaTotpEnabled: boolean;
        mfaRecoveryCodesHashes?: string[];
        mfaRecoveryCodesRemaining?: number;
        upcomingDueDays: number;
        timezone: string;
        language: string;
        membershipTier: "FREE" | "NORMAL" | "PRO";
        membershipBillingStatus:
          | "FREE"
          | "PENDING"
          | "ACTIVE"
          | "PAST_DUE"
          | "CANCELED"
          | "INACTIVE";
        membershipCurrentPeriodEnd: Date | string | null;
        membershipCancelAtPeriodEnd: boolean;
        externalPaymentProvider?: string | null;
        externalSubscriptionId?: string | null;
      }
    | null;
}): UserSettingsViewModelDto {
  return {
    ...toUserPublic(user),
    passkeys: (user.passkeyCredentials ?? []).map(toPasskeyPublic),
    timezone: user.timezone,
    settings: user.settings
      ? {
          ...toUserSettingsPublic(user.settings),
          ...toMembershipSettingsPublic(user.settings),
          canManageBilling: Boolean(
            user.settings.externalPaymentProvider &&
              user.settings.externalSubscriptionId &&
              user.settings.membershipBillingStatus === "ACTIVE",
          ),
        }
      : null,
  };
}

export function buildUserSettingsViewModel(user: Parameters<typeof toUserSettingsViewModel>[0]) {
  return toUserSettingsViewModel(user);
}

export async function getUserSettingsViewModel(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      passkeyCredentials: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          name: true,
          createdAt: true,
          lastUsedAt: true,
        },
      },
      timezone: true,
      settings: {
        select: {
          defaultCurrency: true,
          preferredStrategy: true,
          hybridRateWeight: true,
          hybridBalanceWeight: true,
          monthlyIncome: true,
          monthlyHousingCost: true,
          monthlyGroceriesCost: true,
          monthlyUtilitiesCost: true,
          monthlyTransportCost: true,
          monthlyOtherEssentialExpenses: true,
          monthlyDebtBudget: true,
          notifyDueSoon: true,
          notifyOverdue: true,
          notifyMinimumRisk: true,
          notifyMonthlyReport: true,
          emailRemindersEnabled: true,
          preferredReminderDays: true,
          preferredReminderHour: true,
          mfaTotpEnabled: true,
          mfaRecoveryCodesHashes: true,
          upcomingDueDays: true,
          timezone: true,
          language: true,
          membershipTier: true,
          membershipBillingStatus: true,
          membershipCurrentPeriodEnd: true,
          membershipCancelAtPeriodEnd: true,
          externalPaymentProvider: true,
          externalSubscriptionId: true,
        },
      },
    },
  });

  return toUserSettingsViewModel(user);
}

export function buildAppShellUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  settings: {
    membershipTier: "FREE" | "NORMAL" | "PRO";
  } | null;
}) {
  return toAppShellUser(user);
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
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
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

  return toUserPublic(user);
}

export async function updateUserPreferences(
  userId: string,
  input: PreferencesInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const currentMembership = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      membershipTier: true,
      membershipBillingStatus: true,
    },
  });
  const access = resolveFeatureAccess({
    membershipTier: currentMembership?.membershipTier ?? "FREE",
    membershipBillingStatus: currentMembership?.membershipBillingStatus ?? "FREE",
  });
  const normalizedInput = {
    ...input,
    notifyMinimumRisk: access.canReceiveAdvancedAlerts
      ? input.notifyMinimumRisk
      : false,
    notifyMonthlyReport: access.canReceiveAdvancedAlerts
      ? input.notifyMonthlyReport
      : false,
    preferredReminderDays: sanitizeReminderDaysForAccess(
      access,
      input.preferredReminderDays,
    ),
  };

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      defaultCurrency: normalizedInput.defaultCurrency,
      preferredStrategy: normalizedInput.preferredStrategy,
      hybridRateWeight: normalizedInput.hybridRateWeight,
      hybridBalanceWeight: normalizedInput.hybridBalanceWeight,
      monthlyIncome: normalizedInput.monthlyIncome,
      monthlyHousingCost: normalizedInput.monthlyHousingCost,
      monthlyGroceriesCost: normalizedInput.monthlyGroceriesCost,
      monthlyUtilitiesCost: normalizedInput.monthlyUtilitiesCost,
      monthlyTransportCost: normalizedInput.monthlyTransportCost,
      monthlyOtherEssentialExpenses: normalizedInput.monthlyOtherEssentialExpenses,
      monthlyDebtBudget: normalizedInput.monthlyDebtBudget,
      notifyDueSoon: normalizedInput.notifyDueSoon,
      notifyOverdue: normalizedInput.notifyOverdue,
      notifyMinimumRisk: normalizedInput.notifyMinimumRisk,
      notifyMonthlyReport: normalizedInput.notifyMonthlyReport,
      emailRemindersEnabled: normalizedInput.emailRemindersEnabled,
      preferredReminderDays: normalizedInput.preferredReminderDays,
      preferredReminderHour: normalizedInput.preferredReminderHour,
      upcomingDueDays: normalizedInput.upcomingDueDays,
      timezone: normalizedInput.timezone,
      language: normalizedInput.language,
    },
    update: {
      defaultCurrency: normalizedInput.defaultCurrency,
      preferredStrategy: normalizedInput.preferredStrategy,
      hybridRateWeight: normalizedInput.hybridRateWeight,
      hybridBalanceWeight: normalizedInput.hybridBalanceWeight,
      monthlyIncome: normalizedInput.monthlyIncome,
      monthlyHousingCost: normalizedInput.monthlyHousingCost,
      monthlyGroceriesCost: normalizedInput.monthlyGroceriesCost,
      monthlyUtilitiesCost: normalizedInput.monthlyUtilitiesCost,
      monthlyTransportCost: normalizedInput.monthlyTransportCost,
      monthlyOtherEssentialExpenses: normalizedInput.monthlyOtherEssentialExpenses,
      monthlyDebtBudget: normalizedInput.monthlyDebtBudget,
      notifyDueSoon: normalizedInput.notifyDueSoon,
      notifyOverdue: normalizedInput.notifyOverdue,
      notifyMinimumRisk: normalizedInput.notifyMinimumRisk,
      notifyMonthlyReport: normalizedInput.notifyMonthlyReport,
      emailRemindersEnabled: normalizedInput.emailRemindersEnabled,
      preferredReminderDays: normalizedInput.preferredReminderDays,
      preferredReminderHour: normalizedInput.preferredReminderHour,
      upcomingDueDays: normalizedInput.upcomingDueDays,
      timezone: normalizedInput.timezone,
      language: normalizedInput.language,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      timezone: normalizedInput.timezone,
      locale: normalizedInput.language === "es" ? "es-DO" : "en-US",
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

  return toUserSettingsPublic(settings);
}

export async function createUserTotpSetup(
  userId: string,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      settings: {
        select: {
          id: true,
          mfaTotpEnabled: true,
        },
      },
    },
  });

  if (user.settings?.mfaTotpEnabled) {
    throw new ServiceError(
      "MFA_ALREADY_ENABLED",
      409,
      "La verificación en dos pasos ya está activada.",
    );
  }

  const totpSecret = createTotpSecret();
  const encryptedSecret = encryptSensitiveText(totpSecret);

  if (!encryptedSecret) {
    throw new ServiceError(
      "MFA_SETUP_UNAVAILABLE",
      500,
      "No se pudo preparar la verificación en dos pasos.",
    );
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      mfaTotpEnabled: false,
      mfaTotpSecretEncrypted: encryptedSecret,
      mfaRecoveryCodesHashes: [],
    },
    update: {
      mfaTotpEnabled: false,
      mfaTotpSecretEncrypted: encryptedSecret,
      mfaRecoveryCodesHashes: [],
    },
    select: {
      id: true,
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { securityEvent: "mfa_totp_setup_started" },
  });

  return {
    setupKey: totpSecret,
    provisioningUri: buildTotpProvisioningUri({
      accountName: user.email,
      secret: totpSecret,
    }),
  };
}

export async function verifyUserTotpSetup(
  userId: string,
  input: VerifyTotpSetupInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      settings: {
        select: {
          id: true,
          mfaTotpEnabled: true,
          mfaTotpSecretEncrypted: true,
          mfaRecoveryCodesHashes: true,
        },
      },
    },
  });

  const settings = user?.settings;
  const totpSecret = decryptSensitiveText(settings?.mfaTotpSecretEncrypted);

  if (!user || !settings || !totpSecret) {
    throw new ServiceError(
      "MFA_SETUP_NOT_FOUND",
      400,
      "Primero genera una clave de verificación.",
    );
  }

  if (settings.mfaTotpEnabled) {
    return { mfaTotpEnabled: true, backupCodes: [] as string[] };
  }

  if (!verifyTotpCode(totpSecret, input.totpCode)) {
    throw new ServiceError(
      "MFA_INVALID",
      400,
      "El código de verificación no es válido.",
    );
  }

  const backupCodes = createRecoveryCodes();

  await prisma.userSettings.update({
    where: { userId },
    data: {
      mfaTotpEnabled: true,
      mfaRecoveryCodesHashes: backupCodes.map(hashRecoveryCode),
    },
  });

  await revokeOtherSessions(userId);
  await rotateCurrentSession(userId);

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { securityEvent: "mfa_totp_enabled" },
  });

  const email = buildMfaEnabledEmail(user.firstName);
  await deliverSettingsSecurityEmailSafely({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    context: "mfa_totp_enabled",
  });

  return { mfaTotpEnabled: true, backupCodes };
}

export async function disableUserTotp(
  userId: string,
  input: DisableTotpInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHash: true,
      settings: {
        select: {
          id: true,
          mfaTotpEnabled: true,
          mfaTotpSecretEncrypted: true,
          mfaRecoveryCodesHashes: true,
        },
      },
    },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se encontró la cuenta.");
  }

  if (!user.settings?.mfaTotpEnabled) {
    return { mfaTotpEnabled: false };
  }

  const passwordMatches = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new ServiceError(
      "CURRENT_PASSWORD_INVALID",
      400,
      "La contraseña actual no es correcta.",
    );
  }

  const totpSecret = decryptSensitiveText(user.settings.mfaTotpSecretEncrypted);

  if (!totpSecret || !verifyTotpCode(totpSecret, input.totpCode)) {
    throw new ServiceError(
      "MFA_INVALID",
      400,
      "El código de verificación no es válido.",
    );
  }

  await prisma.userSettings.update({
    where: { userId },
    data: {
      mfaTotpEnabled: false,
      mfaTotpSecretEncrypted: null,
      mfaRecoveryCodesHashes: [],
    },
  });

  await revokeOtherSessions(userId);
  await rotateCurrentSession(userId);

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: user.settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { securityEvent: "mfa_totp_disabled" },
  });

  const email = buildMfaDisabledEmail(user.firstName);
  await deliverSettingsSecurityEmailSafely({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    context: "mfa_totp_disabled",
  });

  return { mfaTotpEnabled: false };
}

export async function regenerateUserRecoveryCodes(
  userId: string,
  input: RegenerateRecoveryCodesInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHash: true,
      settings: {
        select: {
          id: true,
          mfaTotpEnabled: true,
        },
      },
    },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se encontró la cuenta.");
  }

  if (!user.settings?.mfaTotpEnabled) {
    throw new ServiceError(
      "MFA_NOT_ENABLED",
      400,
      "Primero activa la verificación en dos pasos.",
    );
  }

  const passwordMatches = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new ServiceError(
      "CURRENT_PASSWORD_INVALID",
      400,
      "La contraseña actual no es correcta.",
    );
  }

  const backupCodes = createRecoveryCodes();

  await prisma.userSettings.update({
    where: { userId },
    data: {
      mfaRecoveryCodesHashes: backupCodes.map(hashRecoveryCode),
    },
  });

  await revokeOtherSessions(userId);
  await rotateCurrentSession(userId);

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: user.settings.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { securityEvent: "mfa_recovery_codes_regenerated" },
  });

  const email = buildRecoveryCodesRegeneratedEmail(user.firstName);
  await deliverSettingsSecurityEmailSafely({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    context: "mfa_recovery_codes_regenerated",
  });

  return { backupCodes };
}

export async function updateUserMembershipPlan(
  userId: string,
  input: {
    membershipTier: "FREE" | "NORMAL" | "PRO";
  },
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (input.membershipTier !== "FREE") {
    throw new ServiceError(
      "MEMBERSHIP_MANUAL_UPGRADE_BLOCKED",
      403,
      "Los planes pagos solo se activan por checkout seguro.",
    );
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      membershipTier: input.membershipTier,
      membershipBillingStatus: input.membershipTier === "FREE" ? "FREE" : "ACTIVE",
      membershipActivatedAt: input.membershipTier === "FREE" ? null : new Date(),
      membershipCurrentPeriodEnd: null,
      membershipCancelAtPeriodEnd: false,
      billingInterval: null,
      externalPaymentProvider: null,
      externalSubscriptionId: null,
      externalPriceCode: null,
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
      billingInterval: null,
      externalPaymentProvider: null,
      externalSubscriptionId: null,
      externalPriceCode: null,
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

  return toMembershipSettingsPublic(settings);
}
