import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/lib/security/totp";

describe("verifyTotpCode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("acepta un codigo TOTP valido para el secreto Base32", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T13:00:00.000Z"));

    expect(
      verifyTotpCode("JBSWY3DPEHPK3PXP", "240520"),
    ).toBe(true);
  });

  it("rechaza codigos invalidos o secretos mal formados", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T13:00:00.000Z"));

    expect(
      verifyTotpCode("JBSWY3DPEHPK3PXP", "000000"),
    ).toBe(false);
    expect(verifyTotpCode("not-base32-secret", "579282")).toBe(false);
  });

  it("genera y consume recovery codes de un solo uso", () => {
    const [code = "ABCDE-12345"] = createRecoveryCodes(1);
    const hashedCode = hashRecoveryCode(code);

    const firstAttempt = verifyRecoveryCode(code, [hashedCode]);
    expect(firstAttempt.matched).toBe(true);
    expect(firstAttempt.remainingHashes).toHaveLength(0);

    const secondAttempt = verifyRecoveryCode(code, firstAttempt.remainingHashes);
    expect(secondAttempt.matched).toBe(false);
  });
});
