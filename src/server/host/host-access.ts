import type { User, UserSettings } from "@prisma/client";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import {
  HOST_PANEL_GATE_COOKIE,
  HOST_PANEL_ROUTE,
  HOST_PANEL_UNLOCK_ROUTE,
  normalizeHostEmail,
  parseHostAllowedEmails,
} from "@/lib/host/panel";
import { getServerEnv } from "@/lib/env/server";
import { hashOpaqueToken } from "@/server/auth/tokens";
import { logServerWarn } from "@/server/observability/logger";

type SessionUser = User & { settings: UserSettings | null };

type HostAccessDecision =
  | { outcome: "LOGIN" }
  | { outcome: "NOT_FOUND"; reason: string; email?: string | null }
  | { outcome: "SECONDARY_REQUIRED"; user: SessionUser }
  | { outcome: "GRANTED"; user: SessionUser };

function getHostPanelConfig() {
  const env = getServerEnv();
  const allowedEmails = parseHostAllowedEmails(env.HOST_ALLOWED_EMAILS);
  const secondaryPasswordHash = env.HOST_SECONDARY_PASSWORD
    ? hashOpaqueToken(env.HOST_SECONDARY_PASSWORD)
    : null;

  return {
    enabled: env.HOST_PANEL_ENABLED,
    allowedEmails,
    secondaryPasswordHash,
    secondaryEnabled: Boolean(env.HOST_SECONDARY_PASSWORD),
  };
}

function hasAllowedRole(user: SessionUser) {
  return user.role === "ADMIN";
}

function hasAllowedEmail(user: SessionUser, allowedEmails: Set<string>) {
  if (!allowedEmails.size) {
    return false;
  }

  return allowedEmails.has(normalizeHostEmail(user.email));
}

function hasValidSecondaryGate({
  cookieValue,
  secondaryPasswordHash,
}: {
  cookieValue?: string | undefined;
  secondaryPasswordHash: string | null;
}) {
  if (!secondaryPasswordHash) {
    return true;
  }

  return cookieValue === secondaryPasswordHash;
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

  const store = await cookies();
  const gateCookie = store.get(HOST_PANEL_GATE_COOKIE)?.value;

  if (
    !hasValidSecondaryGate({
      cookieValue: gateCookie,
      secondaryPasswordHash: config.secondaryPasswordHash,
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

  if (!config.secondaryPasswordHash) {
    return;
  }

  const store = await cookies();
  const expires = new Date();
  expires.setHours(expires.getHours() + 12);

  store.set(HOST_PANEL_GATE_COOKIE, config.secondaryPasswordHash, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
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
    allowlistCount: config.allowedEmails.size,
    route: HOST_PANEL_ROUTE,
  };
}
