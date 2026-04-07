import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env/server";
import { shouldUseSecureCookies } from "@/lib/security/cookie-options";
import { ServiceError } from "@/server/services/service-error";

export const RECENT_AUTH_COOKIE_NAME = "dc_reauth";
export const RECENT_AUTH_MAX_AGE_SECONDS = 15 * 60;

function getRecentAuthSecret() {
  const env = getServerEnv();
  const secret = env.AUTH_SECRET ?? env.DATA_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("AUTH_SECRET or DATA_ENCRYPTION_KEY is required for recent auth.");
  }

  return secret;
}

function signRecentAuthPayload(payload: string) {
  return createHmac("sha256", getRecentAuthSecret())
    .update(payload)
    .digest("base64url");
}

function buildRecentAuthToken(userId: string, expiresAt: number) {
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${signRecentAuthPayload(payload)}`;
}

function parseRecentAuthToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [userId, expiresAtRaw, signature] = token.split(".");

  if (!userId || !expiresAtRaw || !signature) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const expectedSignature = signRecentAuthPayload(`${userId}.${expiresAt}`);
  const expectedBuffer = Buffer.from(expectedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  return { userId, expiresAt };
}

export async function refreshRecentAuth(userId: string) {
  const store = await cookies();
  const expiresAt = Date.now() + RECENT_AUTH_MAX_AGE_SECONDS * 1000;

  store.set(RECENT_AUTH_COOKIE_NAME, buildRecentAuthToken(userId, expiresAt), {
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookies(),
    expires: new Date(expiresAt),
    path: "/",
    priority: "high",
  });
}

export async function clearRecentAuth() {
  const store = await cookies();
  store.delete(RECENT_AUTH_COOKIE_NAME);
}

export async function hasRecentAuth(userId: string) {
  const store = await cookies();
  const token = store.get(RECENT_AUTH_COOKIE_NAME)?.value;
  const parsed = parseRecentAuthToken(token);

  return parsed?.userId === userId;
}

export async function assertRecentAuth(userId: string) {
  if (!(await hasRecentAuth(userId))) {
    throw new ServiceError(
      "REAUTH_REQUIRED",
      403,
      "Confirma tu identidad para continuar.",
    );
  }
}
