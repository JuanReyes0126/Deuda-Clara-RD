import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/debts/route";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/debts/debt-service", () => ({
  listUserDebts: vi.fn(),
  createDebt: vi.fn(),
}));

describe("api/debts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve 401 si no hay sesion", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autenticado.");
  });

  it("crea una deuda valida", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { createDebt } = await import("@/server/debts/debt-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(createDebt).mockResolvedValueOnce({
      id: "debt-1",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/debts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          name: "Tarjeta principal",
          creditorName: "Banco Popular",
          type: "CREDIT_CARD",
          status: "CURRENT",
          currency: "DOP",
          currentBalance: 50000,
          interestRate: 48,
          interestRateType: "ANNUAL",
          minimumPayment: 4000,
          lateFeeAmount: 0,
          extraChargesAmount: 0,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createDebt).toHaveBeenCalled();
  });
});
