# Release Candidate 1.2

Este corte marca la base de lanzamiento de Deuda Clara RD antes de abrir acceso oficial a usuarios reales.

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

- Configurar credenciales reales o sandbox de AZUL.
- Probar pago aprobado, declinado y cancelado.
- Validar callbacks/retornos con `AuthHash`.
- Confirmar `DEMO_MODE_ENABLED=false`.
- Confirmar `APP_URL`, secretos, Resend, cron y base de datos de producción.
- Ejecutar `npm run prelaunch`, `npm run lint`, `npm run typecheck`, `npm run test:unit` y `npm run test:integration`.
- Revisar go/no-go y checklist de seguridad.

## Decisión de producto

La app ya no se presenta como demo. El fallback local de demo queda solo como herramienta controlada de QA, desactivada por defecto y bloqueada en producción.
