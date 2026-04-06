# Guía de despliegue

Este documento es una vista general de despliegue.

Para ejecución real usa:

- [STAGING_SETUP.md](./STAGING_SETUP.md)
- [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)

## Recomendación

La opción recomendada para este proyecto es **Vercel + Neon**.

Motivos:

- Next.js App Router funciona de forma natural en Vercel.
- Route handlers, páginas dinámicas y cron encajan bien con la plataforma.
- Neon reduce operación de infraestructura para PostgreSQL y escala mejor que una VM simple.
- El stack mantiene fricción baja para un equipo pequeño sin sacrificar Postgres real.

Alternativas:

- Railway: más simple para levantar todo junto, buena opción si prefieres una sola plataforma.
- Render: válido, pero el cold start y costos pueden ser menos atractivos para este perfil.
- AWS: más control y más complejidad operativa; recomendable solo si ya existe equipo DevOps dedicado.

## Variables de entorno

No mantengas aquí una lista paralela.

Usa:

- [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)
- [VERCEL_ENV_TEMPLATES.md](./VERCEL_ENV_TEMPLATES.md)

## Despliegue en Vercel

Para no duplicar flujo:

- setup base: [STAGING_SETUP.md](./STAGING_SETUP.md)
- ejecución completa: [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- billing: [STRIPE_SETUP.md](./STRIPE_SETUP.md)

## Job de recordatorios

Configura un cron diario que invoque:

- `POST /api/jobs/notifications`

Con header:

- `x-cron-secret: <CRON_SECRET>`

## Post-despliegue

La validación post-despliegue vive en:

- [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)
