import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PublicInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  cta?: {
    href: Route;
    label: string;
  };
};

export function PublicInfoPage({
  eyebrow,
  title,
  description,
  children,
  cta = { href: "/registro" as Route, label: "Crear cuenta gratis" },
}: PublicInfoPageProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(81,134,123,0.16),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(180,205,194,0.32),transparent_24%),linear-gradient(180deg,#f7faf8_0%,#edf3ef_100%)]" />
      <div className="relative">
        <div className="px-4 pt-4">
          <SiteHeader />
        </div>

        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 pt-10">
          <section className="rounded-[2rem] border border-border/80 bg-white/88 p-6 shadow-soft sm:p-8 lg:p-10">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.4rem,7vw,4.75rem)] leading-[0.98] tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-muted sm:text-lg">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={cta.href}
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,88,74,0.18)] transition hover:bg-primary-strong"
              >
                {cta.label}
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition hover:bg-secondary/60"
              >
                Volver al inicio
              </Link>
            </div>
          </section>

          <Card className="p-6 sm:p-8">
            <CardHeader className="gap-3">
              <CardTitle>Información clara, sin letra pequeña escondida</CardTitle>
              <CardDescription>
                Estos contenidos resumen cómo pensamos el producto. Los detalles legales completos viven en Términos y Privacidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">{children}</CardContent>
          </Card>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
