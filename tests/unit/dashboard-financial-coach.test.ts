import { describe, expect, it } from "vitest";

import { buildDashboardFinancialCoach } from "@/server/dashboard/financial-coach";

describe("buildDashboardFinancialCoach", () => {
  it("prioriza una deuda atrasada cuando existe", () => {
    const result = buildDashboardFinancialCoach({
      analysisScope: {
        hiddenDebtCount: 0,
        partialAnalysis: false,
      },
      summary: {
        totalDebt: 150000,
        totalMinimumPayment: 12000,
        monthlyIncome: 90000,
        monthlyEssentialExpensesTotal: 50000,
        monthlyDebtCapacity: 40000,
        estimatedMonthlyInterest: 4200,
        recommendedDebtName: "Visa Oro",
        recommendedDebtId: "debt-1",
        interestSavings: 3000,
      },
      planComparison: null,
      habitSignals: {
        reviewPrompt: null,
        momentumMessage: "Buen movimiento.",
        microFeedback: "Sigue así.",
      },
      dueSoonDebts: [],
      urgentDebt: {
        id: "debt-1",
        name: "Visa Oro",
        creditorName: "Banreservas",
        type: "CREDIT_CARD",
        status: "LATE",
        currency: "DOP",
        currentBalance: 120000,
        creditLimit: 140000,
        effectiveBalance: 125000,
        interestRate: 4.2,
        interestRateType: "MONTHLY",
        interestRateMode: "VARIABLE",
        monthlyInterestEstimate: 3600,
        minimumPayment: 9500,
        paymentAmountType: "VARIABLE",
        statementDay: 8,
        dueDay: 25,
        nextDueDate: "2026-04-25T00:00:00.000Z",
        notificationsEnabled: true,
        lateFeeAmount: 2500,
        extraChargesAmount: 500,
        utilizationPct: 89,
        notes: null,
        startedAt: null,
        estimatedEndAt: null,
        paidOffAt: null,
        archivedAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        paymentCount: 2,
        totalPaid: 3000,
        lastPaymentAt: null,
        lastPaymentAmount: null,
      },
      riskAlerts: [{ title: "Pago mínimo riesgoso", description: "..." }],
      recentPayments: [],
    });

    expect(result.badgeVariant).toBe("danger");
    expect(result.primaryAction.href).toContain("/pagos?debtId=debt-1");
    expect(result.title).toContain("Visa Oro");
  });

  it("pide completar el perfil mensual si faltan ingresos o gastos", () => {
    const result = buildDashboardFinancialCoach({
      analysisScope: {
        hiddenDebtCount: 0,
        partialAnalysis: false,
      },
      summary: {
        totalDebt: 50000,
        totalMinimumPayment: 5000,
        monthlyIncome: null,
        monthlyEssentialExpensesTotal: null,
        monthlyDebtCapacity: null,
        estimatedMonthlyInterest: 1200,
        recommendedDebtName: null,
        recommendedDebtId: null,
        interestSavings: null,
      },
      planComparison: null,
      habitSignals: {
        reviewPrompt: null,
        momentumMessage: "Buen movimiento.",
        microFeedback: "Sigue así.",
      },
      dueSoonDebts: [],
      urgentDebt: null,
      riskAlerts: [],
      recentPayments: [],
    });

    expect(result.primaryAction.href).toBe("/configuracion?from=assistant");
    expect(result.title).toContain("flujo mensual");
  });

  it("pide registrar la primera deuda cuando todavía no hay panorama", () => {
    const result = buildDashboardFinancialCoach({
      analysisScope: {
        hiddenDebtCount: 0,
        partialAnalysis: false,
      },
      summary: {
        totalDebt: 0,
        totalMinimumPayment: 0,
        monthlyIncome: null,
        monthlyEssentialExpensesTotal: null,
        monthlyDebtCapacity: null,
        estimatedMonthlyInterest: 0,
        recommendedDebtName: null,
        recommendedDebtId: null,
        interestSavings: null,
      },
      planComparison: null,
      habitSignals: {
        reviewPrompt: null,
        momentumMessage: "Aún sin movimiento.",
        microFeedback: "Primero registra contexto.",
      },
      dueSoonDebts: [],
      urgentDebt: null,
      riskAlerts: [],
      recentPayments: [],
    });

    expect(result.primaryAction.href).toBe("/deudas?from=assistant");
    expect(result.title).toContain("panorama real");
  });
});
