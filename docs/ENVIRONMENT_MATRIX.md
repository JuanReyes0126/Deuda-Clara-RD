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

## 3. Billing / AZUL

### Staging o test

- `BILLING_PROVIDER=AZUL`
- `AZUL_PAYMENT_URL=<url de sandbox o test>`
- `AZUL_MERCHANT_ID=<merchant id de test>`
- `AZUL_MERCHANT_NAME=Deuda Clara RD`
- `AZUL_MERCHANT_TYPE=<tipo provisto por AZUL>`
- `AZUL_AUTH_KEY=<auth key de test>`
- `AZUL_CURRENCY_CODE=USD`

### Production

- `BILLING_PROVIDER=AZUL`
- `AZUL_PAYMENT_URL=<url de producción AZUL>`
- `AZUL_MERCHANT_ID=<merchant id de producción>`
- `AZUL_MERCHANT_NAME=Deuda Clara RD`
- `AZUL_MERCHANT_TYPE=<tipo provisto por AZUL>`
- `AZUL_AUTH_KEY=<auth key de producción>`
- `AZUL_CURRENCY_CODE=USD`

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
| `BILLING_PROVIDER` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_PAYMENT_URL` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_MERCHANT_ID` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_MERCHANT_NAME` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_MERCHANT_TYPE` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_AUTH_KEY` | Si pruebas billing | Si pruebas billing | Sí |
| `AZUL_CURRENCY_CODE` | Si pruebas billing | Si pruebas billing | Sí |
| `HOST_PANEL_ENABLED` | Opcional | Mejor en `false` | Mejor en `false` |
| `HOST_ALLOWED_EMAILS` | Si host está activo | Si host está activo | Si host está activo |
| `HOST_SECONDARY_TOTP_SECRET` | Si host está activo | Si host está activo | Si host está activo |

## 8. Checklist de carga en Vercel

- Cargar primero `APP_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `DATABASE_URL`, `DIRECT_DATABASE_URL`.
- Cargar después `CRON_SECRET`, `HEALTHCHECK_SECRET`.
- Si usarás passkeys, cargar `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_ALLOWED_ORIGINS`.
- Si usarás email, cargar `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Si usarás billing, cargar variables de AZUL.
- Confirmar explícitamente `DEMO_MODE_ENABLED=false`.
- Ejecutar `npx prisma migrate deploy`.
- Verificar `/api/health`.
- Verificar registro, login, MFA y passkeys en el dominio real.

## 9. Bloqueo actual de staging

Al revisar el entorno de `staging`, estas variables siguen faltando o no están visibles en la configuración local usada para validar salida:

- Passkeys:
  - `PASSKEY_RP_ID`
  - `PASSKEY_RP_NAME`
  - `PASSKEY_ALLOWED_ORIGINS`
- Rate limiting persistente:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Billing con AZUL:
  - `BILLING_PROVIDER`
  - `AZUL_PAYMENT_URL`
  - `AZUL_MERCHANT_ID`
  - `AZUL_MERCHANT_NAME`
  - `AZUL_MERCHANT_TYPE`
  - `AZUL_AUTH_KEY`
  - `AZUL_CURRENCY_CODE`

Sin ese bloque, la app puede seguir mostrándose y dejando probar navegación básica, pero no está lista para lanzar auth fuerte + rate limit + cobros reales.

## 10. Plantilla rápida para staging

Usa esto como checklist de carga, ajustando valores reales:

```env
APP_URL=https://deuda-clara-rd-beta.vercel.app
AUTH_SECRET=<staging-secret-de-32+-chars>
DATA_ENCRYPTION_KEY=<staging-secret-de-24+-chars>
DATABASE_URL=<pooled>
DIRECT_DATABASE_URL=<direct>
CRON_SECRET=<staging-secret-de-24+-chars>
HEALTHCHECK_SECRET=<staging-secret-de-24+-chars>
DEMO_MODE_ENABLED=false

PASSKEY_RP_ID=deuda-clara-rd-beta.vercel.app
PASSKEY_RP_NAME=Deuda Clara RD
PASSKEY_ALLOWED_ORIGINS=https://deuda-clara-rd-beta.vercel.app

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@deudaclarard.com>

UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

BILLING_PROVIDER=AZUL
AZUL_PAYMENT_URL=https://<sandbox-o-test-azul>
AZUL_MERCHANT_ID=<merchant-id>
AZUL_MERCHANT_NAME=Deuda Clara RD
AZUL_MERCHANT_TYPE=ECommerce
AZUL_AUTH_KEY=<auth-key>
AZUL_CURRENCY_CODE=USD

HOST_PANEL_ENABLED=false
```

## 11. Plantilla rápida para production

```env
APP_URL=https://deudaclarard.com
AUTH_SECRET=<production-secret-de-32+-chars>
DATA_ENCRYPTION_KEY=<production-secret-de-24+-chars>
DATABASE_URL=<pooled>
DIRECT_DATABASE_URL=<direct>
CRON_SECRET=<production-secret-de-24+-chars>
HEALTHCHECK_SECRET=<production-secret-de-24+-chars>
DEMO_MODE_ENABLED=false

PASSKEY_RP_ID=deudaclarard.com
PASSKEY_RP_NAME=Deuda Clara RD
PASSKEY_ALLOWED_ORIGINS=https://deudaclarard.com

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@deudaclarard.com>

UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

BILLING_PROVIDER=AZUL
AZUL_PAYMENT_URL=https://<produccion-azul>
AZUL_MERCHANT_ID=<merchant-id>
AZUL_MERCHANT_NAME=Deuda Clara RD
AZUL_MERCHANT_TYPE=ECommerce
AZUL_AUTH_KEY=<auth-key>
AZUL_CURRENCY_CODE=USD

HOST_PANEL_ENABLED=false
```
