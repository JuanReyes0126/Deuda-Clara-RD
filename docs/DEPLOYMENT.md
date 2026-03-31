# Guía de despliegue

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

## Variables de entorno mínimas

- `APP_URL`
- `AUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`

## Despliegue en Vercel

1. Crea una base PostgreSQL en Neon.
2. Configura `DATABASE_URL` y `DIRECT_DATABASE_URL`.
   - `DATABASE_URL`: conexión pooled para runtime
   - `DIRECT_DATABASE_URL`: conexión directa / no pooled para Prisma
3. Si Vercel + Neon te inyectan `DATABASE_URL_UNPOOLED`, mapea manualmente:

```bash
DIRECT_DATABASE_URL = DATABASE_URL_UNPOOLED
```

4. Configura también:
   - `APP_URL` con la URL pública real
   - `AUTH_SECRET`
   - `DATA_ENCRYPTION_KEY`
   - `CRON_SECRET`
   - `DEMO_MODE_ENABLED=false`
5. Configura las variables de entorno del proyecto en Vercel.
6. Ejecuta migraciones:

```bash
npx prisma migrate deploy
```

7. Carga seed inicial si quieres entorno demo:

```bash
npm run db:seed
```

8. Despliega el proyecto.

9. Configura Stripe:

- crea los productos `Premium` y `Pro`
- carga los `Price IDs` en variables de entorno
- crea el webhook hacia `/api/stripe/webhook`
- habilita el Billing Portal

Referencia completa:

- [Stripe setup](./STRIPE_SETUP.md)
- [Staging real con Vercel + Neon](./STAGING_SETUP.md)

## Job de recordatorios

Configura un cron diario que invoque:

- `POST /api/jobs/notifications`

Con header:

- `x-cron-secret: <CRON_SECRET>`

## Checklist post-despliegue

- Verificar login y recuperación de contraseña.
- Verificar que PostgreSQL responde desde la app.
- Ejecutar seed solo en entornos donde aplique.
- Probar exportación CSV/PDF.
- Confirmar envío de emails de recordatorio.
- Revisar logs de auditoría y errores.
