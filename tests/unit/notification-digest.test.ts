import { describe, expect, it } from "vitest";

import { buildNotificationDigest } from "@/server/notifications/notification-digest";

describe("notification-digest", () => {
  it("construye un asunto con el total de alertas", () => {
    const result = buildNotificationDigest([
      {
        title: "Vence pronto",
        message: "Tu tarjeta vence esta semana.",
        severity: "WARNING",
      },
      {
        title: "Resumen mensual",
        message: "Tu reporte está listo.",
        severity: "INFO",
      },
    ]);

    expect(result.subject).toBe("Tienes 2 alertas de deuda pendientes");
  });

  it("incluye CTA cuando existe una accion asociada", () => {
    const result = buildNotificationDigest([
      {
        title: "Resumen mensual",
        message: "Tu reporte está listo.",
        severity: "INFO",
        actionLabel: "Abrir reportes",
        actionHref: "http://localhost:3000/reportes",
      },
    ]);

    expect(result.html).toContain("Abrir reportes");
    expect(result.text).toContain("http://localhost:3000/reportes");
  });

  it("incluye una lectura del periodo cuando se entrega contexto adicional", () => {
    const result = buildNotificationDigest(
      [
        {
          title: "Seguimiento premium",
          message: "Tu prioridad sigue siendo la tarjeta principal.",
          severity: "INFO",
        },
      ],
      {
        signal: "REGRESSION",
        headline: "Tu avance existe, pero todavía se diluye más de lo ideal",
        support: "39% de tu flujo sigue yéndose a intereses y cargos.",
        nextStep: "Concentra más flujo en la deuda principal.",
        ctaLabel: "Abrir reportes",
        ctaHref: "http://localhost:3000/reportes",
      },
    );

    expect(result.html).toContain("Lectura del período");
    expect(result.html).toContain("Concentra más flujo en la deuda principal");
    expect(result.html).toContain("Atencion");
    expect(result.subject).toContain("perdió tracción");
    expect(result.text).toContain("LECTURA DEL PERIODO");
    expect(result.text).toContain("SEÑAL: ATENCION");
  });

  it("ajusta el asunto cuando el usuario va mejorando", () => {
    const result = buildNotificationDigest(
      [
        {
          title: "Seguimiento premium",
          message: "Tu prioridad sigue bien encaminada.",
          severity: "INFO",
        },
      ],
      {
        signal: "IMPROVING",
        headline: "Tu flujo va mejor que en el período anterior",
        support: "Más dinero está llegando a principal.",
      },
    );

    expect(result.subject).toContain("Vas mejorando");
  });
});
