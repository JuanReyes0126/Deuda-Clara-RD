import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import {
  clearDemoSession,
  getDemoSession,
  isDemoModeEnabled,
} from "@/lib/demo/session";
import {
  isDatabaseReachable,
  markDatabaseUnavailable,
} from "@/server/services/database-availability";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { hashOpaqueToken } from "@/server/auth/tokens";

const SESSION_COOKIE_NAME = "dc_session";
const SESSION_MAX_AGE_DAYS = 30;

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
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  const demoSession = await getDemoSession();

  if (demoSession) {
    await clearSessionCookie();
    await clearDemoSession();
    return;
  }

  if (isDemoModeEnabled() && !(await isDatabaseReachable())) {
    await clearSessionCookie();
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
  await clearDemoSession();
}

export async function getCurrentSession() {
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

  // Session state depends on the current request cookie and should not be memoized globally.
  try {
    const session = await prisma.session.findUnique({
      where: {
        sessionToken: hashOpaqueToken(rawToken),
      },
      include: {
        user: {
          include: {
            settings: true,
          },
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

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}
