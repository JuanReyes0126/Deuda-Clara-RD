"use client";

import { Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";
import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

type PaydownChallengeCardProps = {
  data: DashboardDto;
};

function computeSuggestedExtraMonthly(data: DashboardDto) {
  const capacity = data.summary.monthlyDebtCapacity;
  if (capacity !== null && capacity > 0) {
    return Math.max(50, Math.round(Math.min(capacity * 0.12, capacity)));
  }

  const budget = data.summary.currentMonthlyBudget;
  if (budget > 0) {
    return Math.max(50, Math.round(Math.min(budget * 0.08, budget)));
  }

  return 500;
}

async function requestPaydownJson(url: string, init?: RequestInit) {
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

export function PaydownChallengeCard({ data }: PaydownChallengeCardProps) {
  const challenge = data.paydownChallenge;
  const hasDebts = data.activeDebts.length > 0;
  const router = useRouter();
  const { navigate } = useAppNavigation();
  const [extraInput, setExtraInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (challenge.state === "none" || challenge.state === "ended") {
      setExtraInput(String(computeSuggestedExtraMonthly(data)));
    }
  }, [
    challenge.state,
    challenge.startedAt,
    challenge.endsAt,
    data,
    data.summary.monthlyDebtCapacity,
    data.summary.currentMonthlyBudget,
  ]);

  const progressPct =
    challenge.state === "active"
      ? Math.round(
          ((challenge.totalDays - (challenge.daysRemaining ?? 0)) / challenge.totalDays) * 100,
        )
      : challenge.state === "ended"
        ? 100
        : 0;

  const startChallenge = async () => {
    const normalized = extraInput.replace(",", ".").trim();
    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Indica un monto extra mensual válido (mayor que cero).");
      return;
    }

    try {
      setIsSubmitting(true);
      await requestPaydownJson("/api/settings/paydown-challenge", {
        method: "POST",
        body: JSON.stringify({ extraMonthly: amount }),
      });
      trackPlanEvent("paydown_challenge_started", {
        amount,
        stateBefore: challenge.state,
      });
      toast.success("Reto activado: 30 días en marcha.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo activar el reto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearChallenge = async () => {
    try {
      setIsSubmitting(true);
      await requestPaydownJson("/api/settings/paydown-challenge", {
        method: "DELETE",
      });
      trackPlanEvent("paydown_challenge_cleared", {
        stateBefore: challenge.state,
      });
      toast.success("Reto cerrado.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cerrar el reto.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white/92 shadow-soft">
      <CardHeader className="gap-3 pb-2 pr-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-500/12 text-orange-700">
            <Flame className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-800/90">
              Reto de 30 días
            </p>
            <CardTitle className="mt-1 text-balance text-lg sm:text-xl">
              Pago extra mensual
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
              {challenge.state === "none"
                ? "Comprométete con un monto fijo al mes, mantenlo 30 días y registra pagos para ver el hábito tomar forma."
                : challenge.state === "active"
                  ? `Te quedan ${challenge.daysRemaining} ${challenge.daysRemaining === 1 ? "día" : "días"} con un extra de ${formatCurrency(challenge.extraMonthly ?? 0)} al mes.`
                  : "Cerraste la ventana de 30 días. Puedes archivar el resultado o lanzar un nuevo reto con otro monto."}
            </CardDescription>
          </div>
        </div>
        {challenge.state === "active" ? (
          <Badge variant="warning" className="shrink-0">
            Activo
          </Badge>
        ) : challenge.state === "ended" ? (
          <Badge variant="success" className="shrink-0">
            Completado
          </Badge>
        ) : (
          <Badge variant="default" className="shrink-0">
            {challenge.totalDays} días
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!hasDebts ? (
          <p className="text-sm text-muted">
            Registra al menos una deuda activa para que el reto tenga sentido con tus pagos.
          </p>
        ) : null}

        {challenge.state === "active" || challenge.state === "ended" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <span>Avance del reto</span>
              <span className="font-medium text-foreground">{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ea580c_0%,#f97316_100%)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              />
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted">
                <span className="font-medium text-foreground">
                  {challenge.paymentsLoggedDuringChallenge}
                </span>{" "}
                {challenge.paymentsLoggedDuringChallenge === 1
                  ? "pago registrado"
                  : "pagos registrados"}{" "}
                en esta ventana.
              </p>
              {challenge.endsAt ? (
                <p className="text-muted sm:text-right">
                  {challenge.state === "ended" ? "Finalizó el " : "Termina el "}
                  <span className="font-medium text-foreground">
                    {formatDate(challenge.endsAt, "d MMM yyyy")}
                  </span>
                  .
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {challenge.state === "none" || challenge.state === "ended" ? (
          <div className="space-y-2">
            <Label htmlFor="paydown-extra-monthly">Monto extra mensual</Label>
            <Input
              id="paydown-extra-monthly"
              inputMode="decimal"
              autoComplete="off"
              disabled={!hasDebts || isSubmitting}
              value={extraInput}
              onChange={(event) => setExtraInput(event.target.value)}
              placeholder="Ej. 750"
              className="rounded-xl border-border/55 shadow-[0_6px_16px_rgba(24,49,59,0.04)] focus:shadow-[0_10px_22px_-18px_rgba(23,56,74,0.35)]"
            />
            <p className="text-xs text-muted">
              Sugerido según tu capacidad hoy:{" "}
              {formatCurrency(computeSuggestedExtraMonthly(data))}.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {challenge.state === "none" || challenge.state === "ended" ? (
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={!hasDebts || isSubmitting}
              onClick={() => void startChallenge()}
            >
              {challenge.state === "ended" ? "Iniciar nuevo reto" : "Empezar reto"}
            </Button>
          ) : null}

          {challenge.state === "active" ? (
            <>
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
                onClick={() => {
                  trackPlanEvent("paydown_challenge_payment_click", {
                    daysRemaining: challenge.daysRemaining,
                    paymentsLoggedDuringChallenge: challenge.paymentsLoggedDuringChallenge,
                  });
                  navigate("/pagos?from=paydown_challenge");
                }}
              >
                Registrar pago
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full border border-border/55 sm:w-auto"
                disabled={isSubmitting}
                onClick={() => {
                  if (
                    !window.confirm(
                      "¿Cerrar el reto? Se borrará el seguimiento de estos 30 días.",
                    )
                  ) {
                    return;
                  }
                  void clearChallenge();
                }}
              >
                Cancelar reto
              </Button>
            </>
          ) : null}

          {challenge.state === "ended" ? (
            <Button
              size="lg"
              variant="ghost"
              className="w-full border border-border/55 sm:w-auto"
              disabled={isSubmitting}
              onClick={() => void clearChallenge()}
            >
              Archivar resultado
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
