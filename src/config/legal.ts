export const CURRENT_TERMS_VERSION = "v1.0";
export const CURRENT_PRIVACY_VERSION = "v1.0";
export const LEGAL_LAST_UPDATED = "2026-04-05";

export type LegalDocumentKey = "terms" | "privacy";

export type LegalDocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocumentDefinition = {
  key: LegalDocumentKey;
  title: string;
  version: string;
  lastUpdated: string;
  description: string;
  sections: LegalDocumentSection[];
};

export const LEGAL_DISCLAIMER_COPY =
  "Deuda Clara RD es una herramienta tecnológica de organización y simulación financiera personal. No constituye asesoría financiera, legal, contable ni de inversión.";

export const REGISTRATION_LEGAL_ACCEPTANCE_COPY =
  "Acepto los Términos y Condiciones y la Política de Privacidad.";

const termsSections: LegalDocumentSection[] = [
  {
    id: "alcance",
    title: "1. Alcance del servicio",
    paragraphs: [
      "Deuda Clara RD es una plataforma digital de organización, seguimiento y simulación financiera personal. Su objetivo es ayudarte a entender tus deudas, visualizar escenarios y priorizar acciones dentro de tu propio contexto.",
      "La plataforma tiene un carácter informativo, educativo, organizativo y de simulación. No sustituye asesoría profesional individualizada.",
    ],
  },
  {
    id: "no-asesoria",
    title: "2. No es asesoría profesional",
    paragraphs: [
      "Deuda Clara RD no presta asesoría financiera, legal, contable ni de inversión. Ningún resultado, simulación, recomendación automatizada o contenido de la plataforma debe interpretarse como una recomendación profesional personalizada.",
      "Toda decisión financiera sigue siendo responsabilidad exclusiva del usuario.",
    ],
  },
  {
    id: "datos-usuario",
    title: "3. Responsabilidad sobre los datos suministrados",
    paragraphs: [
      "El usuario es responsable de la veracidad, actualización y consistencia de la información que introduce en la plataforma, incluyendo montos, tasas, pagos mínimos, fechas y cualquier otra información relacionada con sus deudas.",
      "Si los datos son incompletos o inexactos, los resultados, alertas y simulaciones también pueden serlo.",
    ],
  },
  {
    id: "simulaciones",
    title: "4. Simulaciones y cálculos",
    paragraphs: [
      "Las simulaciones, proyecciones, fechas estimadas de salida, ahorros potenciales y recomendaciones automatizadas son estimaciones generadas a partir de la información disponible y de reglas internas del sistema.",
      "Estas estimaciones pueden variar frente a cambios en tasas, cargos, mora, pagos reales, políticas de acreedores o cualquier otro factor externo.",
    ],
  },
  {
    id: "uso-aceptable",
    title: "5. Uso aceptable y suspensión",
    paragraphs: [
      "El usuario se compromete a utilizar la plataforma de forma lícita, razonable y conforme a estos términos.",
    ],
    bullets: [
      "No usar la plataforma para fraude, abuso, automatización maliciosa o acceso no autorizado.",
      "No intentar afectar la disponibilidad, integridad o seguridad del servicio.",
      "No suplantar identidades ni introducir información de terceros sin autorización.",
    ],
  },
  {
    id: "suspension",
    title: "6. Suspensión o restricción de cuentas",
    paragraphs: [
      "Deuda Clara RD podrá suspender, limitar o cerrar cuentas cuando detecte uso indebido, actividades sospechosas, incumplimiento de estos términos o riesgo para la plataforma, otros usuarios o proveedores.",
    ],
  },
  {
    id: "propiedad",
    title: "7. Propiedad intelectual",
    paragraphs: [
      "La plataforma, su diseño, código, estructura, marca, contenidos, textos, interfaces y materiales asociados son propiedad de Deuda Clara RD o de sus respectivos titulares y están protegidos por las normas aplicables.",
      "No se concede licencia para copiar, revender, descompilar o explotar comercialmente la plataforma fuera del uso normal autorizado.",
    ],
  },
  {
    id: "responsabilidad",
    title: "8. Limitación de responsabilidad",
    paragraphs: [
      "Dentro de lo permitido por la ley aplicable, Deuda Clara RD no será responsable por pérdidas directas o indirectas derivadas de decisiones tomadas por el usuario a partir de datos, simulaciones o proyecciones generadas en la plataforma.",
      "Tampoco será responsable por fallos originados por terceros, indisponibilidad temporal, errores de conectividad, problemas del proveedor de infraestructura o datos incorrectos suministrados por el propio usuario.",
    ],
  },
  {
    id: "privacidad",
    title: "9. Privacidad",
    paragraphs: [
      "El tratamiento de datos personales y el uso de proveedores externos se rige por la Política de Privacidad, disponible en un documento separado.",
    ],
  },
  {
    id: "cambios",
    title: "10. Cambios a estos términos",
    paragraphs: [
      "Deuda Clara RD podrá actualizar estos términos para reflejar cambios legales, operativos, funcionales o de seguridad. La versión vigente y su fecha de actualización se publicarán dentro de la plataforma.",
    ],
  },
  {
    id: "ley",
    title: "11. Ley aplicable",
    paragraphs: [
      "Estos términos se interpretan conforme a las leyes de la República Dominicana, sin perjuicio de otras normas imperativas que resulten aplicables.",
    ],
  },
];

const privacySections: LegalDocumentSection[] = [
  {
    id: "datos",
    title: "1. Datos que recopilamos",
    paragraphs: [
      "Recopilamos los datos que el usuario decide registrar dentro de la plataforma, como nombre, correo electrónico, configuración de seguridad, deudas, pagos, presupuestos y preferencias de uso.",
      "También podemos registrar metadata técnica razonable para seguridad y auditoría, como dirección IP, navegador, eventos de autenticación y aceptación legal.",
    ],
  },
  {
    id: "uso",
    title: "2. Cómo usamos los datos",
    paragraphs: [
      "Usamos los datos para crear y administrar la cuenta, mostrar el dashboard, calcular simulaciones, sugerir prioridades, proteger la seguridad de la plataforma, enviar correos transaccionales y mantener trazabilidad interna.",
    ],
  },
  {
    id: "base-operativa",
    title: "3. Base operativa del tratamiento dentro de la app",
    paragraphs: [
      "El tratamiento de datos responde a la necesidad operativa de prestar el servicio, proteger cuentas, mantener registros de seguridad y cumplir funciones esenciales del producto.",
      "Cuando el usuario habilita funciones adicionales, como alertas o factores de autenticación, tratamos esos datos para ejecutar esas funciones de manera segura.",
    ],
  },
  {
    id: "terceros",
    title: "4. Uso de proveedores terceros",
    paragraphs: [
      "La plataforma puede apoyarse en proveedores de infraestructura y servicios, incluyendo hosting, base de datos, correo transaccional, pagos, rate limiting o autenticación avanzada.",
      "Solo compartimos con esos proveedores la información necesaria para operar la plataforma o ejecutar funciones concretas del servicio.",
    ],
  },
  {
    id: "seguridad",
    title: "5. Seguridad",
    paragraphs: [
      "Aplicamos medidas técnicas y organizativas razonables para proteger la información, incluyendo controles de autenticación, registro de eventos, validación de origen, cifrado de datos sensibles y restricciones de acceso.",
      "Sin embargo, ningún sistema conectado a internet puede garantizar seguridad absoluta o disponibilidad perfecta en todo momento.",
    ],
  },
  {
    id: "conservacion",
    title: "6. Conservación",
    paragraphs: [
      "Conservamos la información mientras sea necesaria para operar la cuenta, atender obligaciones técnicas o legales, sostener trazabilidad de seguridad o resolver incidentes, disputas o fraudes.",
    ],
  },
  {
    id: "derechos",
    title: "7. Derechos del usuario",
    paragraphs: [
      "El usuario puede actualizar datos básicos de perfil y configuración desde la plataforma y puede solicitar información adicional sobre el tratamiento de sus datos a través de los canales de contacto habilitados.",
    ],
  },
  {
    id: "cuentas-bancarias",
    title: "8. Control del usuario",
    paragraphs: [
      "Deuda Clara RD no requiere conectar cuentas bancarias para empezar a usar la plataforma. El usuario controla la información que registra manualmente y decide qué datos financieros introducir.",
    ],
  },
  {
    id: "cambios",
    title: "9. Cambios a esta política",
    paragraphs: [
      "Podemos actualizar esta política para reflejar cambios regulatorios, operativos, tecnológicos o funcionales. La versión vigente y su fecha de actualización estarán disponibles dentro de la plataforma.",
    ],
  },
  {
    id: "contacto",
    title: "10. Contacto",
    paragraphs: [
      "Para asuntos relacionados con privacidad o tratamiento de datos, el usuario podrá contactar a Deuda Clara RD a través de los canales oficiales publicados por la plataforma.",
    ],
  },
];

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocumentDefinition> = {
  terms: {
    key: "terms",
    title: "Términos y Condiciones",
    version: CURRENT_TERMS_VERSION,
    lastUpdated: LEGAL_LAST_UPDATED,
    description:
      "Condiciones de uso de Deuda Clara RD como herramienta tecnológica de organización y simulación financiera personal.",
    sections: termsSections,
  },
  privacy: {
    key: "privacy",
    title: "Política de Privacidad",
    version: CURRENT_PRIVACY_VERSION,
    lastUpdated: LEGAL_LAST_UPDATED,
    description:
      "Cómo Deuda Clara RD recopila, usa y protege la información dentro de la plataforma.",
    sections: privacySections,
  },
};

export function hasAcceptedCurrentLegalVersions(input: {
  termsVersion?: string | null;
  privacyVersion?: string | null;
}) {
  return (
    input.termsVersion === CURRENT_TERMS_VERSION &&
    input.privacyVersion === CURRENT_PRIVACY_VERSION
  );
}
