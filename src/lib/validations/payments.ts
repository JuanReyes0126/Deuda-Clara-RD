import { PaymentSource } from "@prisma/client";
import { z } from "zod";

import {
  moneyInputSchema,
  normalizedTextSchema,
  optionalLongTextSchema,
  optionalMoneyInputSchema,
  requiredDateInputSchema,
} from "@/lib/validations/common";

export const paymentSchema = z
  .object({
    debtId: normalizedTextSchema(),
    amount: moneyInputSchema,
    principalAmount: optionalMoneyInputSchema,
    interestAmount: optionalMoneyInputSchema,
    lateFeeAmount: optionalMoneyInputSchema,
    extraChargesAmount: optionalMoneyInputSchema,
    paidAt: requiredDateInputSchema,
    notes: optionalLongTextSchema(),
    source: z.nativeEnum(PaymentSource).default(PaymentSource.MANUAL),
  })
  .superRefine((value, context) => {
    const splitTotal =
      (value.principalAmount ?? 0) +
      (value.interestAmount ?? 0) +
      (value.lateFeeAmount ?? 0) +
      (value.extraChargesAmount ?? 0);

    if (splitTotal > value.amount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "El desglose no puede superar el monto total del pago.",
      });
    }
  });

export type PaymentInput = z.infer<typeof paymentSchema>;
