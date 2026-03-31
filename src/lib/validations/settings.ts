import { z } from "zod";

export const onboardingSchema = z.object({
  monthlyDebtBudget: z
    .number()
    .min(0, "El presupuesto no puede ser negativo.")
    .max(10_000_000, "El presupuesto es demasiado alto."),
  preferredStrategy: z.enum(["SNOWBALL", "AVALANCHE", "HYBRID"]),
  emailRemindersEnabled: z.boolean(),
  notifyDueSoon: z.boolean(),
  notifyOverdue: z.boolean(),
  notifyMinimumRisk: z.boolean(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
