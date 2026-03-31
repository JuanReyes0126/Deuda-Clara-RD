import Link from "next/link";

import { BrandBadge } from "@/components/shared/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#motor", label: "Motor" },
  { href: "#planes", label: "Planes" },
  { href: "#seguridad", label: "Seguridad" },
  { href: "#arquitectura", label: "Arquitectura" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-4 z-30 w-full">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-soft backdrop-blur sm:gap-6 sm:px-5">
        <Link href="/" className="flex items-center gap-3">
          <BrandBadge className="size-12 rounded-2xl" markClassName="size-7" />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-foreground">Deuda Clara RD</p>
            <p className="hidden text-sm text-muted sm:block">Control real de deudas personales</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 rounded-full bg-secondary/80 px-2 py-2 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:bg-white hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Iniciar sesión
          </Link>
          <Link href="/registro" className={buttonClasses({ variant: "primary", size: "sm" })}>
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
