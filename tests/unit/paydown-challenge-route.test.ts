import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { ServiceError } from "@/server/services/service-error";

const assertSameOriginMock = vi.fn();
const getCurrentSessionMock = vi.fn();
const startPaydownChallengeMock = vi.fn();
const clearPaydownChallengeMock = vi.fn();
const assertRateLimitMock = vi.fn();
const buildRateLimitKeyMock = vi.fn();
const getRequestMetaMock = vi.fn();
const createAuditLogMock = vi.fn();

vi.mock("@/lib/security/origin", () => ({
  assertSameOrigin: assertSameOriginMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: getCurrentSessionMock,
}));

vi.mock("@/server/settings/paydown-challenge-service", () => ({
  startPaydownChallenge: startPaydownChallengeMock,
  clearPaydownChallenge: clearPaydownChallengeMock,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: assertRateLimitMock,
  buildRateLimitKey: buildRateLimitKeyMock,
}));

vi.mock("@/lib/security/request-meta", () => ({
  getRequestMeta: getRequestMetaMock,
}));

vi.mock("@/server/audit/audit-service", () => ({
  createAuditLog: createAuditLogMock,
}));

const routeModulePromise = import("@/app/api/settings/paydown-challenge/route");

function buildJsonRequest(method: "POST" | "DELETE", body?: Record<string, unknown>) {
  return new NextRequest("http://127.0.0.1:3000/api/settings/paydown-challenge", {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3000",
      host: "127.0.0.1:3000",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("paydown challenge settings route", () => {
  beforeEach(() => {
    assertSameOriginMock.mockReset();
    getCurrentSessionMock.mockReset();
    startPaydownChallengeMock.mockReset();
    clearPaydownChallengeMock.mockReset();
    assertRateLimitMock.mockReset();
    buildRateLimitKeyMock.mockReset();
    getRequestMetaMock.mockReset();
    createAuditLogMock.mockReset();
    buildRateLimitKeyMock.mockReturnValue("paydown-challenge-key");
    assertRateLimitMock.mockResolvedValue({
      success: true,
      remaining: 10,
      resetAt: Date.now() + 10_000,
    });
    getRequestMetaMock.mockReturnValue({
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
  });

  it("activa el reto con payload válido", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });

    const { POST } = await routeModulePromise;
    const response = await POST(buildJsonRequest("POST", { extraMonthly: 750 }));
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(startPaydownChallengeMock).toHaveBeenCalledWith("user-1", 750);
    expect(createAuditLogMock).toHaveBeenCalledOnce();
  });

  it("rechaza activación cuando no hay sesión", async () => {
    getCurrentSessionMock.mockResolvedValue(null);

    const { POST } = await routeModulePromise;
    const response = await POST(buildJsonRequest("POST", { extraMonthly: 500 }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("No autenticado.");
    expect(startPaydownChallengeMock).not.toHaveBeenCalled();
    expect(assertRateLimitMock).not.toHaveBeenCalled();
  });

  it("valida monto extra inválido", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });

    const { POST } = await routeModulePromise;
    const response = await POST(buildJsonRequest("POST", { extraMonthly: 0 }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("El monto extra debe ser mayor que cero.");
    expect(startPaydownChallengeMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("cierra reto cuando sesión está activa", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-2" },
    });

    const { DELETE } = await routeModulePromise;
    const response = await DELETE(buildJsonRequest("DELETE"));
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(clearPaydownChallengeMock).toHaveBeenCalledWith("user-2");
    expect(createAuditLogMock).toHaveBeenCalledOnce();
  });

  it("rechaza cierre cuando no hay sesión", async () => {
    getCurrentSessionMock.mockResolvedValue(null);

    const { DELETE } = await routeModulePromise;
    const response = await DELETE(buildJsonRequest("DELETE"));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("No autenticado.");
    expect(clearPaydownChallengeMock).not.toHaveBeenCalled();
    expect(assertRateLimitMock).not.toHaveBeenCalled();
  });

  it("propaga error de servicio al activar reto", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    startPaydownChallengeMock.mockRejectedValueOnce(
      new Error("service exploded"),
    );

    const { POST } = await routeModulePromise;
    const response = await POST(buildJsonRequest("POST", { extraMonthly: 900 }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("No se pudo activar el reto.");
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("propaga ServiceError al cerrar reto", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    clearPaydownChallengeMock.mockRejectedValueOnce(
      new ServiceError("INVALID_STATE", 409, "No se puede cerrar en este momento."),
    );

    const { DELETE } = await routeModulePromise;
    const response = await DELETE(buildJsonRequest("DELETE"));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("No se puede cerrar en este momento.");
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("responde 429 cuando excede rate limit al activar", async () => {
    getCurrentSessionMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    assertRateLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const { POST } = await routeModulePromise;
    const response = await POST(buildJsonRequest("POST", { extraMonthly: 500 }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(429);
    expect(payload.error).toBe("Demasiados intentos. Intenta de nuevo más tarde.");
    expect(startPaydownChallengeMock).not.toHaveBeenCalled();
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });
});
