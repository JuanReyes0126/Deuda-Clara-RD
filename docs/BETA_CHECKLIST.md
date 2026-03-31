# Checklist beta real

## Listo para probar

- Registro y login con sesiones protegidas
- CRUD de deudas y pagos
- Dashboard con prioridad y siguiente acción
- Reportes y exportación
- Centro de notificaciones
- Activación de planes con Stripe si el entorno está configurado
- Diagnóstico local con `npm run doctor`
- Salud del sistema con `GET /api/health`

## Configuración mínima antes de invitar usuarios

- `APP_URL` pública y compartible, no `localhost`
- `DEMO_MODE_ENABLED=false` para que las cuentas de prueba sean reales y persistentes
- PostgreSQL accesible desde `DATABASE_URL`
- `AUTH_SECRET` y `DATA_ENCRYPTION_KEY` configurados
- `APP_URL` apuntando a la URL real que usarán los usuarios
- `CRON_SECRET` para jobs protegidos
- Resend configurado si quieres recuperación por email y recordatorios
- Stripe test configurado si quieres validar Premium/Pro antes de producción

## Riesgos a revisar antes de abrir beta

- Si PostgreSQL cae, auth y módulos privados devolverán error controlado, pero el usuario no podrá operar
- Si Resend no está configurado, los correos se omiten de forma segura
- Si Stripe no está configurado, los planes pagos no podrán activarse
- Los tests e2e siguen dependiendo de tener base y navegador listos en el entorno

## Validación recomendada antes de cada prueba

1. `npm run doctor`
2. `npm run prebeta`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run test:unit`
6. `npm run test:integration`
7. `npm run build`
