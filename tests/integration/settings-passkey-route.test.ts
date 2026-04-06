import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE as deletePasskey } from "@/app/api/settings/passkeys/[passkeyId]/route";
import { POST as optionsPost } from "@/app/api/settings/passkeys/options/route";
import { POST as verifyPost } from "@/app/api/settings/passkeys/verify/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/passkeys", () => ({
  attachPasskeyChallengeCookie: vi.fn(),
  clearPasskeyChallengeCookie: vi.fn(),
  readPasskeyChallengeCookie: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "settings-passkey-rate-limit-key"),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  assertRecentAuth: vi.fn(),
}));

vi.mock("@/server/auth/passkey-service", () => ({
  createPasskeyRegistrationOptions: vi.fn(),
  deleteUserPasskey: vi.fn(),
  verifyPasskeyRegistration: vi.fn(),
}));

describe("api/settings/passkeys", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prepara opciones de registro de passkey", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { attachPasskeyChallengeCookie } = await import("@/lib/security/passkeys");
    const { createPasskeyRegistrationOptions } = await import(
      "@/server/auth/passkey-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(createPasskeyRegistrationOptions).mockResolvedValueOnce({
      options: {
        challenge: "challenge-setup",
        rp: { id: "localhost" },
      },
    } as never);

    const response = await optionsPost(
      buildJsonRequest("http://localhost/api/settings/passkeys/options", {}),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(attachPasskeyChallengeCookie).toHaveBeenCalled();
  });

  it("verifica registro de passkey y devuelve la lista actualizada", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { readPasskeyChallengeCookie, clearPasskeyChallengeCookie } = await import(
      "@/lib/security/passkeys"
    );
    const { verifyPasskeyRegistration } = await import(
      "@/server/auth/passkey-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(readPasskeyChallengeCookie).mockReturnValueOnce({
      challenge: "challenge-setup",
      createdAt: new Date().toISOString(),
      kind: "registration",
      userId: "user-1",
    });
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(verifyPasskeyRegistration).mockResolvedValueOnce({
      passkey: {
        id: "pk-1",
        name: "Passkey 1",
      },
      passkeys: [
        {
          id: "pk-1",
          name: "Passkey 1",
          deviceType: "multiDevice",
          backedUp: true,
          transports: ["internal"],
          createdAt: new Date().toISOString(),
          lastUsedAt: null,
        },
      ],
    } as never);

    const response = await verifyPost(
      buildJsonRequest("http://localhost/api/settings/passkeys/verify", {
        credential: { id: "credential-1" },
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      passkeys: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.passkeys[0]?.id).toBe("pk-1");
    expect(clearPasskeyChallengeCookie).toHaveBeenCalled();
  });

  it("elimina una passkey del usuario autenticado", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { deleteUserPasskey } = await import("@/server/auth/passkey-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(deleteUserPasskey).mockResolvedValueOnce({
      passkeys: [],
    } as never);

    const response = await deletePasskey(
      buildJsonRequest(
        "http://localhost/api/settings/passkeys/pk-1",
        {},
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({
          passkeyId: "pk-1",
        }),
      },
    );
    const body = (await response.json()) as { ok: boolean; passkeys: unknown[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.passkeys).toHaveLength(0);
  });
});
