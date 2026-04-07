# Plantillas de variables para Vercel

Estas plantillas están pensadas para copiar, completar y cargar en Vercel sin mezclar `staging` con `production`.

## Reglas rápidas

- Usa secretos distintos entre `staging` y `production`.
- No reutilices `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` ni `CRON_SECRET`.
- `DEMO_MODE_ENABLED` debe quedar en `false` fuera de local.
- Si usas passkeys, `PASSKEY_RP_ID` y `PASSKEY_ALLOWED_ORIGINS` deben coincidir exactamente con el dominio del entorno.

## 1. Plantilla staging

```env
APP_URL=https://tu-staging.vercel.app
AUTH_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_Y_UNICO_DE_STAGING
DATA_ENCRYPTION_KEY=REEMPLAZAR_CON_CLAVE_LARGA_Y_UNICA_DE_STAGING
DATABASE_URL=REEMPLAZAR_CON_CONNECTION_STRING_POOLED
DIRECT_DATABASE_URL=REEMPLAZAR_CON_CONNECTION_STRING_DIRECTA
CRON_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_DE_STAGING
HEALTHCHECK_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_DE_STAGING
DEMO_MODE_ENABLED=false

PASSKEY_RP_ID=tu-staging.vercel.app
PASSKEY_RP_NAME=Deuda Clara RD
PASSKEY_ALLOWED_ORIGINS=https://tu-staging.vercel.app

UPSTASH_REDIS_REST_URL=REEMPLAZAR_SI_LO_USAS
UPSTASH_REDIS_REST_TOKEN=REEMPLAZAR_SI_LO_USAS

RESEND_API_KEY=REEMPLAZAR_SI_LO_USAS
RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@tu-dominio-staging.com>

BILLING_PROVIDER=AZUL
AZUL_PAYMENT_URL=https://sandbox.azul.com.do/PaymentPage
AZUL_MERCHANT_ID=REEMPLAZAR
AZUL_MERCHANT_NAME=Deuda Clara RD
AZUL_MERCHANT_TYPE=ECommerce
AZUL_AUTH_KEY=REEMPLAZAR
AZUL_CURRENCY_CODE=USD

HOST_PANEL_ENABLED=false
HOST_ALLOWED_EMAILS=
HOST_SECONDARY_TOTP_SECRET=
HOST_SECONDARY_PASSWORD=
```

## 2. Plantilla production

```env
APP_URL=https://deudaclarard.com
AUTH_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_Y_UNICO_DE_PROD
DATA_ENCRYPTION_KEY=REEMPLAZAR_CON_CLAVE_LARGA_Y_UNICA_DE_PROD
DATABASE_URL=REEMPLAZAR_CON_CONNECTION_STRING_POOLED
DIRECT_DATABASE_URL=REEMPLAZAR_CON_CONNECTION_STRING_DIRECTA
CRON_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_DE_PROD
HEALTHCHECK_SECRET=REEMPLAZAR_CON_SECRETO_LARGO_DE_PROD
DEMO_MODE_ENABLED=false

PASSKEY_RP_ID=deudaclarard.com
PASSKEY_RP_NAME=Deuda Clara RD
PASSKEY_ALLOWED_ORIGINS=https://deudaclarard.com,https://app.deudaclarard.com

UPSTASH_REDIS_REST_URL=REEMPLAZAR
UPSTASH_REDIS_REST_TOKEN=REEMPLAZAR

RESEND_API_KEY=REEMPLAZAR
RESEND_FROM_EMAIL=Deuda Clara RD <no-reply@deudaclarard.com>

BILLING_PROVIDER=AZUL
AZUL_PAYMENT_URL=https://pagos.azul.com.do/PaymentPage
AZUL_MERCHANT_ID=REEMPLAZAR
AZUL_MERCHANT_NAME=Deuda Clara RD
AZUL_MERCHANT_TYPE=ECommerce
AZUL_AUTH_KEY=REEMPLAZAR
AZUL_CURRENCY_CODE=USD

HOST_PANEL_ENABLED=false
HOST_ALLOWED_EMAILS=
HOST_SECONDARY_TOTP_SECRET=
HOST_SECONDARY_PASSWORD=
```

## 3. Si vas a activar `/host`

Solo si realmente lo necesitas:

```env
HOST_PANEL_ENABLED=true
HOST_ALLOWED_EMAILS=admin1@deudaclarard.com,admin2@deudaclarard.com
HOST_SECONDARY_TOTP_SECRET=BASE32SECRETO...
```

Recomendación:

- no usar `HOST_SECONDARY_PASSWORD` si ya tienes TOTP
- no abrir `/host` sin allowlist exacta
- no abrir `/host` sin MFA activo en cuentas admin

## 4. Orden recomendado de carga en Vercel

1. Core:
   - `APP_URL`
   - `AUTH_SECRET`
   - `DATA_ENCRYPTION_KEY`
   - `DATABASE_URL`
   - `DIRECT_DATABASE_URL`
   - `CRON_SECRET`
   - `HEALTHCHECK_SECRET`
   - `DEMO_MODE_ENABLED=false`
2. Seguridad adicional:
   - `PASSKEY_RP_ID`
   - `PASSKEY_RP_NAME`
   - `PASSKEY_ALLOWED_ORIGINS`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Integraciones:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `BILLING_PROVIDER=AZUL`
   - `AZUL_PAYMENT_URL`
   - `AZUL_MERCHANT_ID`
   - `AZUL_MERCHANT_NAME`
   - `AZUL_MERCHANT_TYPE`
   - `AZUL_AUTH_KEY`
   - `AZUL_CURRENCY_CODE`
4. Host interno, si aplica:
   - `HOST_PANEL_ENABLED`
   - `HOST_ALLOWED_EMAILS`
   - `HOST_SECONDARY_TOTP_SECRET`

## 5. Verificación inmediata después de cargar variables

Después del deploy:

1. correr migraciones
2. revisar `/api/health`
3. probar registro y login
4. probar MFA
5. probar passkeys en el dominio real
6. si hay billing, probar checkout AZUL aprobado, declinado y cancelado

## 6. Error típico a evitar

No mezcles estas combinaciones:

- `APP_URL` de staging con `PASSKEY_ALLOWED_ORIGINS` de producción
- `PASSKEY_RP_ID` de un subdominio que no coincide con el dominio real de login
- `DEMO_MODE_ENABLED=true` en staging o producción
- credenciales test/sandbox de AZUL en producción
