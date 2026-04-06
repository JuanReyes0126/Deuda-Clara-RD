type ProConversionCopyInput = {
  currentMonths: number | null;
  currentInterest: number;
  currentTotalPaid: number;
  optimizedMonths: number | null;
  optimizedInterest: number;
  optimizedTotalPaid: number;
  monthsSaved: number | null;
  savings: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMonths(value: number | null) {
  if (value === null) {
    return "sin salida clara";
  }

  const rounded = Math.max(1, Math.round(value));
  return `${rounded} ${rounded === 1 ? "mes" : "meses"}`;
}

export const PRO_CONVERSION_COPY = {
  hero: {
    subtitle:
      "Ahora mismo estás pagando más tiempo y más intereses de lo necesario. Este escenario no es el más eficiente.",
    highlight:
      "Cada mes que sigas así, pierdes dinero que podrías quedarte.",
  },
  painBlock: {
    title: "Estás perdiendo dinero sin darte cuenta",
    warning: "Mientras no ajustes, sigues pagando de más.",
  },
  comparison: {
    current: {
      title: "Escenario actual",
      badges: ["Más lento", "Más costoso"],
    },
    optimized: {
      title: "Escenario optimizado",
      badges: ["Más rápido", "Menor costo", "Recomendado"],
    },
  },
  impact: {
    title: "Esto es lo que estás dejando sobre la mesa",
    emotional: "Este dinero ya lo estás perdiendo ahora mismo.",
  },
  paywall: {
    title: "Tu mejor estrategia está bloqueada",
    subtitle:
      "Aquí es donde dejas de pagar de más y empiezas a avanzar de verdad.",
    content: [
      "Optimización automática de pagos",
      "Ruta clara para salir antes",
      "Menos intereses, menos tiempo",
    ],
    note: "Base solo muestra el problema. Pro te muestra la solución.",
  },
  cta: {
    primary: {
      text: "Desbloquear y ahorrar ahora",
      subtext: "Empieza a pagar menos desde hoy",
    },
    secondary: {
      text: "Ver mi mejor estrategia",
      subtext: "Descubre cuánto puedes recortar",
    },
  },
  microcopy: [
    "Esto no es el escenario más eficiente",
    "Podrías estar pagando menos",
    "Hay una mejor forma de salir",
    "Estás más cerca de salir de lo que crees",
    "Optimiza tu deuda, no solo la pagues",
  ],
} as const;

export function buildProConversionCopy(input: ProConversionCopyInput) {
  const safeSavings = Math.max(0, Math.round(input.savings));
  const roundedMonthsSaved = Math.max(1, Math.round(input.monthsSaved ?? 0));
  const monthlyLeak = Math.max(
    0,
    Math.round(input.currentInterest / Math.max(Math.round(input.currentMonths ?? 1), 1)),
  );

  return {
    hero: {
      title:
        safeSavings > 0 && roundedMonthsSaved > 0
          ? `Podrías salir ${roundedMonthsSaved} ${roundedMonthsSaved === 1 ? "mes" : "meses"} antes y ahorrar ${formatMoney(safeSavings)}`
          : "Podrías salir antes y pagar menos",
      subtitle: PRO_CONVERSION_COPY.hero.subtitle,
      highlight: PRO_CONVERSION_COPY.hero.highlight,
    },
    painBlock: {
      title: PRO_CONVERSION_COPY.painBlock.title,
      bullets: [
        `Tu escenario actual te cuesta ${formatMoney(input.currentInterest)} en intereses`,
        `Estás tardando ${formatMonths(input.currentMonths)} en salir`,
        "Existe una forma de salir en menos tiempo pagando menos",
      ],
      warning: PRO_CONVERSION_COPY.painBlock.warning,
    },
    comparison: {
      current: {
        title: PRO_CONVERSION_COPY.comparison.current.title,
        badges: PRO_CONVERSION_COPY.comparison.current.badges,
        content: [
          `Tiempo: ${formatMonths(input.currentMonths)}`,
          `Intereses: ${formatMoney(input.currentInterest)}`,
          `Total pagado: ${formatMoney(input.currentTotalPaid)}`,
        ],
      },
      optimized: {
        title: PRO_CONVERSION_COPY.comparison.optimized.title,
        badges: PRO_CONVERSION_COPY.comparison.optimized.badges,
        content: [
          `Tiempo: ${formatMonths(input.optimizedMonths)}`,
          `Intereses: ${formatMoney(input.optimizedInterest)}`,
          `Total pagado: ${formatMoney(input.optimizedTotalPaid)}`,
        ],
      },
    },
    impact: {
      title: PRO_CONVERSION_COPY.impact.title,
      benefits: [
        roundedMonthsSaved > 0
          ? `Ahorras ${roundedMonthsSaved} ${roundedMonthsSaved === 1 ? "mes" : "meses"} de tu vida`
          : "Ahorras tiempo con una mejor estrategia",
        safeSavings > 0
          ? `Te quedas con ${formatMoney(safeSavings)} más en tu bolsillo`
          : "Te quedas con más dinero en tu bolsillo",
        "Sales de la deuda más rápido con una mejor estrategia",
      ],
      emotional: PRO_CONVERSION_COPY.impact.emotional,
    },
    paywall: {
      ...PRO_CONVERSION_COPY.paywall,
    },
    cta: PRO_CONVERSION_COPY.cta,
    urgency:
      monthlyLeak > 0
        ? `Si sigues con este ritmo, seguirás pagando ${formatMoney(monthlyLeak)}+ extra cada mes.`
        : "Si sigues con este ritmo, seguirás pagando más intereses de los necesarios.",
    microcopy: PRO_CONVERSION_COPY.microcopy,
  };
}
