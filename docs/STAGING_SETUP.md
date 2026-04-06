# Staging real con Vercel + Neon

Esta es la ruta recomendada para dejar la app lista para una beta cerrada real.

Si quieres el orden completo de ejecución sin improvisar, usa también [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md).

## Objetivo

Salir de:

- entorno local
- `DEMO_MODE_ENABLED=true`
- `APP_URL` apuntando a localhost

Y pasar a:

- URL pública estable
- PostgreSQL persistente
- auth real
- prebeta en verde

## Arquitectura recomendada

- Hosting: Vercel
- Base de datos: Neon PostgreSQL
- Emails: Resend
- Cobro: Stripe en test

## Paso 1. Crear el proyecto en Vercel

1. Entra a Vercel.
2. Crea un proyecto nuevo desde este repositorio.
3. Framework preset: `Next.js`.
4. No toques el build command salvo que lo necesites.

Valores esperados:

- Build command: `next build --webpack`
- Install command: `npm install` o `npm ci`

## Paso 2. Crear la base en Neon

Tienes dos formas válidas:

### Opción A: integración desde Vercel

1. Dentro del proyecto en Vercel, abre `Storage`.
2. Crea una base Postgres.
3. El flujo actual de Vercel/Neon suele inyectar variables como:
   - `DATABASE_URL`
   - `DATABASE_URL_UNPOOLED`

### Opción B: Neon por separado

1. Crea el proyecto en Neon.
2. Copia dos connection strings:
   - pooled
   - direct / non-pooled

## Paso 3. Variables de entorno correctas

Referencia rápida completa: [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)
Plantilla copiar/pegar para Vercel: [VERCEL_ENV_TEMPLATES.md](./VERCEL_ENV_TEMPLATES.md)

En Vercel configura estas variables para el entorno de staging:

### Obligatorias

- `APP_URL=https://tu-staging.vercel.app`
- `AUTH_SECRET=<string largo, al menos 32 caracteres>`
- `DATA_ENCRYPTION_KEY=<string larga, al menos 24 caracteres>`
- `DATABASE_URL=<connection string pooled>`
- `DIRECT_DATABASE_URL=<connection string directa/no pooled>`
- `CRON_SECRET=<string largo, al menos 24 caracteres>`
- `DEMO_MODE_ENABLED=false`
- `PASSKEY_RP_ID=<dominio registrable final>`
- `PASSKEY_RP_NAME=Deuda Clara RD`
- `PASSKEY_ALLOWED_ORIGINS=https://tu-staging.vercel.app`

### Recomendadas

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Opcionales según beta

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PORTAL_RETURN_PATH=/planes`

## Importante con Neon + Vercel

Si Vercel te crea:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`

entonces debes hacer este mapeo manual adicional:

- `DIRECT_DATABASE_URL = DATABASE_URL_UNPOOLED`

Razón:

- Prisma en este proyecto usa `DATABASE_URL` para runtime
- y `DIRECT_DATABASE_URL` para conexión directa / migraciones

## Paso 4. Ajustes mínimos antes del primer deploy

Antes de invitar testers:

1. asegúrate de que `APP_URL` ya sea la URL real de staging
2. deja `DEMO_MODE_ENABLED=false`
3. confirma que `HOST_PANEL_ENABLED=false` salvo que quieras exponer el panel interno

## Paso 5. Siguiente paso

Desde aquí, la ejecución ya no se gestiona en este documento.

Usa el runbook para:

- deploy
- migraciones
- validación funcional
- validación técnica
- decisión final de salida

Ver:

- [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) si vas a probar Premium/Pro
