"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, CreditCard, FileText, LayoutDashboard, ShieldCheck, Users } from "lucide-react";

import { LogoutButton } from "@/features/auth/components/logout-button";

type HostShellProps = {
  userName: string;
  userEmail: string;
  children: ReactNode;
};

const internalAnchors = [
  { href: "#overview", label: "Overview", icon: LayoutDashboard },
  { href: "#users", label: "Usuarios", icon: Users },
  { href: "#finance", label: "Finanzas", icon: CreditCard },
  { href: "#membership", label: "Membresías", icon: ShieldCheck },
  { href: "#activity", label: "Actividad", icon: FileText },
  { href: "#notifications", label: "Notificaciones", icon: Bell },
] as const;

export function HostShell({
  userName,
  userEmail,
  children,
}: HostShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-[2rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,246,247,0.96)_100%)] p-5 shadow-soft">
          <Link href="/host" className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-foreground text-background">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Host Panel</p>
              <p className="text-sm text-muted">Acceso interno operativo</p>
            </div>
          </Link>

          <div className="mt-6 rounded-2xl border border-border bg-secondary/45 p-4">
            <p className="text-sm text-muted">Sesión autorizada</p>
            <p className="mt-1 font-semibold text-foreground">{userName}</p>
            <p className="text-sm text-muted">{userEmail}</p>
          </div>

          <nav className="mt-6 flex flex-col gap-2">
            {internalAnchors.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted transition hover:bg-white hover:text-foreground"
                >
                  <span className="grid size-9 place-items-center rounded-2xl bg-white text-muted">
                    <Icon className="size-4" />
                  </span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-border bg-white/80 p-3">
            <LogoutButton />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
