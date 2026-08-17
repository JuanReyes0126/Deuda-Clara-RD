import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getCsv } from "@/app/api/reports/export/csv/route";
import { GET as getPdf } from "@/app/api/reports/export/pdf/route";
import { GET as getSummary } from "@/app/api/reports/summary/route";
import { resolveFeatureAccess, type ResolvedFeatureAccess } from "@/lib/feature-access";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/membership/membership-access-service", () => ({
  getUserFeatureAccess: vi.fn(),
}));

vi.mock("@/server/reports/report-service", () => ({
  getDefaultReportRange: vi.fn(() => ({
    from: new Date("2026-03-01T00:00:00.000Z"),
    to: new Date("2026-03-31T23:59:59.999Z"),
  })),
  getReportSummary: vi.fn(),
  buildReportCsv: vi.fn(() => "header\nvalue"),
  buildReportPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
}));

describe("api/reports/export/csv", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna un CSV exportable", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );
    const { getReportSummary } = await import("@/server/reports/report-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      createAccess({
        requestedTier: "PRO",
        effectiveTier: "PRO",
        billingStatus: "ACTIVE",
        hasPaidAccess: true,
        isBase: false,
        isPremium: false,
        isPro: true,
        upgradeTargetTier: "NORMAL",
        upgradeTargetLabel: "Premium",
        maxActiveDebts: 40,
        canUseAdvancedSimulation: true,
        canSeeFullPlanComparison: true,
        canAccessPremiumOptimization: true,
        canUseAdvancedReminders: true,
        canReceiveAdvancedAlerts: true,
        canSeeExtendedInsights: true,
        canAccessProFollowup: true,
        canExportReports: true,
        maxReportRangeDays: 365,
        notificationHistoryLimit: 100,
        balanceHistoryPoints: 12,
        recentPaymentsLimit: 12,
        riskAlertLimit: 5,
        dueSoonLimit: 6,
        upcomingTimelineLimit: 6,
        allowedReminderDays: [5, 2, 0],
      }),
    );
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

  it("bloquea la exportación para planes sin acceso Pro", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      createAccess({
        requestedTier: "NORMAL",
        effectiveTier: "NORMAL",
        billingStatus: "ACTIVE",
        hasPaidAccess: true,
        isBase: false,
        isPremium: true,
        isPro: false,
        upgradeTargetTier: "PRO",
        upgradeTargetLabel: "Pro",
        maxActiveDebts: 15,
        canUseAdvancedSimulation: true,
        canSeeFullPlanComparison: true,
        canAccessPremiumOptimization: true,
        canUseAdvancedReminders: true,
        canReceiveAdvancedAlerts: true,
        canSeeExtendedInsights: true,
        canAccessProFollowup: false,
        canExportReports: false,
        maxReportRangeDays: 90,
        notificationHistoryLimit: 40,
        balanceHistoryPoints: 8,
        recentPaymentsLimit: 8,
        riskAlertLimit: 3,
        dueSoonLimit: 4,
        upcomingTimelineLimit: 4,
        allowedReminderDays: [5, 2, 0],
      }),
    );

    const response = await getCsv(
      new NextRequest("http://localhost/api/reports/export/csv"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("La exportación de reportes está disponible en Pro.");
  });

  it("rechaza fechas inválidas con 400", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);

    const response = await getCsv(
      new NextRequest("http://localhost/api/reports/export/csv?from=no-es-fecha&to=2026-03-31"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Rango de fechas inválido.");
  });
});

describe("api/reports/summary", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("bloquea rangos más largos que el plan permitido", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      createAccess({
        requestedTier: "FREE",
        effectiveTier: "FREE",
        billingStatus: "FREE",
        hasPaidAccess: false,
        isBase: true,
        isPremium: false,
        isPro: false,
        upgradeTargetTier: "NORMAL",
        upgradeTargetLabel: "Premium",
        maxActiveDebts: 5,
        canUseAdvancedSimulation: false,
        canSeeFullPlanComparison: false,
        canAccessPremiumOptimization: false,
        canUseAdvancedReminders: false,
        canReceiveAdvancedAlerts: false,
        canSeeExtendedInsights: false,
        canAccessProFollowup: false,
        canExportReports: false,
        maxReportRangeDays: 31,
        notificationHistoryLimit: 12,
        balanceHistoryPoints: 4,
        recentPaymentsLimit: 4,
        riskAlertLimit: 1,
        dueSoonLimit: 2,
        upcomingTimelineLimit: 2,
        allowedReminderDays: [2, 0],
      }),
    );

    const response = await getSummary(
      new NextRequest(
        "http://localhost/api/reports/summary?from=2026-01-01&to=2026-04-01",
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Tu plan Base permite reportes de hasta 31 días.");
  });

  it("rechaza rangos invertidos con 400", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);

    const response = await getSummary(
      new NextRequest(
        "http://localhost/api/reports/summary?from=2026-04-10&to=2026-04-01",
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("La fecha inicial no puede ser mayor que la final.");
  });
});

describe("api/reports/export/pdf", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza fechas inválidas con 400", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);

    const response = await getPdf(
      new NextRequest("http://localhost/api/reports/export/pdf?from=2026-03-01&to=fecha-mala"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Rango de fechas inválido.");
  });
});

function createAccess(
  access: Partial<Omit<ResolvedFeatureAccess, "featureBullets">> &
    Pick<ResolvedFeatureAccess, "requestedTier" | "billingStatus">,
): ResolvedFeatureAccess {
  const base = resolveFeatureAccess({
    membershipTier: access.requestedTier,
    membershipBillingStatus: access.billingStatus,
  });

  return {
    ...base,
    ...access,
    featureBullets: [],
  };
}
