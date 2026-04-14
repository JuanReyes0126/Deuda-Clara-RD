import { cookies } from "next/headers";

import type {
  CurrentSessionDto,
  ServerUserContextDto,
  ServerUserSettingsContextDto,
  SessionUserContextDto,
} from "@/lib/auth/session-context";
import { shouldUseSecureCookies } from "@/lib/security/cookie-options";

export const DEMO_SESSION_COOKIE_NAME = "dc_demo_session";
export const DEMO_PROFILE_COOKIE_NAME = "dc_demo_profile";
export const DEMO_USER_ID = "demo-review-user";
export const DEMO_LOGIN_EMAIL = "demo@deudaclarard.com";
export const DEMO_LOGIN_PASSWORD = "DeudaClara123!";

type DemoProfile = {
  firstName: string;
  lastName: string;
  email: string;
};

const DEMO_SESSION_DAYS = 7;

function buildDemoExpiration() {
  const expires = new Date();
  expires.setDate(expires.getDate() + DEMO_SESSION_DAYS);
  return expires;
}

function encodeDemoProfile(profile: DemoProfile) {
  return Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
}

function decodeDemoProfile(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<DemoProfile>;

    if (
      typeof parsed.firstName !== "string" ||
      typeof parsed.lastName !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }

    return {
      firstName: parsed.firstName.trim() || "Cuenta",
      lastName: parsed.lastName.trim() || "demo",
      email: parsed.email.trim().toLowerCase() || DEMO_LOGIN_EMAIL,
    } satisfies DemoProfile;
  } catch {
    return null;
  }
}

function buildDemoSettings(now: Date): ServerUserSettingsContextDto {
  return {
    defaultCurrency: "DOP",
    preferredStrategy: "AVALANCHE",
    membershipTier: "NORMAL",
    membershipBillingStatus: "ACTIVE",
    membershipCurrentPeriodEnd: new Date(
      now.getTime() + 1000 * 60 * 60 * 24 * 30,
    ).toISOString(),
    membershipCancelAtPeriodEnd: false,
    hybridRateWeight: 70,
    hybridBalanceWeight: 30,
    monthlyIncome: null,
    monthlyHousingCost: null,
    monthlyGroceriesCost: null,
    monthlyUtilitiesCost: null,
    monthlyTransportCost: null,
    monthlyOtherEssentialExpenses: null,
    monthlyEssentialExpensesTotal: null,
    monthlyDebtCapacity: null,
    monthlyDebtBudget: null,
    notifyDueSoon: true,
    notifyOverdue: true,
    notifyMinimumRisk: true,
    notifyMonthlyReport: true,
    emailRemindersEnabled: true,
    preferredReminderDays: [5, 2, 0],
    preferredReminderHour: 8,
    mfaTotpEnabled: false,
    mfaRecoveryCodesRemaining: 0,
    upcomingDueDays: 3,
    language: "es",
    timezone: "America/Santo_Domingo",
  };
}

function buildDemoSessionUser(profile: DemoProfile): SessionUserContextDto {
  return {
    id: DEMO_USER_ID,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    avatarUrl: null,
    role: "USER",
    status: "ACTIVE",
    timezone: "America/Santo_Domingo",
    onboardingCompleted: true,
  };
}

function buildDemoServerUser(profile: DemoProfile): ServerUserContextDto {
  const now = new Date();

  return {
    ...buildDemoSessionUser(profile),
    settings: buildDemoSettings(now),
  };
}

export function isDemoModeEnabled() {
  return process.env.DEMO_MODE_ENABLED === "true";
}

export function isDemoSessionUser(user: { id: string }) {
  return user.id === DEMO_USER_ID;
}

export function getDemoLoginCredentials() {
  return {
    email: DEMO_LOGIN_EMAIL,
    password: DEMO_LOGIN_PASSWORD,
  };
}

export async function createDemoSession(profile?: Partial<DemoProfile>) {
  if (!isDemoModeEnabled()) {
    return false;
  }

  const store = await cookies();
  const expires = buildDemoExpiration();
  const normalizedProfile = {
    firstName: profile?.firstName?.trim() || "Cuenta",
    lastName: profile?.lastName?.trim() || "demo",
    email: profile?.email?.trim().toLowerCase() || DEMO_LOGIN_EMAIL,
  } satisfies DemoProfile;

  store.set(DEMO_SESSION_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    expires,
    path: "/",
    priority: "high",
  });
  store.set(DEMO_PROFILE_COOKIE_NAME, encodeDemoProfile(normalizedProfile), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    expires,
    path: "/",
    priority: "high",
  });

  return true;
}

export async function clearDemoSession() {
  const store = await cookies();
  store.delete(DEMO_SESSION_COOKIE_NAME);
  store.delete(DEMO_PROFILE_COOKIE_NAME);
}

export async function getDemoSession() {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const store = await cookies();
  const enabled = store.get(DEMO_SESSION_COOKIE_NAME)?.value === "1";

  if (!enabled) {
    return null;
  }

  const profile =
    decodeDemoProfile(store.get(DEMO_PROFILE_COOKIE_NAME)?.value) ?? {
      firstName: "Cuenta",
      lastName: "demo",
      email: DEMO_LOGIN_EMAIL,
    };

  return {
    id: "demo-session",
    userId: DEMO_USER_ID,
    sessionToken: "demo-session-token",
    expires: buildDemoExpiration(),
    user: buildDemoSessionUser(profile),
  } satisfies CurrentSessionDto & { sessionToken: string };
}

export async function getDemoServerUser() {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const store = await cookies();
  const enabled = store.get(DEMO_SESSION_COOKIE_NAME)?.value === "1";

  if (!enabled) {
    return null;
  }

  const profile =
    decodeDemoProfile(store.get(DEMO_PROFILE_COOKIE_NAME)?.value) ?? {
      firstName: "Cuenta",
      lastName: "demo",
      email: DEMO_LOGIN_EMAIL,
    };

  return buildDemoServerUser(profile);
}
