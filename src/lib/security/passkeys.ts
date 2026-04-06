import type { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getRequestOrigin } from "@/lib/http/request-origin";
import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/security/encryption";

type PasskeyChallengeKind = "authentication" | "registration";

type StoredPasskeyChallenge = {
  challenge: string;
  createdAt: string;
  kind: PasskeyChallengeKind;
  userId: string;
};

const PASSKEY_REGISTRATION_COOKIE = "dc_passkey_registration";
const PASSKEY_AUTHENTICATION_COOKIE = "dc_passkey_authentication";
const PASSKEY_CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

function getChallengeCookieName(kind: PasskeyChallengeKind) {
  return kind === "registration"
    ? PASSKEY_REGISTRATION_COOKIE
    : PASSKEY_AUTHENTICATION_COOKIE;
}

function getChallengeCookiePath(kind: PasskeyChallengeKind) {
  return kind === "registration"
    ? "/api/settings/passkeys"
    : "/api/auth/passkeys";
}

function normalizeOrigin(value: string) {
  return value.replace(/\/$/, "");
}

export function getPasskeyConfig(request: NextRequest) {
  const env = getServerEnv();
  const requestOrigin = normalizeOrigin(getRequestOrigin(request));
  const appUrl = env.APP_URL ? normalizeOrigin(env.APP_URL) : null;
  const configuredOrigins = (env.PASSKEY_ALLOWED_ORIGINS ?? []).map(normalizeOrigin);
  const fallbackOrigins = [requestOrigin, appUrl].filter(Boolean) as string[];
  const expectedOrigins = Array.from(
    new Set((configuredOrigins.length ? configuredOrigins : fallbackOrigins) as string[]),
  );
  const expectedRPIDs = Array.from(
    new Set([
      ...(env.PASSKEY_RP_ID ? [env.PASSKEY_RP_ID] : []),
      ...expectedOrigins.map((origin) => new URL(origin).hostname),
    ]),
  );

  return {
    expectedOrigins,
    expectedRPIDs,
    rpID: env.PASSKEY_RP_ID ?? expectedRPIDs[0] ?? request.nextUrl.hostname,
    rpName: env.PASSKEY_RP_NAME ?? "Deuda Clara RD",
  };
}

export function attachPasskeyChallengeCookie(
  response: NextResponse,
  kind: PasskeyChallengeKind,
  payload: Pick<StoredPasskeyChallenge, "challenge" | "userId">,
) {
  const value = encryptSensitiveText(
    JSON.stringify({
      ...payload,
      createdAt: new Date().toISOString(),
      kind,
    } satisfies StoredPasskeyChallenge),
  );

  if (!value) {
    return;
  }

  response.cookies.set(getChallengeCookieName(kind), value, {
    httpOnly: true,
    maxAge: PASSKEY_CHALLENGE_MAX_AGE_SECONDS,
    path: getChallengeCookiePath(kind),
    priority: "high",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearPasskeyChallengeCookie(
  response: NextResponse,
  kind: PasskeyChallengeKind,
) {
  response.cookies.set(getChallengeCookieName(kind), "", {
    expires: new Date(0),
    httpOnly: true,
    path: getChallengeCookiePath(kind),
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function readPasskeyChallengeCookie(
  request: NextRequest,
  kind: PasskeyChallengeKind,
) {
  const cookieValue = request.cookies.get(getChallengeCookieName(kind))?.value;

  if (!cookieValue) {
    return null;
  }

  const decrypted = decryptSensitiveText(cookieValue);

  if (!decrypted) {
    return null;
  }

  try {
    const parsed = JSON.parse(decrypted) as Partial<StoredPasskeyChallenge>;

    if (
      parsed.kind !== kind ||
      typeof parsed.challenge !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }

    const createdAt = Date.parse(parsed.createdAt);

    if (!Number.isFinite(createdAt)) {
      return null;
    }

    if (Date.now() - createdAt > PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 1000) {
      return null;
    }

    return {
      challenge: parsed.challenge,
      createdAt: parsed.createdAt,
      kind,
      userId: parsed.userId,
    } satisfies StoredPasskeyChallenge;
  } catch {
    return null;
  }
}
