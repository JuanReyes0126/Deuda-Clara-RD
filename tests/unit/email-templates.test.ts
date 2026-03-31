import { describe, expect, it } from "vitest";

import {
  buildMembershipActivatedEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
} from "@/server/mail/email-templates";

describe("email-templates", () => {
  it("construye el email de bienvenida con CTA al onboarding", () => {
    const result = buildWelcomeEmail("Carla");

    expect(result.subject).toBe("Bienvenido a Deuda Clara RD");
    expect(result.html).toContain("Ir al onboarding");
    expect(result.text).toContain("/onboarding");
  });

  it("construye el email de reset con el token incrustado", () => {
    const result = buildPasswordResetEmail("token-seguro");

    expect(result.subject).toContain("Restablece");
    expect(result.html).toContain("token-seguro");
    expect(result.text).toContain("token-seguro");
  });

  it("construye el email de activacion premium con el nombre del plan", () => {
    const result = buildMembershipActivatedEmail({
      firstName: "Carla",
      planLabel: "Premium",
      currentPeriodEnd: "2026-04-29T12:00:00.000Z",
    });

    expect(result.subject).toBe("Tu plan Premium ya está activo");
    expect(result.html).toContain("Premium");
    expect(result.text).toContain("Premium");
  });
});
