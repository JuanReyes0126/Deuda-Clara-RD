"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ImageIcon,
  Loader2,
  MessageCircle,
  PencilLine,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import type { DashboardDto, DebtItemDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDistance } from "@/lib/utils/date";

type AssistantAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type AssistantReply = {
  title: string;
  body: string;
  steps: string[];
  actions: AssistantAction[];
  paymentDraft?: PaymentDraft;
  paymentDrafts?: PaymentDraft[];
  badgeLabel: string;
  badgeVariant: "default" | "warning" | "danger" | "success";
};

type PaymentDraft = {
  debtId: string;
  debtName: string;
  creditorName: string;
  amount: number;
  currency: DebtItemDto["currency"];
  sourcePrompt: string;
  usedSuggestedAmount: boolean;
};

type VisionDebtExtraction = {
  name: string | null;
  creditorName: string | null;
  currentBalance: number | null;
  minimumPayment: number | null;
  paymentAmount: number | null;
  interestRate: number | null;
  interestRateType: "ANNUAL" | "MONTHLY" | null;
  productType: "CREDIT_CARD" | "LOAN" | "INFORMAL" | "UNKNOWN";
  currency: DebtItemDto["currency"] | null;
  dueDateText: string | null;
  detectedAction: "payment" | "statement" | "unknown";
  confidence: "low" | "medium" | "high";
};

type VisionExtractionResult = {
  debts: VisionDebtExtraction[];
  summary: string;
  missingFields: string[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: AssistantReply;
};

type DashboardAssistantChatProps = {
  data: DashboardDto;
};

type ImageInputSource = "archivo" | "arrastre" | "portapapeles";

const quickPrompts = [
  "¿Qué pago primero?",
  "Pagué este préstamo",
  "No me alcanza",
  "Estoy atrasado",
  "Quiero pagar más rápido",
  "Cómo bajo intereses",
];

const dominicanCreditCardRateReferences = [
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

const genericCreditCardRateReference = {
  label: "tarjeta de crédito en RD",
  annualRange: "48% a 72% anual",
  monthlyReferencePct: 5,
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getCreditCardRateReference(creditorName: string | null) {
  const normalizedCreditor = normalizeText(creditorName ?? "");

  return (
    dominicanCreditCardRateReferences.find((reference) =>
      reference.aliases.some((alias) =>
        normalizedCreditor.includes(normalizeText(alias)),
      ),
    ) ?? genericCreditCardRateReference
  );
}

function buildPaymentHref(debt: DebtItemDto | null, amount?: number | null) {
  const params = new URLSearchParams({ from: "clara-chat" });

  if (debt?.id) {
    params.set("debtId", debt.id);
  }

  if (amount && Number.isFinite(amount) && amount > 0) {
    params.set("amount", String(Number(amount.toFixed(2))));
  }

  return `/pagos?${params.toString()}`;
}

function getAssistantDebts(data: DashboardDto) {
  const debtsById = new Map<string, DebtItemDto>();

  for (const debt of [
    ...data.activeDebts,
    ...(data.urgentDebt ? [data.urgentDebt] : []),
    ...data.dueSoonDebts,
  ]) {
    debtsById.set(debt.id, debt);
  }

  return Array.from(debtsById.values());
}

function getPriorityDebt(data: DashboardDto) {
  const priorityId =
    data.summary.recommendedDebtId ??
    data.urgentDebt?.id ??
    data.dueSoonDebts[0]?.id ??
    null;
  const debts = getAssistantDebts(data);

  if (!priorityId) {
    return data.urgentDebt ?? data.dueSoonDebts[0] ?? debts[0] ?? null;
  }

  return (
    debts.find((debt) => debt.id === priorityId) ??
    data.urgentDebt ??
    data.dueSoonDebts[0] ??
    null
  );
}

function getSuggestedPaymentAmount(debt: DebtItemDto | null) {
  if (!debt) {
    return null;
  }

  if (debt.minimumPayment > 0) {
    return debt.minimumPayment;
  }

  return debt.effectiveBalance > 0 ? debt.effectiveBalance : null;
}

function getDebtName(data: DashboardDto, priorityDebt: DebtItemDto | null) {
  return (
    priorityDebt?.name ??
    data.summary.recommendedDebtName ??
    data.recommendedOrder[0]?.name ??
    "tu deuda prioritaria"
  );
}

function createPaymentAction(debt: DebtItemDto | null) {
  const amount = getSuggestedPaymentAmount(debt);

  return {
    label: amount ? "Registrar pago sugerido" : "Registrar pago",
    href: buildPaymentHref(debt, amount),
    variant: "primary" as const,
  };
}

function parseMoneyNumber(rawValue: string) {
  const compactValue = rawValue.replace(/\s/g, "");

  if (compactValue.includes(".") && compactValue.includes(",")) {
    return Number(compactValue.replace(/,/g, ""));
  }

  if (compactValue.includes(",")) {
    const parts = compactValue.split(",");
    const lastPart = parts.at(-1) ?? "";

    if (lastPart.length === 3 && parts.length > 1) {
      return Number(parts.join(""));
    }

    return Number(compactValue.replace(",", "."));
  }

  return Number(compactValue.replace(/,/g, ""));
}

function parsePaymentAmount(message: string) {
  const numericMilMatch = normalizeText(message).match(
    /\b(\d+(?:[.,]\d+)?)\s*(mil|k)\b/,
  );

  if (numericMilMatch?.[1]) {
    const parsedAmount = parseMoneyNumber(numericMilMatch[1]) * 1000;
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const currencyMatch = message.match(
    /(?:rd\$|us\$|\$|dop|usd|pesos?|d[oó]lares?)\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\s*(?:rd\$|us\$|\$|dop|usd|pesos?|d[oó]lares?)/i,
  );
  const currencyValue = currencyMatch?.[1] ?? currencyMatch?.[2];

  if (currencyValue) {
    const parsedAmount = parseMoneyNumber(currencyValue);
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const paymentVerbMatch = normalizeText(message).match(
    /(?:pague|abone|abona|pagaron|registre|registrar|anota|guarda)\s+(?:rd\$|us\$|\$)?\s*([0-9][0-9.,]*)/,
  );

  if (paymentVerbMatch?.[1]) {
    const parsedAmount = parseMoneyNumber(paymentVerbMatch[1]);
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const fallbackMatch = normalizeText(message).match(/\b([0-9]{3,}[0-9.,]*)\b/);

  if (!fallbackMatch?.[1]) {
    return null;
  }

  const parsedAmount = parseMoneyNumber(fallbackMatch[1]);

  return Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;
}

function getDebtAliasScore(debt: DebtItemDto, normalizedMessage: string) {
  let score = 0;
  const normalizedName = normalizeText(debt.name);
  const normalizedCreditor = normalizeText(debt.creditorName);
  const nameTokens = normalizedName
    .split(/\s+/)
    .filter((token) => token.length >= 4);

  if (normalizedMessage.includes(normalizedName)) {
    score += 8;
  }

  if (normalizedCreditor && normalizedMessage.includes(normalizedCreditor)) {
    score += 5;
  }

  score += nameTokens.filter((token) => normalizedMessage.includes(token)).length;

  if (
    /prestamo|cuota|financiamiento/.test(normalizedMessage) &&
    debt.type.includes("LOAN")
  ) {
    score += 2;
  }

  if (/tarjeta|card|credito/.test(normalizedMessage) && debt.type === "CREDIT_CARD") {
    score += 2;
  }

  if (/informal|familiar|amigo/.test(normalizedMessage) && debt.type === "INFORMAL") {
    score += 2;
  }

  return score;
}

function findMentionedDebt(data: DashboardDto, message: string) {
  const debts = getAssistantDebts(data);
  const normalizedMessage = normalizeText(message);
  const priorityDebt = getPriorityDebt(data);
  const scoredDebts = debts
    .map((debt) => ({
      debt,
      score:
        getDebtAliasScore(debt, normalizedMessage) +
        (debt.id === priorityDebt?.id ? 1.5 : 0),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredDebts[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.debt;
  }

  return getPriorityDebt(data);
}

function isPaymentRegistrationIntent(message: string) {
  return /pague|pago realizado|ya pague|lo pague|la pague|abone|abonado|registralo|registrarlo|registrame|anota|anotame|guarda|guardalo|marcalo|marcarlo/.test(
    normalizeText(message),
  );
}

function buildPaymentDraft(data: DashboardDto, message: string) {
  if (!isPaymentRegistrationIntent(message)) {
    return null;
  }

  const debt = findMentionedDebt(data, message);

  if (!debt) {
    return null;
  }

  const parsedAmount = parsePaymentAmount(message);
  const suggestedAmount = getSuggestedPaymentAmount(debt);
  const amount = parsedAmount ?? suggestedAmount;

  if (!amount || amount <= 0) {
    return null;
  }

  return {
    debtId: debt.id,
    debtName: debt.name,
    creditorName: debt.creditorName,
    amount,
    currency: debt.currency,
    sourcePrompt: message,
    usedSuggestedAmount: !parsedAmount,
  } satisfies PaymentDraft;
}

function findImageMatchedDebt(data: DashboardDto, extraction: VisionDebtExtraction) {
  const debts = getAssistantDebts(data);
  const normalizedMessage = normalizeText(
    `${extraction.name ?? ""} ${extraction.creditorName ?? ""}`,
  );
  const scoredDebts = debts
    .map((debt) => ({
      debt,
      score: getDebtAliasScore(debt, normalizedMessage),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredDebts[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.debt;
  }

  return debts.length === 1 ? debts[0] : null;
}

function buildImagePaymentDraft({
  data,
  extraction,
  fileName,
  summary,
}: {
  data: DashboardDto;
  extraction: VisionDebtExtraction;
  fileName: string;
  summary: string;
}): PaymentDraft | null {
  const matchedDebt = findImageMatchedDebt(data, extraction);
  const amount = extraction.paymentAmount ?? extraction.minimumPayment;

  if (!matchedDebt || !amount || amount <= 0) {
    return null;
  }

  return {
    debtId: matchedDebt.id,
    debtName: matchedDebt.name,
    creditorName: matchedDebt.creditorName,
    amount,
    currency: matchedDebt.currency,
    sourcePrompt: `Imagen ${fileName}: ${summary}`,
    usedSuggestedAmount: false,
  } satisfies PaymentDraft;
}

function buildImageAssistantReply(
  data: DashboardDto,
  extraction: VisionExtractionResult,
  fileName: string,
): AssistantReply {
  const detectedDebts = extraction.debts.slice(0, 5);
  const primaryDebt = detectedDebts[0] ?? null;

  if (!primaryDebt) {
    return {
      title: "Recibí la imagen, pero no detecté una deuda clara.",
      body:
        "Intenta con una captura más recortada donde se vea saldo, pago mínimo, institución y fecha.",
      steps: [
        "Recorta la imagen alrededor del estado de cuenta.",
        "Evita capturas borrosas o muy oscuras.",
        "Si quieres, escribe el monto y Clara prepara el pago.",
      ],
      actions: [],
      badgeLabel: "Imagen recibida",
      badgeVariant: "warning",
    };
  }

  const paymentDrafts = detectedDebts
    .map((debtExtraction) =>
      buildImagePaymentDraft({
        data,
        extraction: debtExtraction,
        fileName,
        summary: extraction.summary,
      }),
    )
    .filter((draft): draft is PaymentDraft => Boolean(draft));
  const matchedDebt = findImageMatchedDebt(data, primaryDebt);
  const currency = primaryDebt.currency ?? matchedDebt?.currency ?? "DOP";
  const balanceLabel =
    primaryDebt.currentBalance !== null
      ? formatCurrency(primaryDebt.currentBalance, currency)
      : "No visible";
  const minimumPaymentLabel =
    primaryDebt.minimumPayment !== null
      ? formatCurrency(primaryDebt.minimumPayment, currency)
      : "No visible";
  const detectedPaymentCount = detectedDebts.filter(
    (debt) => debt.paymentAmount !== null,
  ).length;
  const isCreditCardLike =
    primaryDebt.productType === "CREDIT_CARD" ||
    /tarjeta|credito|crédito|card/.test(
      normalizeText(`${primaryDebt.name ?? ""} ${primaryDebt.creditorName ?? ""}`),
    );
  const isRegistrationCandidate =
    paymentDrafts.length === 0 &&
    (primaryDebt.currentBalance !== null ||
      primaryDebt.minimumPayment !== null ||
      Boolean(primaryDebt.productType && primaryDebt.productType !== "UNKNOWN"));

  if (isRegistrationCandidate) {
    const rateReference = getCreditCardRateReference(primaryDebt.creditorName);
    const extractedRateLabel = primaryDebt.interestRate
      ? `${primaryDebt.interestRate}% ${
          primaryDebt.interestRateType === "MONTHLY" ? "mensual" : "anual"
        }`
      : null;

    return {
      title: isCreditCardLike
        ? "Puedo ayudarte a registrar esta tarjeta, pero confirma la tasa."
        : "Puedo ayudarte a registrar esta deuda, pero necesito la tasa.",
      body: isCreditCardLike
        ? `Para tarjetas en RD uso referencias por banco solo como ayuda. No guardo una tasa estimada sin que el usuario la confirme.`
        : "Para que el plan sea realista, Clara necesita la tasa de interés y si esa tasa es anual o mensual.",
      steps: [
        `Institución: ${primaryDebt.creditorName ?? "No visible"}.`,
        `Saldo: ${balanceLabel}.`,
        `Pago mínimo: ${minimumPaymentLabel}.`,
        extractedRateLabel
          ? `Tasa detectada: ${extractedRateLabel}.`
          : isCreditCardLike
            ? `Referencia ${rateReference.label}: ${rateReference.annualRange} (aprox. ${rateReference.monthlyReferencePct}% mensual). Confírmala en tu contrato o estado.`
            : "Falta tasa de interés: escríbela como anual o mensual antes de guardar.",
      ],
      actions: [
        { label: "Registrar deuda", href: "/deudas", variant: "primary" },
        { label: "Preguntarle a Clara", href: "/dashboard", variant: "secondary" },
      ],
      badgeLabel: isCreditCardLike ? "Tasa por confirmar" : "Falta tasa",
      badgeVariant: "warning",
    };
  }

  const reply: AssistantReply = {
    title:
      paymentDrafts.length > 1
        ? `Detecté ${paymentDrafts.length} pagos listos para registrar.`
        : `Leí la imagen: ${primaryDebt.name ?? primaryDebt.creditorName ?? "deuda detectada"}.`,
    body:
      paymentDrafts.length > 1
        ? "Clara encontró varios movimientos y los preparó como multi registro. Revisa la lista antes de confirmar todos."
        : paymentDrafts.length === 1
          ? "Encontré un pago y lo dejé listo para registrar en una deuda existente. Revísalo antes de confirmar."
        : extraction.summary,
    steps:
      paymentDrafts.length > 1
        ? paymentDrafts.map(
            (draft) =>
              `${draft.debtName}: ${formatCurrency(draft.amount, draft.currency)}.`,
          )
        : [
            `Institución: ${primaryDebt.creditorName ?? "No visible"}.`,
            `Saldo: ${balanceLabel}.`,
            detectedPaymentCount > 0
              ? `Pago detectado: ${formatCurrency(primaryDebt.paymentAmount ?? 0, currency)}.`
              : `Pago mínimo: ${minimumPaymentLabel}.`,
            primaryDebt.dueDateText
              ? `Fecha visible: ${primaryDebt.dueDateText}.`
              : "Fecha: no visible.",
          ],
    actions: paymentDrafts.length > 0
      ? []
      : [
          { label: "Revisar deudas", href: "/deudas", variant: "primary" },
          { label: "Registrar pago manual", href: "/pagos", variant: "secondary" },
        ],
    badgeLabel:
      primaryDebt.confidence === "high"
        ? "Lectura alta"
        : primaryDebt.confidence === "medium"
          ? "Revisar datos"
          : "Baja confianza",
    badgeVariant:
      primaryDebt.confidence === "high"
        ? "success"
        : primaryDebt.confidence === "medium"
          ? "warning"
          : "danger",
  };

  if (paymentDrafts.length === 1 && paymentDrafts[0]) {
    reply.paymentDraft = paymentDrafts[0];
  }

  if (paymentDrafts.length > 1) {
    reply.paymentDrafts = paymentDrafts;
  }

  return reply;
}

function getImageTransferFile(files: FileList | null) {
  return Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ?? null;
}

function hasImageTransfer(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.items ?? []).some((item) =>
    item.type.startsWith("image/"),
  );
}

function buildAssistantReply(data: DashboardDto, message: string): AssistantReply {
  const text = normalizeText(message);
  const priorityDebt = getPriorityDebt(data);
  const priorityDebtName = getDebtName(data, priorityDebt);
  const suggestedAmount = getSuggestedPaymentAmount(priorityDebt);
  const hasDebts = data.summary.totalDebt > 0;
  const dueDate = priorityDebt?.nextDueDate
    ? formatRelativeDistance(priorityDebt.nextDueDate)
    : null;
  const debtCurrency = priorityDebt?.currency ?? "DOP";
  const suggestedAmountLabel = suggestedAmount
    ? formatCurrency(suggestedAmount, debtCurrency)
    : null;
  const isLateIntent = /atras|mora|vencid|tarde|urgente|bloque/.test(text);
  const isBudgetIntent =
    /no me alcanza|alcanz|dinero|cobro|sueldo|ingreso|gasto|presupuesto|quincena|nomina/.test(
      text,
    );
  const isInterestIntent = /interes|ahorr|caro|cost|bajar|reduc/.test(text);
  const isPaymentIntent =
    /pago|pagar|primero|rapido|rapido|prioridad|saldar|cuota/.test(text);
  const paymentDraft = buildPaymentDraft(data, message);

  if (!hasDebts) {
    return {
      title: "Primero carguemos una deuda para poder guiarte bien.",
      body: "Clara necesita al menos una deuda activa para decirte qué pagar primero y cuánto conviene mover.",
      steps: [
        "Registra la deuda con saldo, tasa y fecha de pago.",
        "Luego vuelve al dashboard y Clara te dará una prioridad clara.",
      ],
      actions: [
        { label: "Registrar deuda", href: "/deudas", variant: "primary" },
      ],
      badgeLabel: "Primer paso",
      badgeVariant: "default",
    };
  }

  if (isPaymentRegistrationIntent(message) && !paymentDraft) {
    return {
      title: "Puedo registrarlo por ti, pero necesito un poco más de detalle.",
      body:
        "Dime el monto y, si puedes, el nombre de la deuda. Por ejemplo: “Clara, pagué RD$5,000 al préstamo del Popular”.",
      steps: [
        "Incluye el monto pagado.",
        "Menciona el préstamo, tarjeta o banco.",
        "Yo preparo el registro y tú solo confirmas.",
      ],
      actions: [
        { label: "Registrar manualmente", href: "/pagos", variant: "secondary" },
      ],
      badgeLabel: "Falta dato",
      badgeVariant: "warning",
    };
  }

  if (paymentDraft) {
    const amountLabel = formatCurrency(paymentDraft.amount, paymentDraft.currency);

    return {
      title: `Listo, puedo registrar ${amountLabel} en ${paymentDraft.debtName}.`,
      body: paymentDraft.usedSuggestedAmount
        ? `No vi el monto exacto en tu mensaje, así que preparé el pago de referencia de ${amountLabel}. Confirma solo si ese fue el monto correcto.`
        : `Detecté el pago y lo dejé listo para guardar. Al confirmar, Clara actualiza tu historial y el saldo de esa deuda.`,
      steps: [
        `Deuda: ${paymentDraft.debtName}.`,
        `Monto: ${amountLabel}.`,
        "Fecha: hoy.",
      ],
      actions: [],
      paymentDraft,
      badgeLabel: "Pago listo",
      badgeVariant: "success",
    };
  }

  if (isBudgetIntent) {
    const minimumLabel = formatCurrency(data.summary.totalMinimumPayment);
    const capacityLabel = data.summary.monthlyDebtCapacity
      ? formatCurrency(data.summary.monthlyDebtCapacity)
      : null;

    return {
      title: "Si el dinero no alcanza, protege primero lo que evita mora.",
      body: capacityLabel
        ? `Tu capacidad estimada para deudas es ${capacityLabel}. Antes de pagar extra, cubre el mínimo del mes: ${minimumLabel}.`
        : `Empieza por cubrir el mínimo del mes: ${minimumLabel}. Si falta dinero, registra tus ingresos y gastos para que Clara ajuste la recomendación.`,
      steps: [
        `Prioridad de hoy: ${priorityDebtName}.`,
        suggestedAmountLabel
          ? `Monto sugerido para empezar: ${suggestedAmountLabel}.`
          : "Registra el monto que puedas cubrir hoy.",
        "Evita repartir dinero en demasiados frentes si hay vencimientos cerca.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ajustar ingresos y gastos", href: "/configuracion", variant: "secondary" },
      ],
      badgeLabel: "Presupuesto",
      badgeVariant: "warning",
    };
  }

  if (isLateIntent || priorityDebt?.status === "LATE") {
    return {
      title: `Atiende ${priorityDebtName} antes de abrir otro frente.`,
      body: dueDate
        ? `Esta deuda está presionando tu plan y vence ${dueDate}. Resolverla primero mantiene el resto más estable.`
        : "Esta deuda tiene la señal más urgente ahora mismo. Conviene resolverla antes de acelerar otra.",
      steps: [
        suggestedAmountLabel
          ? `Registra al menos ${suggestedAmountLabel}.`
          : "Registra el pago que puedas cubrir hoy.",
        "Después revisa si queda algún vencimiento cercano.",
        "Si no puedes cubrirla completa, anota el pago parcial para mantener el historial real.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver todas mis deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Urgente",
      badgeVariant: "danger",
    };
  }

  if (isInterestIntent) {
    return {
      title: "Para bajar intereses, concentra el dinero donde más cuesta.",
      body:
        data.summary.estimatedMonthlyInterest > 0
          ? `Hoy estás cargando cerca de ${formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses estimados este mes. Clara empezaría por ${priorityDebtName}.`
          : `Clara empezaría por ${priorityDebtName} y evitaría repartir pagos extras sin una prioridad.`,
      steps: [
        "Cubre mínimos para no crear mora.",
        `Envía el extra disponible a ${priorityDebtName}.`,
        "Usa el simulador para ver cuánto cambia el tiempo de salida.",
      ],
      actions: [
        { label: "Abrir simulador", href: "/simulador", variant: "primary" },
        createPaymentAction(priorityDebt),
      ],
      badgeLabel: "Ahorro",
      badgeVariant: "success",
    };
  }

  if (isPaymentIntent) {
    return {
      title: `Paga primero ${priorityDebtName}.`,
      body: suggestedAmountLabel
        ? `Mi recomendación rápida es registrar ${suggestedAmountLabel} para esa deuda y mantener el plan en movimiento.`
        : "Mi recomendación rápida es registrar un pago en esa deuda antes de mover dinero a otra.",
      steps: [
        suggestedAmountLabel
          ? `Usa ${suggestedAmountLabel} como punto de partida.`
          : "Captura el pago real que hiciste o harás.",
        "Si puedes pagar extra, no lo repartas: ponlo en la prioridad actual.",
        "Después revisa el simulador para confirmar el impacto.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Siguiente pago",
      badgeVariant: "success",
    };
  }

  return {
    title: data.assistantCoach.title,
    body: data.assistantCoach.description,
    steps:
      data.assistantCoach.notes.length > 0
        ? data.assistantCoach.notes.slice(0, 3)
        : [
            `Prioridad actual: ${priorityDebtName}.`,
            "Registra tus pagos para que la recomendación mejore.",
            "Usa el simulador si quieres comparar escenarios.",
          ],
    actions: [
      {
        label: data.assistantCoach.primaryAction.label,
        href: data.assistantCoach.primaryAction.href,
        variant: "primary",
      },
      ...(data.assistantCoach.secondaryAction
        ? [
            {
              label: data.assistantCoach.secondaryAction.label,
              href: data.assistantCoach.secondaryAction.href,
              variant: "secondary" as const,
            },
          ]
        : []),
    ],
    badgeLabel: data.assistantCoach.badgeLabel,
    badgeVariant: data.assistantCoach.badgeVariant,
  };
}

export function DashboardAssistantChat({ data }: DashboardAssistantChatProps) {
  const { navigate } = useAppNavigation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragDepthRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const initialReply = useMemo(
    () => buildAssistantReply(data, "¿Qué hago ahora?"),
    [data],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-initial",
      role: "assistant",
      content:
        "Soy Clara. Háblame normal: dime qué pagaste, qué te preocupa o sube una captura y yo te ayudo a convertirlo en una acción.",
      reply: initialReply,
    },
  ]);
  const latestAssistantReply = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.reply;
  const pendingPaymentDrafts =
    latestAssistantReply?.paymentDrafts ??
    (latestAssistantReply?.paymentDraft ? [latestAssistantReply.paymentDraft] : []);

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: "smooth",
    });
  }, [isAnalyzingImage, messages]);

  const sendPrompt = (prompt: string) => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    const reply = buildAssistantReply(data, trimmedPrompt);

    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `user-${nextIndex}`,
          role: "user",
          content: trimmedPrompt,
        },
        {
          id: `assistant-${nextIndex}`,
          role: "assistant",
          content: "Esto es lo que haría ahora:",
          reply,
        },
      ];
    });
    setInput("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendPrompt(input);
  };

  const appendAssistantReply = (reply: AssistantReply, content: string) => {
    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `assistant-${nextIndex}`,
          role: "assistant",
          content,
          reply,
        },
      ];
    });
  };

  const appendUserMessage = (content: string) => {
    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `user-${nextIndex}`,
          role: "user",
          content,
        },
      ];
    });
  };

  const processImageFile = (file: File | null, source: ImageInputSource) => {
    if (!file) {
      return;
    }

    if (isAnalyzingImage) {
      toast.info("Clara ya está leyendo una imagen.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen válida.");
      return;
    }

    if (file.size > 5_000_000) {
      toast.error("La imagen pesa demasiado. Usa una captura más recortada.");
      return;
    }

    const reader = new FileReader();
    const currentPrompt = input.trim();
    const sourceLabel =
      source === "arrastre"
        ? "Arrastré"
        : source === "portapapeles"
          ? "Pegué"
          : "Subí";

    setIsAnalyzingImage(true);
    setIsDraggingImage(false);
    appendUserMessage(
      `${sourceLabel} una imagen para que Clara la lea: ${file.name}`,
    );

    reader.onload = async () => {
      try {
        const imageDataUrl = String(reader.result ?? "");
        const response = await fetchWithCsrf("/api/assistant/image-extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageDataUrl,
            prompt: currentPrompt,
          }),
        });
        const payload = await readJsonPayload<{
          error?: string;
          extraction?: VisionExtractionResult;
        }>(response);

        if (!response.ok || !payload.extraction) {
          appendAssistantReply(
            {
              title: "Recibí la foto, pero la lectura automática no está activa.",
              body:
                payload.error ??
                "Para leer fotos como ChatGPT necesitamos activar visión/OCR con una API key. Mientras tanto, escribe el saldo y pago mínimo y Clara prepara la acción.",
              steps: [
                "Puedes escribir: “Clara, pagué RD$5,000 al préstamo del Popular”.",
                "También puedes escribir saldo, pago mínimo y banco.",
                "Cuando visión esté activa, Clara extraerá esos datos desde la imagen.",
              ],
              actions: [],
              badgeLabel: "Falta visión",
              badgeVariant: "warning",
            },
            "No pude leer la imagen automáticamente.",
          );
          return;
        }

        appendAssistantReply(
          buildImageAssistantReply(data, payload.extraction, file.name),
          "Analicé la imagen.",
        );
      } catch (error) {
        appendAssistantReply(
          {
            title: "No pude analizar la imagen.",
            body:
              error instanceof Error
                ? error.message
                : "Intenta de nuevo con una captura más clara.",
            steps: [
              "Usa una imagen donde se vea el saldo.",
              "Incluye el pago mínimo si aparece.",
              "Evita capturas muy grandes o borrosas.",
            ],
            actions: [],
            badgeLabel: "Imagen",
            badgeVariant: "warning",
          },
          "La imagen no se pudo procesar.",
        );
      } finally {
        setIsAnalyzingImage(false);
      }
    };

    reader.onerror = () => {
      setIsAnalyzingImage(false);
      toast.error("No pude cargar esa imagen.");
    };

    reader.readAsDataURL(file);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    processImageFile(event.target.files?.[0] ?? null, "archivo");
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);
    processImageFile(getImageTransferFile(event.dataTransfer.files), "arrastre");
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pastedImage = getImageTransferFile(event.clipboardData.files);

    if (!pastedImage) {
      return;
    }

    event.preventDefault();
    processImageFile(pastedImage, "portapapeles");
  };

  const createPaymentFromDraft = async (draft: PaymentDraft) => {
    const response = await fetchWithCsrf("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        debtId: draft.debtId,
        amount: draft.amount,
        source: "MANUAL",
        paidAt: new Date().toISOString().slice(0, 10),
        notes: `Registrado desde Clara: ${draft.sourcePrompt.slice(0, 220)}`,
      }),
    });
    const payload = await readJsonPayload<{ error?: string }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo registrar el pago.");
    }
  };

  const registerPaymentDraft = async (draft: PaymentDraft) => {
    if (isRegisteringPayment) {
      return;
    }

    try {
      setIsRegisteringPayment(true);
      await createPaymentFromDraft(draft);

      toast.success("Clara registró el pago.");
      setMessages((current) => {
        const nextIndex = current.length;

        return [
          ...current,
          {
            id: `assistant-payment-${nextIndex}`,
            role: "assistant",
            content: "Pago registrado.",
            reply: {
              title: `${formatCurrency(draft.amount, draft.currency)} registrado en ${draft.debtName}.`,
              body:
                "Ya guardé el pago en tu historial. El dashboard se actualizará con el nuevo saldo y avance.",
              steps: [
                `Deuda actualizada: ${draft.debtName}.`,
                "Historial de pagos actualizado.",
                "Puedes revisar el detalle en Pagos.",
              ],
              actions: [
                { label: "Ver pagos", href: "/pagos", variant: "primary" },
                { label: "Ver deudas", href: "/deudas", variant: "secondary" },
              ],
              badgeLabel: "Registrado",
              badgeVariant: "success",
            },
          },
        ];
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  const registerPaymentDrafts = async (drafts: PaymentDraft[]) => {
    if (isRegisteringPayment || drafts.length === 0) {
      return;
    }

    try {
      setIsRegisteringPayment(true);

      for (const draft of drafts) {
        await createPaymentFromDraft(draft);
      }

      toast.success("Clara registró los pagos.");
      setMessages((current) => {
        const nextIndex = current.length;
        const totalAmountByCurrency = drafts.reduce(
          (totals, draft) => {
            totals[draft.currency] += draft.amount;
            return totals;
          },
          { DOP: 0, USD: 0 },
        );
        const totalLabels = [
          totalAmountByCurrency.DOP > 0
            ? formatCurrency(totalAmountByCurrency.DOP, "DOP")
            : null,
          totalAmountByCurrency.USD > 0
            ? formatCurrency(totalAmountByCurrency.USD, "USD")
            : null,
        ].filter(Boolean);

        return [
          ...current,
          {
            id: `assistant-payment-bulk-${nextIndex}`,
            role: "assistant",
            content: "Multi registro completado.",
            reply: {
              title: `${drafts.length} pagos registrados por Clara.`,
              body: `Ya guardé el multi registro${totalLabels.length ? ` por ${totalLabels.join(" y ")}` : ""}. El dashboard se actualizará con los nuevos saldos.`,
              steps: drafts.map(
                (draft) =>
                  `${draft.debtName}: ${formatCurrency(draft.amount, draft.currency)}.`,
              ),
              actions: [
                { label: "Ver pagos", href: "/pagos", variant: "primary" },
                { label: "Ver dashboard", href: "/dashboard", variant: "secondary" },
              ],
              badgeLabel: "Multi pago",
              badgeVariant: "success",
            },
          },
        ];
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron registrar todos los pagos.",
      );
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-primary/18 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.18),transparent_34%),linear-gradient(135deg,rgba(240,248,245,0.98),rgba(255,248,241,0.94))] p-4 shadow-[0_22px_48px_rgba(15,88,74,0.12)] sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-[0_14px_28px_rgba(15,88,74,0.18)]">
              <Bot className="size-5" />
            </span>
            <div>
              <p className="section-kicker">Mini IA Clara</p>
              <h2 className="text-foreground mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                Habla con Clara y decide más rápido.
              </h2>
            </div>
            {latestAssistantReply ? (
              <Badge variant={latestAssistantReply.badgeVariant}>
                {latestAssistantReply.badgeLabel}
              </Badge>
            ) : null}
          </div>

          <p className="section-summary mt-4 max-w-3xl text-sm leading-6 sm:text-base sm:leading-7">
            Háblale como a una persona: “pagué este préstamo”, “no me alcanza”
            o “mira esta captura”. Si toca pagar, Clara prepara el registro para
            que solo confirmes.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10 rounded-full bg-white/82"
                onClick={() => sendPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>

          {latestAssistantReply ? (
            <div className="mt-5 rounded-[1.5rem] border border-white/80 bg-white/88 p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight text-foreground">
                    {latestAssistantReply.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {latestAssistantReply.body}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {latestAssistantReply.steps.map((step) => (
                  <div
                    key={step}
                    className="flex items-start gap-2 rounded-2xl bg-secondary/45 px-3 py-2 text-sm leading-6 text-foreground"
                  >
                    <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              {pendingPaymentDrafts.length > 0 ? (
                <div className="mt-4 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingPaymentDrafts.length > 1
                          ? `Clara puede registrar ${pendingPaymentDrafts.length} pagos por ti.`
                          : "Clara puede guardarlo por ti."}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {pendingPaymentDrafts.length > 1
                          ? "Revisa el multi registro antes de confirmarlo."
                          : "Confirma si la deuda y el monto están correctos."}
                      </p>
                      {pendingPaymentDrafts.length > 1 ? (
                        <div className="mt-3 grid gap-2">
                          {pendingPaymentDrafts.map((draft) => (
                            <div
                              key={`${draft.debtId}:${draft.amount}`}
                              className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-foreground"
                            >
                              <span className="font-semibold">{draft.debtName}</span>{" "}
                              <span className="text-muted">
                                {formatCurrency(draft.amount, draft.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="min-h-11"
                        disabled={isRegisteringPayment}
                        onClick={() =>
                          pendingPaymentDrafts.length > 1
                            ? registerPaymentDrafts(pendingPaymentDrafts)
                            : registerPaymentDraft(pendingPaymentDrafts[0]!)
                        }
                      >
                        {isRegisteringPayment ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {pendingPaymentDrafts.length > 1
                          ? "Confirmar multi registro"
                          : "Confirmar y registrar"}
                      </Button>
                      {pendingPaymentDrafts.length === 1 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11"
                          onClick={() =>
                            navigate(
                              `/pagos?from=clara-chat&debtId=${pendingPaymentDrafts[0]!.debtId}&amount=${pendingPaymentDrafts[0]!.amount}`,
                            )
                          }
                        >
                          <PencilLine className="size-4" />
                          Editar antes
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11"
                          onClick={() => navigate("/pagos?from=clara-chat")}
                        >
                          <PencilLine className="size-4" />
                          Revisar manual
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {latestAssistantReply.actions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {latestAssistantReply.actions.map((action) => (
                    <Button
                      key={`${action.href}:${action.label}`}
                      type="button"
                      variant={
                        action.variant === "secondary" ? "secondary" : "primary"
                      }
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => navigate(action.href)}
                    >
                      {action.label}
                      {action.variant === "primary" ? (
                        <ArrowRight className="size-4" />
                      ) : null}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={`relative rounded-[1.75rem] border bg-white/90 p-3 shadow-soft outline-none transition sm:p-4 ${
            isDraggingImage
              ? "border-primary/60 ring-primary/20 ring-4"
              : "border-white/80"
          }`}
          role="region"
          tabIndex={0}
          aria-label="Chat con Clara. Puedes escribir, pegar o arrastrar imágenes."
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {isDraggingImage ? (
            <div className="absolute inset-3 z-20 grid place-items-center rounded-[1.55rem] border-2 border-dashed border-primary/55 bg-white/92 text-center shadow-soft backdrop-blur-sm">
              <div className="max-w-xs px-5">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <UploadCloud className="size-6" />
                </span>
                <p className="mt-3 text-base font-semibold text-foreground">
                  Suelta la captura aquí
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Clara intentará leer saldo, pago mínimo, institución y fecha.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Conversación
                </p>
                <p className="text-xs text-muted">
                  Respuestas basadas en tu dashboard.
                </p>
              </div>
            </div>
            <Badge variant="success">Activa</Badge>
          </div>

          <div className="mb-3 flex items-start gap-3 rounded-[1.2rem] border border-primary/10 bg-primary/5 px-3 py-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white text-primary">
              <UploadCloud className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Arrastra una captura aquí o pégala con Cmd/Ctrl + V.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Útil para estados de cuenta, tarjetas, saldos y pagos mínimos.
              </p>
            </div>
          </div>

          <div
            ref={messageListRef}
            className="max-h-[24rem] space-y-3 overflow-y-auto rounded-[1.35rem] bg-secondary/30 p-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-[1.2rem] px-3.5 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "border border-border/70 bg-white text-foreground"
                  }`}
                >
                  <p>{message.content}</p>
                  {message.reply ? (
                    <p className="mt-2 text-xs opacity-75">
                      {message.reply.title}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
            {isAnalyzingImage ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.2rem] border border-primary/10 bg-white px-3.5 py-3 text-sm leading-6 text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Clara está leyendo la imagen...</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Si la captura está clara, extraerá los datos principales.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
            <label className="border-border text-primary hover:border-primary/30 hover:bg-primary/5 grid min-h-12 cursor-pointer place-items-center rounded-2xl border bg-white px-3 transition">
              {isAnalyzingImage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              <span className="sr-only">Subir imagen para Clara</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={isAnalyzingImage}
                onChange={handleImageUpload}
              />
            </label>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe o sube una foto..."
              aria-label="Mensaje para Clara"
              className="min-h-12 bg-white"
            />
            <Button type="submit" className="min-h-12 px-4">
              <Send className="size-4" />
              <span className="sr-only">Enviar mensaje</span>
            </Button>
          </form>

          <p className="mt-3 px-1 text-xs leading-5 text-muted">
            Puedes escribir, arrastrar una captura o pegarla con Cmd/Ctrl + V.
            Clara organiza decisiones con tus datos registrados; no sustituye
            asesoría financiera, legal ni contable.
          </p>
        </div>
      </div>
    </section>
  );
}
