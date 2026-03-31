import type { User, UserSettings } from "@prisma/client";
import { cookies } from "next/headers";

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

type DemoSessionUser = User & { settings: UserSettings | null };

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

function buildDemoUser(profile: DemoProfile): DemoSessionUser {
  const now = new Date();

  return {
    id: DEMO_USER_ID,
    email: profile.email,
    passwordHash: "demo-mode",
    firstName: profile.firstName,
    lastName: profile.lastName,
    role: "USER",
    status: "ACTIVE",
    locale: "es-DO",
    timezone: "America/Santo_Domingo",
    emailVerifiedAt: now,
    onboardingCompleted: true,
    lastLoginAt: now,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    settings: {
      id: "demo-user-settings",
      userId: DEMO_USER_ID,
      defaultCurrency: "DOP",
      preferredStrategy: "AVALANCHE",
      membershipTier: "NORMAL",
      membershipBillingStatus: "ACTIVE",
      membershipActivatedAt: now,
      membershipCurrentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
      membershipCancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      hybridRateWeight: 70,
      hybridBalanceWeight: 30,
      monthlyDebtBudget: null,
      notifyDueSoon: true,
      notifyOverdue: true,
      notifyMinimumRisk: true,
      notifyMonthlyReport: true,
      emailRemindersEnabled: true,
      upcomingDueDays: 3,
      language: "es",
      timezone: "America/Santo_Domingo",
      createdAt: now,
      updatedAt: now,
    },
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
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
    priority: "high",
  });
  store.set(DEMO_PROFILE_COOKIE_NAME, encodeDemoProfile(normalizedProfile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
    user: buildDemoUser(profile),
  };
}
