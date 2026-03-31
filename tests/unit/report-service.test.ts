import { describe, expect, it } from "vitest";

import { buildReportComparison, buildReportInsights } from "@/server/reports/report-service";

describe("report-service insights", () => {
  it("marca como starting cuando no hay pagos", () => {
    const result = buildReportInsights({
      paymentCount: 0,
      totalPaid: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
      totalFeesPaid: 0,
      topDebtName: null,
      topCategoryName: null,
    });

    expect(result.progressSignal).toBe("STARTING");
    expect(result.coachingHeadline).toContain("Todavía no hay movimiento");
  });

  it("marca como watch cuando intereses y cargos superan principal", () => {
    const result = buildReportInsights({
      paymentCount: 3,
      totalPaid: 10000,
      totalPrincipalPaid: 4000,
      totalInterestPaid: 5500,
      totalFeesPaid: 500,
      topDebtName: "Tarjeta principal",
      topCategoryName: "CREDIT_CARD",
    });

    expect(result.progressSignal).toBe("WATCH");
    expect(result.coachingHeadline).toContain("intereses y cargos");
    expect(result.recommendedNextStep).toContain("Tarjeta principal");
  });

  it("marca como strong cuando la mayor parte del flujo reduce capital", () => {
    const result = buildReportInsights({
      paymentCount: 4,
      totalPaid: 20000,
      totalPrincipalPaid: 16000,
      totalInterestPaid: 3500,
      totalFeesPaid: 500,
      topDebtName: "Préstamo personal",
      topCategoryName: "PERSONAL_LOAN",
    });

    expect(result.progressSignal).toBe("STRONG");
    expect(result.principalSharePct).toBe(80);
    expect(result.coachingHeadline).toContain("reduciendo capital");
  });

  it("detecta mejora frente al periodo anterior", () => {
    const result = buildReportComparison({
      current: {
        paymentCount: 3,
        totalPaid: 20000,
        principalSharePct: 72,
        interestAndFeesSharePct: 28,
      },
      previous: {
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-02-28T23:59:59.999Z"),
        paymentCount: 2,
        totalPaid: 15000,
        principalSharePct: 55,
        interestAndFeesSharePct: 45,
      },
    });

    expect(result.signal).toBe("IMPROVING");
    expect(result.headline).toContain("mejor");
  });

  it("detecta retroceso frente al periodo anterior", () => {
    const result = buildReportComparison({
      current: {
        paymentCount: 1,
        totalPaid: 8000,
        principalSharePct: 38,
        interestAndFeesSharePct: 62,
      },
      previous: {
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-02-28T23:59:59.999Z"),
        paymentCount: 2,
        totalPaid: 15000,
        principalSharePct: 58,
        interestAndFeesSharePct: 42,
      },
    });

    expect(result.signal).toBe("REGRESSION");
    expect(result.summary).toContain("58%");
  });
});
