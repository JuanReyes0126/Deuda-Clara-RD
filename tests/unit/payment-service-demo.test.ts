import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    debt: {
      findFirst: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/demo/session", () => ({
  isDemoModeEnabled: vi.fn(() => true),
  isDemoSessionUser: vi.fn(() => false),
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: vi.fn(async () => false),
  markDatabaseUnavailable: vi.fn(),
}));

vi.mock("@/lib/demo/payments", () => ({
  listDemoPayments: vi.fn(),
  createDemoPayment: vi.fn(),
  updateDemoPayment: vi.fn(),
  deleteDemoPayment: vi.fn(),
}));

vi.mock("@/server/audit/audit-service", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/server/snapshots/balance-snapshot-service", () => ({
  captureBalanceSnapshot: vi.fn(),
}));

describe("payment-service demo fallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lista pagos demo cuando la base no esta disponible", async () => {
    const { listUserPayments } = await import("@/server/payments/payment-service");
    const { listDemoPayments } = await import("@/lib/demo/payments");

    vi.mocked(listDemoPayments).mockResolvedValueOnce([
      { id: "demo-payment-1" },
    ] as never);

    const result = await listUserPayments("user-fallback");

    expect(listDemoPayments).toHaveBeenCalled();
    expect(result).toEqual([{ id: "demo-payment-1" }]);
  });

  it("registra pagos en demo cuando la base no esta disponible", async () => {
    const { createPayment } = await import("@/server/payments/payment-service");
    const { createDemoPayment } = await import("@/lib/demo/payments");

    vi.mocked(createDemoPayment).mockResolvedValueOnce({
      id: "demo-payment-new",
      amount: 5000,
    } as never);

    const result = await createPayment(
      "user-fallback",
      {
        debtId: "demo-card-1",
        amount: 5000,
        paidAt: new Date("2026-03-30T12:00:00.000Z"),
        source: "MANUAL",
      },
      {},
    );

    expect(createDemoPayment).toHaveBeenCalled();
    expect(result).toEqual({
      id: "demo-payment-new",
      amount: 5000,
    });
  });

  it("edita pagos en demo cuando la base no esta disponible", async () => {
    const { updatePayment } = await import("@/server/payments/payment-service");
    const { updateDemoPayment } = await import("@/lib/demo/payments");

    vi.mocked(updateDemoPayment).mockResolvedValueOnce({
      id: "demo-payment-1",
      amount: 6000,
    } as never);

    const result = await updatePayment(
      "user-fallback",
      "demo-payment-1",
      {
        debtId: "demo-card-1",
        amount: 6000,
        paidAt: new Date("2026-03-30T12:00:00.000Z"),
        source: "MANUAL",
      },
      {},
    );

    expect(updateDemoPayment).toHaveBeenCalledWith(
      "demo-payment-1",
      expect.objectContaining({ amount: 6000 }),
    );
    expect(result).toEqual({
      id: "demo-payment-1",
      amount: 6000,
    });
  });

  it("elimina pagos en demo cuando la base no esta disponible", async () => {
    const { deletePayment } = await import("@/server/payments/payment-service");
    const { deleteDemoPayment } = await import("@/lib/demo/payments");

    await deletePayment("user-fallback", "demo-payment-1", {});

    expect(deleteDemoPayment).toHaveBeenCalledWith("demo-payment-1");
  });
});
