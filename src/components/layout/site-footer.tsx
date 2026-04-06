import Link from "next/link";

import { DEMO_SNAPSHOT } from "@/config/release";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-foreground">Deuda Clara RD</p>
          <p>Copiloto financiero personal para República Dominicana.</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/80">
            Demo {DEMO_SNAPSHOT.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/login" className="hover:text-foreground">
            Acceder
          </Link>
          <Link href="/registro" className="hover:text-foreground">
            Registro
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Términos y Condiciones
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Política de Privacidad
          </Link>
          <Link href="/recuperar-contrasena" className="hover:text-foreground">
            Recuperar acceso
          </Link>
        </div>
      </div>
    </footer>
  );
}
