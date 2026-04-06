import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  CurrentSessionDto,
  ServerUserContextDto,
  ServerUserSettingsContextDto,
  SessionUserContextDto,
} from "@/lib/auth/session-context";
import { prisma } from "@/lib/db/prisma";
import {
  clearDemoSession,
  getDemoServerUser,
  getDemoSession,
  isDemoModeEnabled,
} from "@/lib/demo/session";
import {
  isDatabaseReachable,
  markDatabaseUnavailable,
} from "@/server/services/database-availability";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { generateOpaqueToken, hashOpaqueToken } from "@/server/auth/tokens";
import { clearRecentAuth, refreshRecentAuth } from "@/lib/security/recent-auth";

const SESSION_COOKIE_NAME = "dc_session";
const SESSION_MAX_AGE_DAYS = 30;

const sessionUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  status: true,
  timezone: true,
  onboardingCompleted: true,
} as const;

const serverUserSettingsSelect = {
  defaultCurrency: true,
  preferredStrategy: true,
  membershipTier: true,
  membershipBillingStatus: true,
  membershipCurrentPeriodEnd: true,
  membershipCancelAtPeriodEnd: true,
  hybridRateWeight: true,
  hybridBalanceWeight: true,
  monthlyIncome: true,
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
  language: true,
  timezone: true,
} as const;

const serverUserContextSelect = {
  ...sessionUserSelect,
  settings: {
    select: serverUserSettingsSelect,
  },
} as const;

function buildSessionExpiration() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_MAX_AGE_DAYS);
  return expires;
}

export async function setSessionCookie(rawToken: string, expires: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
    priority: "high",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function createUserSession(userId: string, rawToken: string) {
  const expires = buildSessionExpiration();

  await prisma.session.create({
    data: {
      userId,
      sessionToken: hashOpaqueToken(rawToken),
      expires,
    },
  });

  await setSessionCookie(rawToken, expires);
  await refreshRecentAuth(userId);
}

export async function revokeOtherSessions(userId: string) {
  const demoSession = await getDemoSession();

  if (demoSession) {
    return;
  }

  if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
    return;
  }

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;

  try {
    await prisma.session.deleteMany({
      where: rawToken
        ? {
            userId,
            sessionToken: {
              not: hashOpaqueToken(rawToken),
            },
          }
        : { userId },
    });
  } catch (error) {
    if (!isInfrastructureUnavailableError(error) || !isDemoModeEnabled()) {
      throw error;
    }

    markDatabaseUnavailable();
  }
}

export async function rotateCurrentSession(userId: string) {
  const demoSession = await getDemoSession();

  if (demoSession) {
    return;
  }

  if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
    return;
  }

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  const nextRawToken = generateOpaqueToken(32);
  const expires = buildSessionExpiration();

  try {
    if (rawToken) {
      await prisma.session.deleteMany({
        where: {
          userId,
          sessionToken: hashOpaqueToken(rawToken),
        },
      });
    }

    await prisma.session.create({
      data: {
        userId,
        sessionToken: hashOpaqueToken(nextRawToken),
        expires,
      },
    });
  } catch (error) {
    if (!isInfrastructureUnavailableError(error) || !isDemoModeEnabled()) {
      throw error;
    }

    markDatabaseUnavailable();
    return;
  }

  await setSessionCookie(nextRawToken, expires);
  await refreshRecentAuth(userId);
}

function toServerUserContext(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  timezone: string;
  onboardingCompleted: boolean;
  settings:
    | {
        defaultCurrency: "DOP" | "USD";
        preferredStrategy: "SNOWBALL" | "AVALANCHE" | "HYBRID";
        membershipTier: "FREE" | "NORMAL" | "PRO";
        membershipBillingStatus:
          | "FREE"
          | "PENDING"
          | "ACTIVE"
          | "PAST_DUE"
          | "CANCELED"
          | "INACTIVE";
        membershipCurrentPeriodEnd: Date | null;
        membershipCancelAtPeriodEnd: boolean;
        hybridRateWeight: number;
        hybridBalanceWeight: number;
        monthlyIncome: unknown;
        monthlyDebtBudget: unknown;
        notifyDueSoon: boolean;
        notifyOverdue: boolean;
        notifyMinimumRisk: boolean;
        notifyMonthlyReport: boolean;
        emailRemindersEnabled: boolean;
        preferredReminderDays: number[];
        preferredReminderHour: number;
        mfaTotpEnabled: boolean;
        mfaRecoveryCodesHashes: string[];
        upcomingDueDays: number;
        language: string;
        timezone: string;
      }
    | null;
}): ServerUserContextDto {
  const settings: ServerUserSettingsContextDto | null = user.settings
    ? {
        defaultCurrency: user.settings.defaultCurrency,
        preferredStrategy: user.settings.preferredStrategy,
        membershipTier: user.settings.membershipTier,
        membershipBillingStatus: user.settings.membershipBillingStatus,
        membershipCurrentPeriodEnd:
          user.settings.membershipCurrentPeriodEnd?.toISOString() ?? null,
        membershipCancelAtPeriodEnd:
          user.settings.membershipCancelAtPeriodEnd,
        hybridRateWeight: user.settings.hybridRateWeight,
        hybridBalanceWeight: user.settings.hybridBalanceWeight,
        monthlyIncome:
          user.settings.monthlyIncome === null ||
          user.settings.monthlyIncome === undefined
            ? null
            : Number(user.settings.monthlyIncome),
        monthlyDebtBudget:
          user.settings.monthlyDebtBudget === null ||
          user.settings.monthlyDebtBudget === undefined
            ? null
            : Number(user.settings.monthlyDebtBudget),
        notifyDueSoon: user.settings.notifyDueSoon,
        notifyOverdue: user.settings.notifyOverdue,
        notifyMinimumRisk: user.settings.notifyMinimumRisk,
        notifyMonthlyReport: user.settings.notifyMonthlyReport,
        emailRemindersEnabled: user.settings.emailRemindersEnabled,
        preferredReminderDays: user.settings.preferredReminderDays,
        preferredReminderHour: user.settings.preferredReminderHour,
        mfaTotpEnabled: user.settings.mfaTotpEnabled,
        mfaRecoveryCodesRemaining: user.settings.mfaRecoveryCodesHashes.length,
        upcomingDueDays: user.settings.upcomingDueDays,
        language: user.settings.language,
        timezone: user.settings.timezone,
      }
    : null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    timezone: user.timezone,
    onboardingCompleted: user.onboardingCompleted,
    settings,
  };
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  const demoSession = await getDemoSession();

  if (demoSession) {
    await clearSessionCookie();
    await clearRecentAuth();
    await clearDemoSession();
    return;
  }

  if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
    await clearSessionCookie();
    await clearRecentAuth();
    await clearDemoSession();
    return;
  }

  if (rawToken) {
    try {
      await prisma.session.deleteMany({
        where: {
          sessionToken: hashOpaqueToken(rawToken),
        },
      });
    } catch (error) {
      if (!isInfrastructureUnavailableError(error) || !isDemoModeEnabled()) {
        throw error;
      }

      markDatabaseUnavailable();
    }
  }

  await clearSessionCookie();
  await clearRecentAuth();
  await clearDemoSession();
}

export async function getCurrentSession(): Promise<CurrentSessionDto | null> {
  const store = await cookies();
  const demoSession = await getDemoSession();

  if (demoSession) {
    return demoSession;
  }

  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
    await clearSessionCookie();
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: {
        sessionToken: hashOpaqueToken(rawToken),
      },
      select: {
        id: true,
        userId: true,
        expires: true,
        user: {
          select: sessionUserSelect,
        },
      },
    });

    if (!session || session.expires < new Date() || session.user.status !== "ACTIVE") {
      await clearSessionCookie();
      return getDemoSession();
    }

    return session;
  } catch (error) {
    if (!isInfrastructureUnavailableError(error) || !isDemoModeEnabled()) {
      throw error;
    }

    markDatabaseUnavailable();
    await clearSessionCookie();
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUserContextDto> {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

export async function requireUser(): Promise<ServerUserContextDto> {
  const demoUser = await getDemoServerUser();

  if (demoUser) {
    return demoUser;
  }

  const sessionUser = await requireSessionUser();

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id,
    },
    select: serverUserContextSelect,
  });

  if (!user || user.status !== "ACTIVE") {
    await clearSessionCookie();
    redirect("/login");
  }

  return toServerUserContext(user);
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
