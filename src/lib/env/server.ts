import { z } from "zod";

const resendFromEmailSchema = z
  .string()
  .refine((value) => {
    const trimmed = value.trim();
    const plainEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const namedEmailPattern = /^[^<>]+<\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*>$/;

    return plainEmailPattern.test(trimmed) || namedEmailPattern.test(trimmed);
  }, "Invalid sender email format");

const optionalValue = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || !value.trim()) {
      return undefined;
    }

    return value;
  });

const optionalUrlList = optionalValue.transform((value, ctx) => {
  if (!value) {
    return [] as string[];
  }

  const urls = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `PASSKEY_ALLOWED_ORIGINS contiene una URL inválida: ${url}`,
      });
    }
  }

  return urls;
});

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: optionalValue.pipe(z.string().url().optional()),
  AUTH_SECRET: optionalValue.pipe(z.string().min(32).optional()),
  DATABASE_URL: optionalValue,
  DIRECT_DATABASE_URL: optionalValue,
  DATA_ENCRYPTION_KEY: optionalValue.pipe(z.string().min(24).optional()),
  HEALTHCHECK_SECRET: optionalValue.pipe(z.string().min(24).optional()),
  PASSKEY_RP_ID: optionalValue.pipe(
    z
      .string()
      .min(1)
      .regex(/^[a-z0-9.-]+$/i, "PASSKEY_RP_ID debe ser un hostname válido.")
      .optional(),
  ),
  PASSKEY_RP_NAME: optionalValue.pipe(z.string().min(1).max(80).optional()),
  PASSKEY_ALLOWED_ORIGINS: optionalUrlList,
  RESEND_API_KEY: optionalValue,
  RESEND_FROM_EMAIL: optionalValue.pipe(resendFromEmailSchema.optional()),
  CRON_SECRET: optionalValue.pipe(z.string().min(24).optional()),
  UPSTASH_REDIS_REST_URL: optionalValue.pipe(z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalValue,
  BILLING_PROVIDER: z.enum(["AZUL"]).optional().default("AZUL"),
  AZUL_PAYMENT_URL: optionalValue.pipe(z.string().url().optional()),
  AZUL_MERCHANT_ID: optionalValue,
  AZUL_MERCHANT_NAME: optionalValue,
  AZUL_MERCHANT_TYPE: optionalValue,
  AZUL_AUTH_KEY: optionalValue,
  AZUL_CURRENCY_CODE: optionalValue,
  HOST_ALLOWED_EMAILS: optionalValue,
  HOST_PANEL_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  HOST_SECONDARY_PASSWORD: optionalValue.pipe(z.string().min(8).optional()),
  HOST_SECONDARY_TOTP_SECRET: optionalValue.pipe(
    z
      .string()
      .min(16)
      .regex(/^[A-Z2-7=\s]+$/i, "HOST_SECONDARY_TOTP_SECRET debe estar en Base32.")
      .optional(),
  ),
  DEMO_MODE_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const requiredInProduction: Array<keyof typeof env> = [
    "APP_URL",
    "AUTH_SECRET",
    "DATABASE_URL",
    "DATA_ENCRYPTION_KEY",
  ];

  requiredInProduction.forEach((key) => {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} es obligatorio en producción.`,
      });
    }
  });

  if (env.DEMO_MODE_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEMO_MODE_ENABLED"],
      message: "DEMO_MODE_ENABLED debe estar en false en producción.",
    });
  }

  if (env.HOST_PANEL_ENABLED && !env.HOST_ALLOWED_EMAILS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HOST_ALLOWED_EMAILS"],
      message: "HOST_ALLOWED_EMAILS es obligatorio cuando HOST_PANEL_ENABLED=true en producción.",
    });
  }

  if (
    env.HOST_PANEL_ENABLED &&
    !env.HOST_SECONDARY_TOTP_SECRET &&
    !env.HOST_SECONDARY_PASSWORD
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HOST_SECONDARY_TOTP_SECRET"],
      message:
        "HOST_SECONDARY_TOTP_SECRET o HOST_SECONDARY_PASSWORD es obligatorio cuando HOST_PANEL_ENABLED=true en producción.",
    });
  }
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}
