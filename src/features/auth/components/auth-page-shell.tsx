import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLockup } from "@/components/shared/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  asideTitle: string;
  asideItems: string[];
  proofItems?: string[];
};

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
  asideTitle,
  asideItems,
  proofItems = [],
}: AuthPageShellProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,183,172,0.35),transparent_28%),linear-gradient(180deg,#f7faf8_0%,#edf3ef_100%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="space-y-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandLockup
              className="gap-3.5"
              markClassName="size-11 sm:size-12"
              titleClassName="text-[1.72rem] sm:text-[2.02rem]"
              subtitleClassName="text-sm sm:text-base"
            />
          </Link>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
            <h1 className="max-w-xl font-display text-5xl leading-[0.98] tracking-tight text-foreground">
              {title}
            </h1>
            <p className="max-w-xl text-base leading-8 text-muted">{description}</p>
          </div>

          {proofItems.length ? (
            <div className="flex flex-wrap gap-2">
              {proofItems.map((item) => (
                <div
                  key={item}
                  className="rounded-full border border-border/80 bg-white/70 px-4 py-2 text-sm font-medium text-foreground shadow-soft"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <Card className="border-none bg-[linear-gradient(155deg,#0f584a_0%,#174d44_48%,#9abbb0_145%)] p-7 text-white shadow-[0_20px_50px_rgba(14,68,58,0.24)]">
            <CardHeader>
              <CardTitle className="text-white">{asideTitle}</CardTitle>
              <CardDescription className="text-white/72">
                Diseñado para bajar ruido y convertir números dispersos en decisiones claras.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {asideItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm leading-7 text-white/80"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="p-7 md:p-9">
          <CardContent className="space-y-6">
            {children}
            <div className="border-border/70 flex flex-wrap items-center gap-4 border-t pt-4 text-sm text-muted">
              <Link href="/about" className="font-medium hover:text-foreground">
                Acerca de nosotros
              </Link>
              <Link href="/security" className="font-medium hover:text-foreground">
                Seguridad
              </Link>
              <Link href="/terms" className="font-medium hover:text-foreground">
                Términos y Condiciones
              </Link>
              <Link href="/privacy" className="font-medium hover:text-foreground">
                Política de Privacidad
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
