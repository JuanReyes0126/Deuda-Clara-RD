"use client";

import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  badgeLabel: string;
  badgeVariant: "default" | "warning" | "danger" | "success";
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

function getPriorityDebt(data: DashboardDto) {
  const priorityId =
    data.summary.recommendedDebtId ??
    data.urgentDebt?.id ??
    data.dueSoonDebts[0]?.id ??
    null;

  if (!priorityId) {
    return data.urgentDebt ?? data.dueSoonDebts[0] ?? null;
  }

  return (
    data.urgentDebt?.id === priorityId
      ? data.urgentDebt
      : data.dueSoonDebts.find((debt) => debt.id === priorityId) ?? null
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
  const [input, setInput] = useState("");
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
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {latestAssistantReply.actions.map((action) => (
                  <Button
                    key={`${action.href}:${action.label}`}
                    type="button"
                    variant={action.variant === "secondary" ? "secondary" : "primary"}
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
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej. No me alcanza para todas..."
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
