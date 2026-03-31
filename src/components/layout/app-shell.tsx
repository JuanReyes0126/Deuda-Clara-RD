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

import { BrandBadge } from "@/components/shared/brand-logo";
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
  const activeNavItem = navItems.find((item) => item.href === pathname) ?? navItems[0]!;

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
      <div className="mx-auto grid min-h-screen w-full max-w-[1840px] grid-cols-[68px_minmax(0,1fr)] items-start gap-3 px-2 py-2 sm:grid-cols-[74px_minmax(0,1fr)] sm:gap-4 sm:px-3 sm:py-3 md:grid-cols-[80px_minmax(0,1fr)] md:px-4 md:py-4 xl:px-6 2xl:max-w-[1980px] 2xl:px-8 lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="sticky top-2 flex h-[calc(100dvh-1rem)] min-h-[620px] flex-col rounded-[1.6rem] border border-[#dfe9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(245,250,248,0.97)_58%,rgba(241,247,244,0.94)_100%)] px-1.5 py-2.5 shadow-[0_24px_60px_-38px_rgba(18,61,54,0.28)] ring-1 ring-white/80 sm:top-3 sm:h-[calc(100dvh-1.5rem)] sm:px-2 sm:py-3 md:px-2.5 md:py-3.5 lg:top-4 lg:h-[calc(100dvh-2rem)] lg:rounded-[2rem] lg:px-4 lg:py-5">
          <Link
            href="/dashboard"
            prefetch
            className="flex items-center justify-center lg:justify-start lg:gap-3"
            aria-label="Ir al dashboard"
            title="Deuda Clara RD"
          >
            <BrandBadge
              className="size-10 rounded-2xl sm:size-11 lg:size-12"
              markClassName="size-6 sm:size-[1.625rem] lg:size-7"
            />
            <div className="hidden min-w-0 lg:block">
              <p className="font-display text-lg font-semibold text-foreground">Deuda Clara RD</p>
              <p className="text-sm text-muted">Panel personal guiado</p>
            </div>
          </Link>

          <div className="mt-3 flex justify-center lg:hidden">
            <div className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#d7e8e1] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,251,249,0.94)_100%)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#256e63] shadow-[0_16px_30px_-24px_rgba(23,56,74,0.36)] sm:min-h-10 sm:px-3.5 sm:text-[11px]">
              {activeNavItem.label}
            </div>
          </div>

          <div className="mt-5 hidden gap-4 lg:grid">
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

          <nav className="mt-5 flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pb-2 lg:mt-6 lg:items-stretch">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "group relative flex w-full max-w-[52px] items-center justify-center rounded-2xl px-0 py-2.5 transition-all duration-200 ease-out active:scale-[0.97] sm:max-w-[58px] sm:py-3 md:max-w-[62px] lg:max-w-none lg:justify-start lg:px-4 lg:py-3",
                    isActive
                      ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,251,249,0.94)_100%)] text-[#163c4e] shadow-[0_16px_32px_-22px_rgba(23,56,74,0.34)] ring-1 ring-[#d7e8e1]"
                      : "text-muted hover:bg-white/84 hover:text-foreground active:bg-white/92",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-[2.625rem] place-items-center rounded-2xl transition-all duration-200 ease-out sm:size-[2.9rem] lg:size-9",
                      isActive
                        ? "bg-[linear-gradient(180deg,#ffffff_0%,#f2faf7_100%)] text-primary shadow-[0_12px_24px_-18px_rgba(37,110,99,0.5)]"
                        : "bg-white/78 text-muted group-hover:bg-white group-hover:text-foreground group-active:scale-[0.97]",
                    )}
                  >
                    <Icon
                      className="size-[1.05rem] sm:size-[1.15rem] lg:size-4"
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                  </span>
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-[#d7e8e1] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,251,249,0.96)_100%)] px-2.5 py-1 text-[11px] font-medium text-[#17384a] opacity-0 shadow-[0_14px_30px_-20px_rgba(23,56,74,0.35)] transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 lg:hidden">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center justify-center pt-2 lg:block lg:pt-4">
            <div className="rounded-3xl border border-white/60 bg-white/72 p-1.5 sm:p-2 lg:p-3">
              <div className="lg:hidden">
                <LogoutButton compact />
              </div>
              <div className="hidden lg:block">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 pt-0 sm:gap-5 lg:gap-6">{children}</div>
      </div>
    </div>
  );
}
