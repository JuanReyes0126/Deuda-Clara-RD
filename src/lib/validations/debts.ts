import {
  CurrencyCode,
  DebtStatus,
  DebtType,
  InterestRateType,
  StrategyMethod,
} from "@prisma/client";
import { z } from "zod";

import {
  moneyInputSchema,
  normalizedTextSchema,
  optionalDateInputSchema,
  optionalIntegerDayInputSchema,
  optionalLongTextSchema,
  optionalMoneyInputSchema,
  percentageInputSchema,
} from "@/lib/validations/common";

export const debtSchema = z
  .object({
    name: normalizedTextSchema(120),
    creditorName: normalizedTextSchema(120),
    type: z.nativeEnum(DebtType),
    status: z.nativeEnum(DebtStatus),
    currency: z.nativeEnum(CurrencyCode).default(CurrencyCode.DOP),
    currentBalance: moneyInputSchema,
    creditLimit: optionalMoneyInputSchema,
    interestRate: percentageInputSchema,
    interestRateType: z.nativeEnum(InterestRateType),
    minimumPayment: moneyInputSchema,
    statementDay: optionalIntegerDayInputSchema,
    dueDay: optionalIntegerDayInputSchema,
    nextDueDate: optionalDateInputSchema,
    lateFeeAmount: moneyInputSchema.default(0),
    extraChargesAmount: moneyInputSchema.default(0),
    notes: optionalLongTextSchema(),
    startedAt: optionalDateInputSchema,
    estimatedEndAt: optionalDateInputSchema,
  })
  .superRefine((value, context) => {
    if (value.creditLimit !== undefined && value.type !== DebtType.CREDIT_CARD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["creditLimit"],
        message: "El límite de crédito solo aplica a tarjetas.",
      });
    }

    if (value.statementDay !== undefined && value.type !== DebtType.CREDIT_CARD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statementDay"],
        message: "La fecha de corte solo aplica a tarjetas.",
      });
    }

    if (value.minimumPayment > value.currentBalance + value.lateFeeAmount + value.extraChargesAmount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimumPayment"],
        message: "El pago mínimo no puede superar la deuda total actual.",
      });
    }

    if (
      value.creditLimit !== undefined &&
      value.creditLimit > 0 &&
      value.currentBalance > value.creditLimit * 1.5
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentBalance"],
        message: "El saldo parece inconsistente con el límite de crédito.",
      });
    }

    if (
      value.startedAt &&
      value.estimatedEndAt &&
      value.estimatedEndAt < value.startedAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimatedEndAt"],
        message: "La fecha estimada de término no puede ser anterior al inicio.",
      });
    }
  });

export const debtArchiveSchema = z.object({
  archive: z.boolean(),
});

export const debtIdSchema = z.object({
  debtId: normalizedTextSchema(),
});

export const strategyPreferenceSchema = z.object({
  preferredStrategy: z.nativeEnum(StrategyMethod),
});

export type DebtInput = z.infer<typeof debtSchema>;
