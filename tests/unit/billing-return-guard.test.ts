import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const billingProviderEventCreateMock = vi.fn();
const billingProviderEventFindUniqueMock = vi.fn();
const billingProviderEventUpdateMock = vi.fn();
const billingPaymentFindUniqueMock = vi.fn();
const billingPaymentUpdateMock = vi.fn();
const verifyAzulResponseHashMock = vi.fn();
const isAzulApprovedResponseMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    billingProviderEvent: {
      create: billingProviderEventCreateMock,
      findUnique: billingProviderEventFindUniqueMock,
      update: billingProviderEventUpdateMock,
    },
    billingPayment: {
      findUnique: billingPaymentFindUniqueMock,
      update: billingPaymentUpdateMock,
    },
    user: {
      findUniqueOrThrow: vi.fn(),
    },
    userSettings: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/billing/providers/azul-provider", () => ({
  createAzulBillingProvider: vi.fn(),
  verifyAzulResponseHash: verifyAzulResponseHashMock,
  isAzulApprovedResponse: isAzulApprovedResponseMock,
}));

vi.mock("@/server/mail/mail-service", () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/server/mail/email-templates", () => ({
  buildMembershipActivatedEmail: vi.fn(),
  buildMembershipBillingAttentionEmail: vi.fn(),
}));

vi.mock("@/server/audit/audit-service", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/server/observability/logger", () => ({
  logServerError: vi.fn(),
}));

describe("billing return guard", () => {
  beforeEach(() => {
    vi.resetModules();
    billingProviderEventCreateMock.mockReset();
    billingProviderEventFindUniqueMock.mockReset();
    billingProviderEventUpdateMock.mockReset();
    billingPaymentFindUniqueMock.mockReset();
    billingPaymentUpdateMock.mockReset();
    verifyAzulResponseHashMock.mockReset();
    isAzulApprovedResponseMock.mockReset();
    billingProviderEventCreateMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rechaza callbacks negativos sin firma", async () => {
    const { handleAzulPaymentReturn } = await import("@/server/billing/billing-service");

    billingPaymentFindUniqueMock.mockResolvedValueOnce({
      id: "payment-1",
      userId: "user-1",
      amountCents: 500,
      status: "PENDING",
      membershipTier: "NORMAL",
      billingInterval: "MONTHLY",
      externalPriceCode: "azul_normal_monthly_usd",
    });

    await expect(
      handleAzulPaymentReturn("declined", {
        OrderNumber: "DCORDER1",
        Amount: "500",
      }),
    ).rejects.toThrow("La respuesta de AZUL no trae firma.");

    expect(billingPaymentUpdateMock).not.toHaveBeenCalled();
  });

  it("ignora callbacks negativos tardíos para pagos ya aprobados", async () => {
    const { handleAzulPaymentReturn } = await import("@/server/billing/billing-service");

    billingPaymentFindUniqueMock.mockResolvedValueOnce({
      id: "payment-1",
      userId: "user-1",
      amountCents: 500,
      status: "APPROVED",
      membershipTier: "NORMAL",
      billingInterval: "MONTHLY",
      externalPriceCode: "azul_normal_monthly_usd",
    });
    verifyAzulResponseHashMock.mockReturnValueOnce(true);

    const result = await handleAzulPaymentReturn("cancelled", {
      OrderNumber: "DCORDER1",
      Amount: "500",
      AuthHash: "firma",
    });

    expect(result.checkout).toBe("success");
    expect(billingPaymentUpdateMock).not.toHaveBeenCalled();
    expect(billingProviderEventUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROCESSED",
        }),
      }),
    );
  });
});
