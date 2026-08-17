# Lanzamiento 1.2

Este corte marca la base de salida de Deuda Clara RD antes de abrir acceso oficial a usuarios reales.

## Incluye

- Experiencia mobile-first con header compacto, contenido full width y navegación inferior.
- Planes Base, Premium y Pro con permisos funcionales y paywalls conectados al backend.
- Billing desacoplado del dominio y preparado para AZUL como proveedor principal en República Dominicana.
- Recordatorios automáticos por correo para fechas importantes.
- Seguridad de sesión, CSRF, headers, auditoría, MFA/passkeys y panel host protegido.
- Legal, privacidad, onboarding y dashboard orientados a uso real.

## Estado de cobros

- Proveedor activo de cobro: AZUL.
- Moneda comercial de membresías: USD.
- Datos financieros del usuario: RD$.
- Flujo actual: checkout con redirección/post a Página de Pagos AZUL y activación server-side tras confirmación aprobada.
- Fase siguiente: tokenización/bóveda y recurrencia automática con AZUL cuando estén listas las credenciales y el acuerdo operativo.

## Checklist antes de producción

- Completar [GO / NO-GO CHECKLIST](./GO_NO_GO_CHECKLIST.md) con prioridades `P1`, `P2` y `P3`.
- Configurar credenciales reales o sandbox de AZUL.
- Probar pago aprobado, declinado y cancelado.
- Validar callbacks/retornos con `AuthHash`.
- Confirmar `DEMO_MODE_ENABLED=false`.
- Confirmar `APP_URL`, secretos, Resend, cron y base de datos de producción.
- Ejecutar `npm run prelaunch`, `npm run typecheck`, `npm run build`, `npm run test:unit` y `npm run test:integration`.
- Ejecutar QA manual en iPhone/Safari y Android/Chrome.

## Decisión de producto

La app ya no se presenta como demo. El fallback local de demo queda solo como herramienta controlada de QA, desactivada por defecto y bloqueada en producción.

## Lectura rápida de lanzamiento

### Se puede lanzar cuando

- login, registro, onboarding y dashboard funcionan en dominio real
- billing con AZUL está validado en el ambiente correcto
- móvil está aprobado en iPhone/Safari y Android/Chrome
- build, pruebas y migraciones están en verde

### No deberíamos lanzar si

- falla cualquier flujo principal de auth
- `DEMO_MODE_ENABLED` sigue activo
- passkeys o MFA están mal configurados en el dominio real
- AZUL no confirma pagos de forma confiable
