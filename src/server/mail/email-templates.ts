type EmailTemplateResult = {
  subject: string;
  html: string;
  text: string;
};

type EmailLayoutInput = {
  subject: string;
  eyebrow?: string;
  title: string;
  intro: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  outro?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function formatDateLabel(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function buildEmailLayout(input: EmailLayoutInput): EmailTemplateResult {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #16362e; line-height: 1.65;">
      ${
        input.eyebrow
          ? `<p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #0f766e; font-weight: 700;">${escapeHtml(input.eyebrow)}</p>`
          : ""
      }
      <h1 style="margin: 0 0 14px; font-size: 28px; line-height: 1.2; color: #16362e;">${escapeHtml(input.title)}</h1>
      <p style="margin: 0 0 16px; color: #44645c;">${escapeHtml(input.intro)}</p>
      ${
        input.bullets?.length
          ? `<div style="border: 1px solid #d8e5df; border-radius: 20px; background: #f8fbfa; padding: 18px 20px; margin: 18px 0;">
              ${input.bullets
                .map(
                  (bullet) =>
                    `<p style="margin: 0 0 10px; color: #16362e;">• ${escapeHtml(bullet)}</p>`,
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        input.ctaHref && input.ctaLabel
          ? `<p style="margin: 20px 0;">
              <a href="${escapeHtml(input.ctaHref)}" style="display: inline-block; background: linear-gradient(135deg, #0f766e 0%, #0f8f78 100%); color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-weight: 700;">${escapeHtml(input.ctaLabel)}</a>
            </p>`
          : ""
      }
      ${
        input.outro
          ? `<p style="margin: 18px 0 0; color: #44645c;">${escapeHtml(input.outro)}</p>`
          : ""
      }
    </div>
  `;

  const text = [
    input.eyebrow ? input.eyebrow.toUpperCase() : null,
    input.title,
    input.intro,
    input.bullets?.length ? input.bullets.map((bullet) => `- ${bullet}`).join("\n") : null,
    input.ctaHref && input.ctaLabel ? `${input.ctaLabel}: ${input.ctaHref}` : null,
    input.outro ?? null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject: input.subject,
    html,
    text,
  };
}

export function buildWelcomeEmail(firstName: string | null | undefined) {
  const displayName = firstName?.trim() || "Hola";

  return buildEmailLayout({
    subject: "Bienvenido a Deuda Clara RD",
    eyebrow: "Tu cuenta ya está lista",
    title: `${displayName}, ya puedes empezar a ordenar tus deudas`,
    intro:
      "Deuda Clara RD ya tiene tu cuenta creada. El siguiente paso es registrar tus deudas y definir tu flujo real para darte una salida clara.",
    bullets: [
      "Configura tu presupuesto mensual y tu estrategia preferida.",
      "Registra tus deudas principales con saldo y vencimiento.",
      "Empieza a ver alertas, simulación y fecha estimada de salida.",
    ],
    ctaLabel: "Ir al onboarding",
    ctaHref: `${getAppUrl()}/onboarding`,
    outro:
      "Si no hiciste este registro, puedes ignorar este correo. No compartas tus credenciales con nadie.",
  });
}

export function buildPasswordResetEmail(token: string) {
  const url = `${getAppUrl()}/restablecer-contrasena/${token}`;

  return buildEmailLayout({
    subject: "Restablece tu acceso a Deuda Clara RD",
    eyebrow: "Seguridad",
    title: "Restablece tu contraseña",
    intro:
      "Recibimos una solicitud para cambiar tu contraseña. Usa este enlace seguro dentro de la próxima hora.",
    bullets: [
      "El enlace expira en 60 minutos.",
      "Al cambiar la contraseña se cerrarán tus sesiones activas.",
      "Si no hiciste esta solicitud, puedes ignorar este correo.",
    ],
    ctaLabel: "Restablecer contraseña",
    ctaHref: url,
    outro: "Si tienes dudas sobre la seguridad de tu cuenta, revisa tu configuración apenas vuelvas a entrar.",
  });
}

export function buildPasswordResetSuccessEmail() {
  return buildEmailLayout({
    subject: "Tu contraseña fue restablecida",
    eyebrow: "Seguridad",
    title: "Tu contraseña ya fue actualizada",
    intro:
      "El cambio se aplicó correctamente y tus sesiones anteriores fueron cerradas como medida de seguridad.",
    bullets: [
      "Entra de nuevo con tu contraseña nueva.",
      "Revisa tu configuración si quieres ajustar alertas o seguridad.",
    ],
    ctaLabel: "Ir a login",
    ctaHref: `${getAppUrl()}/login`,
    outro:
      "Si no reconoces este cambio, contáctanos cuanto antes y vuelve a iniciar el proceso de recuperación.",
  });
}

export function buildPasswordChangedEmail() {
  return buildEmailLayout({
    subject: "Confirmación de cambio de contraseña",
    eyebrow: "Seguridad",
    title: "Tu contraseña fue cambiada",
    intro:
      "Te confirmamos que la contraseña de tu cuenta fue actualizada desde tu sesión activa.",
    bullets: [
      "Si fuiste tú, no necesitas hacer nada más.",
      "Si no reconoces este cambio, restablece tu acceso inmediatamente.",
    ],
    ctaLabel: "Revisar seguridad",
    ctaHref: `${getAppUrl()}/configuracion`,
  });
}

export function buildMembershipActivatedEmail(input: {
  firstName?: string | null;
  planLabel: string;
  currentPeriodEnd?: Date | string | null;
}) {
  const formattedPeriodEnd = formatDateLabel(input.currentPeriodEnd);

  return buildEmailLayout({
    subject: `Tu plan ${input.planLabel} ya está activo`,
    eyebrow: "Membresía",
    title: `${input.firstName?.trim() || "Tu cuenta"} ahora tiene ${input.planLabel}`,
    intro:
      input.planLabel === "Premium"
        ? "Ya desbloqueaste la ruta guiada para salir más rápido de tus deudas durante 6 meses."
        : "Ya desbloqueaste el acompañamiento premium extendido para sostener tu salida de deudas por más tiempo.",
    bullets: [
      "El plan recomendado ya está disponible en tu dashboard.",
      "Puedes comparar plan actual vs plan optimizado.",
      formattedPeriodEnd ? `Tu período actual está cubierto hasta ${formattedPeriodEnd}.` : "Tu suscripción ya quedó sincronizada.",
    ],
    ctaLabel: "Abrir planes",
    ctaHref: `${getAppUrl()}/planes`,
  });
}

export function buildMembershipBillingAttentionEmail(input: {
  planLabel: string;
  status: "PAST_DUE" | "CANCELED";
}) {
  const isPastDue = input.status === "PAST_DUE";

  return buildEmailLayout({
    subject: isPastDue
      ? `Tu plan ${input.planLabel} necesita atención`
      : `Tu plan ${input.planLabel} fue cancelado`,
    eyebrow: "Facturación",
    title: isPastDue ? "Tu suscripción tiene un pago pendiente" : "Tu suscripción fue cancelada",
    intro: isPastDue
      ? "Conviene revisar tu facturación para no perder acceso al plan recomendado y al acompañamiento premium."
      : "Tu cuenta volverá a Base si no reactivas la suscripción.",
    bullets: isPastDue
      ? [
          "El plan recomendado puede dejar de estar disponible si el pago no se regulariza.",
          "Puedes revisar o actualizar tu método de pago desde facturación.",
        ]
      : [
          "Tu cuenta seguirá mostrando el modo Base.",
          "Puedes volver a activar Premium o Pro cuando lo necesites.",
        ],
    ctaLabel: "Gestionar facturación",
    ctaHref: `${getAppUrl()}/planes`,
  });
}
