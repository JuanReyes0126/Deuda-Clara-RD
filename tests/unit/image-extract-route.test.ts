import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const assertSameOriginMock = vi.fn();
const getCurrentSessionMock = vi.fn();
const logServerErrorMock = vi.fn();
const generateTextMock = vi.fn();

vi.mock("@/lib/security/origin", () => ({
  assertSameOrigin: assertSameOriginMock,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: getCurrentSessionMock,
}));

vi.mock("@/server/observability/logger", () => ({
  logServerError: logServerErrorMock,
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

const routeModulePromise = import("@/app/api/assistant/image-extract/route");

const validDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Yf9sAAAAASUVORK5CYII=";

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://127.0.0.1:3000/api/assistant/image-extract", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3000",
      host: "127.0.0.1:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("assistant image extract route", () => {
  beforeEach(() => {
    assertSameOriginMock.mockReset();
    getCurrentSessionMock.mockReset();
    logServerErrorMock.mockReset();
    generateTextMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();

    getCurrentSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("devuelve 401 sin sesión", async () => {
    getCurrentSessionMock.mockResolvedValueOnce(null);

    const { POST } = await routeModulePromise;
    const response = await POST(buildRequest({ imageDataUrl: validDataUrl }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("No autenticado.");
  });

  it("hace fallback a gateway cuando OpenAI falla", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("openai timeout")),
    );
    generateTextMock.mockResolvedValueOnce({
      text: '{"debts":[],"summary":"ok","missingFields":[]}',
    });

    const { POST } = await routeModulePromise;
    const response = await POST(buildRequest({ imageDataUrl: validDataUrl }));
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(logServerErrorMock).toHaveBeenCalled();
  });

  it("retorna 503 cuando no hay proveedores disponibles", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(buildRequest({ imageDataUrl: validDataUrl }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(payload.error).toContain("lectura automática de imágenes");
  });

  it("valida el formato de imagen", async () => {
    const { POST } = await routeModulePromise;
    const response = await POST(
      buildRequest({ imageDataUrl: "data:text/plain;base64,abc" }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Sube una imagen PNG, JPG o WEBP válida.");
  });
});
