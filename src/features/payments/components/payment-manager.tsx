"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, WalletCards, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import type { DebtItemDto, PaymentItemDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { paymentSchema } from "@/lib/validations/payments";

type PaymentFormValues = {
  debtId: string;
  amount: number;
  principalAmount: number | undefined;
  interestAmount: number | undefined;
  lateFeeAmount: number | undefined;
  extraChargesAmount: number | undefined;
  source: "MANUAL" | "IMPORT" | "SYSTEM";
  paidAt: string;
  notes: string | undefined;
};

function optionalPaymentValue(value: string) {
  return value === "" ? undefined : Number(value);
}

function requiredPaymentValue(value: string) {
  return value === "" ? 0 : Number(value);
}

function emptyPaymentValues(defaultDebtId?: string): PaymentFormValues {
  return {
    debtId: defaultDebtId ?? "",
    amount: 0,
    principalAmount: undefined,
    interestAmount: undefined,
    lateFeeAmount: undefined,
    extraChargesAmount: undefined,
    source: "MANUAL",
    paidAt: new Date().toISOString().slice(0, 10),
    notes: undefined,
  };
}

function paymentToFormValues(payment: PaymentItemDto): PaymentFormValues {
  return {
    debtId: payment.debtId,
    amount: payment.amount,
    principalAmount: payment.principalAmount ?? undefined,
    interestAmount: payment.interestAmount ?? undefined,
    lateFeeAmount: payment.lateFeeAmount ?? undefined,
    extraChargesAmount: payment.extraChargesAmount ?? undefined,
    source: payment.source as PaymentFormValues["source"],
    paidAt: payment.paidAt.slice(0, 10),
    notes: payment.notes ?? undefined,
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

export function PaymentManager({
  debts,
  payments,
  entryFlow = null,
  defaultDebtId,
}: {
  debts: DebtItemDto[];
  payments: PaymentItemDto[];
  entryFlow?: "onboarding" | null;
  defaultDebtId?: string;
}) {
  const router = useRouter();
  const [selectedPayment, setSelectedPayment] = useState<PaymentItemDto | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyDebtFilter, setHistoryDebtFilter] = useState<string>("ALL");
  const debtOptions = useMemo(
    () => debts.filter((debt) => debt.status !== "ARCHIVED"),
    [debts],
  );
  const isOnboardingFlow = entryFlow === "onboarding";
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as never,
    defaultValues: emptyPaymentValues(defaultDebtId ?? debtOptions[0]?.id),
  });
  const watchedDebtId =
    useWatch({ control: form.control, name: "debtId" }) ?? "";
  const watchedAmount = Number(
    useWatch({ control: form.control, name: "amount" }) ?? 0,
  );
  const watchedPrincipal = Number(
    useWatch({ control: form.control, name: "principalAmount" }) ?? 0,
  );
  const watchedInterest = Number(
    useWatch({ control: form.control, name: "interestAmount" }) ?? 0,
  );
  const watchedLateFee = Number(
    useWatch({ control: form.control, name: "lateFeeAmount" }) ?? 0,
  );
  const watchedExtraCharges = Number(
    useWatch({ control: form.control, name: "extraChargesAmount" }) ?? 0,
  );
  const selectedDebt = useMemo(
    () => debtOptions.find((debt) => debt.id === watchedDebtId) ?? null,
    [debtOptions, watchedDebtId],
  );
  const filteredPayments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return payments.filter((payment) => {
      if (historyDebtFilter !== "ALL" && payment.debtId !== historyDebtFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [payment.debtName, payment.notes ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [historyDebtFilter, payments, searchQuery]);
  const paymentSplitTotal =
    watchedPrincipal + watchedInterest + watchedLateFee + watchedExtraCharges;
  const pendingSplitAmount = Number(
    (watchedAmount - paymentSplitTotal).toFixed(2),
  );

  useEffect(() => {
    if (selectedPayment) {
      return;
    }

    const requestedDebtStillExists =
      defaultDebtId && debtOptions.some((debt) => debt.id === defaultDebtId);

    if (requestedDebtStillExists) {
      form.setValue("debtId", defaultDebtId);
      return;
    }

    if (!form.getValues("debtId") && debtOptions[0]?.id) {
      form.setValue("debtId", debtOptions[0].id);
    }
  }, [defaultDebtId, debtOptions, form, selectedPayment]);

  const resetForm = () => {
    setSelectedPayment(null);
    form.reset(emptyPaymentValues(defaultDebtId ?? debtOptions[0]?.id));
  };

  const applyQuickAmount = (amount: number) => {
    form.setValue("amount", Number(amount.toFixed(2)), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    if (paymentSplitTotal > amount) {
      form.setValue("principalAmount", undefined, { shouldValidate: true });
      form.setValue("interestAmount", undefined, { shouldValidate: true });
      form.setValue("lateFeeAmount", undefined, { shouldValidate: true });
      form.setValue("extraChargesAmount", undefined, { shouldValidate: true });
    }
  };

  const submit = form.handleSubmit(async (values) => {
    if (!values.debtId || !selectedDebt) {
      toast.error(
        "Selecciona una deuda activa antes de registrar el pago.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedPayment) {
        await requestJson(`/api/payments/${selectedPayment.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("El pago fue actualizado.");
      } else {
        await requestJson("/api/payments", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("El pago fue registrado.");
      }

      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el pago.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleDelete = async (paymentId: string) => {
    if (!window.confirm("¿Eliminar este pago del historial?")) {
      return;
    }

    try {
      await requestJson(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });
      toast.success("El pago fue eliminado.");
      if (selectedPayment?.id === paymentId) {
        resetForm();
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el pago.",
      );
    }
  };

  const paymentTotals = useMemo(
    () => ({
      count: payments.length,
      totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
      principalPaid: payments.reduce(
        (sum, payment) => sum + (payment.principalAmount ?? 0),
        0,
      ),
      interestPaid: payments.reduce(
        (sum, payment) => sum + (payment.interestAmount ?? 0),
        0,
      ),
      chargesPaid: payments.reduce(
        (sum, payment) =>
          sum +
          (payment.lateFeeAmount ?? 0) +
          (payment.extraChargesAmount ?? 0),
        0,
      ),
    }),
    [payments],
  );

  return (
    <div className="flex flex-col gap-6">
      {isOnboardingFlow ? (
        <section className="border-primary/15 shadow-soft rounded-[2rem] border bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
                Paso 2 de 2
              </p>
              <p className="text-foreground mt-2 text-xl font-semibold">
                Registra tu primer pago para que la app empiece a medir avance
                real.
              </p>
              <p className="text-muted mt-2 max-w-3xl text-sm leading-7">
                Con el primer pago ya podremos mostrar mejor cuánto baja el
                principal, cuánto se va en intereses y cómo cambia tu ritmo de
                salida.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {payments.length > 0 ? (
                <Button onClick={() => router.push("/dashboard")}>
                  Ir al dashboard
                </Button>
              ) : null}
              <Button variant="secondary" onClick={resetForm}>
                Limpiar captura
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="min-w-0 p-6">
          <CardHeader className="gap-3">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              Resumen de pagos
            </CardDescription>
            <CardTitle className="text-foreground text-2xl">
              Lo que ya has movido en esta deuda
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-[1.9rem] border border-primary/12 bg-[rgba(240,248,245,0.92)] p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">{paymentTotals.count} pagos registrados</Badge>
                <Badge variant="default">Vista acumulada</Badge>
              </div>
              <p className="text-muted mt-4 text-[11px] font-semibold uppercase tracking-[0.22em]">
                Pagado total
              </p>
              <p className="value-stable text-foreground mt-3 text-[clamp(1.9rem,5vw,2.8rem)] font-semibold leading-none">
                {formatCurrency(paymentTotals.totalPaid)}
              </p>
              <p className="text-muted mt-3 max-w-xl text-sm leading-7">
                Este es el monto total que ya has registrado. Abajo ves cuánto se fue a principal, intereses y cargos.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              label: "Abono a principal",
              value: formatCurrency(paymentTotals.principalPaid),
              support: "Lo que realmente bajó capital.",
            },
            {
              label: "Intereses",
              value: formatCurrency(paymentTotals.interestPaid),
              support: "Costo financiero absorbido.",
            },
            {
              label: "Cargos",
              value: formatCurrency(paymentTotals.chargesPaid),
              support: "Mora y cargos extras cubiertos.",
            },
            {
              label: "Pagos registrados",
              value: String(paymentTotals.count),
              support: "Movimientos ya capturados.",
            },
          ].map((item) => (
            <Card key={item.label} className="min-w-0 p-5 sm:p-6">
              <CardHeader className="gap-3">
                <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {item.label}
                </CardDescription>
                <CardTitle className="value-stable mt-0 text-[clamp(1.2rem,3vw,1.7rem)] leading-tight">
                  {item.value}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 text-sm leading-6 text-muted">
                {item.support}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card className="min-w-0 p-6">
          <CardHeader>
            <CardTitle>
              {selectedPayment ? "Editar pago" : "Registrar pago"}
            </CardTitle>
            <CardDescription>
              El sistema recalcula el saldo y guarda cuánto fue a principal,
              interés y cargos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {!debtOptions.length ? (
              <div className="border-border bg-secondary/40 mb-6 rounded-[2rem] border border-dashed p-5">
                <p className="text-foreground text-base font-semibold">
                  Primero necesitas al menos una deuda activa.
                </p>
                <p className="text-muted mt-2 text-sm">
                  Registra una deuda y luego vuelve aquí para llevar el
                  historial de pagos y recalcular el saldo.
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push("/deudas")}
                  >
                    Ir a deudas
                  </Button>
                </div>
              </div>
            ) : null}

            {selectedDebt ? (
              <div className="border-primary/15 mb-6 rounded-[2rem] border bg-[linear-gradient(135deg,rgba(13,148,136,0.12),rgba(14,116,144,0.04))] p-5 sm:p-6">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="rounded-[1.85rem] border border-white/70 bg-white/88 p-5 sm:p-6">
                    <p className="text-primary/80 text-xs font-semibold tracking-[0.22em] uppercase">
                      Contexto de la deuda
                    </p>
                    <p className="text-foreground mt-3 break-words text-[clamp(1.45rem,3vw,1.9rem)] font-semibold leading-tight">
                      {selectedDebt.name}
                    </p>
                    <p className="text-muted mt-2 text-sm leading-6">
                      {selectedDebt.creditorName}
                    </p>
                    <p className="text-muted mt-4 max-w-xl text-sm leading-7">
                      Antes de registrar el pago, aquí tienes el panorama que
                      conviene proteger para que la captura quede clara.
                    </p>
                  </div>

                  <div className="rounded-[1.85rem] border border-white/70 bg-white/82 p-5 sm:p-6">
                    <p className="text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                      Acciones rápidas
                    </p>
                    <p className="text-foreground mt-3 text-lg font-semibold leading-tight">
                      Usa un atajo si quieres capturar sin escribir todo.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {[
                        {
                          label: "Pagar mínimo",
                          value: selectedDebt.minimumPayment,
                        },
                        {
                          label: "Cubrir saldo",
                          value: selectedDebt.effectiveBalance,
                        },
                        ...(selectedDebt.lastPaymentAmount
                          ? [
                              {
                                label: "Repetir último pago",
                                value: selectedDebt.lastPaymentAmount,
                              },
                            ]
                          : []),
                      ].map((option) => (
                        <Button
                          key={option.label}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="max-w-full"
                          onClick={() => applyQuickAmount(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      label: "Saldo actual",
                      value: formatCurrency(selectedDebt.effectiveBalance),
                      support: "Incluye mora y cargos acumulados.",
                    },
                    {
                      label: "Pago mínimo",
                      value: formatCurrency(selectedDebt.minimumPayment),
                      support: "Lo mínimo para mantenerte al día.",
                    },
                    {
                      label: "Próximo vencimiento",
                      value: selectedDebt.nextDueDate
                        ? formatDate(selectedDebt.nextDueDate)
                        : "Sin fecha",
                      support: "La fecha que más conviene proteger ahora.",
                      isDate: true,
                    },
                    {
                      label: "Último pago",
                      value: selectedDebt.lastPaymentAmount
                        ? formatCurrency(selectedDebt.lastPaymentAmount)
                        : "Sin registro",
                      support: selectedDebt.lastPaymentAt
                        ? formatDate(selectedDebt.lastPaymentAt)
                        : "Aún no hay pagos capturados",
                      isDateSupport: Boolean(selectedDebt.lastPaymentAt),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-[1.9rem] border border-white/80 bg-white/92 p-5 shadow-[0_14px_32px_rgba(24,49,59,0.06)] sm:p-6"
                    >
                      <p className="text-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                        {item.label}
                      </p>
                      <p
                        className={`${item.isDate ? "date-stable" : "value-stable"} text-foreground mt-4 text-[clamp(1.35rem,3.5vw,1.95rem)] font-semibold leading-tight`}
                      >
                        {item.value}
                      </p>
                      <p
                        className={`${item.isDateSupport ? "date-stable" : ""} text-muted mt-3 text-sm leading-6`}
                      >
                        {item.support}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="debtId">Deuda</Label>
                <select
                  id="debtId"
                  disabled={Boolean(selectedPayment) || !debtOptions.length}
                  className="border-border text-foreground focus:border-primary/40 focus:ring-primary/10 min-w-0 h-12 w-full rounded-2xl border bg-white px-4 text-sm transition outline-none focus:ring-4 disabled:opacity-70"
                  {...form.register("debtId")}
                >
                  <option value="">Selecciona una deuda</option>
                  {debtOptions.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name} - {formatCurrency(debt.effectiveBalance)}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-rose-600">
                  {form.formState.errors.debtId?.message}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto del pago</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("amount", {
                    setValueAs: requiredPaymentValue,
                  })}
                />
                <p className="text-muted text-xs">
                  Registra el monto total pagado. Si no conoces el desglose
                  exacto, puedes dejarlo parcial.
                </p>
                <p className="text-sm text-rose-600">
                  {form.formState.errors.amount?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paidAt">Fecha del pago</Label>
                <Input id="paidAt" type="date" {...form.register("paidAt")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="principalAmount">Principal</Label>
                <Input
                  id="principalAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("principalAmount", {
                    setValueAs: optionalPaymentValue,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestAmount">Interés</Label>
                <Input
                  id="interestAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("interestAmount", {
                    setValueAs: optionalPaymentValue,
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateFeeAmount">Mora cubierta</Label>
                <Input
                  id="lateFeeAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("lateFeeAmount", {
                    setValueAs: optionalPaymentValue,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraChargesAmount">
                  Cargos extras cubiertos
                </Label>
                <Input
                  id="extraChargesAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("extraChargesAmount", {
                    setValueAs: optionalPaymentValue,
                  })}
                />
              </div>

              <div className="border-border bg-secondary/45 rounded-3xl border p-4 md:col-span-2">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">
                      Lectura rápida del desglose
                    </p>
                    <p className="text-muted text-sm">
                      {pendingSplitAmount > 0
                        ? `Faltan ${formatCurrency(pendingSplitAmount)} por asignar dentro del pago.`
                        : pendingSplitAmount < 0
                          ? `El desglose supera el pago por ${formatCurrency(Math.abs(pendingSplitAmount))}.`
                          : "El desglose coincide con el pago registrado."}
                    </p>
                  </div>
                  <Badge
                    variant={pendingSplitAmount < 0 ? "danger" : "default"}
                    className="value-stable max-w-full text-center"
                  >
                    {formatCurrency(watchedAmount)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" {...form.register("notes")} />
              </div>

              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !debtOptions.length}
                >
                  {selectedPayment ? "Guardar cambios" : "Registrar pago"}
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
            <CardTitle>Historial cronológico</CardTitle>
            <CardDescription>
              Revisa movimientos recientes y corrige cualquier captura
              incorrecta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="border-border bg-secondary/45 rounded-[2rem] border p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Busca por deuda o nota"
                />

                <select
                  value={historyDebtFilter}
                  onChange={(event) => setHistoryDebtFilter(event.target.value)}
                  className="border-border text-foreground focus:border-primary/40 focus:ring-primary/10 min-w-0 h-12 w-full rounded-2xl border bg-white px-4 text-sm transition outline-none focus:ring-4"
                >
                  <option value="ALL">Todas las deudas</option>
                  {debtOptions.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredPayments.length ? (
              filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="border-border bg-secondary/70 min-w-0 rounded-3xl border p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <p className="text-foreground min-w-0 break-words text-lg font-semibold">
                          {payment.debtName}
                        </p>
                        <Badge
                          variant="success"
                          className="max-w-full text-center"
                        >
                          {payment.source}
                        </Badge>
                      </div>
                      <p className="date-stable text-muted mt-2 text-sm">
                        {formatDate(payment.paidAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedPayment(payment);
                          form.reset(paymentToFormValues(payment));
                        }}
                      >
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(payment.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="min-w-0 md:col-span-2">
                      <p className="text-muted text-xs tracking-[0.18em] uppercase">
                        Monto
                      </p>
                      <p className="value-stable text-foreground mt-1 font-semibold">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted text-xs tracking-[0.18em] uppercase">
                        Principal
                      </p>
                      <p className="value-stable text-foreground mt-1 font-semibold">
                        {formatCurrency(payment.principalAmount ?? 0)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted text-xs tracking-[0.18em] uppercase">
                        Interés
                      </p>
                      <p className="value-stable text-foreground mt-1 font-semibold">
                        {formatCurrency(payment.interestAmount ?? 0)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted text-xs tracking-[0.18em] uppercase">
                        Saldo luego del pago
                      </p>
                      <p className="value-stable text-foreground mt-1 font-semibold">
                        {formatCurrency(payment.remainingBalanceAfter ?? 0)}
                      </p>
                    </div>
                  </div>

                  {payment.notes ? (
                    <p className="text-muted mt-4 break-words text-sm leading-7">
                      {payment.notes}
                    </p>
                  ) : null}
                </div>
              ))
            ) : payments.length ? (
              <div className="border-border rounded-3xl border border-dashed p-8 text-center">
                <p className="text-foreground text-base font-semibold">
                  No hay pagos que coincidan con ese filtro.
                </p>
                <p className="text-muted mt-2 text-sm">
                  Cambia la deuda seleccionada o limpia la búsqueda para ver
                  todo el historial.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSearchQuery("")}
                  >
                    Limpiar búsqueda
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setHistoryDebtFilter("ALL")}
                  >
                    Ver todo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-border rounded-3xl border border-dashed p-8 text-center">
                <p className="text-base font-semibold text-foreground">
                  Aún no hay pagos registrados.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Cuando registres el primero, aquí verás cuánto fue a
                  principal, cuánto se fue en intereses y cómo cambia el saldo.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  >
                    Registrar primer pago
                  </Button>
                  {!debtOptions.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => router.push("/deudas")}
                    >
                      Cargar deuda primero
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="border-border shadow-soft rounded-[2rem] border bg-white/90 p-6">
        <div className="flex items-center gap-3">
          <WalletCards className="text-primary size-5" />
          <div>
            <p className="text-foreground font-semibold">Consejo de captura</p>
            <p className="text-muted text-sm">
              Si no conoces el desglose exacto, deja principal, interés o cargos
              vacíos y la app hará una estimación razonable.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
