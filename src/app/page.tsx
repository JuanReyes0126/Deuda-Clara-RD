import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlanFeatureBullets } from "@/lib/feature-access";
import { formatCurrency } from "@/lib/utils/currency";

export const dynamic = "force-dynamic";

const dashboardMetrics = [
  {
    label: "Deuda total consolidada",
    value: formatCurrency(392500),
    detail: "Todo en una sola vista.",
  },
  {
    label: "Pago mínimo del mes",
    value: formatCurrency(21800),
    detail: "Lo urgente queda claro.",
  },
  {
    label: "Interés estimado del mes",
    value: formatCurrency(11993),
    detail: "El costo de esperar se vuelve visible.",
  },
];

const [heroPrimaryMetricFallback, ...heroSecondaryMetrics] = dashboardMetrics;
const heroPrimaryMetric = heroPrimaryMetricFallback ?? {
  label: "Deuda total consolidada",
  value: formatCurrency(0),
  detail: "Todo en una sola vista.",
};

const trustPills = [
  "Empieza gratis",
  "Sin conectar bancos para empezar",
  "Seguridad avanzada",
  "Premium desde US$5/mes",
];

const howItWorks = [
  {
    step: "1",
    title: "Registra tus deudas reales",
    copy: "Carga tus tarjetas y préstamos para ver tu panorama real.",
  },
  {
    step: "2",
    title: "Ve lo urgente y lo caro",
    copy: "Sabe exactamente qué decisión te conviene hoy.",
  },
  {
    step: "3",
    title: "Desbloquea tu mejor ruta",
    copy: "Premium te muestra cómo salir antes y pagar menos intereses.",
  },
] as const;

const strategyCards = [
  {
    title: "Avalanche",
    copy: "Ataca primero la deuda más cara para pagar menos intereses.",
  },
  {
    title: "Snowball",
    copy: "Empieza por los saldos más pequeños para ganar impulso.",
  },
  {
    title: "Híbrido configurable",
    copy: "Combina tasa, urgencia y saldo para una ruta más equilibrada.",
  },
];

const pricingPlans = [
  {
    id: "FREE",
    name: "Base",
    price: "Gratis",
    highlight: "Empieza y entiende tu situación",
    idealFor: "Ordena tus deudas y ve tu escenario actual.",
    features: getPlanFeatureBullets("FREE"),
  },
  {
    id: "NORMAL",
    name: "Premium",
    price: "US$5/mes",
    annual: "US$49/año",
    annualSavings: "ahorras US$11",
    highlight: "Optimiza y paga menos",
    idealFor: "Te muestra cuánto pierdes hoy y cómo empezar a ahorrar.",
    features: getPlanFeatureBullets("NORMAL"),
    featured: true,
  },
  {
    id: "PRO",
    name: "Pro",
    price: "US$10/mes",
    annual: "US$99/año",
    annualSavings: "ahorras US$21",
    highlight: "Control total y estrategia inteligente",
    idealFor: "Más seguimiento, más contexto y una estrategia más completa.",
    features: getPlanFeatureBullets("PRO"),
  },
] as const;

const features = [
  "Dashboard claro con deuda, intereses y siguiente paso.",
  "Registro simple de deudas y pagos.",
  "Simulador para ver cuánto te cuesta seguir igual.",
  "Alertas para no dejar pasar fechas importantes.",
];

const reminderHighlights = [
  "Te avisamos antes de cada corte y cada pago.",
  "Antes del corte. Antes del pago. Sin olvidos.",
  "Recibe recordatorios claros para mantenerte al día.",
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(81,134,123,0.15),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(180,205,194,0.35),transparent_24%),linear-gradient(180deg,#f7faf8_0%,#edf3ef_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,138,93,0.14),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(15,118,110,0.16),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(255,210,125,0.2),transparent_30%)]" />
      <div className="relative">
        <div className="px-4 pt-4">
          <SiteHeader />
        </div>

        <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 pb-20 pt-10">
          <section
            id="producto"
            className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr] xl:items-start"
          >
            <div className="space-y-9">
              <div className="inline-flex items-center gap-3 rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-sm font-medium text-primary shadow-soft">
                <span className="size-2 rounded-full bg-primary" />
                Copiloto financiero personal para RD
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl font-display text-5xl leading-[0.95] tracking-tight text-foreground md:text-7xl">
                  Deja de adivinar qué pagar primero.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted md:text-xl">
                  Ve cuánto debes, evita intereses innecesarios y toma control real de tu dinero en minutos.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/registro"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,88,74,0.22)] transition hover:bg-primary-strong"
                >
                  Empezar gratis
                </Link>
                <Link
                  href="#como-funciona"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(240,138,93,0.18)] bg-white px-6 text-base font-semibold text-foreground transition hover:bg-accent-soft/55"
                >
                  Tomar control de mis deudas
                </Link>
                <Link
                  href="/planes"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,88,74,0.18)] transition hover:bg-primary-strong"
                >
                  Ver mi plan ahora
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                {trustPills.map((pill) => (
                  <div
                    key={pill}
                    className="rounded-full border border-border/80 bg-white/70 px-4 py-2 text-sm font-medium text-foreground shadow-soft"
                  >
                    {pill}
                  </div>
                ))}
              </div>

              <ul className="grid gap-3 text-sm text-muted xl:grid-cols-2">
                {features.map((item) => (
                  <li
                    key={item}
                    className="rounded-[1.6rem] border border-border/80 bg-white/70 px-5 py-4 shadow-soft"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Card className="overflow-hidden bg-[linear-gradient(145deg,#0f766e_0%,#f08a5d_92%,#ffd27d_150%)] p-8 text-white sm:p-9">
              <CardHeader className="gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    Vista ejecutiva
                  </span>
                  <span className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold">
                    Empieza hoy
                  </span>
                </div>
                <CardTitle className="max-w-sm text-4xl text-white">
                  Menos ruido. Más control sobre tu dinero.
                </CardTitle>
                <CardDescription className="max-w-lg text-base leading-7 text-white/72">
                  Hecho para ver qué te cuesta más, qué hacer ahora y cómo dejar de perder dinero.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-5">
                <div className="rounded-[1.9rem] border border-white/20 bg-white/12 p-6 backdrop-blur-sm sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    {heroPrimaryMetric.label}
                  </p>
                  <p className="value-stable mt-4 font-display text-[clamp(2.25rem,5vw,3.4rem)] tracking-tight text-white">
                    {heroPrimaryMetric.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {heroPrimaryMetric.detail}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {heroSecondaryMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[1.75rem] border border-white/18 bg-white/10 p-5 backdrop-blur-sm sm:p-6"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        {metric.label}
                      </p>
                      <p className="value-stable mt-4 font-display text-[clamp(1.7rem,3.8vw,2.25rem)] tracking-tight text-white">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/72">
                        {metric.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 rounded-[1.7rem] border border-white/18 bg-white/10 p-5 backdrop-blur-sm sm:grid-cols-2 xl:grid-cols-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Panorama
                    </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Todo en una sola vista
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/70">
                        Sin hojas sueltas ni cuentas dispersas.
                      </p>
                    </div>
                  <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Prioridad
                    </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Lo que más te conviene hoy
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/70">
                        Vencimientos, mínimos y costo visible.
                      </p>
                    </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Premium
                    </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        Ruta más clara
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/70">
                        Premium te muestra cómo pagar mejor.
                      </p>
                    </div>
                  </div>
              </CardContent>
            </Card>
          </section>

          <section
            id="como-funciona"
            className="grid gap-8 xl:grid-cols-[0.86fr_1.14fr] xl:items-start"
          >
            <div className="space-y-4">
              <p className="section-kicker">
                Cómo funciona
              </p>
              <h2 className="font-display text-4xl tracking-tight text-foreground">
                Tres pasos para dejar de improvisar con tus deudas.
              </h2>
              <p className="section-summary max-w-2xl">
                Registras, ves el problema y activas una ruta más clara para salir antes.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {howItWorks.map((item) => (
                <Card key={item.step} className="p-7">
                  <CardHeader className="gap-4">
                    <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(240,138,93,0.18)_100%)] font-display text-xl text-primary">
                      {item.step}
                    </div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription className="leading-7">
                      {item.copy}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <section
            id="siempre-a-tiempo"
            className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-center"
          >
            <div className="space-y-4">
              <p className="section-kicker">Siempre a tiempo</p>
              <h2 className="font-display text-4xl tracking-tight text-foreground">
                Antes del corte. Antes del pago. Sin olvidos.
              </h2>
              <p className="section-summary max-w-2xl">
                Ordena tus deudas y te ayuda a no dejar pasar fechas importantes.
              </p>
            </div>

            <Card className="p-7 sm:p-8">
              <CardHeader className="gap-4">
                <CardTitle>Recordatorios claros para mantenerte al día</CardTitle>
                <CardDescription className="leading-7">
                  Configura tus fechas una vez y recibe avisos antes del corte y antes del pago.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {reminderHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.5rem] border border-border/80 bg-secondary/45 px-5 py-4 text-sm font-medium text-foreground"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section
            id="motor"
            className="grid gap-8 xl:grid-cols-[0.86fr_1.14fr] xl:items-start"
          >
            <div className="space-y-4">
              <p className="section-kicker">
                Tu estrategia
              </p>
              <h2 className="font-display text-4xl tracking-tight text-foreground">
                Sabe exactamente qué decisión te conviene.
              </h2>
              <p className="section-summary max-w-2xl">
                Te mostramos qué pagar primero y cómo evitar intereses innecesarios.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {strategyCards.map((strategy) => (
                <Card key={strategy.title} className="p-7">
                  <CardHeader className="gap-4">
                    <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(15,118,110,0.12)_0%,rgba(240,138,93,0.18)_100%)] font-display text-xl text-primary">
                      {strategy.title.slice(0, 1)}
                    </div>
                    <CardTitle>{strategy.title}</CardTitle>
                    <CardDescription className="leading-7">
                      {strategy.copy}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <section
            id="planes"
            className="grid gap-6 rounded-[2rem] border border-border bg-white/82 p-8 shadow-soft"
          >
            <div className="max-w-3xl space-y-4">
              <p className="section-kicker">
                Planes claros
              </p>
              <h2 className="font-display text-4xl tracking-tight text-foreground">
                Empieza gratis y activa Premium cuando quieras pagar menos.
              </h2>
              <p className="section-summary">
                Premium te muestra cuánto puedes ahorrar, qué pagar primero y cómo salir antes.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {pricingPlans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`h-full overflow-hidden p-0 ${
                    "featured" in plan && plan.featured
                      ? "border-primary/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,248,245,0.95)_100%)] shadow-[0_22px_48px_rgba(15,88,74,0.1)] xl:col-span-2 2xl:col-span-1"
                      : ""
                  }`}
                >
                  <CardHeader className="p-7 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{plan.name}</CardTitle>
                      {"featured" in plan && plan.featured ? (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Recomendado
                        </span>
                      ) : null}
                    </div>
                    <CardDescription className="leading-7">
                      {plan.highlight}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 p-7 pt-0">
                    <div className="rounded-[1.65rem] border border-border/80 bg-secondary/40 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        Precio
                      </p>
                      <p className="mt-3 font-display text-[clamp(2rem,4vw,2.8rem)] tracking-tight text-foreground">
                        {plan.price}
                      </p>
                      {"annual" in plan ? (
                        <p className="mt-2 text-sm font-medium text-primary">
                          {plan.annual}
                          {"annualSavings" in plan ? ` · ${plan.annualSavings}` : ""}
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm leading-7 text-muted">
                        {plan.idealFor}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {plan.features.map((feature) => (
                        <div
                          key={feature}
                          className="rounded-2xl border border-border/80 bg-secondary/55 px-4 py-3 text-sm leading-6 text-muted"
                        >
                          {feature}
                        </div>
                      ))}
                    </div>

                    <div>
                      <Link
                        href="/registro"
                        className={`inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                          "featured" in plan && plan.featured
                            ? "bg-primary text-white shadow-[0_18px_42px_rgba(15,88,74,0.22)] hover:bg-primary-strong"
                            : "border border-border bg-white text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        {"featured" in plan && plan.featured
                          ? "Ver mi plan ahora"
                          : plan.name === "Pro"
                            ? "Tomar control de mis deudas"
                            : "Empezar gratis"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.12))] p-8 shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <p className="section-kicker">
                  Empieza hoy
                </p>
                <h2 className="font-display text-4xl tracking-tight text-foreground">
                  Empieza gratis y deja de decidir a ciegas.
                </h2>
                <p className="section-summary max-w-2xl">
                  Primero entiende tu panorama. Luego activa una ruta más clara para ahorrar tiempo y dinero.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link
                  href="/registro"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,88,74,0.22)] transition hover:bg-primary-strong"
                >
                  Empezar gratis
                </Link>
                <Link
                  href="/planes"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-foreground transition hover:bg-secondary/60"
                >
                  Ver mi plan ahora
                </Link>
              </div>
            </div>
          </section>

          <section
            id="seguridad"
            className="grid gap-6 rounded-[2rem] border border-border bg-white/80 p-8 shadow-soft lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="space-y-5">
              <p className="section-kicker">
                Tu información, protegida
              </p>
              <h2 className="font-display text-4xl tracking-tight text-foreground">
                Seguridad avanzada sin complicarte la vida.
              </h2>
              <p className="section-summary max-w-2xl">
                Tu información está protegida con buenas prácticas de seguridad, protección de datos y control de acceso.
              </p>
              <Link
                href="/security"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-white shadow-[0_18px_42px_rgba(15,88,74,0.18)] transition hover:bg-primary-strong"
              >
                Ver seguridad
              </Link>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-secondary/70 p-5">
                <p className="text-sm font-semibold text-foreground">Acceso seguro</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Protegemos el inicio de sesión y las acciones sensibles.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-secondary/70 p-5">
                <p className="text-sm font-semibold text-foreground">Protección de datos</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Tú decides qué información registrar dentro de la app.
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-secondary/70 p-5">
                <p className="text-sm font-semibold text-foreground">Buenas prácticas de seguridad</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Aplicamos controles razonables para proteger tu cuenta y tus datos.
                </p>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
