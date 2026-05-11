import { StrategyMethod } from "@prisma/client";
import { z } from "zod";

import { DEFAULT_REMINDER_DAYS, REMINDER_DAY_OPTIONS } from "@/config/reminders";
import {
  moneyInputSchema,
  normalizedTextSchema,
  optionalNormalizedTextSchema,
} from "@/lib/validations/common";

export const profileSchema = z.object({
  firstName: normalizedTextSchema(80),
  lastName: normalizedTextSchema(80),
  avatarUrl: optionalNormalizedTextSchema(500).pipe(z.string().url().optional()),
});

export const preferencesSchema = z
  .object({
    defaultCurrency: z.enum(["DOP", "USD"]),
    preferredStrategy: z.nativeEnum(StrategyMethod),
    hybridRateWeight: z
      .number()
      .int()
      .min(0, "Debe ser un porcentaje válido.")
      .max(100, "Debe ser un porcentaje válido."),
    hybridBalanceWeight: z
      .number()
      .int()
      .min(0, "Debe ser un porcentaje válido.")
      .max(100, "Debe ser un porcentaje válido."),
    monthlyIncome: moneyInputSchema,
    monthlyHousingCost: moneyInputSchema,
    monthlyGroceriesCost: moneyInputSchema,
    monthlyUtilitiesCost: moneyInputSchema,
    monthlyTransportCost: moneyInputSchema,
    monthlyOtherEssentialExpenses: moneyInputSchema,
    monthlyDebtBudget: moneyInputSchema,
    notifyDueSoon: z.boolean(),
    notifyOverdue: z.boolean(),
    notifyMinimumRisk: z.boolean(),
    notifyMonthlyReport: z.boolean(),
    emailRemindersEnabled: z.boolean(),
    preferredReminderDays: z
      .array(
        z
          .number()
          .int()
          .refine(
            (value) => REMINDER_DAY_OPTIONS.some((option) => option.value === value),
            "Debes elegir una opción de recordatorio válida.",
          ),
      )
      .min(1, "Debes elegir al menos un recordatorio.")
      .default([...DEFAULT_REMINDER_DAYS]),
    preferredReminderHour: z
      .number()
      .int()
      .min(0, "La hora debe estar entre 0 y 23.")
      .max(23, "La hora debe estar entre 0 y 23."),
    upcomingDueDays: z
      .number()
      .int()
      .min(1, "Debes elegir al menos 1 día.")
      .max(30, "El valor máximo es 30 días."),
    timezone: normalizedTextSchema(80),
    language: z.enum(["es", "en"]),
  })
  .superRefine((value, context) => {
    if (value.hybridRateWeight + value.hybridBalanceWeight !== 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hybridBalanceWeight"],
        message: "Los pesos del modo híbrido deben sumar 100.",
      });
    }
  });

export type PreferencesInput = z.infer<typeof preferencesSchema>;
