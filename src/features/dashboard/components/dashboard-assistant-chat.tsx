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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
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
  currency: DebtItemDto["currency"] | null;
  dueDateText: string | null;
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

const quickPrompts = [
  "¿Qué pago primero?",
  "Pagué este préstamo",
  "No me alcanza",
  "Estoy atrasado",
  "Quiero pagar más rápido",
  "Cómo bajo intereses",
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
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

function buildImageAssistantReply(
  data: DashboardDto,
  extraction: VisionExtractionResult,
  fileName: string,
): AssistantReply {
  const primaryDebt = extraction.debts[0] ?? null;

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

  const matchedDebt = findMentionedDebt(
    data,
    `${primaryDebt.name ?? ""} ${primaryDebt.creditorName ?? ""}`,
  );
  const currency = primaryDebt.currency ?? matchedDebt?.currency ?? "DOP";
  const balanceLabel =
    primaryDebt.currentBalance !== null
      ? formatCurrency(primaryDebt.currentBalance, currency)
      : "No visible";
  const minimumPaymentLabel =
    primaryDebt.minimumPayment !== null
      ? formatCurrency(primaryDebt.minimumPayment, currency)
      : "No visible";
  const paymentDraft =
    matchedDebt && primaryDebt.minimumPayment && primaryDebt.minimumPayment > 0
      ? ({
          debtId: matchedDebt.id,
          debtName: matchedDebt.name,
          creditorName: matchedDebt.creditorName,
          amount: primaryDebt.minimumPayment,
          currency: matchedDebt.currency,
          sourcePrompt: `Imagen ${fileName}: ${extraction.summary}`,
          usedSuggestedAmount: false,
        } satisfies PaymentDraft)
      : undefined;

  return {
    title: `Leí la imagen: ${primaryDebt.name ?? primaryDebt.creditorName ?? "deuda detectada"}.`,
    body:
      paymentDraft
        ? "Encontré un pago mínimo y lo dejé listo para registrar en una deuda existente. Revísalo antes de confirmar."
        : extraction.summary,
    steps: [
      `Institución: ${primaryDebt.creditorName ?? "No visible"}.`,
      `Saldo: ${balanceLabel}.`,
      `Pago mínimo: ${minimumPaymentLabel}.`,
      primaryDebt.dueDateText
        ? `Fecha visible: ${primaryDebt.dueDateText}.`
        : "Fecha: no visible.",
    ],
    actions: paymentDraft
      ? []
      : [
          { label: "Revisar deudas", href: "/deudas", variant: "primary" },
          { label: "Registrar pago manual", href: "/pagos", variant: "secondary" },
        ],
    ...(paymentDraft ? { paymentDraft } : {}),
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
  const initialReply = useMemo(
    () => buildAssistantReply(data, "¿Qué hago ahora?"),
    [data],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-initial",
      role: "assistant",
      content:
        "Soy Clara. Escríbeme qué te preocupa y te digo el próximo paso con tus datos actuales.",
      reply: initialReply,
    },
  ]);
  const latestAssistantReply = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.reply;

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

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
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
    setIsAnalyzingImage(true);
    appendUserMessage(`Subí una imagen para que Clara la lea: ${file.name}`);

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
            prompt: input,
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

  const registerPaymentDraft = async (draft: PaymentDraft) => {
    if (isRegisteringPayment) {
      return;
    }

    try {
      setIsRegisteringPayment(true);

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
            Cuéntale tu problema financiero y Clara te responde con un próximo
            paso claro. Si toca pagar, te lleva directo a registrar el pago con
            deuda y monto sugeridos.
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

              {latestAssistantReply.paymentDraft ? (
                <div className="mt-4 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Clara puede guardarlo por ti.
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Confirma si la deuda y el monto están correctos.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="min-h-11"
                        disabled={isRegisteringPayment}
                        onClick={() =>
                          latestAssistantReply.paymentDraft
                            ? registerPaymentDraft(latestAssistantReply.paymentDraft)
                            : undefined
                        }
                      >
                        {isRegisteringPayment ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Confirmar y registrar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11"
                        onClick={() =>
                          latestAssistantReply.paymentDraft
                            ? navigate(
                                `/pagos?from=clara-chat&debtId=${latestAssistantReply.paymentDraft.debtId}&amount=${latestAssistantReply.paymentDraft.amount}`,
                              )
                            : undefined
                        }
                      >
                        <PencilLine className="size-4" />
                        Editar antes
                      </Button>
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

        <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-3 shadow-soft sm:p-4">
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

          <div className="max-h-[24rem] space-y-3 overflow-y-auto rounded-[1.35rem] bg-secondary/30 p-3">
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
            Clara organiza decisiones con tus datos registrados. No sustituye
            asesoría financiera, legal ni contable.
          </p>
        </div>
      </div>
    </section>
  );
}
