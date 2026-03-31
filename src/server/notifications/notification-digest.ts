type NotificationDigestItem = {
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  actionLabel?: string | null;
  actionHref?: string | null;
};

type NotificationDigestSummary = {
  signal?: "IMPROVING" | "STABLE" | "REGRESSION" | "NO_BASELINE";
  headline: string;
  support: string;
  nextStep?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSeverityLabel(severity: NotificationDigestItem["severity"]) {
  if (severity === "CRITICAL") {
    return "Crítica";
  }

  if (severity === "WARNING") {
    return "Importante";
  }

  return "Informativa";
}

function getSummarySignalLabel(signal: NonNullable<NotificationDigestSummary["signal"]>) {
  if (signal === "IMPROVING") {
    return "Mejorando";
  }

  if (signal === "REGRESSION") {
    return "Atencion";
  }

  if (signal === "STABLE") {
    return "Estable";
  }

  return "Sin historial";
}

function getDigestSubject(
  notifications: NotificationDigestItem[],
  summary?: NotificationDigestSummary,
) {
  if (summary?.signal === "IMPROVING") {
    return "Vas mejorando: tu seguimiento semanal de deudas";
  }

  if (summary?.signal === "REGRESSION") {
    return "Atencion: tu plan perdió tracción esta semana";
  }

  if (summary?.signal === "STABLE") {
    return "Tu progreso sigue estable: resumen semanal de deudas";
  }

  if (summary?.signal === "NO_BASELINE") {
    return "Empieza a construir tu historial: resumen semanal de deudas";
  }

  return notifications.length === 1
    ? "Tienes 1 alerta de deuda pendiente"
    : `Tienes ${notifications.length} alertas de deuda pendientes`;
}

export function buildNotificationDigest(
  notifications: NotificationDigestItem[],
  summary?: NotificationDigestSummary,
) {
  const subject = getDigestSubject(notifications, summary);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #16362e; line-height: 1.6;">
      <h1 style="margin-bottom: 8px;">Resumen de alertas de Deuda Clara RD</h1>
      <p style="margin-top: 0;">Estas son las alertas más relevantes detectadas en tu cuenta hoy.</p>
      ${
        summary
          ? `<div style="margin-top: 18px; border: 1px solid #cbe6dc; border-radius: 20px; background: #eef8f4; padding: 18px;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #0f766e; font-weight: 700;">
                Lectura del período
              </p>
              ${
                summary.signal
                  ? `<p style="margin: 0 0 10px; display: inline-block; border-radius: 999px; padding: 6px 10px; background: #d7f2e5; color: #0f766e; font-size: 12px; font-weight: 700;">
                      ${escapeHtml(getSummarySignalLabel(summary.signal))}
                    </p>`
                  : ""
              }
              <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #16362e;">
                ${escapeHtml(summary.headline)}
              </p>
              <p style="margin: 0; color: #44645c;">
                ${escapeHtml(summary.support)}
              </p>
              ${
                summary.nextStep
                  ? `<p style="margin: 12px 0 0; color: #16362e; font-weight: 700;">Siguiente paso: ${escapeHtml(summary.nextStep)}</p>`
                  : ""
              }
              ${
                summary.ctaHref && summary.ctaLabel
                  ? `<p style="margin: 12px 0 0;"><a href="${escapeHtml(summary.ctaHref)}" style="color: #0f766e; font-weight: 700; text-decoration: none;">${escapeHtml(summary.ctaLabel)}</a></p>`
                  : ""
              }
            </div>`
          : ""
      }
      <div style="margin-top: 20px;">
        ${notifications
          .map(
            (notification) => `
              <div style="border: 1px solid #d8e5df; border-radius: 18px; padding: 16px; margin-bottom: 12px; background: #f8fbfa;">
                <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #0f766e;">
                  ${escapeHtml(getSeverityLabel(notification.severity))}
                </p>
                <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #16362e;">
                  ${escapeHtml(notification.title)}
                </p>
                <p style="margin: 0; color: #44645c;">
                  ${escapeHtml(notification.message)}
                </p>
                ${
                  notification.actionHref && notification.actionLabel
                    ? `<p style="margin: 12px 0 0;"><a href="${escapeHtml(notification.actionHref)}" style="color: #0f766e; font-weight: 700; text-decoration: none;">${escapeHtml(notification.actionLabel)}</a></p>`
                    : ""
                }
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;

  const text = notifications
    .map((notification) =>
      [
        `[${getSeverityLabel(notification.severity)}] ${notification.title}`,
        notification.message,
        notification.actionHref && notification.actionLabel
          ? `${notification.actionLabel}: ${notification.actionHref}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return {
    subject,
    html,
    text: [
      summary
        ? [
            "LECTURA DEL PERIODO",
            summary.signal ? `SEÑAL: ${getSummarySignalLabel(summary.signal).toUpperCase()}` : null,
            summary.headline,
            summary.support,
            summary.nextStep ? `Siguiente paso: ${summary.nextStep}` : null,
            summary.ctaHref && summary.ctaLabel ? `${summary.ctaLabel}: ${summary.ctaHref}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : null,
      text,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
