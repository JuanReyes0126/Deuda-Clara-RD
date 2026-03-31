import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getCsv } from "@/app/api/reports/export/csv/route";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/reports/report-service", () => ({
  getDefaultReportRange: vi.fn(() => ({
    from: new Date("2026-03-01T00:00:00.000Z"),
    to: new Date("2026-03-31T23:59:59.999Z"),
  })),
  getReportSummary: vi.fn(),
  buildReportCsv: vi.fn(() => "header\nvalue"),
}));

describe("api/reports/export/csv", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna un CSV exportable", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { getReportSummary } = await import("@/server/reports/report-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getReportSummary).mockResolvedValueOnce({
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-31T23:59:59.999Z",
      totalPaid: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
      totalFeesPaid: 0,
      paymentCount: 0,
      principalSharePct: 0,
      interestAndFeesSharePct: 0,
      progressSignal: "STARTING",
      coachingHeadline: "Todavía no hay movimiento en este período",
      coachingSummary: "Sin pagos registrados todavía no podemos leer avance.",
      recommendedNextStep: "Registra al menos un pago en este rango.",
      comparison: {
        signal: "NO_BASELINE",
        headline: "Todavía no hay suficiente historial para comparar",
        summary: "Cuando registres pagos en períodos consecutivos, aquí verás si el flujo mejora o empeora.",
        previousFrom: null,
        previousTo: null,
        previousPaymentCount: 0,
        previousPrincipalSharePct: null,
        previousTotalPaid: 0,
      },
      debtSummary: [],
      categorySummary: [],
    });

    const response = await getCsv(
      new NextRequest("http://localhost/api/reports/export/csv"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
  });
});
