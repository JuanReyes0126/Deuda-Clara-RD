import { z } from "zod";
import { ONBOARDING_MAX_DEBTS } from "@/config/onboarding";
import { moneyInputSchema } from "@/lib/validations/common";

const moneyField = z
  .number()
  .finite("Debes introducir un monto válido.")
  .positive("Debes introducir un monto mayor que cero.")
  .max(999_999_999, "El monto es demasiado alto.");

const onboardingDebtSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre de la deuda es obligatorio.")
    .max(80, "El nombre de la deuda es demasiado largo."),
  presetType: z.enum(["CREDIT_CARD", "PERSONAL_LOAN"]),
  currentBalance: moneyField,
  minimumPayment: moneyField,
  interestRate: z
    .number()
    .finite("La tasa debe ser un número válido.")
    .min(0, "La tasa no puede ser negativa.")
    .max(1000, "La tasa es demasiado alta.")
    .optional(),
});

export const onboardingSchema = z.object({
  monthlyIncome: moneyField,
  monthlyHousingCost: moneyInputSchema,
  monthlyGroceriesCost: moneyInputSchema,
  monthlyUtilitiesCost: moneyInputSchema,
  monthlyTransportCost: moneyInputSchema,
  monthlyOtherEssentialExpenses: moneyInputSchema,
  monthlyDebtBudget: moneyField,
  debts: z
    .array(onboardingDebtSchema)
    .min(1, "Debes registrar al menos una deuda.")
    .max(
      ONBOARDING_MAX_DEBTS,
      `Solo puedes registrar hasta ${ONBOARDING_MAX_DEBTS} deudas en este onboarding rápido.`,
    ),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
