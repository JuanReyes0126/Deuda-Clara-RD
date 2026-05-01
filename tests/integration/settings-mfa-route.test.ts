import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH, POST } from "@/app/api/settings/mfa/totp/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  assertRecentAuth: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "settings-mfa-key"),
}));

vi.mock("@/server/settings/settings-service", () => ({
  createUserTotpSetup: vi.fn(),
  verifyUserTotpSetup: vi.fn(),
  disableUserTotp: vi.fn(),
  regenerateUserRecoveryCodes: vi.fn(),
}));

describe("api/settings/mfa/totp", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("genera una clave TOTP para el usuario autenticado", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { createUserTotpSetup } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(createUserTotpSetup).mockResolvedValueOnce({
      setupKey: "JBSWY3DPEHPK3PXP",
      provisioningUri: "otpauth://totp/Deuda%20Clara%20RD:demo%40correo.com?secret=JBSWY3DPEHPK3PXP",
    } as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/settings/mfa/totp", {}),
    );
    const body = (await response.json()) as {
      ok: boolean;
      setup: { setupKey: string; provisioningUri: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.setup.setupKey).toBe("JBSWY3DPEHPK3PXP");
  });

  it("activa MFA al confirmar un codigo valido", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { verifyUserTotpSetup } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(verifyUserTotpSetup).mockResolvedValueOnce({
      mfaTotpEnabled: true,
      backupCodes: ["ABCDE-12345", "FGHIJ-67890"],
    } as never);

    const response = await PATCH(
      buildJsonRequest(
        "http://localhost/api/settings/mfa/totp",
        { totpCode: "123456" },
        { method: "PATCH" },
      ),
    );
    const body = (await response.json()) as {
      ok: boolean;
      mfa: { mfaTotpEnabled: boolean; backupCodes: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mfa.mfaTotpEnabled).toBe(true);
    expect(body.mfa.backupCodes).toHaveLength(2);
  });

  it("regenera recovery codes cuando el usuario lo pide", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { regenerateUserRecoveryCodes } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(regenerateUserRecoveryCodes).mockResolvedValueOnce({
      backupCodes: ["ABCDE-12345", "FGHIJ-67890"],
    } as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/settings/mfa/totp", {
        action: "regenerate-recovery-codes",
        currentPassword: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      recovery: { backupCodes: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.recovery.backupCodes).toHaveLength(2);
  });

  it("desactiva MFA con contraseña y codigo actual", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { disableUserTotp } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(disableUserTotp).mockResolvedValueOnce({
      mfaTotpEnabled: false,
    } as never);

    const response = await DELETE(
      buildJsonRequest(
        "http://localhost/api/settings/mfa/totp",
        {
          currentPassword: "DeudaClara123!",
          totpCode: "123456",
        },
        { method: "DELETE" },
      ),
    );
    const body = (await response.json()) as {
      ok: boolean;
      mfa: { mfaTotpEnabled: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mfa.mfaTotpEnabled).toBe(false);
  });

  it("pide reautenticacion reciente antes de tocar MFA", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { ServiceError } = await import("@/server/services/service-error");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockRejectedValueOnce(
      new ServiceError("REAUTH_REQUIRED", 403, "Confirma tu identidad para continuar."),
    );

    const response = await POST(
      buildJsonRequest("http://localhost/api/settings/mfa/totp", {}),
    );
    const body = (await response.json()) as {
      error: string;
      reauthRequired?: boolean;
    };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Confirma tu identidad para continuar.");
    expect(body.reauthRequired).toBe(true);
  });
});
