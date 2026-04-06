# Matriz de variables de entorno

Esta matriz resume qué variables necesita Deuda Clara RD por entorno y cómo deberían quedar para una salida seria.

## Regla base

- Nunca expongas estas variables al frontend.
- En Vercel, configúralas como Environment Variables del proyecto.
- Usa valores distintos entre `staging` y `production`.
- `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET` y `HEALTHCHECK_SECRET` deben ser aleatorios y largos.

## 1. Core obligatorio

### Local

- `APP_URL=http://localhost:3000`
- `AUTH_SECRET=<mínimo 32 caracteres>`
- `DATA_ENCRYPTION_KEY=<mínimo 24 caracteres>`
- `DATABASE_URL=<postgres local o neon>`
- `DIRECT_DATABASE_URL=<directa/no pooled>`
- `CRON_SECRET=<mínimo 24 caracteres>`
- `DEMO_MODE_ENABLED=true` solo si quieres fallback demo local

### Staging

- `APP_URL=https://tu-staging.vercel.app`
- `AUTH_SECRET=<secreto único de staging>`
- `DATA_ENCRYPTION_KEY=<secreto único de staging>`
- `DATABASE_URL=<pooled>`
- `DIRECT_DATABASE_URL=<unpooled/direct>`
- `CRON_SECRET=<secreto único de staging>`
- `HEALTHCHECK_SECRET=<secreto único de staging>`
- `DEMO_MODE_ENABLED=false`

### Production

- `APP_URL=https://tu-dominio-real.com`
- `AUTH_SECRET=<secreto único de producción>`
- `DATA_ENCRYPTION_KEY=<secreto único de producción>`
- `DATABASE_URL=<pooled>`
- `DIRECT_DATABASE_URL=<unpooled/direct>`
- `CRON_SECRET=<secreto único de producción>`
- `HEALTHCHECK_SECRET=<secreto único de producción>`
- `DEMO_MODE_ENABLED=false`

## 2. Passkeys / WebAuthn

### Requeridas si habilitarás passkeys

- `PASSKEY_RP_ID=<dominio registrable final>`
- `PASSKEY_RP_NAME=Deuda Clara RD`
- `PASSKEY_ALLOWED_ORIGINS=<lista separada por comas de orígenes HTTPS exactos>`

### Ejemplos

#### Staging

- `PASSKEY_RP_ID=tu-staging.vercel.app`
- `PASSKEY_RP_NAME=Deuda Clara RD`
- `PASSKEY_ALLOWED_ORIGINS=https://tu-staging.vercel.app`

#### Production

- `PASSKEY_RP_ID=deudaclarard.com`
- `PASSKEY_RP_NAME=Deuda Clara RD`
- `PASSKEY_ALLOWED_ORIGINS=https://deudaclarard.com,https://app.deudaclarard.com`

### Nota importante

- `PASSKEY_RP_ID` debe coincidir con el dominio donde el usuario autentica.
- No mezcles dominios de staging y producción en el mismo valor de producción.

## 3. Billing / Stripe

### Staging o test

- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PREMIUM_PRICE_ID=price_...`
- `STRIPE_PRO_PRICE_ID=price_...`
- `STRIPE_PORTAL_RETURN_PATH=/planes`

### Production

- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_PREMIUM_PRICE_ID=price_...`
- `STRIPE_PRO_PRICE_ID=price_...`
- `STRIPE_PORTAL_RETURN_PATH=/planes`

## 4. Email / Resend

### Staging

- `RESEND_API_KEY=re_...`
- `RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@tu-dominio.com>`

### Production

- `RESEND_API_KEY=re_...`
- `RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@deudaclarard.com>`

## 5. Redis / Rate limit

### Recomendado en staging y production

- `UPSTASH_REDIS_REST_URL=https://...`
- `UPSTASH_REDIS_REST_TOKEN=...`

### Si falta

- La app puede caer a memoria en algunos flujos, pero para producción real no es suficiente.

## 6. Host / Admin interno

### Default recomendado

- `HOST_PANEL_ENABLED=false`

### Si lo activas

- `HOST_PANEL_ENABLED=true`
- `HOST_ALLOWED_EMAILS=admin1@dominio.com,admin2@dominio.com`
- `HOST_SECONDARY_TOTP_SECRET=<base32>`

### Solo legado

- `HOST_SECONDARY_PASSWORD=<valor largo>`

### Recomendación

- Prioriza `HOST_SECONDARY_TOTP_SECRET`.
- No expongas `/host` sin allowlist y MFA activo en cuentas admin.

## 7. Matriz rápida por entorno

| Variable | Local | Staging | Production |
| --- | --- | --- | --- |
| `APP_URL` | Sí | Sí | Sí |
| `AUTH_SECRET` | Sí | Sí | Sí |
| `DATA_ENCRYPTION_KEY` | Sí | Sí | Sí |
| `DATABASE_URL` | Sí | Sí | Sí |
| `DIRECT_DATABASE_URL` | Sí | Sí | Sí |
| `CRON_SECRET` | Sí | Sí | Sí |
| `HEALTHCHECK_SECRET` | Opcional | Sí | Sí |
| `DEMO_MODE_ENABLED` | Opcional | No | No |
| `PASSKEY_RP_ID` | Si usas passkeys | Sí | Sí |
| `PASSKEY_RP_NAME` | Si usas passkeys | Sí | Sí |
| `PASSKEY_ALLOWED_ORIGINS` | Si usas passkeys | Sí | Sí |
| `RESEND_API_KEY` | Opcional | Recomendado | Sí |
| `RESEND_FROM_EMAIL` | Opcional | Recomendado | Sí |
| `UPSTASH_REDIS_REST_URL` | Opcional | Recomendado | Sí |
| `UPSTASH_REDIS_REST_TOKEN` | Opcional | Recomendado | Sí |
| `STRIPE_SECRET_KEY` | Si pruebas billing | Si pruebas billing | Sí |
| `STRIPE_WEBHOOK_SECRET` | Si pruebas billing | Si pruebas billing | Sí |
| `STRIPE_PREMIUM_PRICE_ID` | Si pruebas billing | Si pruebas billing | Sí |
| `STRIPE_PRO_PRICE_ID` | Si pruebas billing | Si pruebas billing | Sí |
| `HOST_PANEL_ENABLED` | Opcional | Mejor en `false` | Mejor en `false` |
| `HOST_ALLOWED_EMAILS` | Si host está activo | Si host está activo | Si host está activo |
| `HOST_SECONDARY_TOTP_SECRET` | Si host está activo | Si host está activo | Si host está activo |

## 8. Checklist de carga en Vercel

- Cargar primero `APP_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `DATABASE_URL`, `DIRECT_DATABASE_URL`.
- Cargar después `CRON_SECRET`, `HEALTHCHECK_SECRET`.
- Si usarás passkeys, cargar `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_ALLOWED_ORIGINS`.
- Si usarás email, cargar `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Si usarás billing, cargar variables de Stripe.
- Confirmar explícitamente `DEMO_MODE_ENABLED=false`.
- Ejecutar `npx prisma migrate deploy`.
- Verificar `/api/health`.
- Verificar registro, login, MFA y passkeys en el dominio real.
