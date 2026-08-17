import { z } from "zod";

export const checkoutSourceContextSchema = z.enum([
  "simulador",
  "dashboard",
  "reportes",
  "notificaciones",
  "planes",
]);

export const billingIntervalSchema = z.enum(["monthly", "annual"]).default("monthly");

export const checkoutPlanSchema = z.object({
  membershipTier: z.enum(["NORMAL", "PRO"]),
  billingInterval: billingIntervalSchema,
  sourceContext: checkoutSourceContextSchema.optional(),
});

export type CheckoutPlanInput = z.infer<typeof checkoutPlanSchema>;
export type CheckoutBillingIntervalInput = z.infer<typeof billingIntervalSchema>;
export type CheckoutSourceContext = z.infer<typeof checkoutSourceContextSchema>;
