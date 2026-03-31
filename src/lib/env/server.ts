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

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: optionalValue.pipe(z.string().url().optional()),
  AUTH_SECRET: optionalValue.pipe(z.string().min(32).optional()),
  DATABASE_URL: optionalValue,
  DIRECT_DATABASE_URL: optionalValue,
  DATA_ENCRYPTION_KEY: optionalValue.pipe(z.string().min(24).optional()),
  RESEND_API_KEY: optionalValue,
  RESEND_FROM_EMAIL: optionalValue.pipe(resendFromEmailSchema.optional()),
  CRON_SECRET: optionalValue.pipe(z.string().min(24).optional()),
  UPSTASH_REDIS_REST_URL: optionalValue.pipe(z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: optionalValue,
  STRIPE_SECRET_KEY: optionalValue,
  STRIPE_WEBHOOK_SECRET: optionalValue,
  STRIPE_PREMIUM_PRICE_ID: optionalValue,
  STRIPE_PRO_PRICE_ID: optionalValue,
  STRIPE_PORTAL_RETURN_PATH: optionalValue,
  HOST_ALLOWED_EMAILS: optionalValue,
  HOST_PANEL_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  HOST_SECONDARY_PASSWORD: optionalValue.pipe(z.string().min(8).optional()),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}
