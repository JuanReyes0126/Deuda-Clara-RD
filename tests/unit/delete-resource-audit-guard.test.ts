import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const debtFindFirstMock = vi.fn();
const paymentFindFirstMock = vi.fn();
const prismaTransactionMock = vi.fn();
const txDebtDeleteManyMock = vi.fn();
const txDebtUpdateManyMock = vi.fn();
const txPaymentDeleteManyMock = vi.fn();
const txAuditLogCreateMock = vi.fn();
const txAuditLogUpdateManyMock = vi.fn();
const txNotificationUpdateManyMock = vi.fn();
const txNotificationEventUpdateManyMock = vi.fn();
const captureBalanceSnapshotMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    debt: {
      findFirst: debtFindFirstMock,
    },
    payment: {
      findFirst: paymentFindFirstMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@/lib/demo/session", () => ({
  isDemoModeEnabled: vi.fn(() => false),
  isDemoSessionUser: vi.fn(() => false),
}));

vi.mock("@/server/snapshots/balance-snapshot-service", () => ({
  captureBalanceSnapshot: captureBalanceSnapshotMock,
}));

vi.mock("@/server/payments/payment-allocation", () => ({
  revertPaymentFromDebtState: vi.fn(() => ({
    currentBalance: {
      toDecimalPlaces: vi.fn(() => 1000),
    },
    lateFeeAmount: {
      toDecimalPlaces: vi.fn(() => 0),
    },
    extraChargesAmount: {
      toDecimalPlaces: vi.fn(() => 0),
    },
  })),
}));

vi.mock("@/server/finance/debt-helpers", () => ({
  deriveDebtStatus: vi.fn(() => "CURRENT"),
  mapPaymentToDto: vi.fn(),
}));

describe("delete resource audit guard", () => {
  beforeEach(() => {
    vi.resetModules();
    debtFindFirstMock.mockReset();
    paymentFindFirstMock.mockReset();
    prismaTransactionMock.mockReset();
    txDebtDeleteManyMock.mockReset();
    txDebtUpdateManyMock.mockReset();
    txPaymentDeleteManyMock.mockReset();
    txAuditLogCreateMock.mockReset();
    txAuditLogUpdateManyMock.mockReset();
    txNotificationUpdateManyMock.mockReset();
    txNotificationEventUpdateManyMock.mockReset();
    captureBalanceSnapshotMock.mockReset();

    prismaTransactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        debt: {
          deleteMany: txDebtDeleteManyMock,
          updateMany: txDebtUpdateManyMock,
        },
        payment: {
          deleteMany: txPaymentDeleteManyMock,
        },
        auditLog: {
          create: txAuditLogCreateMock,
          updateMany: txAuditLogUpdateManyMock,
        },
        notification: {
          updateMany: txNotificationUpdateManyMock,
        },
        notificationEvent: {
          updateMany: txNotificationEventUpdateManyMock,
        },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("no referencia debtId borrado al auditar eliminación de deuda", async () => {
    const { deleteDebt } = await import("@/server/debts/debt-service");

    debtFindFirstMock.mockResolvedValueOnce({
      id: "debt-1",
      userId: "user-1",
      name: "Gold",
      payments: [{ id: "payment-1" }, { id: "payment-2" }],
    });
    txDebtDeleteManyMock.mockResolvedValueOnce({ count: 1 });
    txPaymentDeleteManyMock.mockResolvedValueOnce({ count: 2 });
    txAuditLogUpdateManyMock.mockResolvedValue(undefined);
    txNotificationUpdateManyMock.mockResolvedValue(undefined);
    txNotificationEventUpdateManyMock.mockResolvedValue(undefined);
    txAuditLogCreateMock.mockResolvedValue(undefined);

    await deleteDebt("user-1", "debt-1", {});

    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DEBT_DELETED",
          resourceId: "debt-1",
        }),
      }),
    );

    expect(txAuditLogCreateMock.mock.calls[0]?.[0]?.data?.debtId).toBeUndefined();
    expect(txPaymentDeleteManyMock).toHaveBeenCalled();
    expect(captureBalanceSnapshotMock).toHaveBeenCalled();
  });

  it("no referencia paymentId borrado al auditar eliminación de pago", async () => {
    const { deletePayment } = await import("@/server/payments/payment-service");

    paymentFindFirstMock.mockResolvedValueOnce({
      id: "payment-1",
      userId: "user-1",
      debtId: "debt-1",
      amount: 500,
      principalAmount: 400,
      interestAmount: 100,
      lateFeeAmount: 0,
      extraChargesAmount: 0,
      remainingBalanceAfter: 1000,
      paidAt: new Date("2026-04-13T00:00:00.000Z"),
      debt: { id: "debt-1" },
    });
    debtFindFirstMock.mockResolvedValueOnce({
      id: "debt-1",
      userId: "user-1",
      name: "Gold",
      status: "CURRENT",
      nextDueDate: null,
      archivedAt: null,
      paidOffAt: null,
    });
    txDebtUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    txAuditLogUpdateManyMock.mockResolvedValue(undefined);
    txPaymentDeleteManyMock.mockResolvedValueOnce({ count: 1 });
    txAuditLogCreateMock.mockResolvedValue(undefined);

    await deletePayment("user-1", "payment-1", {});

    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PAYMENT_DELETED",
          resourceId: "payment-1",
          debtId: "debt-1",
        }),
      }),
    );

    expect(txAuditLogCreateMock.mock.calls[0]?.[0]?.data?.paymentId).toBeUndefined();
    expect(txAuditLogUpdateManyMock).toHaveBeenCalledWith({
      where: { paymentId: "payment-1" },
      data: { paymentId: null },
    });
    expect(captureBalanceSnapshotMock).toHaveBeenCalled();
  });
});
