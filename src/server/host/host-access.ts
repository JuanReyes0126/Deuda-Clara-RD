import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { SessionUserContextDto } from "@/lib/auth/session-context";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  HOST_PANEL_GATE_COOKIE,
  HOST_PANEL_ROUTE,
  HOST_PANEL_UNLOCK_ROUTE,
  normalizeHostEmail,
  parseHostAllowedEmails,
} from "@/lib/host/panel";
import { getServerEnv } from "@/lib/env/server";
import { shouldUseSecureCookies } from "@/lib/security/cookie-options";
import { verifyTotpCode } from "@/lib/security/totp";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { logServerWarn } from "@/server/observability/logger";

type HostAccessDecision =
  | { outcome: "LOGIN" }
  | { outcome: "NOT_FOUND"; reason: string; email?: string | null }
  | { outcome: "MFA_SETUP_REQUIRED"; user: SessionUserContextDto }
  | { outcome: "SECONDARY_REQUIRED"; user: SessionUserContextDto }
  | { outcome: "GRANTED"; user: SessionUserContextDto };

const ADMIN_MFA_REQUIRED_REDIRECT = "/configuracion?security=admin-mfa-required";

function getHostPanelConfig() {
  const env = getServerEnv();
  const allowedEmails = parseHostAllowedEmails(env.HOST_ALLOWED_EMAILS);
  const secondaryTotpSecret = env.HOST_SECONDARY_TOTP_SECRET ?? null;
  const secondaryPasswordHash = env.HOST_SECONDARY_PASSWORD
    ? hashOpaqueToken(env.HOST_SECONDARY_PASSWORD)
    : null;
  const secondaryGateTokenHash = secondaryTotpSecret
    ? hashOpaqueToken(secondaryTotpSecret)
    : secondaryPasswordHash;

  return {
    enabled: env.HOST_PANEL_ENABLED,
    allowedEmails,
    secondaryGateTokenHash,
    secondaryPasswordHash,
    secondaryTotpSecret,
    secondaryMode: secondaryTotpSecret ? ("TOTP" as const) : ("PASSWORD" as const),
    secondaryEnabled: Boolean(secondaryTotpSecret ?? env.HOST_SECONDARY_PASSWORD),
  };
}

function hasAllowedRole(user: SessionUserContextDto) {
  return user.role === "ADMIN";
}

function hasAllowedEmail(user: SessionUserContextDto, allowedEmails: Set<string>) {
  if (!allowedEmails.size) {
    return false;
  }

  return allowedEmails.has(normalizeHostEmail(user.email));
}

function hasValidSecondaryGate({
  cookieValue,
  secondaryGateTokenHash,
}: {
  cookieValue?: string | undefined;
  secondaryGateTokenHash: string | null;
}) {
  if (!secondaryGateTokenHash) {
    return true;
  }

  return cookieValue === secondaryGateTokenHash;
}

async function hasRequiredAdminMfa(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      mfaTotpEnabled: true,
    },
  });

  return Boolean(settings?.mfaTotpEnabled);
}

export async function evaluateHostPanelAccess(options?: {
  allowMissingSecondary?: boolean;
}) {
  const config = getHostPanelConfig();

  if (!config.enabled) {
    return {
      outcome: "NOT_FOUND",
      reason: "panel_disabled",
      email: null,
    } satisfies HostAccessDecision;
  }

  const session = await getCurrentSession();

  if (!session) {
    return { outcome: "LOGIN" } satisfies HostAccessDecision;
  }

  if (!hasAllowedRole(session.user)) {
    return {
      outcome: "NOT_FOUND",
      reason: "role_not_allowed",
      email: session.user.email,
    } satisfies HostAccessDecision;
  }

  if (!hasAllowedEmail(session.user, config.allowedEmails)) {
    return {
      outcome: "NOT_FOUND",
      reason: "email_not_allowlisted",
      email: session.user.email,
    } satisfies HostAccessDecision;
  }

  if (!(await hasRequiredAdminMfa(session.user.id))) {
    return {
      outcome: "MFA_SETUP_REQUIRED",
      user: session.user,
    } satisfies HostAccessDecision;
  }

  const store = await cookies();
  const gateCookie = store.get(HOST_PANEL_GATE_COOKIE)?.value;

  if (
    !hasValidSecondaryGate({
      cookieValue: gateCookie,
      secondaryGateTokenHash: config.secondaryGateTokenHash,
    })
  ) {
    if (options?.allowMissingSecondary) {
      return {
        outcome: "GRANTED",
        user: session.user,
      } satisfies HostAccessDecision;
    }

    return {
      outcome: "SECONDARY_REQUIRED",
      user: session.user,
    } satisfies HostAccessDecision;
  }

  return {
    outcome: "GRANTED",
    user: session.user,
  } satisfies HostAccessDecision;
}

export async function requireHostPanelUser(options?: {
  allowMissingSecondary?: boolean;
}) {
  const decision = await evaluateHostPanelAccess(options);

  if (decision.outcome === "LOGIN") {
    redirect("/login");
  }

  if (decision.outcome === "SECONDARY_REQUIRED") {
    redirect(HOST_PANEL_UNLOCK_ROUTE);
  }

  if (decision.outcome === "MFA_SETUP_REQUIRED") {
    redirect(ADMIN_MFA_REQUIRED_REDIRECT);
  }

  if (decision.outcome === "NOT_FOUND") {
    logServerWarn("Host panel access blocked", {
      reason: decision.reason,
      email: decision.email ?? null,
    });
    notFound();
  }

  return decision.user;
}

export async function assertHostPanelApiAccess(options?: {
  allowMissingSecondary?: boolean;
}) {
  const decision = await evaluateHostPanelAccess(options);

  if (decision.outcome === "NOT_FOUND") {
    logServerWarn("Host panel API access blocked", {
      reason: decision.reason,
      email: decision.email ?? null,
    });
  }

  return decision;
}

export async function setHostPanelGateCookie() {
  const config = getHostPanelConfig();

  if (!config.secondaryGateTokenHash) {
    return;
  }

  const store = await cookies();
  const expires = new Date();
  expires.setHours(expires.getHours() + 12);

  store.set(HOST_PANEL_GATE_COOKIE, config.secondaryGateTokenHash, {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookies(),
    expires,
    path: "/",
    priority: "high",
  });
}

export async function clearHostPanelGateCookie() {
  const store = await cookies();
  store.delete(HOST_PANEL_GATE_COOKIE);
}

export async function verifyHostSecondaryPassword(password: string) {
  const config = getHostPanelConfig();

  if (config.secondaryTotpSecret) {
    return verifyTotpCode(config.secondaryTotpSecret, password);
  }

  if (!config.secondaryPasswordHash) {
    return true;
  }

  return hashOpaqueToken(password) === config.secondaryPasswordHash;
}

export function getHostPanelRuntimeConfig() {
  const config = getHostPanelConfig();

  return {
    enabled: config.enabled,
    secondaryEnabled: config.secondaryEnabled,
    secondaryMode: config.secondaryMode,
    allowlistCount: config.allowedEmails.size,
    route: HOST_PANEL_ROUTE,
  };
}

export { ADMIN_MFA_REQUIRED_REDIRECT };
