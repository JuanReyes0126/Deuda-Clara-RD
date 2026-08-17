import { DebtStatus, InterestRateType } from "@prisma/client";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  deriveDebtStatus,
  getDebtMonthlyRate,
  getEffectiveDebtBalance,
  isMinimumPaymentRisk,
} from "@/server/finance/debt-helpers";

describe("debt-helpers", () => {
  it("convierte tasa anual a mensual", () => {
    const rate = getDebtMonthlyRate(48, InterestRateType.ANNUAL);

    expect(rate.toDecimalPlaces(4).toNumber()).toBe(0.04);
  });

  it("calcula el saldo efectivo incluyendo mora y cargos", () => {
    const effectiveBalance = getEffectiveDebtBalance({
      currentBalance: new Decimal(100_000),
      lateFeeAmount: new Decimal(1_500),
      extraChargesAmount: new Decimal(700),
    });

    expect(effectiveBalance.toNumber()).toBe(102_200);
  });

  it("marca deuda pagada cuando ya no queda saldo", () => {
    const status = deriveDebtStatus({
      currentBalance: new Decimal(0),
      lateFeeAmount: new Decimal(0),
      extraChargesAmount: new Decimal(0),
    });

    expect(status).toBe(DebtStatus.PAID);
  });

  it("detecta riesgo de pago minimo en tarjetas", () => {
    expect(
      isMinimumPaymentRisk({
        id: "debt-1",
        userId: "user-1",
        name: "Tarjeta",
        creditorName: "Banco",
        type: "CREDIT_CARD",
        status: "CURRENT",
        currency: "DOP",
        currentBalance: new Decimal(80_000),
        creditLimit: new Decimal(100_000),
        interestRate: new Decimal(48),
        interestRateType: "ANNUAL",
        minimumPayment: new Decimal(3_000),
        statementDay: 12,
        dueDay: 28,
        nextDueDate: new Date(),
        lateFeeAmount: new Decimal(0),
        extraChargesAmount: new Decimal(0),
        notes: null,
        startedAt: null,
        estimatedEndAt: null,
        paidOffAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe(true);
  });
});
