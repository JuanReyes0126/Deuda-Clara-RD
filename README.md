# Deuda Clara RD

Aplicación web para control de deudas personales enfocada en República Dominicana. Consolida deudas, pagos, intereses, mora y vencimientos para dar un plan claro de salida con estrategias accionables.

## Stack

- Frontend: Next.js 16 App Router + TypeScript + Tailwind CSS
- Backend: Next.js route handlers + server components
- Base de datos: PostgreSQL
- ORM: Prisma
- Validación: Zod
- Formularios: React Hook Form
- Auth: sesiones protegidas con cookie + Argon2
- Emails: Resend
- Testing: Vitest + Playwright
- CI/CD: GitHub Actions
- Contenedores: Docker + docker-compose

## Decisión backend

Se eligió **Next.js route handlers + server components** en lugar de NestJS.

Razón breve:

- El producto ya vive completo en Next.js.
- Reduce latencia y complejidad operativa al evitar un backend separado.
- Mantiene UI, validación, auth y acceso a datos en un solo repositorio con menos duplicación.
- El dominio actual cabe bien en handlers y servicios modulares sin necesitar un monolito HTTP independiente.

## Funcionalidades implementadas

- Registro, login, logout, recuperación y cambio de contraseña
- Onboarding inicial
- Dashboard con:
  - deuda total
  - pago mínimo total
  - interés estimado
  - próximos vencimientos
  - deuda más urgente
  - resumen por tipo
  - gráfico de saldo
  - orden recomendado de ataque
- CRUD de deudas
- CRUD de pagos con recalculo de saldo
- Motor de salida de deudas:
  - snowball
  - avalanche
  - híbrido
- Simulador:
  - pago extra mensual
  - priorizar una deuda específica
  - dejar de usar una tarjeta
  - refinanciar a menor tasa en vista cartera (plan Pro activo)
- Reportes con exportación CSV y PDF
- Centro de notificaciones
- Emails transaccionales de:
  - bienvenida
  - recuperación y cambio de contraseña
  - activación y atención de membresía
- Panel admin con usuarios, métricas, auditoría y plantillas
- Auditoría de eventos críticos
- Planes Base, Premium y Pro con checkout real por AZUL y activación server-side de membresía

## Arquitectura

- `src/app`: rutas App Router, layouts y route handlers
- `src/features`: UI por dominio
- `src/server`: servicios, lógica financiera, auditoría, reportes, simulador
- `src/lib`: utilidades, validaciones, seguridad, auth y Prisma client
- `prisma`: schema, migraciones y seed
- `tests`: unit, integration y e2e
- `docs`: documentación complementaria

Detalles más extensos:

- [Arquitectura](./docs/ARCHITECTURE.md)
- [Estructura de carpetas](./docs/FOLDER_STRUCTURE.md)
- [Plan de implementación](./docs/IMPLEMENTATION_PLAN.md)
- [Guía de despliegue](./docs/DEPLOYMENT.md)
- [Staging real con Vercel + Neon](./docs/STAGING_SETUP.md)
- [Previews rápidos en Vercel](./docs/VERCEL_PREVIEW_WORKFLOW.md)
- [Entorno privado de testing](./docs/PRIVATE_TESTING.md)
- [Billing con AZUL](./docs/BILLING_AZUL.md)
- [Release Candidate 1.2](./docs/RELEASE_CANDIDATE_1_2.md)
- [Checklist go/no-go](./docs/GO_NO_GO_CHECKLIST.md)
- [Límites por plan (Base / Premium / Pro)](./docs/MEMBERSHIP_FEATURE_TIERS_PLAN.md)
- [Checklist de seguridad producción](./docs/PRODUCTION_SECURITY_CHECKLIST.md)

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 16+

## Variables de entorno

Ver [`.env.example`](./.env.example).

Variables principales:

- `APP_URL`
- `AUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `DATA_ENCRYPTION_KEY`
- `PASSKEY_RP_ID`
- `PASSKEY_RP_NAME`
- `PASSKEY_ALLOWED_ORIGINS`
- `SKIP_RATE_LIMIT_IN_DEV`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `BILLING_PROVIDER`
- `AZUL_PAYMENT_URL`
- `AZUL_MERCHANT_ID`
- `AZUL_MERCHANT_NAME`
- `AZUL_MERCHANT_TYPE`
- `AZUL_AUTH_KEY`
- `AZUL_CURRENCY_CODE`
- `DEMO_MODE_ENABLED`
- `HOST_PANEL_ENABLED`
- `HOST_ALLOWED_EMAILS`
- `HOST_SECONDARY_PASSWORD`
- `HOST_SECONDARY_TOTP_SECRET`

## Instalación local

1. Instala dependencias:

```bash
npm ci
```

2. Copia variables de entorno:

```bash
cp .env.example .env
```

3. Levanta PostgreSQL y la app con Docker:

```bash
docker-compose up --build
```

O manualmente:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Chequeo rápido del entorno local:

```bash
npm run doctor
```

Estado de la app y de PostgreSQL:

```bash
GET /api/health
```

Si vas a probar cobro real de planes con AZUL, configura los retornos de Página de Pagos hacia:

```bash
/api/billing/azul/approved
/api/billing/azul/declined
/api/billing/azul/cancelled
```

La configuración operativa está en [docs/BILLING_AZUL.md](./docs/BILLING_AZUL.md).

## Entorno privado y estable para pruebas

Ya no necesitas túneles públicos temporales para revisar la app.

El flujo recomendado para testing continuo es levantar una instancia privada local, fija y persistente en `127.0.0.1`, con logs y PID propios:

```bash
npm install
cp .env.example .env
npm run dev
```

Si quieres dejarla corriendo por horas sin ocupar la terminal:

```bash
npm run private:up
```

Comandos disponibles:

```bash
npm run private:status
npm run private:logs
npm run private:restart
npm run private:stop
```

URL privada local:

```bash
http://127.0.0.1:3000
```

Si necesitas hot reload para corregir bugs:

```bash
npm run dev
```

Detalles completos:

- [docs/PRIVATE_TESTING.md](./docs/PRIVATE_TESTING.md)

## Credenciales QA del seed

- Usuario: `demo@deudaclarard.com`
- Admin: `admin@deudaclarard.com`
- Contraseña: `DeudaClara123!`

Estas credenciales son solo para entornos locales, QA o staging controlado. No deben usarse como acceso de producción.

## Estado actual

- Release candidate: `1.2`
- Corte funcional con seguridad, legal, onboarding, dashboard, recordatorios, monetización y billing AZUL ya integrados

## Prueba real de registro y acceso

1. Verifica el entorno:

```bash
npm run doctor
```

2. Si PostgreSQL está arriba, aplica migraciones y seed:

```bash
npx prisma migrate deploy
npm run db:seed
```

3. Levanta la app:

```bash
npm run dev
```

4. Crea una cuenta nueva en `http://localhost:3000/registro`.
5. Si la cuenta ya existe, entra por `http://localhost:3000/login`.
6. Si el servicio no puede hablar con PostgreSQL, auth devolverá `503` y `/api/health` mostrará el problema.

Nota local:

- En desarrollo, `SKIP_RATE_LIMIT_IN_DEV=true` evita que el rate limit te bloquee mientras pruebas registro/login muchas veces.
- Si quieres probar el rate limit real, cambia esa variable a `false`.
- Si `DEMO_MODE_ENABLED=true`, login y registro pueden abrir una sesión demo de revisión cuando PostgreSQL no responda.
- En staging/producción real, deja `DEMO_MODE_ENABLED=false`.

## Panel interno oculto

- Ruta interna: `/host`
- No aparece en navbar ni en UI pública
- Responde con `noindex` y no se anuncia en sitemap
- Capas de acceso:
  - sesión activa
  - rol `ADMIN`
  - MFA obligatorio en la cuenta admin
  - allowlist por `HOST_ALLOWED_EMAILS`
  - feature flag por `HOST_PANEL_ENABLED`
  - segundo factor interno por `HOST_SECONDARY_TOTP_SECRET` o, solo como legado, `HOST_SECONDARY_PASSWORD`

Recomendación local para probarlo:

```bash
HOST_PANEL_ENABLED=true
HOST_ALLOWED_EMAILS=admin@deudaclarard.com
HOST_SECONDARY_TOTP_SECRET=BASE32SECRETO...
HOST_SECONDARY_PASSWORD=una-clave-larga-opcional
```

## Preparación para lanzamiento oficial

Antes de abrir acceso real a usuarios, verifica este mínimo:

- `npm run doctor`
- `npm run prelaunch`
- `GET /api/health`
- PostgreSQL accesible desde `DATABASE_URL`
- `APP_URL`, `AUTH_SECRET` y `DATA_ENCRYPTION_KEY` configurados
- `PASSKEY_RP_ID` y `PASSKEY_ALLOWED_ORIGINS` configurados si vas a habilitar WebAuthn/passkeys
- Resend listo si vas a probar recuperación por email
- AZUL configurado si vas a cobrar Premium y Pro
- `CRON_SECRET` configurado si vas a disparar recordatorios

Checklist completa:

- [docs/GO_NO_GO_CHECKLIST.md](./docs/GO_NO_GO_CHECKLIST.md)
- [docs/PRODUCTION_SECURITY_CHECKLIST.md](./docs/PRODUCTION_SECURITY_CHECKLIST.md)

## Comandos útiles

```bash
npm run dev
npm run dev:private
npm run build
npm run private:up
npm run private:status
npm run private:logs
npm run private:restart
npm run private:stop
npm run lint
npm run typecheck
npm run prelaunch
npm run test:unit
npm run test:integration
npm run test:e2e
npm run prisma:generate
npm run db:seed
```

## Job de recordatorios

El job de notificaciones vive en:

```bash
POST /api/jobs/notifications
```

Debe recibir el header:

```bash
x-cron-secret: <CRON_SECRET>
```

La respuesta devuelve estadísticas útiles:

- usuarios procesados
- usuarios con alertas pendientes
- emails encolados
- emails omitidos por falta de configuración
- notificaciones marcadas como enviadas
- fallos por usuario

## Testing

### Unit

- motor de estrategia
- helpers financieros
- exportación CSV

### Integration

- rutas de deudas
- rutas de pagos
- exportación de reportes

### E2E

- registro + onboarding
- login
- recuperación de contraseña
- crear deuda
- registrar pago
- recalcular simulador
- exportar reporte

## Base de datos

El esquema Prisma incluye:

- `User`
- `Session`
- `Account`
- `VerificationToken`
- `PasswordResetToken`
- `UserSettings`
- `Debt`
- `Payment`
- `Notification`
- `AuditLog`
- `EmailTemplate`
- `BalanceSnapshot`

La migración inicial está en `prisma/migrations/20260320113500_init`.

## Seguridad

Ver [SECURITY.md](./SECURITY.md).

Resumen:

- validación estricta
- autorización por recurso
- rate limiting en endpoints sensibles
- cookies seguras
- cifrado de notas sensibles en reposo
- activación de planes pagos vía checkout + webhook, sin desbloqueo manual en frontend
- cabeceras de seguridad
- auditoría
- manejo seguro de errores

## Docker

Arranque completo:

```bash
docker-compose up --build
```

La app quedará en `http://localhost:3000` y PostgreSQL en `localhost:5432`.

## CI/CD

Workflow incluido en [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) con:

- instalación
- migraciones
- seed
- lint
- typecheck
- unit tests
- integration tests
- build
- e2e con Playwright

## Despliegue recomendado

**Vercel + Neon**.

Justificación:

- mejor encaje con Next.js App Router
- menor complejidad operativa que AWS
- Postgres real administrado
- buena experiencia para cron, previews y despliegues rápidos

## Riesgos pendientes

- WAF/CDN y reglas anti-bot todavía dependen del proveedor de despliegue, no del código de la app
- Falta un pentest externo de staging/producción
- `style-src` sigue más permisivo que `script-src` por dependencias de estilos inline
- El cifrado por campo está enfocado en datos sensibles clave, no en todo el modelo

Ver mitigaciones en [SECURITY.md](./SECURITY.md).
Checklist operativo final en [docs/PRODUCTION_SECURITY_CHECKLIST.md](./docs/PRODUCTION_SECURITY_CHECKLIST.md).
Matriz exacta de variables en [docs/ENVIRONMENT_MATRIX.md](./docs/ENVIRONMENT_MATRIX.md).
Runbook de staging y salida en [docs/STAGING_GO_LIVE_RUNBOOK.md](./docs/STAGING_GO_LIVE_RUNBOOK.md).
Plantillas listas para Vercel en [docs/VERCEL_ENV_TEMPLATES.md](./docs/VERCEL_ENV_TEMPLATES.md).

## Roadmap

- conexión bancaria/importación de estados
- monitoreo y alertas operativas avanzadas
- reglas avanzadas de refinanciamiento
- analytics de comportamiento
- multi-moneda ampliada
- recordatorios por WhatsApp/SMS

## Estado actual

La app está funcional de extremo a extremo a nivel de código y build.

La activación comercial de planes Premium y Pro ya está preparada con AZUL. Para que funcione en producción debes configurar comercio, `AZUL_AUTH_KEY`, `AZUL_MERCHANT_ID`, URLs de retorno y variables de entorno de billing.

Notas honestas:

- Para ejecutar la app completa necesitas PostgreSQL levantado.
- Los tests e2e requieren navegador y base disponible.
- En este entorno local de trabajo, `build` pasó aunque sin una base activa aparecieron logs de conexión durante generación dinámica.

## 🚀 Go-Live

Antes de cualquier despliegue a producción, ejecutar obligatoriamente:

- [STAGING_GO_LIVE_RUNBOOK.md](./docs/STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./docs/GO_NO_GO_CHECKLIST.md)

No se debe realizar deploy a producción sin completar ambos documentos.
