import { describe, expect, it } from "vitest";

import {
  canAddMoreDebts,
  canAccessUnlimitedDebts,
  canReceiveSmartAlerts,
  canUseFullSimulator,
  getMaxDebts,
  PLAN_CAPABILITIES,
  getPlanFeatureBullets,
  getUserCapabilities,
  resolveFeatureAccess,
  sanitizeReminderDaysForAccess,
} from "@/lib/feature-access";

describe("feature-access", () => {
  it("mantiene Base como capa efectiva cuando Premium no está activa", () => {
    const access = resolveFeatureAccess({
      membershipTier: "NORMAL",
      membershipBillingStatus: "PAST_DUE",
    });

    expect(access.requestedTier).toBe("NORMAL");
    expect(access.effectiveTier).toBe("FREE");
    expect(access.canUseAdvancedSimulation).toBe(false);
    expect(access.maxActiveDebts).toBe(2);
  });

  it("desbloquea comparación completa y simulación avanzada en Premium activo", () => {
    const access = resolveFeatureAccess({
      membershipTier: "NORMAL",
      membershipBillingStatus: "ACTIVE",
    });

    expect(access.isPremium).toBe(true);
    expect(access.canUseAdvancedSimulation).toBe(true);
    expect(access.canSeeFullPlanComparison).toBe(true);
    expect(access.canExportReports).toBe(false);
  });

  it("reserva exportación e historial más profundo para Pro", () => {
    const access = resolveFeatureAccess({
      membershipTier: "PRO",
      membershipBillingStatus: "ACTIVE",
    });

    expect(access.isPro).toBe(true);
    expect(access.canExportReports).toBe(true);
    expect(access.notificationHistoryLimit).toBe(100);
    expect(access.maxReportRangeDays).toBe(365);
  });

  it("recorta recordatorios avanzados para Base", () => {
    const access = resolveFeatureAccess({
      membershipTier: "FREE",
      membershipBillingStatus: "FREE",
    });

    expect(sanitizeReminderDaysForAccess(access, [5, 2, 0])).toEqual([2, 0]);
  });

  it("aplica el límite de deudas por plan", () => {
    expect(
      canAddMoreDebts({
        membershipTier: "FREE",
        membershipBillingStatus: "FREE",
        activeDebtCount: 1,
      }),
    ).toBe(true);

    expect(
      canAddMoreDebts({
        membershipTier: "FREE",
        membershipBillingStatus: "FREE",
        activeDebtCount: 2,
      }),
    ).toBe(false);
  });

  it("expone bullets comerciales alineados con lo implementado", () => {
    expect(getPlanFeatureBullets("FREE")).toContain("Hasta 2 deudas activas");
    expect(getPlanFeatureBullets("NORMAL")).toContain(
      "Simulador completo con comparación de escenarios",
    );
    expect(getPlanFeatureBullets("PRO")).toContain(
      "Exportación CSV/PDF y seguimiento profundo",
    );
  });

  it("expone helpers centrales para capacidades y límites", () => {
    const access = getUserCapabilities({
      membershipTier: "PRO",
      membershipBillingStatus: "ACTIVE",
    });

    expect(getMaxDebts(access)).toBe(Number.MAX_SAFE_INTEGER);
    expect(canAccessUnlimitedDebts(access)).toBe(true);
    expect(canUseFullSimulator(access)).toBe(true);
    expect(canReceiveSmartAlerts(access)).toBe(true);
    expect(access.canUseDynamicReoptimization).toBe(true);
    expect(PLAN_CAPABILITIES.FREE.maxActiveDebts).toBe(2);
    expect(PLAN_CAPABILITIES.NORMAL.maxActiveDebts).toBe(10);
  });
});
