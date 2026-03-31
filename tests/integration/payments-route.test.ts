import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import { POST } from "@/app/api/payments/route";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/payments/payment-service", () => ({
  createPayment: vi.fn(),
  listUserPayments: vi.fn(),
}));

describe("api/payments", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza payload invalido", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          debtId: "",
          amount: -1,
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("registra un pago valido", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { createPayment } = await import("@/server/payments/payment-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(createPayment).mockResolvedValueOnce({
      id: "payment-1",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          debtId: "debt-1",
          amount: 5000,
          paidAt: "2026-03-20",
          source: "MANUAL",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createPayment).toHaveBeenCalled();
  });

  it("devuelve mensaje especifico cuando la infraestructura falla", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { createPayment } = await import("@/server/payments/payment-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(createPayment).mockRejectedValueOnce(
      new Prisma.PrismaClientInitializationError("db down", "6.18.0"),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          debtId: "debt-1",
          amount: 5000,
          paidAt: "2026-03-20",
          source: "MANUAL",
        }),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("registrar este pago");
  });
});
