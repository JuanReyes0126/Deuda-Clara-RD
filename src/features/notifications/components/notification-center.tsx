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
import { ExecutiveSummaryStrip } from "@/components/shared/executive-summary-strip";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { MEMBERSHIP_COMMERCIAL_COPY } from "@/config/membership-commercial-copy";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { resolveFeatureAccess } from "@/lib/feature-access";
import { useSessionUpgradePrompt } from "@/lib/membership/use-session-upgrade-prompt";
import type {
  MembershipBillingStatus,
  MembershipPlanId,
} from "@/lib/membership/plans";
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

type NotificationBucket =
  | "ALL"
  | "URGENT"
  | "IMPORTANT"
  | "OPPORTUNITY"
  | "FOLLOW_UP";

const notificationBucketMeta: Record<
  Exclude<NotificationBucket, "ALL">,
  { label: string; description: string; variant: "default" | "success" | "warning" | "danger" }
> = {
  URGENT: {
    label: "Urgente",
    description: "Conviene resolverlo hoy para no dejar que la presión crezca.",
    variant: "danger",
  },
  IMPORTANT: {
    label: "Importante",
    description: "Tiene impacto directo sobre tu flujo o tu siguiente decisión.",
    variant: "warning",
  },
  OPPORTUNITY: {
    label: "Oportunidad",
    description: "Aquí hay una mejora concreta que te conviene aprovechar.",
    variant: "success",
  },
  FOLLOW_UP: {
    label: "Seguimiento",
    description: "Mantiene el plan alineado y evita perder contexto.",
    variant: "default",
  },
};

function getNotificationBucket(
  notification: NotificationItemDto,
): Exclude<NotificationBucket, "ALL"> {
  if (
    notification.type === "OVERDUE" ||
    notification.severity === "CRITICAL"
  ) {
    return "URGENT";
  }

  if (
    notification.type === "DUE_SOON" ||
    notification.type === "MINIMUM_PAYMENT_RISK" ||
    notification.severity === "WARNING"
  ) {
    return "IMPORTANT";
  }

  if (
    notification.type === "STRATEGY_RECOMMENDATION" ||
    notification.type === "MONTHLY_REPORT" ||
    Boolean(notification.actionHref)
  ) {
    return "OPPORTUNITY";
  }

  return "FOLLOW_UP";
}

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
  const response = await fetchWithCsrf(url, { method });
  const payload = await readJsonPayload<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }
}

export function NotificationCenter({
  initialNotifications,
  membershipTier,
  billingStatus,
}: {
  initialNotifications: NotificationItemDto[];
  membershipTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
}) {
  const router = useRouter();
  const access = resolveFeatureAccess({
    membershipTier,
    membershipBillingStatus: billingStatus,
  });
  const premiumInsightsEnabled = access.canReceiveAdvancedAlerts;
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<NotificationBucket>("ALL");
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
    access.isBase && (warningCount > 0 || actionableCount > 0);
  const shouldShowProUpsell =
    access.isPremium && !access.canAccessProFollowup;
  const premiumPlanHref = "/planes?plan=NORMAL&source=notificaciones";
  const proPlanHref = "/planes?plan=PRO&source=notificaciones";
  const bucketCounts = useMemo(() => {
    const counts = {
      URGENT: 0,
      IMPORTANT: 0,
      OPPORTUNITY: 0,
      FOLLOW_UP: 0,
    };

    notifications.forEach((notification) => {
      counts[getNotificationBucket(notification)] += 1;
    });

    return counts;
  }, [notifications]);
  const showNotificationsPremiumPrompt = useSessionUpgradePrompt({
    id: "notifications:premium",
    active:
      (shouldShowPremiumUpsell && bucketCounts.URGENT > 0) ||
      (shouldShowPremiumUpsell && actionableCount > 1),
  });
  const showNotificationsProPrompt = useSessionUpgradePrompt({
    id: "notifications:pro",
    active:
      !showNotificationsPremiumPrompt &&
      shouldShowProUpsell &&
      (warningCount > 0 || actionableCount > 0),
  });
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "ALL") {
      return notifications;
    }

    return notifications.filter(
      (notification) => getNotificationBucket(notification) === activeFilter,
    );
  }, [activeFilter, notifications]);
  const notificationGroups = useMemo(() => {
    if (!filteredNotifications.length) {
      return {
        primary: null,
        buckets: {
          URGENT: [] as NotificationItemDto[],
          IMPORTANT: [] as NotificationItemDto[],
          OPPORTUNITY: [] as NotificationItemDto[],
          FOLLOW_UP: [] as NotificationItemDto[],
        },
      };
    }

    const sorted = [...filteredNotifications].sort(
      (left, right) => getNotificationScore(right) - getNotificationScore(left),
    );
    const primary = sorted[0] ?? null;
    const buckets = {
      URGENT: [] as NotificationItemDto[],
      IMPORTANT: [] as NotificationItemDto[],
      OPPORTUNITY: [] as NotificationItemDto[],
      FOLLOW_UP: [] as NotificationItemDto[],
    };

    sorted.forEach((notification) => {
      if (notification.id === primary?.id) {
        return;
      }

      buckets[getNotificationBucket(notification)].push(notification);
    });

    return {
      primary,
      buckets,
    };
  }, [filteredNotifications]);
  const primaryNotification = notificationGroups.primary;
  const groupedNotifications = notificationGroups.buckets;
  const notificationSummaryItems = [
    {
      label: "Sin leer",
      value: String(unreadCount),
      support: "Lo primero que conviene revisar para no perder contexto.",
      featured: true,
      badgeLabel: unreadCount > 0 ? "Pendientes" : "Al día",
      badgeVariant: unreadCount > 0 ? ("warning" as const) : ("success" as const),
      valueKind: "text" as const,
    },
    {
      label: "Urgentes",
      value: String(bucketCounts.URGENT),
      support: "Pueden aumentar mora o presión si las dejas pasar.",
      valueKind: "text" as const,
    },
    {
      label: "Oportunidades",
      value: String(bucketCounts.OPPORTUNITY),
      support: "Te muestran dónde puedes ahorrar o decidir mejor.",
      valueKind: "text" as const,
    },
    {
      label: "Con acción directa",
      value: String(actionableCount),
      support: "Te llevan al siguiente paso útil sin rodeos.",
      valueKind: "text" as const,
    },
  ];

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
      <ModuleSectionHeader
        kicker="Alertas"
        title="Una alerta principal arriba. El resto agrupado por intención."
        description="La idea aquí no es llenarte de avisos. Es decirte qué conviene resolver hoy, qué merece atención y dónde hay oportunidad de mejorar."
        action={
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
        }
      />

      <ExecutiveSummaryStrip items={notificationSummaryItems} />

      {primaryNotification ? (
        <PrimaryActionCard
          eyebrow="Alerta principal de hoy"
          title={primaryNotification.title}
          description={`${primaryNotification.message} ${getNotificationSupportCopy(primaryNotification)}`}
          badgeLabel={notificationBucketMeta[getNotificationBucket(primaryNotification)].label}
          badgeVariant={
            primaryNotification.severity === "CRITICAL"
              ? "danger"
              : primaryNotification.severity === "WARNING"
                ? "warning"
                : "default"
          }
          primaryAction={{
            label:
              primaryNotification.actionHref && primaryNotification.actionLabel
                ? primaryNotification.actionLabel
                : "Actualizar alertas",
            onClick: () => {
              if (primaryNotification.actionHref && primaryNotification.actionLabel) {
                if (!primaryNotification.readAt) {
                  void markRead(primaryNotification.id);
                }
                router.push(primaryNotification.actionHref as never);
                return;
              }

              refreshNotifications();
            },
          }}
          secondaryAction={
            !primaryNotification.readAt
              ? {
                  label: "Marcar leída",
                  onClick: () => markRead(primaryNotification.id),
                  variant: "secondary",
                }
              : undefined
          }
          notes={[
            `Creada: ${formatDate(primaryNotification.createdAt)}.`,
            primaryNotification.dueAt
              ? `Vence ${formatRelativeDistance(primaryNotification.dueAt)}.`
              : "Sin vencimiento directo asociado.",
          ]}
          tone={
            primaryNotification.severity === "CRITICAL"
              ? "warning"
              : primaryNotification.actionHref
                ? "premium"
                : "default"
          }
        />
      ) : null}

      {showNotificationsPremiumPrompt ? (
        <div className="border-primary/15 rounded-2xl border bg-[rgba(255,248,241,0.82)] px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                Seguimiento premium disponible
              </p>
              <p className="text-foreground mt-3 break-words text-xl font-semibold">
                No te quedes solo leyendo alertas. Úsalas para perder menos dinero.
              </p>
              <p className="text-muted mt-2 text-sm leading-7">
                Tienes {bucketCounts.URGENT} alerta{bucketCounts.URGENT === 1 ? "" : "s"} urgente{bucketCounts.URGENT === 1 ? "" : "s"} y {actionableCount} acción{actionableCount === 1 ? "" : "es"} directa{actionableCount === 1 ? "" : "s"}. Premium las convierte en una prioridad semanal clara para que no sigas reaccionando tarde.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => router.push(premiumPlanHref)}>
                {MEMBERSHIP_COMMERCIAL_COPY.contextualCta.notificationsPremium}
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
        <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(240,248,245,0.92))] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700 uppercase">
                Seguimiento premium activo
              </p>
              <p className="text-foreground mt-3 break-words text-xl font-semibold">
                Tus alertas ya funcionan como acompañamiento, no como lista fría.
              </p>
              <p className="text-muted mt-2 text-sm leading-7">
                Deuda Clara RD cruza vencimientos, ritmo reciente y progreso para priorizar mejor qué conviene hacer esta semana.
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

      {showNotificationsProPrompt ? (
        <div className="rounded-2xl border border-primary/12 bg-[rgba(255,248,241,0.82)] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                Seguimiento extendido disponible
              </p>
              <p className="text-foreground mt-3 break-words text-xl font-semibold">
                Premium ya ordena tus alertas. Pro mantiene el seguimiento vivo por más tiempo.
              </p>
              <p className="text-muted mt-2 text-sm leading-7">
                Ahora mismo ves las {access.notificationHistoryLimit} alertas más recientes. Pro extiende ese seguimiento para que no pierdas contexto cuando el flujo se alarga o cambia.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => router.push(proPlanHref)}>
                {MEMBERSHIP_COMMERCIAL_COPY.contextualCta.notificationsPro}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "ALL" as const, label: `Todas (${notifications.length})` },
          { id: "URGENT" as const, label: `Urgente (${bucketCounts.URGENT})` },
          { id: "IMPORTANT" as const, label: `Importante (${bucketCounts.IMPORTANT})` },
          { id: "OPPORTUNITY" as const, label: `Oportunidad (${bucketCounts.OPPORTUNITY})` },
          { id: "FOLLOW_UP" as const, label: `Seguimiento (${bucketCounts.FOLLOW_UP})` },
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

      <section className="grid gap-4">
        {filteredNotifications.length ? (
          <>
            {(Object.keys(groupedNotifications) as Array<
              Exclude<NotificationBucket, "ALL">
            >).map((bucket) => {
              const bucketItems = groupedNotifications[bucket];

              if (!bucketItems.length) {
                return null;
              }

              const meta = notificationBucketMeta[bucket];

              return (
                <div key={bucket} className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <p className="text-muted text-sm">{meta.description}</p>
                  </div>
                  {bucketItems.map(renderNotificationCard)}
                </div>
              );
            })}

            {!Object.values(groupedNotifications).some((group) => group.length) &&
            primaryNotification ? (
              <Card className="p-6">
                <CardContent className="border-border text-muted rounded-2xl border border-dashed p-8 text-center text-sm">
                  La alerta principal ya quedó destacada arriba. Cuando entren
                  más avisos, aquí aparecerá el resto del contexto.
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <Card className="p-6">
            <CardContent className="border-border rounded-2xl border border-dashed p-8 text-center">
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
