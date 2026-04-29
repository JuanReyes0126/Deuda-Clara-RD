import {
  AlertTriangle,
  CircleCheck,
  CreditCard,
  Crown,
  Sparkles,
  Wallet,
} from "lucide-react";

import { getCommercialUpgradeCta } from "@/config/membership-commercial-copy";
import type { DashboardDto } from "@/lib/types/app";

export type MobileActionButton = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type DashboardQuickAction = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  icon: typeof AlertTriangle;
};

export function buildMobileActionButtons(paymentPriorityHref: string): MobileActionButton[] {
  return [
    {
      label: "Registrar pago",
      href: paymentPriorityHref,
      variant: "primary",
    },
    {
      label: "Ver deudas",
      href: "/deudas",
      variant: "secondary",
    },
    {
      label: "Abrir simulador",
      href: "/simulador",
      variant: "secondary",
    },
  ];
}

export function buildDashboardQuickActions(input: {
  data: DashboardDto;
  hasDebts: boolean;
  isPremiumUnlocked: boolean;
  upgradePlanHref: string;
  managePlanHref: string;
}): DashboardQuickAction[] {
  const { data, hasDebts, isPremiumUnlocked, upgradePlanHref, managePlanHref } = input;

  return [
    !hasDebts
      ? {
          title: "Carga tu primera deuda",
          description:
            "Sin deudas registradas todavía no podemos construir una ruta real ni alertarte a tiempo.",
          actionLabel: "Ir a deudas",
          href: "/deudas",
          icon: CreditCard,
        }
      : null,
    hasDebts && data.recentPayments.length === 0
      ? {
          title: "Registra tu primer pago",
          description:
            "Con un pago registrado el sistema ya empieza a medir avance real y presión mensual.",
          actionLabel: "Ir a pagos",
          href: "/pagos",
          icon: Wallet,
        }
      : null,
    !isPremiumUnlocked && data.membership.billingStatus === "FREE"
      ? {
          title: "Desbloquea el plan recomendado",
          description:
            "Premium te guía por 6 meses para dejar de perder dinero y mostrar cuánto tiempo podrías recortar.",
          actionLabel: getCommercialUpgradeCta("Premium"),
          href: upgradePlanHref,
          icon: Crown,
        }
      : null,
    data.membership.billingStatus === "PAST_DUE"
      ? {
          title: "Tu plan premium necesita atención",
          description:
            "Actualiza la facturación para no perder el módulo recomendado ni el seguimiento.",
          actionLabel: "Revisar facturación",
          href: managePlanHref,
          icon: AlertTriangle,
        }
      : null,
    data.membership.cancelAtPeriodEnd
      ? {
          title: "Tu plan terminará al cierre del período",
          description:
            "Si quieres mantener la guía premium y el orden optimizado, reactívalo antes del corte.",
          actionLabel: "Gestionar plan",
          href: managePlanHref,
          icon: CircleCheck,
        }
      : null,
    hasDebts && data.riskAlerts.length > 0
      ? {
          title: "Hay señales de pago mínimo riesgoso",
          description:
            "Revisar esto ahora puede evitar que sigas pagando intereses sin bajar el saldo.",
          actionLabel: "Revisar deudas",
          href: "/deudas",
          icon: Sparkles,
        }
      : null,
  ].filter(Boolean) as DashboardQuickAction[];
}
