import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: vi.fn(),
}));

describe("api/health", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 cuando el entorno y la base estan listos", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getServerEnv } = await import("@/lib/env/server");

    vi.mocked(getServerEnv).mockReturnValue({
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/deuda_clara_rd?schema=public",
      DIRECT_DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/deuda_clara_rd?schema=public",
      DATA_ENCRYPTION_KEY: "b".repeat(32),
      HEALTHCHECK_SECRET: undefined,
      PASSKEY_RP_ID: undefined,
      PASSKEY_RP_NAME: undefined,
      PASSKEY_ALLOWED_ORIGINS: [],
      RESEND_API_KEY: "re_test",
      RESEND_FROM_EMAIL: "Deuda Clara RD <no-reply@deudaclarard.com>",
      CRON_SECRET: "c".repeat(24),
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      BILLING_PROVIDER: "AZUL",
      AZUL_PAYMENT_URL: "https://pagos.azul.test/PaymentPage",
      AZUL_MERCHANT_ID: "390000000000001",
      AZUL_MERCHANT_NAME: "Deuda Clara RD",
      AZUL_MERCHANT_TYPE: "ECommerce",
      AZUL_AUTH_KEY: "azul-auth-key",
      AZUL_CURRENCY_CODE: "USD",
      HOST_ALLOWED_EMAILS: "admin@deudaclarard.com",
      HOST_PANEL_ENABLED: true,
      HOST_SECONDARY_PASSWORD: "host-pass-123",
      HOST_SECONDARY_TOTP_SECRET: undefined,
      DEMO_MODE_ENABLED: false,
    });
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ ok: 1 }] as never);

    const response = await GET(new Request("http://localhost:3000/api/health"));
    const body = (await response.json()) as {
      ok: boolean;
      database: { ok: boolean };
      auth: { ready: boolean };
      environment: { billingMode: string; webhookReady: boolean; cronReady: boolean };
      hostPanel: { enabled: boolean; allowlistReady: boolean; secondaryEnabled: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.database.ok).toBe(true);
    expect(body.auth.ready).toBe(true);
    expect(body.environment.billingMode).toBe("azul");
    expect(body.environment.webhookReady).toBe(true);
    expect(body.environment.cronReady).toBe(true);
    expect(body.hostPanel.enabled).toBe(true);
    expect(body.hostPanel.allowlistReady).toBe(true);
    expect(body.hostPanel.secondaryEnabled).toBe(true);
  });

  it("retorna 503 cuando la base no responde", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    const { getServerEnv } = await import("@/lib/env/server");

    vi.mocked(getServerEnv).mockReturnValue({
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "a".repeat(32),
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/deuda_clara_rd?schema=public",
      DIRECT_DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/deuda_clara_rd?schema=public",
      DATA_ENCRYPTION_KEY: "b".repeat(32),
      HEALTHCHECK_SECRET: undefined,
      PASSKEY_RP_ID: undefined,
      PASSKEY_RP_NAME: undefined,
      PASSKEY_ALLOWED_ORIGINS: [],
      RESEND_API_KEY: undefined,
      RESEND_FROM_EMAIL: undefined,
      CRON_SECRET: "c".repeat(24),
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      BILLING_PROVIDER: "AZUL",
      AZUL_PAYMENT_URL: undefined,
      AZUL_MERCHANT_ID: undefined,
      AZUL_MERCHANT_NAME: undefined,
      AZUL_MERCHANT_TYPE: undefined,
      AZUL_AUTH_KEY: undefined,
      AZUL_CURRENCY_CODE: undefined,
      HOST_ALLOWED_EMAILS: undefined,
      HOST_PANEL_ENABLED: false,
      HOST_SECONDARY_PASSWORD: undefined,
      HOST_SECONDARY_TOTP_SECRET: undefined,
      DEMO_MODE_ENABLED: false,
    });
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error("db down"));

    const response = await GET(new Request("http://localhost:3000/api/health"));
    const body = (await response.json()) as {
      ok: boolean;
      database: { ok: boolean; message: string };
    };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.database.ok).toBe(false);
    expect(body.database.message).toContain("PostgreSQL");
  });
});
