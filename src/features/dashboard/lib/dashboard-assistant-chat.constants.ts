export const quickPrompts = [
  "¿Qué pago primero?",
  "¿Cómo voy en general?",
  "¿Qué vencimientos tengo?",
  "¿Qué pagos llevamos en el chat?",
  "Pagué este préstamo",
  "Registra lo que te dije",
  "No me alcanza",
  "Estoy atrasado",
  "Dame ánimo",
  "Abrir simulador",
  "Cómo bajo intereses",
];

const claraAckMessages = [
  "Te lo dejo en simple:",
  "Aquí va mi lectura:",
  "Resumo así:",
  "Esto es lo que haría ahora:",
  "Va, mira esto:",
];

const claraImageOkMessages = [
  "Listo, revisé la captura.",
  "Ya le eché un ojo a la imagen.",
  "Analicé la imagen.",
];

export function pickClaraAckMessage() {
  return claraAckMessages[Math.floor(Math.random() * claraAckMessages.length)]!;
}

export function pickClaraImageOkMessage() {
  return claraImageOkMessages[
    Math.floor(Math.random() * claraImageOkMessages.length)
  ]!;
}

export const dominicanCreditCardRateReferences = [
  {
    label: "Banco Popular",
    aliases: ["popular", "bpd"],
    annualRange: "48% a 60% anual",
    monthlyReferencePct: 4.5,
  },
  {
    label: "Banreservas",
    aliases: ["banreservas", "reservas", "banco de reservas"],
    annualRange: "48% a 60% anual",
    monthlyReferencePct: 4.5,
  },
  {
    label: "BHD",
    aliases: ["bhd", "leon", "león"],
    annualRange: "48% a 60% anual",
    monthlyReferencePct: 4.5,
  },
  {
    label: "Scotiabank",
    aliases: ["scotia", "scotiabank"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
  {
    label: "Banco Caribe",
    aliases: ["caribe"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
  {
    label: "Banco Santa Cruz",
    aliases: ["santa cruz"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
  {
    label: "Banco Promerica",
    aliases: ["promerica"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
  {
    label: "Banco López de Haro",
    aliases: ["lopez de haro", "lópez de haro"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
  {
    label: "Banco Vimenca",
    aliases: ["vimenca"],
    annualRange: "54% a 66% anual",
    monthlyReferencePct: 5,
  },
] as const;

export const genericCreditCardRateReference = {
  label: "tarjeta de crédito en RD",
  annualRange: "48% a 72% anual",
  monthlyReferencePct: 5,
};
