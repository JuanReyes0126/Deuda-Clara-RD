import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env/server";
import { logServerError } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  let envStatus:
    | {
        ok: true;
        appUrl: string | null;
        authSecretReady: boolean;
        encryptionReady: boolean;
        emailReady: boolean;
        billingReady: boolean;
        billingMode: "test" | "live" | "not-configured";
        webhookReady: boolean;
        cronReady: boolean;
        hostPanelEnabled: boolean;
        hostAllowlistReady: boolean;
        hostSecondaryEnabled: boolean;
      }
    | {
        ok: false;
        message: string;
      };

  try {
    const env = getServerEnv();
    envStatus = {
      ok: true,
      appUrl: env.APP_URL ?? null,
      authSecretReady: Boolean(env.AUTH_SECRET),
      encryptionReady: Boolean(env.DATA_ENCRYPTION_KEY ?? env.AUTH_SECRET),
      emailReady: Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
      billingReady: Boolean(
        env.STRIPE_SECRET_KEY && env.STRIPE_PREMIUM_PRICE_ID && env.STRIPE_PRO_PRICE_ID,
      ),
      billingMode: !env.STRIPE_SECRET_KEY
        ? "not-configured"
        : env.STRIPE_SECRET_KEY.startsWith("sk_test_")
          ? "test"
          : "live",
      webhookReady: Boolean(env.STRIPE_WEBHOOK_SECRET),
      cronReady: Boolean(env.CRON_SECRET),
      hostPanelEnabled: env.HOST_PANEL_ENABLED,
      hostAllowlistReady: Boolean(env.HOST_ALLOWED_EMAILS),
      hostSecondaryEnabled: Boolean(env.HOST_SECONDARY_PASSWORD),
    };
  } catch (error) {
    logServerError("Healthcheck env validation failed", { error });
    envStatus = {
      ok: false,
      message: "La configuración de entorno no es válida.",
    };
  }

  let databaseStatus:
    | {
        ok: true;
        message: string;
      }
    | {
        ok: false;
        message: string;
      };

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    databaseStatus = {
      ok: true,
      message: "Conexión a PostgreSQL lista.",
    };
  } catch (error) {
    logServerError("Healthcheck database failed", { error });
    databaseStatus = {
      ok: false,
      message: "No se pudo conectar con PostgreSQL.",
    };
  }

  const authReady = envStatus.ok
    ? envStatus.authSecretReady && envStatus.encryptionReady && databaseStatus.ok
    : false;

  const payload = {
    ok: envStatus.ok && databaseStatus.ok && authReady,
    app: {
      status: "up",
      timestamp: new Date().toISOString(),
    },
    environment: envStatus,
    database: databaseStatus,
    auth: {
      ready: authReady,
      sessionCookie: "dc_session",
    },
    hostPanel: envStatus.ok
      ? {
          enabled: envStatus.hostPanelEnabled,
          allowlistReady: envStatus.hostAllowlistReady,
          secondaryEnabled: envStatus.hostSecondaryEnabled,
          route: "/host",
        }
      : {
          enabled: false,
          allowlistReady: false,
          secondaryEnabled: false,
          route: "/host",
        },
  };

  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
  });
}
