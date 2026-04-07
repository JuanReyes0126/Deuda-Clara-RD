import { cookies } from "next/headers";

import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  isDemoModeEnabled,
} from "@/lib/demo/session";
import { shouldUseSecureCookies } from "@/lib/security/cookie-options";
import type { RegisterInput } from "@/lib/validations/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { ServiceError } from "@/server/services/service-error";

const DEMO_ACCOUNTS_COOKIE_NAME = "dc_demo_accounts";

type DemoAccount = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

type DemoProfile = {
  firstName: string;
  lastName: string;
  email: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function encodeAccounts(accounts: DemoAccount[]) {
  return Buffer.from(JSON.stringify(accounts), "utf8").toString("base64url");
}

function decodeAccounts(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;

    return Array.isArray(parsed) ? (parsed as DemoAccount[]) : [];
  } catch {
    return [];
  }
}

async function getAccountStore() {
  const store = await cookies();
  return {
    store,
    accounts: decodeAccounts(store.get(DEMO_ACCOUNTS_COOKIE_NAME)?.value),
  };
}

async function persistAccounts(accounts: DemoAccount[]) {
  const store = await cookies();
  store.set(DEMO_ACCOUNTS_COOKIE_NAME, encodeAccounts(accounts), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    priority: "high",
  });
}

export function getDemoAuthHint() {
  return `La app está corriendo en modo demo. Usa ${DEMO_LOGIN_EMAIL} / ${DEMO_LOGIN_PASSWORD}, o entra con la cuenta local que acabas de crear en este navegador.`;
}

export async function authenticateDemoUser(input: {
  email: string;
  password: string;
}): Promise<DemoProfile | null> {
  if (!isDemoModeEnabled()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);

  if (
    normalizedEmail === DEMO_LOGIN_EMAIL &&
    input.password === DEMO_LOGIN_PASSWORD
  ) {
    return {
      firstName: "Cuenta",
      lastName: "demo",
      email: DEMO_LOGIN_EMAIL,
    };
  }

  const { accounts } = await getAccountStore();
  const account = accounts.find((item) => item.email === normalizedEmail);

  if (!account) {
    return null;
  }

  const passwordMatches = await verifyPassword(input.password, account.passwordHash);

  if (!passwordMatches) {
    return null;
  }

  return {
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  };
}

export async function registerDemoUser(input: RegisterInput): Promise<DemoProfile> {
  if (!isDemoModeEnabled()) {
    throw new ServiceError("DEMO_MODE_DISABLED", 503, "El modo demo no está disponible.");
  }

  const normalizedEmail = normalizeEmail(input.email);

  if (normalizedEmail === DEMO_LOGIN_EMAIL) {
    throw new ServiceError("EMAIL_IN_USE", 409, "Ya existe una cuenta con ese correo.");
  }

  const { accounts } = await getAccountStore();
  const existingAccount = accounts.find((item) => item.email === normalizedEmail);

  if (existingAccount) {
    throw new ServiceError("EMAIL_IN_USE", 409, "Ya existe una cuenta con ese correo.");
  }

  const passwordHash = await hashPassword(input.password);
  const account: DemoAccount = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await persistAccounts([...accounts, account]);

  return {
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  };
}
