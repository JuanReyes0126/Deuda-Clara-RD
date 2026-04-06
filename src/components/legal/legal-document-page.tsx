import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { BrandBadge } from "@/components/shared/brand-logo";
import { buttonClasses } from "@/components/ui/button";
import type { LegalDocumentDefinition } from "@/config/legal";

type LegalDocumentPageProps = {
  document: LegalDocumentDefinition;
};

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,183,172,0.2),transparent_28%),linear-gradient(180deg,#f7faf8_0%,#edf3ef_100%)]" />
      <div className="relative">
        <header className="px-4 pt-4">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-soft backdrop-blur sm:px-5">
            <Link href="/" className="flex items-center gap-3">
              <BrandBadge className="size-12 rounded-2xl" markClassName="size-7" />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-foreground">
                  Deuda Clara RD
                </p>
                <p className="hidden text-sm text-muted sm:block">
                  Documentación legal pública
                </p>
              </div>
            </Link>

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

        <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-10">
          <article className="rounded-[2rem] border border-border/80 bg-white/90 p-6 shadow-soft sm:p-8 lg:p-10">
            <div className="border-border/70 flex flex-wrap items-center gap-3 border-b pb-6">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Documento legal
              </span>
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted">
                Versión {document.version}
              </span>
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted">
                Última actualización {document.lastUpdated}
              </span>
            </div>

            <header className="pt-6">
              <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
                {document.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
                {document.description}
              </p>
            </header>

            <div className="mt-8 space-y-10">
              {document.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-base leading-8 text-muted">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.bullets?.length ? (
                      <ul className="list-disc space-y-2 pl-6">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
