import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = new Map<string, string>();
const cookieStore = {
  get: vi.fn((name: string) => {
    const value = cookieState.get(name);
    return value ? { value } : undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    cookieState.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieState.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

describe("demo payments fallback", () => {
  beforeEach(() => {
    cookieState.clear();
    cookieStore.get.mockClear();
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
  });

  it("crea pagos demo y recalcula la deuda asociada", async () => {
    const { createDemoPayment } = await import("@/lib/demo/payments");
    const { getDemoDebtById } = await import("@/lib/demo/debts");

    const payment = await createDemoPayment({
      debtId: "demo-card-1",
      amount: 5000,
      paidAt: new Date("2026-03-25T12:00:00.000Z"),
      source: "MANUAL",
    });

    const updatedDebt = await getDemoDebtById("demo-card-1");

    expect(payment.amount).toBe(5000);
    expect((payment.interestAmount ?? 0) + (payment.principalAmount ?? 0)).toBe(5000);
    expect(payment.remainingBalanceAfter).toBeLessThan(128000);
    expect(updatedDebt.paymentCount).toBe(5);
    expect(updatedDebt.totalPaid).toBe(37000);
    expect(updatedDebt.lastPaymentAmount).toBe(5000);
    expect(updatedDebt.effectiveBalance).toBe(payment.remainingBalanceAfter ?? 0);
  });

  it("permite editar un pago demo sin romper el saldo", async () => {
    const { createDemoPayment, updateDemoPayment } = await import("@/lib/demo/payments");
    const { getDemoDebtById } = await import("@/lib/demo/debts");

    const payment = await createDemoPayment({
      debtId: "demo-loan-1",
      amount: 7000,
      paidAt: new Date("2026-03-26T12:00:00.000Z"),
      source: "MANUAL",
    });

    const updatedPayment = await updateDemoPayment(payment.id, {
      debtId: "demo-loan-1",
      amount: 9000,
      paidAt: new Date("2026-03-26T12:00:00.000Z"),
      source: "MANUAL",
    });

    const updatedDebt = await getDemoDebtById("demo-loan-1");

    expect(updatedPayment.amount).toBe(9000);
    expect(updatedDebt.totalPaid).toBe(28600);
    expect(updatedDebt.lastPaymentAmount).toBe(9000);
    expect(updatedDebt.effectiveBalance).toBe(updatedPayment.remainingBalanceAfter ?? 0);
  });

  it("elimina pagos demo y revierte el estado de la deuda", async () => {
    const { createDemoPayment, deleteDemoPayment, listDemoPayments } = await import("@/lib/demo/payments");
    const { getDemoDebtById } = await import("@/lib/demo/debts");

    const payment = await createDemoPayment({
      debtId: "demo-card-1",
      amount: 3000,
      paidAt: new Date("2026-03-27T12:00:00.000Z"),
      source: "MANUAL",
    });

    await deleteDemoPayment(payment.id);

    const updatedDebt = await getDemoDebtById("demo-card-1");
    const payments = await listDemoPayments();

    expect(payments.find((item) => item.id === payment.id)).toBeUndefined();
    expect(updatedDebt.paymentCount).toBe(4);
    expect(updatedDebt.totalPaid).toBe(32000);
    expect(updatedDebt.lastPaymentAmount).toBe(8000);
    expect(updatedDebt.effectiveBalance).toBe(128000);
  });
});
