import { z } from "zod";

export const checkoutSourceContextSchema = z.enum([
  "simulador",
  "dashboard",
  "reportes",
  "notificaciones",
  "planes",
]);

export const checkoutPlanSchema = z.object({
  membershipTier: z.enum(["NORMAL", "PRO"]),
  sourceContext: checkoutSourceContextSchema.optional(),
});

export type CheckoutPlanInput = z.infer<typeof checkoutPlanSchema>;
export type CheckoutSourceContext = z.infer<typeof checkoutSourceContextSchema>;
