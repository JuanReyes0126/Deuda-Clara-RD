import { StrategyMethod } from "@prisma/client";
import { z } from "zod";

import {
  moneyInputSchema,
  normalizedTextSchema,
  optionalMoneyInputSchema,
  percentageInputSchema,
  requiredDateInputSchema,
} from "@/lib/validations/common";

export const simulatorSchema = z.object({
  strategy: z.nativeEnum(StrategyMethod),
  monthlyBudget: moneyInputSchema,
  extraMonthlyPayment: optionalMoneyInputSchema,
  focusedDebtId: z.string().trim().optional(),
  cardToFreezeId: z.string().trim().optional(),
  monthlyCardUsageToStop: optionalMoneyInputSchema,
  refinanceDebtId: z.string().trim().optional(),
  refinancedRate: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      return Number(value);
    }

    return value;
  }, percentageInputSchema.optional()),
  refinancedMinimumPayment: optionalMoneyInputSchema,
});

export const notificationReadSchema = z.object({
  notificationId: normalizedTextSchema(),
});

export const debtSimulatorFormSchema = z.object({
  debtType: z.enum(["CREDIT_CARD", "PERSONAL_LOAN", "FIXED_NO_INTEREST"]),
  principal: moneyInputSchema.refine((value) => value > 0, {
    message: "El monto de la deuda debe ser mayor que cero.",
  }),
  interestRate: percentageInputSchema.refine((value) => value >= 0, {
    message: "La tasa no puede ser negativa.",
  }),
  interestRateType: z.enum(["ANNUAL", "MONTHLY"]),
  paymentAmount: moneyInputSchema.refine((value) => value > 0, {
    message: "Debes introducir un pago mayor que cero.",
  }),
  extraPayment: optionalMoneyInputSchema,
  startDate: requiredDateInputSchema,
  paymentFrequency: z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY"]),
});

export type SimulatorInput = z.infer<typeof simulatorSchema>;
export type DebtSimulatorFormInput = z.infer<typeof debtSimulatorFormSchema>;
