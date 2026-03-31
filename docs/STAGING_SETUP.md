# Staging real con Vercel + Neon

Esta es la ruta recomendada para dejar la app lista para una beta cerrada real.

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

En Vercel configura estas variables para el entorno de staging:

### Obligatorias

- `APP_URL=https://tu-staging.vercel.app`
- `AUTH_SECRET=<string largo, al menos 32 caracteres>`
- `DATA_ENCRYPTION_KEY=<string larga, al menos 24 caracteres>`
- `DATABASE_URL=<connection string pooled>`
- `DIRECT_DATABASE_URL=<connection string directa/no pooled>`
- `CRON_SECRET=<string largo, al menos 24 caracteres>`
- `DEMO_MODE_ENABLED=false`

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

## Paso 5. Deploy y migraciones

Después del primer deploy:

1. corre migraciones:

```bash
npx prisma migrate deploy
```

2. si necesitas data base para demos internas:

```bash
npm run db:seed
```

Haz esto contra la base de staging, no contra local.

## Paso 6. Validación antes de invitar amigos

Corre:

```bash
npm run doctor
npm run prebeta
npm run lint
npm run typecheck
npm run test:integration
npm run build
```

Y además revisa:

- `GET /api/health`
- registro
- login
- crear deuda
- registrar pago
- simulador
- reportes
- planes

## Paso 7. Si también quieres probar Premium/Pro

Deja Stripe en modo test:

- productos creados
- `Price IDs` cargados
- webhook a `/api/stripe/webhook`

Referencia:

- [STRIPE_SETUP.md](./STRIPE_SETUP.md)

## Qué no deberías hacer antes de la beta

- no compartir `localhost`
- no dejar `DEMO_MODE_ENABLED=true`
- no abrir staging sin PostgreSQL real
- no abrir beta si `npm run prebeta` sigue marcando `fail`

## Señal de “listo”

Estás listo cuando:

- `APP_URL` es pública y abre
- `DEMO_MODE_ENABLED=false`
- `DATABASE_URL` y `DIRECT_DATABASE_URL` están bien
- `/api/health` responde bien
- `npm run prebeta` no marca fallos
