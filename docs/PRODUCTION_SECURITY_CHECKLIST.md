# Checklist final de producción

Este checklist está pensado para el entorno real de Deuda Clara RD antes de abrir tráfico de usuarios.

Úsalo como validación de seguridad y operación.

Para ejecución completa y decisión final:

- [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)

### Variables y secretos

- `APP_URL` apuntando al dominio final HTTPS.
- `AUTH_SECRET` con al menos 32 caracteres aleatorios.
- `DATA_ENCRYPTION_KEY` dedicada y distinta de `AUTH_SECRET`.
- `DATABASE_URL` y `DIRECT_DATABASE_URL` apuntando a la base real.
- `HEALTHCHECK_SECRET` configurado si se usará health detallado.
- `DEMO_MODE_ENABLED=false`.
- Si usarás passkeys:
  - `PASSKEY_RP_ID` igual al dominio registrable final.
  - `PASSKEY_RP_NAME=Deuda Clara RD`.
  - `PASSKEY_ALLOWED_ORIGINS` con la lista exacta de orígenes HTTPS permitidos.

### Host/Admin

- `HOST_PANEL_ENABLED=false` salvo necesidad real.
- Si `HOST_PANEL_ENABLED=true`:
  - `HOST_ALLOWED_EMAILS` con allowlist exacta.
  - `HOST_SECONDARY_TOTP_SECRET` configurado.
  - validar que las cuentas `ADMIN` tengan MFA activo antes de entrar.

### Base y despliegue

- Ejecutar `npx prisma migrate deploy` sobre la base real.
- Confirmar que las migraciones de MFA, recovery codes y passkeys quedaron aplicadas.
- Ejecutar `npm run build`.
- Ejecutar `npm run security:audit`.
- Confirmar que CI está verde.
- Confirmar que el runbook técnico ya fue ejecutado completo.

### Verificación funcional sensible

- Registro real crea usuario persistente.
- Login por contraseña funciona.
- MFA TOTP funciona.
- Recovery codes funcionan y se consumen una sola vez.
- Passkey se registra, permite login y se puede eliminar.
- Checkout y billing portal requieren reautenticación reciente.
- `/host` exige admin + MFA + compuerta interna.

### Red y perímetro

- WAF/CDN activado en el proveedor.
- Rate limits del edge habilitados si el proveedor los ofrece.
- HTTPS forzado y HSTS activo.
- Bloqueo de bots básicos y protección de login/registro desde el edge.

### Observabilidad y respuesta

- Logs de seguridad enviados a un destino central.
- Alertas para:
  - picos de login fallido
  - abuso de rate limit
  - cambios MFA
  - alta/baja de passkeys
- Backups de base verificados.
- Restore test al menos una vez en staging.

### Cierre honesto

Si este checklist se completa, la app queda en una postura fuerte a nivel de aplicación y operación básica. Lo que sigue para una postura “máxima” ya es pentest externo, revisión de infraestructura y monitoreo continuo.
