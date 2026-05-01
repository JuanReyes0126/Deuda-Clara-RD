import { describe, expect, it } from "vitest";

import { debtSchema } from "@/lib/validations/debts";

describe("debtSchema", () => {
  it("aplica defaults seguros para tasa y pago fijos cuando no se envían", () => {
    const result = debtSchema.safeParse({
      name: "Tarjeta principal",
      creditorName: "Banreservas",
      type: "CREDIT_CARD",
      status: "CURRENT",
      currency: "DOP",
      currentBalance: 50_000,
      interestRate: 48,
      interestRateType: "ANNUAL",
      minimumPayment: 4_000,
      lateFeeAmount: 0,
      extraChargesAmount: 0,
      notificationsEnabled: true,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.interestRateMode).toBe("FIXED");
    expect(result.data.paymentAmountType).toBe("FIXED");
  });

  it("muestra un mensaje específico cuando un pago variable supera la deuda actual", () => {
    const result = debtSchema.safeParse({
      name: "Tarjeta variable",
      creditorName: "Banco Popular Dominicano",
      type: "CREDIT_CARD",
      status: "CURRENT",
      currency: "DOP",
      currentBalance: 10_000,
      interestRate: 48,
      interestRateType: "ANNUAL",
      interestRateMode: "VARIABLE",
      minimumPayment: 12_000,
      paymentAmountType: "VARIABLE",
      lateFeeAmount: 0,
      extraChargesAmount: 0,
      notificationsEnabled: true,
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.issues[0]?.message).toBe(
      "El pago de referencia no puede superar la deuda total actual.",
    );
  });
});
