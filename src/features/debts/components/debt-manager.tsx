"use client";

import { Archive, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeCTA } from "@/components/membership/upgrade-cta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ExecutiveSummaryStrip,
  type ExecutiveSummaryItem,
} from "@/components/shared/executive-summary-strip";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { TrustInlineNote } from "@/components/shared/trust-inline-note";
import {
  UPGRADE_MESSAGES,
  getDebtLimitUpgradeNotes,
} from "@/config/upgrade-messages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { resolveFeatureAccess } from "@/lib/feature-access";
import type {
  MembershipBillingStatus,
  MembershipPlanId,
} from "@/lib/membership/plans";
import {
  sanitizeMultilineText,
  sanitizeText,
} from "@/lib/security/sanitize";
import type { DebtItemDto, DebtSummaryDto } from "@/lib/types/app";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

const debtTypeLabels: Record<DebtFormValues["type"], string> = {
  CREDIT_CARD: "Tarjeta de crédito",
  PERSONAL_LOAN: "Préstamo personal",
  VEHICLE: "Vehículo",
  MORTGAGE: "Hipotecaria",
  INFORMAL: "Informal",
  OTHER: "Otra",
};

const debtStatusLabels: Record<DebtFormValues["status"], string> = {
  CURRENT: "Al día",
  LATE: "Atrasada",
  NEGOTIATING: "En negociación",
  PAID: "Pagada",
  ARCHIVED: "Archivada",
};

const debtRateModeLabels: Record<DebtFormValues["interestRateMode"], string> = {
  FIXED: "Tasa fija",
  VARIABLE: "Tasa variable",
};

const debtPaymentTypeLabels: Record<DebtFormValues["paymentAmountType"], string> = {
  FIXED: "Pago fijo",
  VARIABLE: "Pago variable",
};

const monthOptions = [
  { value: "01", label: "Ene" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Abr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Ago" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dic" },
] as const;

const currentYear = new Date().getFullYear();
const debtDateYearOptions = Array.from({ length: 61 }, (_, index) =>
  String(currentYear - 10 + index),
);

const debtQuickPresets = [
  {
    key: "CREDIT_CARD",
    label: "Tarjeta",
    description: "Ideal para capturar corte, vencimiento y uso de la línea.",
    values: {
      type: "CREDIT_CARD" as const,
      status: "CURRENT" as const,
      interestRateType: "ANNUAL" as const,
      interestRateMode: "VARIABLE" as const,
      currency: "DOP" as const,
      paymentAmountType: "VARIABLE" as const,
    },
  },
  {
    key: "PERSONAL_LOAN",
    label: "Préstamo",
    description: "Pensado para cuota fija, saldo pendiente y fecha final.",
    values: {
      type: "PERSONAL_LOAN" as const,
      status: "CURRENT" as const,
      interestRateType: "ANNUAL" as const,
      interestRateMode: "FIXED" as const,
      currency: "DOP" as const,
      paymentAmountType: "FIXED" as const,
      creditLimit: undefined,
      statementDay: undefined,
    },
  },
  {
    key: "INFORMAL",
    label: "Informal",
    description: "Útil para deudas con familiares, amigos o acuerdos directos.",
    values: {
      type: "INFORMAL" as const,
      status: "CURRENT" as const,
      interestRateType: "MONTHLY" as const,
      interestRateMode: "VARIABLE" as const,
      currency: "DOP" as const,
      paymentAmountType: "VARIABLE" as const,
      creditLimit: undefined,
      statementDay: undefined,
    },
  },
] as const;

const CUSTOM_CREDITOR_VALUE = "__OTHER_CREDITOR__";

const rdCreditorOptions = [
  "Banreservas",
  "Banco Popular Dominicano",
  "Banco BHD",
  "Asociación Popular de Ahorros y Préstamos",
  "Asociación Cibao de Ahorros y Préstamos",
  "Scotiabank República Dominicana",
  "Banco Santa Cruz",
  "Banco Caribe",
  "Banco Promerica",
  "Banco Vimenca",
  "Banco López de Haro",
  "Asociación La Nacional de Ahorros y Préstamos",
  "Asociación Duarte de Ahorros y Préstamos",
  "Asociación Romana de Ahorros y Préstamos",
  "Asociación Mocana de Ahorros y Préstamos",
] as const;

const rdCreditorOptionSet = new Set<string>(rdCreditorOptions);

type DebtListFilter = "ALL" | "CURRENT" | "LATE";

type DebtFormValues = {
  name: string;
  creditorName: string;
  type: "CREDIT_CARD" | "PERSONAL_LOAN" | "VEHICLE" | "MORTGAGE" | "INFORMAL" | "OTHER";
  status: "CURRENT" | "LATE" | "NEGOTIATING" | "PAID" | "ARCHIVED";
  currency: "DOP" | "USD";
  currentBalance: number;
  creditLimit: number | undefined;
  interestRate: number;
  interestRateType: "ANNUAL" | "MONTHLY";
  interestRateMode: "FIXED" | "VARIABLE";
  minimumPayment: number;
  paymentAmountType: "FIXED" | "VARIABLE";
  statementDay: number | undefined;
  dueDay: number | undefined;
  nextDueDate: string | undefined;
  notificationsEnabled: boolean;
  lateFeeAmount: number;
  extraChargesAmount: number;
  notes: string | undefined;
  startedAt: string | undefined;
  estimatedEndAt: string | undefined;
};

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function optionalNumberValue(value: string) {
  return value === "" ? undefined : Number(value);
}

function requiredNumberValue(value: string) {
  return value === "" ? 0 : Number(value);
}

function optionalDateValue(value: string) {
  return value ? value : undefined;
}

function optionalNotesValue(value: string) {
  const sanitized = sanitizeMultilineText(value);
  return sanitized.length ? sanitized : undefined;
}

function padDateSegment(value: number | string) {
  return String(value).padStart(2, "0");
}

function splitDateInput(value: string | undefined) {
  if (!value) {
    return {
      year: "",
      month: "",
      day: "",
    };
  }

  const [year = "", month = "", day = ""] = value.split("-");

  return {
    year,
    month,
    day,
  };
}

function getDaysInMonth(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isFinite(numericYear) || !Number.isFinite(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return 31;
  }

  return new Date(numericYear, numericMonth, 0).getDate();
}

function buildDateInputValue(input: {
  currentValue?: string | undefined;
  year?: string | undefined;
  month?: string | undefined;
  fallbackDay?: string | undefined;
}) {
  const current = splitDateInput(input.currentValue);
  const year = input.year ?? current.year;
  const month = input.month ?? current.month;

  if (!year || !month) {
    return undefined;
  }

  const currentDay = current.day || input.fallbackDay || "01";
  const safeDay = Math.min(Number(currentDay) || 1, getDaysInMonth(year, month));

  return `${year}-${month}-${padDateSegment(safeDay)}`;
}

function addYearsToDateInput(value: string | undefined, years: number, fallbackValue?: string | undefined) {
  const baseValue = value || fallbackValue || new Date().toISOString().slice(0, 10);
  const [year = "", month = "", day = "01"] = baseValue.split("-");

  if (!year || !month) {
    return baseValue;
  }

  const nextYear = String(Number(year) + years);
  const safeDay = Math.min(Number(day) || 1, getDaysInMonth(nextYear, month));

  return `${nextYear}-${month}-${padDateSegment(safeDay)}`;
}

function getInterestRateLabel(mode: DebtFormValues["interestRateMode"]) {
  return mode === "VARIABLE" ? "Tasa actual de referencia" : "Tasa";
}

function getInterestRateSupport(mode: DebtFormValues["interestRateMode"]) {
  return mode === "VARIABLE"
    ? "Usa la tasa actual o la más reciente. Luego podrás actualizarla cuando cambie."
    : "Introduce la tasa tal como aparece en el contrato o estado.";
}

function getPaymentAmountLabel(mode: DebtFormValues["paymentAmountType"]) {
  return mode === "VARIABLE" ? "Pago actual de referencia" : "Pago mínimo";
}

function getPaymentAmountSupport(mode: DebtFormValues["paymentAmountType"]) {
  return mode === "VARIABLE"
    ? "Usa el pago más reciente o el monto que hoy te piden como referencia."
    : "Esto ayuda a detectar cuándo una deuda se estanca solo pagando el mínimo.";
}

function getDebtStructureSummary(input: Pick<DebtItemDto, "interestRateMode" | "paymentAmountType">) {
  return `${debtRateModeLabels[input.interestRateMode]} · ${debtPaymentTypeLabels[input.paymentAmountType]}`;
}

function buildRequiredTextValidation(maxLength: number) {
  return {
    validate: {
      required: (value: string) =>
        sanitizeText(value).length >= 1 || "Este campo es obligatorio.",
      maxLength: (value: string) =>
        sanitizeText(value).length <= maxLength || "El texto es demasiado largo.",
    },
    setValueAs: (value: string) => sanitizeText(value),
  } as const;
}

function buildMoneyValidation(
  fieldName: "currentBalance" | "creditLimit" | "minimumPayment" | "lateFeeAmount" | "extraChargesAmount",
  { optional = false } = {},
) {
  return {
    validate: {
      amount: (value: number | undefined, formValues: DebtFormValues) => {
        if (value === undefined) {
          return optional || "Debes introducir un monto válido.";
        }

        if (!Number.isFinite(value)) {
          return "Debes introducir un monto válido.";
        }

        if (value < 0) {
          return "El monto no puede ser negativo.";
        }

        if (value > 999_999_999) {
          return "El monto es demasiado alto.";
        }

        if (
          fieldName === "minimumPayment" &&
          value >
            formValues.currentBalance +
              formValues.lateFeeAmount +
              formValues.extraChargesAmount
        ) {
          return formValues.paymentAmountType === "VARIABLE"
            ? "El pago de referencia no puede superar la deuda total actual."
            : "El pago mínimo no puede superar la deuda total actual.";
        }

        if (
          fieldName === "creditLimit" &&
          value !== undefined &&
          formValues.type !== "CREDIT_CARD"
        ) {
          return "El límite de crédito solo aplica a tarjetas.";
        }

        if (
          fieldName === "currentBalance" &&
          formValues.creditLimit !== undefined &&
          formValues.creditLimit > 0 &&
          value > formValues.creditLimit * 1.5
        ) {
          return "El saldo parece inconsistente con el límite de crédito.";
        }

        return true;
      },
    },
    setValueAs: optional ? optionalNumberValue : requiredNumberValue,
  } as const;
}

const nameValidation = buildRequiredTextValidation(120);
const creditorNameValidation = buildRequiredTextValidation(120);
const currentBalanceValidation = buildMoneyValidation("currentBalance");
const creditLimitValidation = buildMoneyValidation("creditLimit", { optional: true });
const minimumPaymentValidation = buildMoneyValidation("minimumPayment");
const lateFeeAmountValidation = buildMoneyValidation("lateFeeAmount");
const extraChargesAmountValidation = buildMoneyValidation("extraChargesAmount");

const interestRateValidation = {
  validate: {
    amount: (value: number) => {
      if (!Number.isFinite(value)) {
        return "Debes introducir una tasa válida.";
      }

      if (value < 0) {
        return "La tasa no puede ser negativa.";
      }

      return value <= 999 || "La tasa es demasiado alta.";
    },
  },
  setValueAs: requiredNumberValue,
} as const;

function buildDayValidation({
  requiresCreditCard = false,
} = {}) {
  return {
    validate: {
      day: (value: number | undefined, formValues: DebtFormValues) => {
        if (value === undefined) {
          return true;
        }

        if (!Number.isInteger(value)) {
          return "Debes introducir un valor entero válido.";
        }

        if (value < 1) {
          return "Debe ser mayor que cero.";
        }

        if (value > 31) {
          return "Debe estar entre 1 y 31.";
        }

        if (requiresCreditCard && formValues.type !== "CREDIT_CARD") {
          return "La fecha de corte solo aplica a tarjetas.";
        }

        return true;
      },
    },
    setValueAs: optionalNumberValue,
  } as const;
}

const statementDayValidation = buildDayValidation({ requiresCreditCard: true });
const dueDayValidation = buildDayValidation();

const estimatedEndAtValidation = {
  validate: (value: string | undefined, formValues: DebtFormValues) => {
    if (!value || !formValues.startedAt) {
      return true;
    }

    return (
      new Date(value) >= new Date(formValues.startedAt) ||
      "La fecha estimada de término no puede ser anterior al inicio."
    );
  },
  setValueAs: optionalDateValue,
} as const;

const optionalDateValidation = {
  setValueAs: optionalDateValue,
} as const;

const notesValidation = {
  validate: (value: string | undefined) =>
    (value?.length ?? 0) <= 4000 || "El texto es demasiado largo.",
  setValueAs: optionalNotesValue,
} as const;

function emptyDebtValues(): DebtFormValues {
  return {
    name: "",
    creditorName: "",
    type: "CREDIT_CARD",
    status: "CURRENT",
    currency: "DOP",
    currentBalance: 0,
    creditLimit: undefined,
    interestRate: 0,
    interestRateType: "ANNUAL",
    interestRateMode: "FIXED",
    minimumPayment: 0,
    paymentAmountType: "FIXED",
    statementDay: undefined,
    dueDay: undefined,
    nextDueDate: undefined,
    notificationsEnabled: true,
    lateFeeAmount: 0,
    extraChargesAmount: 0,
    notes: undefined,
    startedAt: undefined,
    estimatedEndAt: undefined,
  };
}

function debtToFormValues(debt: DebtItemDto): DebtFormValues {
  return {
    name: debt.name,
    creditorName: debt.creditorName,
    type: debt.type as DebtFormValues["type"],
    status: debt.status as DebtFormValues["status"],
    currency: debt.currency,
    currentBalance: debt.currentBalance,
    creditLimit: debt.creditLimit ?? undefined,
    interestRate: debt.interestRate,
    interestRateType: debt.interestRateType as DebtFormValues["interestRateType"],
    interestRateMode: debt.interestRateMode,
    minimumPayment: debt.minimumPayment,
    paymentAmountType: debt.paymentAmountType,
    statementDay: debt.statementDay ?? undefined,
    dueDay: debt.dueDay ?? undefined,
    nextDueDate: toDateInput(debt.nextDueDate),
    notificationsEnabled: debt.notificationsEnabled,
    lateFeeAmount: debt.lateFeeAmount,
    extraChargesAmount: debt.extraChargesAmount,
    notes: debt.notes ?? undefined,
    startedAt: toDateInput(debt.startedAt),
    estimatedEndAt: toDateInput(debt.estimatedEndAt),
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetchWithCsrf(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await readJsonPayload<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }

  return payload;
}

function getDebtPriorityLabel(
  debt: DebtItemDto,
  options: { isPriority: boolean },
) {
  if (debt.status === "LATE") {
    return "Riesgo alto";
  }

  if (options.isPriority) {
    return "Prioridad";
  }

  if (debt.nextDueDate) {
    return "Por vencer";
  }

  return "Estable";
}

function getDebtPriorityVariant(
  debt: DebtItemDto,
  options: { isPriority: boolean },
): "danger" | "warning" | "success" | "default" {
  if (debt.status === "LATE") {
    return "danger";
  }

  if (options.isPriority) {
    return "warning";
  }

  if (debt.status === "CURRENT") {
    return "success";
  }

  return "default";
}

export function DebtManager({
  debts,
  summary,
  entryFlow = null,
  membershipTier,
  billingStatus,
}: {
  debts: DebtItemDto[];
  summary: DebtSummaryDto;
  entryFlow?: "onboarding" | null;
  membershipTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
}) {
  const router = useRouter();
  const access = resolveFeatureAccess({
    membershipTier,
    membershipBillingStatus: billingStatus,
  });
  const upgradeHref = `/planes?plan=${access.upgradeTargetTier}&source=deudas`;
  const [selectedDebt, setSelectedDebt] = useState<DebtItemDto | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<DebtListFilter>("ALL");
  const activeDebts = useMemo(
    () => debts.filter((debt) => !debt.archivedAt && debt.status !== "ARCHIVED"),
    [debts],
  );
  const form = useForm<DebtFormValues>({
    defaultValues: emptyDebtValues(),
  });
  const isOnboardingFlow = entryFlow === "onboarding";
  const watchedType = useWatch({ control: form.control, name: "type" }) ?? "CREDIT_CARD";
  const watchedCreditorName = useWatch({ control: form.control, name: "creditorName" }) ?? "";
  const watchedCurrentBalance = Number(
    useWatch({ control: form.control, name: "currentBalance" }) ?? 0,
  );
  const watchedLateFee = Number(
    useWatch({ control: form.control, name: "lateFeeAmount" }) ?? 0,
  );
  const watchedExtraCharges = Number(
    useWatch({ control: form.control, name: "extraChargesAmount" }) ?? 0,
  );
  const watchedMinimumPayment = Number(
    useWatch({ control: form.control, name: "minimumPayment" }) ?? 0,
  );
  const watchedInterestRate = Number(
    useWatch({ control: form.control, name: "interestRate" }) ?? 0,
  );
  const watchedCreditLimit = Number(
    useWatch({ control: form.control, name: "creditLimit" }) ?? 0,
  );
  const watchedInterestRateType =
    useWatch({ control: form.control, name: "interestRateType" }) ?? "ANNUAL";
  const watchedInterestRateMode =
    useWatch({ control: form.control, name: "interestRateMode" }) ?? "FIXED";
  const watchedPaymentAmountType =
    useWatch({ control: form.control, name: "paymentAmountType" }) ?? "FIXED";
  const watchedNextDueDate = useWatch({ control: form.control, name: "nextDueDate" }) ?? "";
  const watchedStartedAt = useWatch({ control: form.control, name: "startedAt" }) ?? "";
  const watchedEstimatedEndAt =
    useWatch({ control: form.control, name: "estimatedEndAt" }) ?? "";
  const isCreditCard = watchedType === "CREDIT_CARD";
  const isPresetCreditor = rdCreditorOptionSet.has(watchedCreditorName);
  const creditorSelectValue = watchedCreditorName
    ? isPresetCreditor
      ? watchedCreditorName
      : CUSTOM_CREDITOR_VALUE
    : "";
  const filteredDebts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return debts.filter((debt) => {
      if (listFilter === "CURRENT" && debt.status !== "CURRENT") {
        return false;
      }

      if (listFilter === "LATE" && debt.status !== "LATE") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [debt.name, debt.creditorName, debt.notes ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [debts, listFilter, searchQuery]);
  const priorityDebt = useMemo(() => {
    if (!activeDebts.length) {
      return null;
    }

    return [...activeDebts].sort((left, right) => {
      const lateDelta =
        Number(right.status === "LATE") - Number(left.status === "LATE");

      if (lateDelta !== 0) {
        return lateDelta;
      }

      const leftDueTime = left.nextDueDate ? new Date(left.nextDueDate).getTime() : Number.POSITIVE_INFINITY;
      const rightDueTime = right.nextDueDate ? new Date(right.nextDueDate).getTime() : Number.POSITIVE_INFINITY;

      if (leftDueTime !== rightDueTime) {
        return leftDueTime - rightDueTime;
      }

      return right.monthlyInterestEstimate - left.monthlyInterestEstimate;
    })[0] ?? null;
  }, [activeDebts]);
  const debtLimitReached =
    activeDebts.length >= access.maxActiveDebts && !selectedDebt;
  const hiddenDebtCount = Math.max(0, activeDebts.length - access.maxActiveDebts);
  const debtLimitNotes = getDebtLimitUpgradeNotes();
  const hasVariablePaymentDebt = activeDebts.some(
    (debt) => debt.paymentAmountType === "VARIABLE",
  );
  const debtSummaryItems: ExecutiveSummaryItem[] = [
    {
      label: "Saldo total",
      value: formatCurrency(summary.totalBalance),
      support: activeDebts.length
        ? "Lo que hoy necesitas ordenar para recuperar control."
        : "Aquí aparecerá tu panorama apenas registres la primera deuda.",
      badgeLabel: activeDebts.length ? "Panorama real" : "Empieza aquí",
      badgeVariant: activeDebts.length ? ("success" as const) : ("default" as const),
      featured: true,
    },
    {
      label: "Deudas activas",
      value: String(summary.activeDebtCount),
      support: access.isBase
        ? `Cuentas abiertas que hoy compiten por tu flujo. Base llega hasta ${access.maxActiveDebts}.`
        : `Cuentas abiertas que hoy compiten por tu flujo. Tu plan permite hasta ${access.maxActiveDebts}.`,
      valueKind: "text" as const,
    },
    {
      label: hasVariablePaymentDebt ? "Pago base total" : "Pago mínimo total",
      value: formatCurrency(summary.totalMinimumPayment),
      support: hasVariablePaymentDebt
        ? "Incluye mínimos fijos y montos de referencia para deudas variables."
        : "Lo mínimo para sostenerte al día este mes.",
    },
    {
      label: "Más presión hoy",
      value: priorityDebt?.name ?? "Define tu prioridad",
      support: priorityDebt
        ? "Conviene revisarla antes de repartir el flujo del mes."
        : "Con una deuda registrada te diremos cuál presiona más.",
      valueKind: "text" as const,
      badgeLabel: priorityDebt?.status === "LATE" ? "Atrasada" : undefined,
      badgeVariant: "warning" as const,
    },
  ];
  const livePreview = useMemo(() => {
    const effectiveBalance = watchedCurrentBalance + watchedLateFee + watchedExtraCharges;
    const monthlyRate =
      watchedInterestRateType === "MONTHLY"
        ? watchedInterestRate / 100
        : watchedInterestRate / 100 / 12;
    const monthlyInterestEstimate = watchedCurrentBalance * monthlyRate;
    const utilizationPct =
      isCreditCard && watchedCreditLimit > 0
        ? Number(((watchedCurrentBalance / watchedCreditLimit) * 100).toFixed(1))
        : null;
    const minimumPaymentRisk = isCreditCard && watchedMinimumPayment > 0
      ? watchedMinimumPayment <= monthlyInterestEstimate * 1.1
      : false;

    return {
      effectiveBalance,
      monthlyInterestEstimate,
      utilizationPct,
      minimumPaymentRisk,
    };
  }, [
    isCreditCard,
    watchedCreditLimit,
    watchedCurrentBalance,
    watchedExtraCharges,
    watchedInterestRate,
    watchedInterestRateType,
    watchedLateFee,
    watchedMinimumPayment,
  ]);

  useEffect(() => {
    if (!isCreditCard) {
      form.setValue("creditLimit", undefined);
      form.setValue("statementDay", undefined);
    }
  }, [form, isCreditCard]);

  const updateDateAssist = (
    fieldName: "nextDueDate" | "startedAt" | "estimatedEndAt",
    part: "month" | "year",
    value: string,
  ) => {
    const currentValue = form.getValues(fieldName);
    const currentDateParts = splitDateInput(currentValue);
    const today = new Date();
    const nextValue = buildDateInputValue({
      currentValue,
      year:
        part === "year"
          ? value
          : currentDateParts.year || String(today.getFullYear()),
      month:
        part === "month"
          ? value
          : currentDateParts.month || padDateSegment(today.getMonth() + 1),
      fallbackDay: fieldName === "nextDueDate" ? "15" : "01",
    });

    form.setValue(fieldName, nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const resetForm = () => {
    setSelectedDebt(null);
    setExpandedDebtId(null);
    form.reset(emptyDebtValues());
  };

  const applyPreset = (
    preset: (typeof debtQuickPresets)[number],
    options?: { preserveText?: boolean },
  ) => {
    form.reset({
      ...(options?.preserveText
        ? {
            ...emptyDebtValues(),
            name: form.getValues("name"),
            creditorName: form.getValues("creditorName"),
            currentBalance: form.getValues("currentBalance"),
            minimumPayment: form.getValues("minimumPayment"),
            interestRate: form.getValues("interestRate"),
            nextDueDate: form.getValues("nextDueDate"),
          }
        : emptyDebtValues()),
      ...preset.values,
    });
    setSelectedDebt(null);
  };

  const startEditingDebt = (debt: DebtItemDto) => {
    setSelectedDebt(debt);
    setExpandedDebtId(debt.id);
    form.reset(debtToFormValues(debt));
    window.requestAnimationFrame(() => {
      document.getElementById("debt-form-card")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      setIsSubmitting(true);

      if (selectedDebt) {
        await requestJson(`/api/debts/${selectedDebt.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("La deuda fue actualizada.");
      } else {
        await requestJson("/api/debts", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("La deuda fue creada.");
      }

      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la deuda.");
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async (debtId: string) => {
    if (!window.confirm("Esta acción eliminará la deuda y sus pagos asociados. ¿Continuar?")) {
      return;
    }

    try {
      await requestJson(`/api/debts/${debtId}`, {
        method: "DELETE",
      });
      toast.success("La deuda fue eliminada.");
      if (selectedDebt?.id === debtId) {
        resetForm();
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la deuda.");
    }
  };

  const handleArchive = async (debt: DebtItemDto) => {
    try {
      await requestJson(`/api/debts/${debt.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...debtToFormValues(debt),
          status: "ARCHIVED",
        }),
      });
      toast.success("La deuda fue archivada.");
      if (selectedDebt?.id === debt.id) {
        resetForm();
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo archivar la deuda.");
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {isOnboardingFlow ? (
        <section className="rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-4 shadow-soft sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Paso 1 de 2
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                Registra tus deudas principales para construir tu panorama real.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
                Empieza por las más urgentes o las que más usas. Cuando tengas al menos una deuda, podrás pasar a registrar tu primer pago.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {activeDebts.length > 0 ? (
                <Button className="w-full sm:w-auto" onClick={() => router.push("/pagos?from=onboarding")}>
                  Continuar a pagos
                </Button>
              ) : null}
              <Button className="w-full sm:w-auto" variant="secondary" onClick={resetForm}>
                Empezar limpio
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <ModuleSectionHeader
        kicker="Deudas"
        title="Ordena tus deudas y detecta la prioridad de hoy."
        description="Mira qué cuenta presiona más y actúa sin ruido."
        action={
          debtLimitReached ? (
            <Button className="w-full sm:w-auto" onClick={() => router.push(upgradeHref as never)}>
              Desbloquear más deudas
            </Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => form.setFocus("name")}>
              Registrar deuda
            </Button>
          )
        }
      />

      {access.isBase ? (
        <div className="hidden rounded-[1.6rem] border border-dashed border-primary/18 bg-[rgba(255,248,241,0.82)] px-4 py-4 sm:px-5 lg:block">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                Base con límite útil
              </p>
              <p className="text-foreground mt-3 text-lg font-semibold">
                Puedes organizar hasta {access.maxActiveDebts} deudas activas antes de pasar a Premium.
              </p>
              <p className="text-muted mt-2 text-sm leading-7">
                Base te ayuda a entender el problema. Premium te deja ver el panorama completo y optimizarlo sin tomar decisiones a ciegas.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={() => {
                  trackPlanEvent("upgrade_click", {
                    source: "deudas_top_banner",
                    targetPlan: access.upgradeTargetTier,
                  });
                  router.push(upgradeHref as never);
                }}
              >
                Desbloquear esto con Premium
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="-mx-1 grid gap-3 lg:hidden">
        <div className="rounded-[1.5rem] border border-border bg-white/92 p-4 shadow-soft">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0 rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Saldo visible
              </p>
              <p className="value-stable mt-1 text-lg font-semibold text-foreground">
                {formatCurrency(summary.totalBalance)}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Próxima atención
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                {priorityDebt?.name ?? "Registra una deuda"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {priorityDebt?.nextDueDate
                  ? formatDate(priorityDebt.nextDueDate)
                  : priorityDebt
                    ? debtStatusLabels[priorityDebt.status as DebtFormValues["status"]]
                    : "Activa tu primer panorama"}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Riesgo actual
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                {priorityDebt?.status === "LATE"
                  ? "Alto"
                  : activeDebts.length > 1
                    ? "Medio"
                    : activeDebts.length
                      ? "Controlado"
                      : "Sin datos"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {priorityDebt?.status === "LATE"
                  ? "Hay una deuda que ya requiere acción."
                  : "Usa la lista para decidir qué revisar ahora."}
              </p>
            </div>
          </div>
        </div>

        {access.isBase ? (
          <div className="rounded-[1.5rem] border border-dashed border-primary/18 bg-[rgba(255,248,241,0.82)] p-4">
            <p className="text-sm font-semibold text-foreground">
              Base te deja organizar hasta {access.maxActiveDebts} deudas activas.
            </p>
            <p className="mt-2 text-sm text-muted">
              Si necesitas ver el panorama completo, pasa a Premium.
            </p>
            <Button
              className="mt-3 w-full"
              variant="secondary"
              onClick={() => router.push(upgradeHref as never)}
            >
              Desbloquear más deudas
            </Button>
          </div>
        ) : null}
      </section>

      <div className="hidden lg:block">
        <ExecutiveSummaryStrip items={debtSummaryItems} />
      </div>

      <div className="hidden lg:block">
        <PrimaryActionCard
          eyebrow="Lo que más te conviene hoy"
          title={
            priorityDebt
              ? `Tu deuda más sensible hoy es ${priorityDebt.name}.`
              : "Registra tu primera deuda para activar una prioridad real."
          }
          description={
            priorityDebt
              ? priorityDebt.status === "LATE"
                ? "Ya viene atrasada. Si la atiendes primero, reduces presión y evitas que la mora siga ganando terreno."
                : priorityDebt.nextDueDate
                  ? "Es la que más conviene proteger ahora por vencimiento, interés o presión sobre el flujo."
                  : "Hoy es la que más conviene revisar antes de repartir dinero entre varias cuentas."
              : "Con una sola deuda ya podemos mostrarte costo mensual, riesgo y qué conviene atacar primero."
          }
          badgeLabel={priorityDebt?.status === "LATE" ? "Urgente" : "Siguiente mejor paso"}
          badgeVariant={priorityDebt?.status === "LATE" ? "danger" : "default"}
          primaryAction={{
            label: priorityDebt ? "Registrar deuda / editar prioridad" : "Registrar deuda",
            onClick: () => form.setFocus(priorityDebt ? "name" : "name"),
          }}
          secondaryAction={
            activeDebts.length
              ? {
                  label: "Ir a pagos",
                  onClick: () => router.push("/pagos"),
                  variant: "secondary",
                }
              : undefined
          }
          notes={
            priorityDebt
              ? [
                  `Saldo visible: ${formatCurrency(priorityDebt.effectiveBalance)}.`,
                  `${priorityDebt.paymentAmountType === "VARIABLE" ? "Pago de referencia" : "Pago mínimo"}: ${formatCurrency(priorityDebt.minimumPayment)}.`,
                ]
              : [
                  "Empieza por saldo, pago base y vencimiento.",
                  "Luego la app te ayuda con prioridad y alertas.",
                ]
          }
          tone={priorityDebt?.status === "LATE" ? "warning" : "default"}
        />
      </div>

      <section className="grid gap-5 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card id="debt-form-card" className="order-2 -mx-1 min-w-0 p-4 sm:mx-0 sm:p-6 xl:order-2">
          <CardHeader>
            <CardTitle>{selectedDebt ? "Editar deuda" : "Registrar deuda"}</CardTitle>
            <CardDescription>
              Registra saldo, tasa, pago y fechas clave sin forzar que todo sea fijo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-5 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-4 sm:mb-6 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
                    Carga guiada
                  </p>
                  <p className="mt-2 break-words text-lg font-semibold text-foreground">
                    Empieza con el tipo correcto y luego completa solo los datos clave.
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {selectedDebt
                      ? "Estás editando una deuda existente."
                      : "Usa un preset y luego ajusta saldo, tasa, pago y vencimiento."}
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap">
                  {debtQuickPresets.map((preset) => {
                    const isActive = watchedType === preset.values.type;

                    return (
                      <Button
                        key={preset.key}
                        type="button"
                        variant={isActive ? "primary" : "secondary"}
                        className="min-h-11 max-w-full justify-center lg:min-w-[9.5rem]"
                        onClick={() => applyPreset(preset, { preserveText: true })}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 hidden gap-3 md:grid-cols-3 lg:grid">
                {debtQuickPresets.map((preset) => (
                  <div key={preset.key} className="min-w-0 rounded-3xl border border-white/70 bg-white/80 p-4">
                    <p className="break-words text-sm font-semibold text-foreground">{preset.label}</p>
                    <p className="mt-1 break-words text-sm text-muted">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {debtLimitReached ? (
              <div className="mb-6">
                <UpgradeCTA
                  title={UPGRADE_MESSAGES.DEBT_LIMIT_BASE}
                  description={`${UPGRADE_MESSAGES.DEBT_LIMIT_CONTEXT} ${UPGRADE_MESSAGES.DEBT_LIMIT_DECISION}`}
                  requiredPlan="Premium"
                  ctaText="Desbloquear más deudas"
                  onClick={() => {
                    trackPlanEvent("debt_limit_hit", {
                      source: "debt_form_limit",
                      activeDebtCount: activeDebts.length,
                      maxDebts: access.maxActiveDebts,
                    });
                    trackPlanEvent("upgrade_click", {
                      source: "debt_form_limit",
                      targetPlan: access.upgradeTargetTier,
                    });
                    router.push(upgradeHref as never);
                  }}
                />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {debtLimitNotes.map((note) => (
                    <div
                      key={note}
                      className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm font-medium text-foreground"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {access.isBase && hiddenDebtCount > 0 ? (
              <div className="mb-6 rounded-[1.6rem] border border-primary/14 bg-[rgba(255,248,241,0.7)] p-5">
                <p className="text-lg font-semibold text-foreground">
                  Hay {hiddenDebtCount} deuda{hiddenDebtCount === 1 ? "" : "s"} fuera del análisis Base.
                </p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {UPGRADE_MESSAGES.HIDDEN_DEBTS} {UPGRADE_MESSAGES.DEBT_LIMIT_DECISION}
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      trackPlanEvent("feature_blocked", {
                        source: "debt_hidden_warning",
                        hiddenDebtCount,
                      });
                      router.push(upgradeHref as never);
                    }}
                  >
                    Ver panorama completo
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mb-6 hidden gap-4 md:grid-cols-3 lg:grid">
              <div className="min-w-0 rounded-3xl border border-border bg-secondary/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Deuda real estimada</p>
                <p className="value-stable mt-2 text-[clamp(1rem,2.7vw,1.35rem)] font-semibold leading-tight text-foreground">
                  {formatCurrency(livePreview.effectiveBalance)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Incluye saldo, mora y cargos extra registrados.
                </p>
              </div>
              <div className="min-w-0 rounded-3xl border border-border bg-secondary/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Interés estimado del mes</p>
                <p className="value-stable mt-2 text-[clamp(1rem,2.7vw,1.35rem)] font-semibold leading-tight text-foreground">
                  {formatCurrency(livePreview.monthlyInterestEstimate)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Calculado con la tasa y el saldo actual que has escrito.
                </p>
              </div>
              <div className="min-w-0 rounded-3xl border border-border bg-secondary/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Lectura rápida</p>
                <p className="mt-2 break-words text-lg font-semibold text-foreground">
                  {livePreview.minimumPaymentRisk
                    ? watchedPaymentAmountType === "VARIABLE"
                      ? "La referencia de pago está demasiado justa"
                      : "El mínimo está demasiado justo"
                    : livePreview.utilizationPct !== null
                      ? `${livePreview.utilizationPct}% de uso`
                      : "Registro listo para evaluar"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {livePreview.minimumPaymentRisk
                    ? watchedPaymentAmountType === "VARIABLE"
                      ? "Si la referencia de pago sigue tan baja, esta deuda puede tardar demasiado en bajar."
                      : "Si solo pagas mínimos, esta deuda puede tardar demasiado en bajar."
                    : livePreview.utilizationPct !== null
                      ? "En tarjetas, el uso alto suele aumentar presión e intereses."
                      : "Completa fechas y montos para una recomendación más precisa."}
                </p>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  placeholder="Ej. Tarjeta principal"
                  {...form.register("name", nameValidation)}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.name?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditorName">Institución / acreedor</Label>
                <select
                  id="creditorName"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  value={creditorSelectValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    if (nextValue === CUSTOM_CREDITOR_VALUE) {
                      if (!watchedCreditorName || isPresetCreditor) {
                        form.setValue("creditorName", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                      return;
                    }

                    form.setValue("creditorName", sanitizeText(nextValue), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  <option value="">Selecciona un banco o acreedor</option>
                  {rdCreditorOptions.map((creditor) => (
                    <option key={creditor} value={creditor}>
                      {creditor}
                    </option>
                  ))}
                  <option value={CUSTOM_CREDITOR_VALUE}>Otro acreedor</option>
                </select>
                {creditorSelectValue === CUSTOM_CREDITOR_VALUE ? (
                  <Input
                    id="creditorNameCustom"
                    placeholder="Escribe el banco, cooperativa o acreedor"
                    {...form.register("creditorName", creditorNameValidation)}
                  />
                ) : null}
                <p className="text-xs text-muted">
                  Incluye bancos y asociaciones grandes de RD, con salida manual para otros acreedores.
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.creditorName?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("type")}
                >
                  <option value="CREDIT_CARD">Tarjeta de crédito</option>
                  <option value="PERSONAL_LOAN">Préstamo personal</option>
                  <option value="VEHICLE">Vehículo</option>
                  <option value="MORTGAGE">Hipotecaria</option>
                  <option value="INFORMAL">Informal</option>
                  <option value="OTHER">Otra</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("status")}
                >
                  <option value="CURRENT">Al día</option>
                  <option value="LATE">Atrasada</option>
                  <option value="NEGOTIATING">En negociación</option>
                  <option value="PAID">Pagada</option>
                  <option value="ARCHIVED">Archivada</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentBalance">Saldo actual</Label>
                <Input
                  id="currentBalance"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("currentBalance", currentBalanceValidation)}
                />
                <p className="text-xs text-muted">
                  Usa el saldo pendiente actual, no el monto original.
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.currentBalance?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Límite de crédito</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  disabled={!isCreditCard}
                  placeholder={isCreditCard ? "Solo si aplica" : "Solo aplica a tarjetas"}
                  {...form.register("creditLimit", creditLimitValidation)}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.creditLimit?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">{getInterestRateLabel(watchedInterestRateMode)}</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("interestRate", interestRateValidation)}
                />
                <p className="text-xs text-muted">
                  {getInterestRateSupport(watchedInterestRateMode)}
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.interestRate?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestRateType">Tipo de tasa</Label>
                <select
                  id="interestRateType"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("interestRateType")}
                >
                  <option value="ANNUAL">Anual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRateMode">Comportamiento de tasa</Label>
                <select
                  id="interestRateMode"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("interestRateMode")}
                >
                  <option value="FIXED">Fija</option>
                  <option value="VARIABLE">Variable</option>
                </select>
                <p className="text-xs text-muted">
                  Marca variable si el banco puede cambiar la tasa o si hoy solo tienes una referencia actual.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumPayment">{getPaymentAmountLabel(watchedPaymentAmountType)}</Label>
                <Input
                  id="minimumPayment"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("minimumPayment", minimumPaymentValidation)}
                />
                <p className="text-xs text-muted">
                  {getPaymentAmountSupport(watchedPaymentAmountType)}
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.minimumPayment?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmountType">Tipo de pago</Label>
                <select
                  id="paymentAmountType"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("paymentAmountType")}
                >
                  <option value="FIXED">Fijo</option>
                  <option value="VARIABLE">Variable</option>
                </select>
                <p className="text-xs text-muted">
                  Úsalo si la cuota cambia mes a mes y aquí solo quieres guardar la referencia más reciente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  className="min-h-12 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-base text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("currency")}
                >
                  <option value="DOP">RD$</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="statementDay">Fecha de corte</Label>
                <Input
                  id="statementDay"
                  type="number"
                  disabled={!isCreditCard}
                  placeholder={isCreditCard ? "1 a 31" : "Solo aplica a tarjetas"}
                  {...form.register("statementDay", statementDayValidation)}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.statementDay?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDay">
                  {isCreditCard ? "Fecha límite de pago" : "Día de pago mensual"}
                </Label>
                <Input
                  id="dueDay"
                  type="number"
                  placeholder="1 a 31"
                  {...form.register("dueDay", dueDayValidation)}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.dueDay?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextDueDate">
                  {isCreditCard ? "Próxima fecha de pago" : "Próximo vencimiento"}
                </Label>
                <Input
                  id="nextDueDate"
                  type="date"
                  {...form.register("nextDueDate", optionalDateValidation)}
                />
                <p className="text-xs text-muted">
                  Si todavía no manejas el día mensual exacto, usa esta fecha como próxima referencia.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="nextDueDateMonth"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedNextDueDate).month}
                    onChange={(event) => updateDateAssist("nextDueDate", "month", event.target.value)}
                  >
                    <option value="">Mes rápido</option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    id="nextDueDateYear"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedNextDueDate).year}
                    onChange={(event) => updateDateAssist("nextDueDate", "year", event.target.value)}
                  >
                    <option value="">Año rápido</option>
                    {debtDateYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startedAt">Fecha de inicio</Label>
                <Input
                  id="startedAt"
                  type="date"
                  {...form.register("startedAt", optionalDateValidation)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="startedAtMonth"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedStartedAt).month}
                    onChange={(event) => updateDateAssist("startedAt", "month", event.target.value)}
                  >
                    <option value="">Mes rápido</option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    id="startedAtYear"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedStartedAt).year}
                    onChange={(event) => updateDateAssist("startedAt", "year", event.target.value)}
                  >
                    <option value="">Año rápido</option>
                    {debtDateYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted">
                  Usa mes y año para saltar rápido sin tener que avanzar mes por mes.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4 md:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  {...form.register("notificationsEnabled")}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-foreground">
                    Activar recordatorios para esta deuda
                  </span>
                  <span className="block text-sm text-muted">
                    Te avisaremos antes del corte y antes del pago si tus correos están activos en Configuración.
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <Label htmlFor="lateFeeAmount">Mora</Label>
                <Input
                  id="lateFeeAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("lateFeeAmount", lateFeeAmountValidation)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraChargesAmount">Cargos extras</Label>
                <Input
                  id="extraChargesAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("extraChargesAmount", extraChargesAmountValidation)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="estimatedEndAt">Fecha estimada de término</Label>
                <Input
                  id="estimatedEndAt"
                  type="date"
                  {...form.register("estimatedEndAt", estimatedEndAtValidation)}
                />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <select
                    id="estimatedEndAtMonth"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedEstimatedEndAt).month}
                    onChange={(event) => updateDateAssist("estimatedEndAt", "month", event.target.value)}
                  >
                    <option value="">Mes rápido</option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    id="estimatedEndAtYear"
                    className="min-h-11 min-w-0 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                    value={splitDateInput(watchedEstimatedEndAt).year}
                    onChange={(event) => updateDateAssist("estimatedEndAt", "year", event.target.value)}
                  >
                    <option value="">Año rápido</option>
                    {debtDateYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() =>
                      form.setValue(
                        "estimatedEndAt",
                        addYearsToDateInput(watchedEstimatedEndAt, 4, watchedStartedAt),
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        },
                      )
                    }
                  >
                    +4 años
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 5].map((years) => (
                    <Button
                      key={years}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10"
                      onClick={() =>
                        form.setValue(
                          "estimatedEndAt",
                          addYearsToDateInput(watchedEstimatedEndAt, years, watchedStartedAt),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        )
                      }
                    >
                      +{years} {years === 1 ? "año" : "años"}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Para préstamos largos, usa mes, año o atajos de duración en vez de avanzar el calendario una y otra vez.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" {...form.register("notes", notesValidation)} />
              </div>

              <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:flex-wrap">
                <Button className="w-full sm:w-auto" type="submit" disabled={isSubmitting || debtLimitReached}>
                  {selectedDebt ? "Guardar cambios" : "Crear deuda"}
                </Button>
                <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={resetForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="order-1 -mx-1 min-w-0 p-4 sm:mx-0 sm:p-6 xl:order-1">
          <CardHeader>
            <CardTitle>Tus deudas</CardTitle>
            <CardDescription>
              Revisa la que más presiona y actúa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-[1.75rem] border border-border bg-secondary/45 p-3.5 sm:rounded-[2rem] sm:p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Busca una deuda"
                />

                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                  {[
                    { value: "ALL" as const, label: `Todas (${debts.length})` },
                    { value: "CURRENT" as const, label: `Al día (${debts.filter((debt) => debt.status === "CURRENT").length})` },
                    { value: "LATE" as const, label: `Atrasadas (${debts.filter((debt) => debt.status === "LATE").length})` },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={listFilter === option.value ? "primary" : "secondary"}
                      size="sm"
                      className="min-h-11 w-full justify-center sm:w-auto"
                      onClick={() => setListFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {filteredDebts.length ? (
              filteredDebts.map((debt) => (
                <div key={debt.id}>
                  <div className="rounded-[1.65rem] border border-border bg-secondary/45 p-4 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)] active:scale-[0.997] lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-foreground">
                          {debt.name}
                        </p>
                        <p className="mt-1 break-words text-sm text-muted">
                          {debt.creditorName}
                        </p>
                        <p className="mt-1 text-xs font-medium text-muted">
                          {getDebtStructureSummary(debt)}
                        </p>
                      </div>
                      <Badge
                        variant={getDebtPriorityVariant(debt, {
                          isPriority: priorityDebt?.id === debt.id,
                        })}
                      >
                        {getDebtPriorityLabel(debt, {
                          isPriority: priorityDebt?.id === debt.id,
                        })}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[1.15rem] border border-white/70 bg-white/88 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                          Balance actual
                        </p>
                        <p className="value-stable mt-1 text-base font-semibold text-foreground">
                          {formatCurrency(debt.effectiveBalance)}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/70 bg-white/88 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                          {debt.nextDueDate ? "Próximo pago" : "Estado"}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                          {debt.nextDueDate
                            ? formatDate(debt.nextDueDate)
                            : debtStatusLabels[debt.status as DebtFormValues["status"]] ?? debt.status}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          debt.status === "LATE"
                            ? "danger"
                            : debt.status === "PAID"
                              ? "success"
                              : "default"
                        }
                      >
                        {debtStatusLabels[debt.status as DebtFormValues["status"]] ?? debt.status}
                      </Badge>
                      <span className="text-xs font-medium text-muted">
                        {debtTypeLabels[debt.type as DebtFormValues["type"]] ?? debt.type}
                      </span>
                    </div>

                    {expandedDebtId === debt.id ? (
                      <div className="mt-4 rounded-[1.2rem] border border-border/80 bg-white/90 p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                              {debt.paymentAmountType === "VARIABLE" ? "Pago referencia" : "Pago mínimo"}
                            </p>
                            <p className="value-stable mt-1 text-sm font-semibold text-foreground">
                              {formatCurrency(debt.minimumPayment)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                              Interés estimado
                            </p>
                            <p className="value-stable mt-1 text-sm font-semibold text-foreground">
                              {formatCurrency(debt.monthlyInterestEstimate)}
                            </p>
                          </div>
                        </div>
                        {debt.notes ? (
                          <p className="mt-3 text-sm leading-6 text-muted">{debt.notes}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11 w-full justify-center"
                        onClick={() =>
                          setExpandedDebtId((current) =>
                            current === debt.id ? null : debt.id,
                          )
                        }
                      >
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11 w-full justify-center"
                        onClick={() => router.push(`/pagos?debtId=${debt.id}`)}
                      >
                        Registrar pago
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-2 min-h-11 w-full justify-center"
                        onClick={() => startEditingDebt(debt)}
                      >
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </Button>
                    </div>
                  </div>

                  <div className="hidden min-w-0 rounded-[1.65rem] border border-border bg-secondary/50 p-4 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)] active:scale-[0.997] sm:rounded-[1.9rem] sm:p-6 lg:block">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <p className="min-w-0 break-words text-lg font-semibold text-foreground">{debt.name}</p>
                          <Badge
                            variant={
                              debt.status === "LATE"
                                ? "danger"
                                : debt.status === "PAID"
                                  ? "success"
                                  : "default"
                            }
                          >
                            {debtStatusLabels[debt.status as DebtFormValues["status"]] ?? debt.status}
                          </Badge>
                          <Badge variant="default">{debtTypeLabels[debt.type as DebtFormValues["type"]] ?? debt.type}</Badge>
                          {priorityDebt?.id === debt.id ? (
                            <Badge variant="warning">Más presión hoy</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 break-words text-sm text-muted">{debt.creditorName}</p>
                        <p className="mt-2 text-xs font-medium text-muted">
                          {getDebtStructureSummary(debt)}
                        </p>
                        {debt.notes ? (
                          <p className="mt-3 break-words text-sm leading-6 text-muted">
                            {debt.notes}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-11 w-full justify-center"
                          onClick={() => router.push(`/pagos?debtId=${debt.id}`)}
                        >
                          Ir a pagos
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-11 w-full justify-center"
                          onClick={() => startEditingDebt(debt)}
                        >
                          <Pencil className="mr-2 size-4" />
                          Editar
                        </Button>
                        {debt.status !== "ARCHIVED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-11 w-full justify-center"
                            onClick={() => handleArchive(debt)}
                          >
                            <Archive className="mr-2 size-4" />
                            Archivar
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11 w-full justify-center"
                          onClick={() => handleDelete(debt.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">Saldo real</p>
                        <p className="value-stable mt-1 font-semibold text-foreground">
                          {formatCurrency(debt.effectiveBalance)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">
                          {debt.paymentAmountType === "VARIABLE" ? "Pago referencia" : "Pago mínimo"}
                        </p>
                        <p className="value-stable mt-1 font-semibold text-foreground">
                          {formatCurrency(debt.minimumPayment)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">
                          {debt.interestRateMode === "VARIABLE" ? "Interés ref. mes" : "Interés estimado"}
                        </p>
                        <p className="value-stable mt-1 font-semibold text-foreground">
                          {formatCurrency(debt.monthlyInterestEstimate)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">Próximo vencimiento</p>
                        <p className="date-stable mt-1 font-semibold text-foreground">
                          {debt.nextDueDate ? formatDate(debt.nextDueDate) : "Sin fecha"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : debts.length ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center">
                <p className="text-base font-semibold text-foreground">
                  No encontramos deudas con ese filtro.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Ajusta la búsqueda o vuelve a mostrar todas para seguir editando tu plan.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSearchQuery("")}>
                    Limpiar búsqueda
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setListFilter("ALL")}>
                    Ver todas
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center">
                <p className="text-base font-semibold text-foreground">
                  Todavía no has registrado deudas.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Empieza con un preset y en menos de un minuto tendrás una primera lectura útil.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {debtQuickPresets.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      variant="secondary"
                      onClick={() => applyPreset(preset)}
                    >
                      Crear {preset.label.toLowerCase()}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/onboarding")}
                  >
                    Ver guía inicial
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <TrustInlineNote
        notes={[
          "Tú controlas qué registras.",
          "No conectamos cuentas bancarias.",
          "La prioridad se calcula con tus propios datos.",
        ]}
      />
    </div>
  );
}
