# Runbook de Staging y Salida Controlada

Este runbook está pensado para dejar Deuda Clara RD lista para un staging serio y una salida oficial controlada sin improvisar.

## 1. Preparación del entorno

Antes de tocar Vercel, ten a mano:

- dominio o URL de staging
- proyecto Postgres real en Neon
- claves de Resend
- credenciales test/sandbox de AZUL
- secretos fuertes para auth, cifrado, cron y health

Referencia exacta de variables:

- [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)

## 2. Crear y configurar staging

### Vercel

1. Crea el proyecto desde el repositorio.
2. Framework preset: `Next.js`.
3. No cambies el build command salvo necesidad real.

### Neon

1. Crea la base.
2. Obtén:
   - connection string pooled
   - connection string direct/unpooled

## 3. Cargar variables de entorno

Carga primero estas variables:

- `APP_URL`
- `AUTH_SECRET`
- `DATA_ENCRYPTION_KEY`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `CRON_SECRET`
- `HEALTHCHECK_SECRET`
- `DEMO_MODE_ENABLED=false`

Después carga estas si usarás seguridad avanzada:

- `PASSKEY_RP_ID`
- `PASSKEY_RP_NAME`
- `PASSKEY_ALLOWED_ORIGINS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Después carga estas si usarás integraciones:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `BILLING_PROVIDER=AZUL`
- `AZUL_PAYMENT_URL`
- `AZUL_MERCHANT_ID`
- `AZUL_MERCHANT_NAME`
- `AZUL_MERCHANT_TYPE`
- `AZUL_AUTH_KEY`
- `AZUL_CURRENCY_CODE`

Si vas a habilitar panel interno:

- `HOST_PANEL_ENABLED=true`
- `HOST_ALLOWED_EMAILS=...`
- `HOST_SECONDARY_TOTP_SECRET=...`

Si no lo necesitas:

- `HOST_PANEL_ENABLED=false`

## 4. Primer deploy

1. Haz deploy con las variables ya cargadas.
2. Verifica que la app abra en la URL pública.
3. Confirma que `/api/health` responda bien.

## 5. Migraciones y base

Ejecuta:

```bash
npx prisma migrate deploy
```

Luego confirma:

- migraciones de MFA aplicadas
- migraciones de recovery codes aplicadas
- migraciones de passkeys aplicadas

Si necesitas data base para pruebas:

```bash
npm run db:seed
```

## 6. Validación técnica antes de invitar testers

Corre:

```bash
npm run doctor
npm run prelaunch
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Y si quieres repetir la prueba crítica:

```bash
npx playwright test tests/e2e/passkeys.spec.ts --project=chromium --workers=1
```

## 7. Validación funcional sensible

Recorre este orden:

1. Registro real
2. Login real
3. Cambio de contraseña
4. Activación de MFA TOTP
5. Uso de recovery code
6. Registro de passkey
7. Logout
8. Login con passkey
9. Crear deuda
10. Registrar pago
11. Abrir simulador
12. Revisar reportes
13. Probar billing si AZUL está listo

## 8. Perímetro y observabilidad

Antes de abrir producción controlada:

- activa WAF/CDN
- fuerza HTTPS
- confirma HSTS
- activa rate limiting de edge si el proveedor lo permite
- envía logs a un destino central
- crea alertas para:
  - login fallido
  - abuso de rate limit
  - cambios MFA
  - alta/baja de passkeys

## 9. Host/Admin

Si usarás `/host`:

- confirma `HOST_PANEL_ENABLED=true`
- revisa allowlist
- confirma MFA activo en cuentas admin
- confirma segunda compuerta interna

Si no lo usarás:

- deja `HOST_PANEL_ENABLED=false`

## 10. Cierre recomendado

Si todo esto queda en verde:

1. abre acceso controlado
2. invita pocos usuarios reales primero
3. observa errores, pagos y feedback
4. no metas features nuevas antes de estabilizar

## 🧾 Decisión final

Una vez completados todos los pasos del runbook:

➡️ Ejecutar: [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)

Este documento define si el sistema está listo para producción.

No avanzar a producción sin una decisión explícita de:

- GO
- GO WITH RISK
- NO-GO

La decisión debe quedar documentada con:

- fecha
- entorno
- versión
- responsable
