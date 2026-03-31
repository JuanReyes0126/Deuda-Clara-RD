"use client";

import type { Route } from "next";
import Link from "next/link";
import type { User, UserSettings } from "@prisma/client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Bell,
  Crown,
  CreditCard,
  FileText,
  Gauge,
  Radar,
  Settings,
  Wallet,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { LogoutButton } from "@/features/auth/components/logout-button";
import { getMembershipPlan } from "@/lib/membership/plans";
import { cn } from "@/lib/utils/cn";

type AppShellProps = {
  user: User & { settings: UserSettings | null };
  children: ReactNode;
};

const navItems: ReadonlyArray<{
  href: Route;
  label: string;
  icon: typeof Gauge;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/deudas", label: "Deudas", icon: CreditCard },
  { href: "/pagos", label: "Pagos", icon: Wallet },
  { href: "/simulador", label: "Simulador", icon: Radar },
  { href: "/reportes", label: "Reportes", icon: FileText },
  { href: "/planes" as Route, label: "Planes", icon: Crown },
  { href: "/notificaciones", label: "Alertas", icon: Bell },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const membershipPlan = getMembershipPlan(user.settings?.membershipTier);

  useEffect(() => {
    const prefetchRoutes = () => {
      navItems.forEach((item) => {
        if (item.href !== pathname) {
          router.prefetch(item.href);
        }
      });
    };

    if (typeof window === "undefined") {
      return;
    }

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes);

      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(prefetchRoutes, 150);

    return () => clearTimeout(timeoutId);
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1840px] gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 xl:px-6 2xl:max-w-[1980px] 2xl:px-8 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,240,231,0.92)_100%)] p-4 shadow-soft ring-1 ring-white/70 sm:p-5 lg:sticky lg:top-6 lg:self-start">
          <Link href="/dashboard" prefetch className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_125%)] text-white shadow-[0_18px_36px_rgba(15,118,110,0.25)]">
              <span className="font-display text-lg font-semibold">DC</span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-foreground">Deuda Clara RD</p>
              <p className="hidden text-sm text-muted sm:block">Panel personal guiado</p>
            </div>
          </Link>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/60 bg-white/72 p-4 shadow-[0_14px_28px_rgba(24,49,59,0.06)]">
              <p className="text-sm text-muted">Sesión actual</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <div className="mt-3">
                <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                  Plan {membershipPlan.label}
                </span>
              </div>
            </div>

            <div className="rounded-3xl bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(255,210,125,0.24)_100%)] p-4">
              <p className="text-sm font-semibold text-foreground">Navegación clara</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Entramos por secciones simples: primero panorama, luego deudas, pagos y simulación.
              </p>
            </div>
          </div>

          <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(240,138,93,0.12)_100%)] text-foreground shadow-[0_12px_26px_rgba(240,138,93,0.08)]"
                      : "text-muted hover:bg-white/70 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-2xl transition",
                      isActive ? "bg-white text-primary" : "bg-white/80 text-muted",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 rounded-3xl border border-white/60 bg-white/72 p-3 sm:mt-6">
            <LogoutButton />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
