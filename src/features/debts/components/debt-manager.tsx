"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import type { DebtItemDto, DebtSummaryDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { debtSchema } from "@/lib/validations/debts";

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

const debtQuickPresets = [
  {
    key: "CREDIT_CARD",
    label: "Tarjeta",
    description: "Ideal para capturar corte, vencimiento y uso de la línea.",
    values: {
      type: "CREDIT_CARD" as const,
      status: "CURRENT" as const,
      interestRateType: "ANNUAL" as const,
      currency: "DOP" as const,
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
      currency: "DOP" as const,
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
      currency: "DOP" as const,
      creditLimit: undefined,
      statementDay: undefined,
    },
  },
] as const;

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
  minimumPayment: number;
  statementDay: number | undefined;
  dueDay: number | undefined;
  nextDueDate: string | undefined;
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
    minimumPayment: 0,
    statementDay: undefined,
    dueDay: undefined,
    nextDueDate: undefined,
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
    minimumPayment: debt.minimumPayment,
    statementDay: debt.statementDay ?? undefined,
    dueDay: debt.dueDay ?? undefined,
    nextDueDate: toDateInput(debt.nextDueDate),
    lateFeeAmount: debt.lateFeeAmount,
    extraChargesAmount: debt.extraChargesAmount,
    notes: debt.notes ?? undefined,
    startedAt: toDateInput(debt.startedAt),
    estimatedEndAt: toDateInput(debt.estimatedEndAt),
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
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

export function DebtManager({
  debts,
  summary,
  entryFlow = null,
}: {
  debts: DebtItemDto[];
  summary: DebtSummaryDto;
  entryFlow?: "onboarding" | null;
}) {
  const router = useRouter();
  const [selectedDebt, setSelectedDebt] = useState<DebtItemDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<DebtListFilter>("ALL");
  const activeDebts = useMemo(
    () => debts.filter((debt) => !debt.archivedAt && debt.status !== "ARCHIVED"),
    [debts],
  );
  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtSchema) as never,
    defaultValues: emptyDebtValues(),
  });
  const isOnboardingFlow = entryFlow === "onboarding";
  const watchedType = useWatch({ control: form.control, name: "type" }) ?? "CREDIT_CARD";
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
  const isCreditCard = watchedType === "CREDIT_CARD";
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

  const resetForm = () => {
    setSelectedDebt(null);
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
    form.reset(debtToFormValues(debt));
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
    <div className="flex flex-col gap-6">
      {isOnboardingFlow ? (
        <section className="rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-6 shadow-soft">
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

            <div className="flex flex-wrap gap-3">
              {activeDebts.length > 0 ? (
                <Button onClick={() => router.push("/pagos?from=onboarding")}>
                  Continuar a pagos
                </Button>
              ) : null}
              <Button variant="secondary" onClick={resetForm}>
                Empezar limpio
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Deudas activas", value: summary.activeDebtCount, suffix: "" },
          { label: "Deuda total", value: summary.totalBalance, suffix: "currency" },
          { label: "Pago mínimo total", value: summary.totalMinimumPayment, suffix: "currency" },
          { label: "Interés mensual estimado", value: summary.totalMonthlyInterest, suffix: "currency" },
        ].map((item) => (
          <Card key={item.label} className="min-w-0 p-6">
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="value-stable mt-3 text-[clamp(1.35rem,3.8vw,2.1rem)] leading-tight">
                {item.suffix === "currency" ? formatCurrency(item.value) : item.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="min-w-0 p-6">
          <CardHeader>
            <CardTitle>{selectedDebt ? "Editar deuda" : "Registrar deuda"}</CardTitle>
            <CardDescription>
              Captura saldo real, tasa, pagos mínimos, mora y fechas clave para que el sistema pueda priorizar bien.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-6 rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-5">
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
                      ? "Estás editando una deuda existente. Si quieres registrar otra distinta, limpia el formulario o usa un preset."
                      : "Usa un preset para reducir pasos. Luego ajusta saldo, pago mínimo y vencimiento."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {debtQuickPresets.map((preset) => {
                    const isActive = watchedType === preset.values.type;

                    return (
                      <Button
                        key={preset.key}
                        type="button"
                        variant={isActive ? "primary" : "secondary"}
                        className="min-w-[9.5rem] max-w-full"
                        onClick={() => applyPreset(preset, { preserveText: true })}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {debtQuickPresets.map((preset) => (
                  <div key={preset.key} className="min-w-0 rounded-3xl border border-white/70 bg-white/80 p-4">
                    <p className="break-words text-sm font-semibold text-foreground">{preset.label}</p>
                    <p className="mt-1 break-words text-sm text-muted">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
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
                    ? "El mínimo está demasiado justo"
                    : livePreview.utilizationPct !== null
                      ? `${livePreview.utilizationPct}% de uso`
                      : "Registro listo para evaluar"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {livePreview.minimumPaymentRisk
                    ? "Si solo pagas mínimos, esta deuda puede tardar demasiado en bajar."
                    : livePreview.utilizationPct !== null
                      ? "En tarjetas, el uso alto suele aumentar presión e intereses."
                      : "Completa fechas y montos para una recomendación más precisa."}
                </p>
              </div>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" placeholder="Ej. Tarjeta principal" {...form.register("name")} />
                <p className="text-sm text-rose-600">{form.formState.errors.name?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditorName">Institución / acreedor</Label>
                <Input id="creditorName" placeholder="Ej. Banco Popular" {...form.register("creditorName")} />
                <p className="text-sm text-rose-600">{form.formState.errors.creditorName?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  className="min-w-0 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
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
                  className="min-w-0 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
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
                  {...form.register("currentBalance", { setValueAs: requiredNumberValue })}
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
                  {...form.register("creditLimit", { setValueAs: optionalNumberValue })}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.creditLimit?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">Tasa</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("interestRate", { setValueAs: requiredNumberValue })}
                />
                <p className="text-xs text-muted">
                  Introduce la tasa tal como aparece en el contrato o estado.
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.interestRate?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestRateType">Tipo de tasa</Label>
                <select
                  id="interestRateType"
                  className="min-w-0 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  {...form.register("interestRateType")}
                >
                  <option value="ANNUAL">Anual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumPayment">Pago mínimo</Label>
                <Input
                  id="minimumPayment"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("minimumPayment", { setValueAs: requiredNumberValue })}
                />
                <p className="text-xs text-muted">
                  Esto ayuda a detectar cuándo una deuda se estanca solo pagando el mínimo.
                </p>
                <p className="text-sm text-rose-600">{form.formState.errors.minimumPayment?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  className="min-w-0 h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
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
                  {...form.register("statementDay", { setValueAs: optionalNumberValue })}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.statementDay?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDay">Día de vencimiento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  placeholder="1 a 31"
                  {...form.register("dueDay", { setValueAs: optionalNumberValue })}
                />
                <p className="text-sm text-rose-600">{form.formState.errors.dueDay?.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextDueDate">Próximo vencimiento</Label>
                <Input id="nextDueDate" type="date" {...form.register("nextDueDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startedAt">Fecha de inicio</Label>
                <Input id="startedAt" type="date" {...form.register("startedAt")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateFeeAmount">Mora</Label>
                <Input
                  id="lateFeeAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("lateFeeAmount", { setValueAs: requiredNumberValue })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraChargesAmount">Cargos extras</Label>
                <Input
                  id="extraChargesAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("extraChargesAmount", { setValueAs: requiredNumberValue })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="estimatedEndAt">Fecha estimada de término</Label>
                <Input id="estimatedEndAt" type="date" {...form.register("estimatedEndAt")} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  {selectedDebt ? "Guardar cambios" : "Crear deuda"}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0 p-6">
          <CardHeader>
            <CardTitle>Tus deudas</CardTitle>
            <CardDescription>
              Vista consolidada para editar, archivar o eliminar registros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-[2rem] border border-border bg-secondary/45 p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Busca por nombre, acreedor o nota"
                />

                <div className="flex flex-wrap gap-2">
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
                <div key={debt.id} className="min-w-0 rounded-3xl border border-border bg-secondary/70 p-5">
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
                      </div>
                      <p className="mt-2 break-words text-sm text-muted">{debt.creditorName}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEditingDebt(debt)}
                      >
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </Button>
                      {debt.status !== "ARCHIVED" ? (
                        <Button variant="ghost" size="sm" onClick={() => handleArchive(debt)}>
                          <Archive className="mr-2 size-4" />
                          Archivar
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(debt.id)}>
                        <Trash2 className="mr-2 size-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Saldo real</p>
                      <p className="value-stable mt-1 font-semibold text-foreground">
                        {formatCurrency(debt.effectiveBalance)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Pago mínimo</p>
                      <p className="value-stable mt-1 font-semibold text-foreground">
                        {formatCurrency(debt.minimumPayment)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Interés mensual estimado</p>
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
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Pagos registrados</p>
                      <p className="mt-1 font-semibold text-foreground">{debt.paymentCount}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Total pagado</p>
                      <p className="value-stable mt-1 font-semibold text-foreground">
                        {formatCurrency(debt.totalPaid)}
                      </p>
                    </div>
                  </div>

                  {debt.notes ? (
                    <p className="mt-4 break-words text-sm leading-7 text-muted">{debt.notes}</p>
                  ) : null}
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

      <section className="rounded-[2rem] border border-border bg-white/90 p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <Plus className="size-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Lectura rápida</p>
            <p className="text-sm text-muted">
              {activeDebts.length
                ? `Tienes ${activeDebts.length} deudas activas y ${summary.overdueCount} en atraso.`
                : "No hay deudas activas registradas."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
