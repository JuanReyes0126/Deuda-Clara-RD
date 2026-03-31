import { describe, expect, it, vi } from "vitest";

describe("encryption", () => {
  it("cifra y descifra texto sensible", async () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef");

    const { decryptSensitiveText, encryptSensitiveText } = await import("@/lib/security/encryption");
    const encrypted = encryptSensitiveText("Nota privada de prueba");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(decryptSensitiveText(encrypted)).toBe("Nota privada de prueba");

    vi.unstubAllEnvs();
  });

  it("mantiene compatibilidad con texto previo sin cifrar", async () => {
    const { decryptSensitiveText } = await import("@/lib/security/encryption");

    expect(decryptSensitiveText("Texto sin cifrar")).toBe("Texto sin cifrar");
  });
});
