import { describe, expect, it } from "vitest";

import {
  buildDebtReminderEmail,
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

  it("construye el email de recordatorio de pago con monto y CTA", () => {
    const result = buildDebtReminderEmail({
      firstName: "Carla",
      debtName: "Tarjeta Gold",
      eventType: "PAYMENT_DUE",
      occursOn: new Date("2026-04-10T12:00:00.000Z"),
      daysBefore: 2,
      minimumPayment: 5200,
      currency: "DOP",
      timeZone: "America/Santo_Domingo",
    });

    expect(result.subject).toContain("vence");
    expect(result.html).toContain("Tarjeta Gold");
    expect(result.html).toContain("RD$");
    expect(result.text).toContain("/deudas");
  });
});
