"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { readJsonPayload } from "@/lib/http/read-json-payload";
import type { NotificationItemDto } from "@/lib/types/app";
import { formatDate, formatRelativeDistance } from "@/lib/utils/date";

const notificationTypeLabels: Record<string, string> = {
  DUE_SOON: "Vence pronto",
  OVERDUE: "Atraso",
  MINIMUM_PAYMENT_RISK: "Pago mínimo riesgoso",
  STRATEGY_RECOMMENDATION: "Recomendación",
  MONTHLY_REPORT: "Resumen mensual",
  SECURITY: "Seguridad",
  SYSTEM: "Sistema",
};

function getNotificationScore(notification: NotificationItemDto) {
  const severityScore =
    notification.severity === "CRITICAL"
      ? 120
      : notification.severity === "WARNING"
        ? 80
        : 40;
  const unreadScore = notification.readAt ? 0 : 30;
  const actionScore = notification.actionHref ? 20 : 0;
  const dueSoonScore =
    notification.type === "OVERDUE"
      ? 25
      : notification.type === "DUE_SOON"
        ? 15
        : 0;
  const recencyScore =
    new Date(notification.createdAt).getTime() / 1_000_000_000_000;

  return (
    severityScore + unreadScore + actionScore + dueSoonScore + recencyScore
  );
}

function getNotificationSupportCopy(notification: NotificationItemDto) {
  if (notification.type === "OVERDUE") {
    return "Actuar hoy ayuda a frenar mora y a que esta deuda no siga absorbiendo flujo.";
  }

  if (notification.type === "DUE_SOON") {
    return "Resolver este vencimiento primero evita que el plan se abra en demasiados frentes a la vez.";
  }

  if (notification.type === "MINIMUM_PAYMENT_RISK") {
    return "Esta señal vale la pena porque puede recortar intereses antes de que cierres el mes.";
  }

  if (notification.type === "STRATEGY_RECOMMENDATION") {
    return "Esta alerta ya se conecta con la prioridad que hoy rinde mejor para tu flujo.";
  }

  if (notification.type === "MONTHLY_REPORT") {
    return "Abrir el reporte ahora te dice si tu dinero rindió mejor o peor que antes.";
  }

  return "Vale la pena revisarla para mantener el panel alineado con tu situación real.";
}

async function requestJson(url: string, method = "POST") {
  const response = await fetch(url, { method });
  const payload = await readJsonPayload<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }
}

export function NotificationCenter({
  initialNotifications,
  premiumInsightsEnabled = false,
}: {
  initialNotifications: NotificationItemDto[];
  premiumInsightsEnabled?: boolean;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "UNREAD" | "WARNING" | "ACTIONABLE"
  >("ALL");
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const counts = useMemo(() => {
    let unread = 0;
    let warning = 0;
    let actionable = 0;

    notifications.forEach((notification) => {
      if (!notification.readAt) {
        unread += 1;
      }

      if (
        notification.severity === "WARNING" ||
        notification.severity === "CRITICAL"
      ) {
        warning += 1;
      }

      if (notification.actionHref) {
        actionable += 1;
      }
    });

    return {
      unread,
      warning,
      actionable,
    };
  }, [notifications]);
  const unreadCount = counts.unread;
  const warningCount = counts.warning;
  const actionableCount = counts.actionable;
  const shouldShowPremiumUpsell =
    !premiumInsightsEnabled && (warningCount > 0 || actionableCount > 0);
  const premiumPlanHref = "/planes?plan=NORMAL&source=notificaciones";
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "UNREAD") {
      return notifications.filter((notification) => !notification.readAt);
    }

    if (activeFilter === "WARNING") {
      return notifications.filter(
        (notification) =>
          notification.severity === "WARNING" ||
          notification.severity === "CRITICAL",
      );
    }

    if (activeFilter === "ACTIONABLE") {
      return notifications.filter((notification) =>
        Boolean(notification.actionHref),
      );
    }

    return notifications;
  }, [activeFilter, notifications]);
  const notificationGroups = useMemo(() => {
    if (!filteredNotifications.length) {
      return {
        primary: null,
        priority: [] as NotificationItemDto[],
        secondary: [] as NotificationItemDto[],
      };
    }

    const sorted = [...filteredNotifications].sort(
      (left, right) => getNotificationScore(right) - getNotificationScore(left),
    );
    const primary = sorted[0] ?? null;
    const priority = sorted.filter(
      (notification) =>
        notification.id !== primary?.id &&
        (notification.severity === "CRITICAL" ||
          notification.severity === "WARNING" ||
          (!notification.readAt && Boolean(notification.actionHref))),
    );
    const priorityIds = new Set(priority.map((notification) => notification.id));
    const secondary = sorted.filter(
      (notification) =>
        notification.id !== primary?.id && !priorityIds.has(notification.id),
    );

    return {
      primary,
      priority,
      secondary,
    };
  }, [filteredNotifications]);
  const primaryNotification = notificationGroups.primary;
  const priorityNotifications = notificationGroups.priority;
  const secondaryNotifications = notificationGroups.secondary;

  const markRead = async (notificationId: string) => {
    try {
      await requestJson(`/api/notifications/${notificationId}/read`);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la alerta.",
      );
    }
  };

  const readAll = async () => {
    try {
      await requestJson("/api/notifications/read-all");
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron marcar las alertas.",
      );
    }
  };

  const refreshNotifications = () => {
    startTransition(() => {
      router.refresh();
    });
  };
  const renderNotificationCard = (notification: NotificationItemDto) => (
    <Card key={notification.id} className="min-w-0 p-6">
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={
                notification.severity === "CRITICAL"
                  ? "danger"
                  : notification.severity === "WARNING"
                    ? "warning"
                    : "default"
              }
            >
              {notificationTypeLabels[notification.type] ?? notification.type}
            </Badge>
            {!notification.readAt ? (
              <Badge variant="success">Nueva</Badge>
            ) : null}
          </div>
          <CardTitle className="mt-4 break-words text-2xl">
            {notification.title}
          </CardTitle>
          <CardDescription className="mt-3 break-words">
            {notification.message}
          </CardDescription>
          <p className="text-muted mt-3 text-sm leading-7">
            {getNotificationSupportCopy(notification)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {notification.actionHref && notification.actionLabel ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (!notification.readAt) {
                  void markRead(notification.id);
                }
                router.push(notification.actionHref! as never);
              }}
            >
              {notification.actionLabel}
            </Button>
          ) : null}
          {!notification.readAt ? (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => markRead(notification.id)}
            >
              Marcar leída
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="text-muted flex flex-wrap gap-6 pt-4 text-sm">
        <p>
          Creada: <span className="date-stable inline-block">{formatDate(notification.createdAt)}</span>
        </p>
        {notification.dueAt ? (
          <p>Vence {formatRelativeDistance(notification.dueAt)}</p>
        ) : null}
        {notification.readAt ? (
          <p>
            Leída: <span className="date-stable inline-block">{formatDate(notification.readAt)}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader className="flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Centro de notificaciones</CardTitle>
            <CardDescription>
              Alertas por vencimiento, atraso, riesgo de mínimos,
              recomendaciones del plan y seguimiento premium semanal.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={refreshNotifications}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={readAll}
              disabled={!unreadCount}
            >
              Marcar todas como leídas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Sin leer",
                value: unreadCount,
                support: "Lo que conviene revisar primero.",
              },
              {
                label: "Con urgencia",
                value: warningCount,
                support: "Alertas de warning o críticas.",
              },
              {
                label: "Con acción directa",
                value: actionableCount,
                support: "Te llevan al siguiente paso útil.",
              },
            ].map((item) => (
              <div key={item.label} className="bg-secondary min-w-0 rounded-3xl p-4">
                <p className="text-muted text-xs tracking-[0.16em] uppercase">
                  {item.label}
                </p>
                <p className="value-stable text-foreground mt-2 text-[clamp(1.2rem,2.8vw,1.8rem)] font-semibold leading-tight">
                  {item.value}
                </p>
                <p className="text-muted mt-2 text-sm">{item.support}</p>
              </div>
            ))}
          </div>

          {shouldShowPremiumUpsell ? (
            <div className="border-primary/15 rounded-[1.75rem] border bg-[rgba(255,248,241,0.82)] px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                    Seguimiento premium disponible
                  </p>
                  <p className="text-foreground mt-3 break-words text-xl font-semibold">
                    No te quedes solo leyendo alertas. Convierte estas señales
                    en una rutina guiada.
                  </p>
                  <p className="text-muted mt-2 text-sm leading-7">
                    Tienes {warningCount} alerta{warningCount === 1 ? "" : "s"}{" "}
                    urgente
                    {warningCount === 1 ? "" : "s"} y {actionableCount} acción
                    {actionableCount === 1 ? "" : "es"} directa
                    {actionableCount === 1 ? "" : "s"}. Premium las conecta con
                    seguimiento semanal, prioridades más claras y un plan
                    recomendado sin tener que interpretarlo todo manualmente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => router.push(premiumPlanHref)}
                  >
                    Optimizar con Premium
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push("/simulador")}
                  >
                    Revisar simulador
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {premiumInsightsEnabled ? (
            <div className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(240,248,245,0.92))] px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
                    Seguimiento premium activo
                  </p>
                  <p className="text-foreground mt-3 break-words text-xl font-semibold">
                    Tus alertas ya trabajan como acompañamiento, no solo como
                    recordatorio.
                  </p>
                  <p className="text-muted mt-2 text-sm leading-7">
                    Deuda Clara RD combina tus vencimientos, tu ritmo reciente y
                    tu progreso frente al período anterior para priorizar mejor
                    qué hacer esta semana.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => router.push("/dashboard?focus=optimization")}
                  >
                    Ver mi plan
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {primaryNotification ? (
            <div className="border-primary/12 rounded-[1.75rem] border bg-[rgba(240,248,245,0.92)] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant={
                        primaryNotification.severity === "CRITICAL"
                          ? "danger"
                          : primaryNotification.severity === "WARNING"
                            ? "warning"
                            : "default"
                      }
                    >
                      Alerta principal de hoy
                    </Badge>
                    {!primaryNotification.readAt ? (
                      <Badge variant="success">Sin leer</Badge>
                    ) : null}
                  </div>
                  <p className="text-foreground mt-4 break-words text-2xl font-semibold">
                    {primaryNotification.title}
                  </p>
                  <p className="text-muted mt-3 text-sm leading-7">
                    {primaryNotification.message}
                  </p>
                  <p className="text-foreground mt-3 text-sm leading-7">
                    {getNotificationSupportCopy(primaryNotification)}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto">
                  {primaryNotification.actionHref &&
                  primaryNotification.actionLabel ? (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => {
                        if (!primaryNotification.readAt) {
                          void markRead(primaryNotification.id);
                        }
                        router.push(primaryNotification.actionHref! as never);
                      }}
                    >
                      {primaryNotification.actionLabel}
                    </Button>
                  ) : null}
                  {!primaryNotification.readAt ? (
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => markRead(primaryNotification.id)}
                    >
                      Marcar leída
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {[
              { id: "ALL" as const, label: `Todas (${notifications.length})` },
              { id: "UNREAD" as const, label: `Sin leer (${unreadCount})` },
              { id: "WARNING" as const, label: `Urgentes (${warningCount})` },
              {
                id: "ACTIONABLE" as const,
                label: `Accionables (${actionableCount})`,
              },
            ].map((filter) => (
              <Button
                key={filter.id}
                type="button"
                size="sm"
                variant={activeFilter === filter.id ? "primary" : "secondary"}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {filteredNotifications.length ? (
          <>
            {priorityNotifications.length ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="warning">Atiéndelo primero</Badge>
                  <p className="text-muted text-sm">
                    Estas alertas tienen impacto directo sobre mora,
                    vencimientos o decisiones del plan.
                  </p>
                </div>
                {priorityNotifications.map(renderNotificationCard)}
              </div>
            ) : null}

            {secondaryNotifications.length ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="default">Luego revisa esto</Badge>
                  <p className="text-muted text-sm">
                    Mantienen el contexto al día y ayudan a sostener el hábito
                    semanal.
                  </p>
                </div>
                {secondaryNotifications.map(renderNotificationCard)}
              </div>
            ) : null}

            {!priorityNotifications.length &&
            !secondaryNotifications.length &&
            primaryNotification ? (
              <Card className="p-6">
                <CardContent className="border-border text-muted rounded-3xl border border-dashed p-8 text-center text-sm">
                  La alerta principal ya quedó destacada arriba. Cuando entren
                  más avisos, aquí aparecerá el resto del contexto.
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <Card className="p-6">
            <CardContent className="border-border rounded-3xl border border-dashed p-8 text-center">
              <p className="text-base font-semibold text-foreground">
                No hay notificaciones para ese filtro ahora mismo.
              </p>
              <p className="text-muted mt-2 text-sm">
                Si tu panel está empezando, aquí irán apareciendo alertas de
                vencimiento, atraso y seguimiento semanal.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/dashboard")}
                >
                  Volver al dashboard
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/deudas")}
                >
                  Registrar una deuda
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
