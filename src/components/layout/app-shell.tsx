"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  Crown,
  CreditCard,
  FileText,
  Gauge,
  MoreHorizontal,
  Radar,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BrandBadge } from "@/components/shared/brand-logo";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { AppShellUserDto } from "@/lib/types/app";
import { getMembershipPlan } from "@/lib/membership/plans";
import { cn } from "@/lib/utils/cn";

type AppShellProps = {
  user: AppShellUserDto;
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const membershipPlan = getMembershipPlan(user.membershipTier);
  const activeNavItem = navItems.find((item) => item.href === pathname) ?? navItems[0]!;
  const mobilePrimaryNavItems = navItems.filter((item) =>
    ["/dashboard", "/deudas", "/pagos", "/simulador"].includes(item.href),
  );
  const mobileSecondaryNavItems = navItems.filter(
    (item) => !mobilePrimaryNavItems.some((primaryItem) => primaryItem.href === item.href),
  );
  const isMoreActive = mobileSecondaryNavItems.some((item) => item.href === pathname);

  const navigateTo = (href: Route) => {
    setIsMobileMenuOpen(false);
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen w-full max-w-[1840px] px-0 py-0 lg:grid lg:grid-cols-[252px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-6 lg:py-4 2xl:max-w-[1980px] 2xl:px-8">
        <div className="sticky top-0 z-30 border-b border-border/70 bg-[rgba(247,250,248,0.92)] px-3 pb-3 pt-3 backdrop-blur lg:hidden">
          <div className="rounded-[1.6rem] border border-[#dfe9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(245,250,248,0.97)_58%,rgba(241,247,244,0.94)_100%)] px-4 py-3 shadow-[0_18px_44px_-34px_rgba(18,61,54,0.3)] ring-1 ring-white/80">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                prefetch={false}
                onMouseEnter={() => router.prefetch("/dashboard")}
                className="flex min-w-0 items-center gap-3"
                aria-label="Ir al dashboard"
                title="Deuda Clara RD"
              >
                <BrandBadge
                  className="size-11 rounded-2xl"
                  markClassName="size-[1.625rem]"
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-foreground">
                    Deuda Clara RD
                  </p>
                  <p className="truncate text-sm text-muted">{activeNavItem.label}</p>
                </div>
              </Link>
              <span className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[#d7e8e1] bg-white/88 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#256e63]">
                {membershipPlan.label}
              </span>
            </div>
          </div>
        </div>

        <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] min-h-[620px] flex-col rounded-[2rem] border border-[#dfe9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(245,250,248,0.97)_58%,rgba(241,247,244,0.94)_100%)] px-4 py-5 shadow-[0_24px_60px_-38px_rgba(18,61,54,0.28)] ring-1 ring-white/80 lg:flex">
          <Link
            href="/dashboard"
            prefetch={false}
            onMouseEnter={() => router.prefetch("/dashboard")}
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

          <nav className="mt-6 flex min-h-0 flex-1 flex-col items-stretch gap-2 overflow-y-auto pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "group relative flex w-full items-center justify-start rounded-2xl px-4 py-3 transition-all duration-200 ease-out active:scale-[0.97]",
                    isActive
                      ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,251,249,0.94)_100%)] text-[#163c4e] shadow-[0_16px_32px_-22px_rgba(23,56,74,0.34)] ring-1 ring-[#d7e8e1]"
                      : "text-muted hover:bg-white/84 hover:text-foreground active:bg-white/92",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-2xl transition-all duration-200 ease-out",
                      isActive
                        ? "bg-[linear-gradient(180deg,#ffffff_0%,#f2faf7_100%)] text-primary shadow-[0_12px_24px_-18px_rgba(37,110,99,0.5)]"
                        : "bg-white/78 text-muted group-hover:bg-white group-hover:text-foreground group-active:scale-[0.97]",
                    )}
                  >
                    <Icon
                      className="size-4"
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                  </span>
                  <span>{item.label}</span>
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

        <main className="flex min-w-0 flex-col gap-4 px-3 pb-[7.5rem] pt-3 sm:px-4 sm:pb-[8rem] sm:pt-4 lg:gap-6 lg:px-0 lg:pb-0 lg:pt-0">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.85rem)] lg:hidden">
        <div className="rounded-[1.75rem] border border-[#dfe9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(245,250,248,0.96)_100%)] p-2 shadow-[0_26px_60px_-38px_rgba(18,61,54,0.34)] ring-1 ring-white/85">
          <div className="grid grid-cols-5 gap-1.5">
            {mobilePrimaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigateTo(item.href)}
                  className={cn(
                    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2 text-[11px] font-medium transition-all",
                    isActive
                      ? "bg-primary text-white shadow-[0_18px_34px_-24px_rgba(15,88,74,0.52)]"
                      : "bg-white/78 text-muted",
                  )}
                >
                  <Icon className="size-[1.1rem]" strokeWidth={isActive ? 2.35 : 2.1} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[1.35rem] px-2 py-2 text-[11px] font-medium transition-all",
                isMoreActive || isMobileMenuOpen
                  ? "bg-primary text-white shadow-[0_18px_34px_-24px_rgba(15,88,74,0.52)]"
                  : "bg-white/78 text-muted",
              )}
            >
              <MoreHorizontal className="size-[1.1rem]" strokeWidth={2.1} />
              <span>Más</span>
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(18,41,53,0.28)] backdrop-blur-[2px] lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-3 rounded-[2rem] border border-[#dfe9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(245,250,248,0.98)_100%)] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] shadow-[0_28px_70px_-36px_rgba(18,61,54,0.36)] ring-1 ring-white/90">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                  Navegación
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">Más opciones</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="grid size-11 place-items-center rounded-2xl border border-border bg-white/86 text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {mobileSecondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => navigateTo(item.href)}
                    className={cn(
                      "flex min-h-[3.75rem] items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-left text-sm font-medium transition-all",
                      isActive
                        ? "border-primary/18 bg-primary/8 text-foreground"
                        : "border-border/70 bg-white/82 text-foreground",
                    )}
                  >
                    <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1.35rem] border border-border/70 bg-white/82 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-sm text-muted">{user.email}</p>
                </div>
                <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                  Plan {membershipPlan.label}
                </span>
              </div>
              <div className="mt-3">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
