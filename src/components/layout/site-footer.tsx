import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-foreground">Deuda Clara RD</p>
          <p>Organiza tus deudas y empieza a pagar mejor.</p>
        </div>
        <nav aria-label="Navegación legal y pública" className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link href="/login" className="hover:text-foreground">
            Acceder
          </Link>
          <Link href="/registro" className="hover:text-foreground">
            Registro
          </Link>
          <Link href="/about" className="hover:text-foreground">
            Acerca de nosotros
          </Link>
          <Link href="/security" className="hover:text-foreground">
            Seguridad
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
        </nav>
      </div>
    </footer>
  );
}
