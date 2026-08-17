import { describe, expect, it } from "vitest";

import {
  getBillingPaymentReturnAction,
  getBillingProviderEventProcessingDecision,
  isBillableMembershipTier,
} from "@/server/billing/billing-service";

describe("billing-service", () => {
  it("limita checkout a planes cobrables", () => {
    expect(isBillableMembershipTier("NORMAL")).toBe(true);
    expect(isBillableMembershipTier("PRO")).toBe(true);
    expect(isBillableMembershipTier("FREE")).toBe(false);
  });

  it("evita reprocesar webhooks ya procesados o omitidos", () => {
    const updatedAt = new Date("2026-04-07T10:00:00.000Z");
    const now = new Date("2026-04-07T10:01:00.000Z");

    expect(getBillingProviderEventProcessingDecision({ status: "PROCESSED", updatedAt, now })).toEqual({
      shouldProcess: false,
      reason: "duplicate",
    });
    expect(getBillingProviderEventProcessingDecision({ status: "SKIPPED", updatedAt, now })).toEqual({
      shouldProcess: false,
      reason: "duplicate",
    });
  });

  it("permite reintentar webhooks fallidos o processing estancados", () => {
    const now = new Date("2026-04-07T10:20:00.000Z");

    expect(
      getBillingProviderEventProcessingDecision({
        status: "FAILED",
        updatedAt: new Date("2026-04-07T10:01:00.000Z"),
        now,
      }),
    ).toEqual({ shouldProcess: true });

    expect(
      getBillingProviderEventProcessingDecision({
        status: "PROCESSING",
        updatedAt: new Date("2026-04-07T10:01:00.000Z"),
        now,
      }),
    ).toEqual({ shouldProcess: true });

    expect(
      getBillingProviderEventProcessingDecision({
        status: "PROCESSING",
        updatedAt: new Date("2026-04-07T10:19:00.000Z"),
        now,
      }),
    ).toEqual({ shouldProcess: false, reason: "processing" });
  });

  it("conserva pagos aprobados si llega un retorno negativo tardío", () => {
    expect(
      getBillingPaymentReturnAction({
        currentStatus: "APPROVED",
        outcome: "declined",
      }),
    ).toBe("IGNORE_ALREADY_APPROVED");

    expect(
      getBillingPaymentReturnAction({
        currentStatus: "APPROVED",
        outcome: "cancelled",
      }),
    ).toBe("IGNORE_ALREADY_APPROVED");
  });
});
