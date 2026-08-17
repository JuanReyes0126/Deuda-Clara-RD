import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as optionsPost } from "@/app/api/auth/passkeys/options/route";
import { POST as verifyPost } from "@/app/api/auth/passkeys/verify/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  createUserSession: vi.fn(),
}));

vi.mock("@/lib/security/passkeys", () => ({
  attachPasskeyChallengeCookie: vi.fn(),
  clearPasskeyChallengeCookie: vi.fn(),
  readPasskeyChallengeCookie: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "passkey-rate-limit-key"),
}));

vi.mock("@/server/auth/passkey-service", () => ({
  createPasskeyAuthenticationOptions: vi.fn(),
  verifyPasskeyAuthentication: vi.fn(),
}));

vi.mock("@/server/auth/tokens", () => ({
  generateOpaqueToken: vi.fn(() => "opaque-passkey-token"),
}));

describe("api/auth/passkeys", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prepara opciones de login con passkey", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { attachPasskeyChallengeCookie } = await import("@/lib/security/passkeys");
    const { createPasskeyAuthenticationOptions } = await import(
      "@/server/auth/passkey-service"
    );

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(createPasskeyAuthenticationOptions).mockResolvedValueOnce({
      userId: "user-1",
      options: {
        challenge: "challenge-1",
        rpId: "localhost",
      },
    } as never);

    const response = await optionsPost(
      buildJsonRequest("http://localhost/api/auth/passkeys/options", {
        email: "clara@example.com",
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      options: { challenge: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.options.challenge).toBe("challenge-1");
    expect(attachPasskeyChallengeCookie).toHaveBeenCalled();
  });

  it("verifica login con passkey y crea sesión", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { readPasskeyChallengeCookie, clearPasskeyChallengeCookie } = await import(
      "@/lib/security/passkeys"
    );
    const { verifyPasskeyAuthentication } = await import(
      "@/server/auth/passkey-service"
    );
    const { createUserSession } = await import("@/lib/auth/session");

    vi.mocked(readPasskeyChallengeCookie).mockReturnValueOnce({
      challenge: "challenge-verify",
      createdAt: new Date().toISOString(),
      kind: "authentication",
      userId: "user-1",
    });
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(verifyPasskeyAuthentication).mockResolvedValueOnce({
      id: "user-1",
      onboardingCompleted: true,
    } as never);

    const response = await verifyPost(
      buildJsonRequest("http://localhost/api/auth/passkeys/verify", {
        credential: {
          id: "credential-1",
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean; redirectTo: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/dashboard");
    expect(createUserSession).toHaveBeenCalledWith("user-1", "opaque-passkey-token");
    expect(clearPasskeyChallengeCookie).toHaveBeenCalled();
  });
});
