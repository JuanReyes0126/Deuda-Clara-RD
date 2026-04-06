# Seguridad

Deuda Clara RD aplica buenas prácticas razonables de seguridad para una aplicación web financiera personal. No ofrece seguridad absoluta. La meta es reducir superficie de ataque, limitar impacto y documentar riesgos pendientes con claridad.

## Controles implementados

- Validación server-side estricta con Zod en rutas/API y validación client-side ligera con `react-hook-form` nativo para no arrastrar `unsafe-eval` al bundle.
- Autorización por recurso en servicios de deudas, pagos, notificaciones y configuración usando `userId` en todas las consultas sensibles.
- Sesiones protegidas con cookie `httpOnly`, `sameSite=strict`, prioridad alta y `secure` en producción.
- Hashing de contraseñas con `@node-rs/argon2`, una alternativa moderna y fuerte a bcrypt.
- Protección CSRF por double-submit cookie (`dc_csrf`) + header (`x-csrf-token`) en mutaciones, además de validación `Origin`/`Referer`.
- Protección contra SQL injection mediante Prisma y validación previa.
- Rate limiting para login, registro y recuperación de contraseña con Upstash Redis o fallback en memoria.
- Sanitización básica de texto de entrada para evitar payloads HTML inesperados en notas, plantillas y campos libres.
- Cifrado simétrico en reposo para notas de deudas y pagos con `DATA_ENCRYPTION_KEY` dedicado en producción. El fallback a `AUTH_SECRET` queda restringido a entornos no productivos.
- Manejo de errores sin filtrar stack traces o secretos a cliente.
- Cabeceras de seguridad aplicadas en `proxy.ts`, incluyendo `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `HSTS`, `X-DNS-Prefetch-Control`, `X-Permitted-Cross-Domain-Policies` y `Cache-Control: no-store` en rutas sensibles.
- Registro de eventos críticos en auditoría: login exitoso/fallido, cambios de contraseña, CRUD de deudas/pagos, cambios de configuración y estado de usuarios.
- Activación de planes Premium/Pro controlada por Stripe checkout + webhook firmado; el frontend no desbloquea planes pagos por sí solo.
- Portal de facturación separado para cambios de plan o cancelación, evitando toggles directos inseguros desde cliente.
- Secretos externalizados a variables de entorno.
- Panel host/admin con defensa en profundidad: sesión admin, MFA obligatorio en la cuenta, allowlist de correo y segundo factor interno por TOTP (`HOST_SECONDARY_TOTP_SECRET`) o clave secundaria legacy.
- Dependencias innecesarias retiradas del proyecto y auditoría automática de dependencias de producción en CI (`npm audit --omit=dev`) + Dependabot semanal para npm y GitHub Actions.
- MFA para usuarios finales con TOTP, recovery codes y passkeys/WebAuthn, incluyendo alertas por email para alta/baja de factores sensibles.
- Reautenticación reciente para acciones sensibles como billing, cambio de contraseña, cambios MFA y registro/eliminación de passkeys.

## Checklist de seguridad

- [x] Validación server-side obligatoria
- [x] Validación client-side en formularios críticos
- [x] Sanitización de inputs de texto libre
- [x] Hash fuerte de contraseñas
- [x] Sesiones con cookie segura
- [x] Cifrado en reposo para notas sensibles
- [x] Autorización por recurso
- [x] Rate limit en login y recuperación
- [x] Anti-CSRF por token en mutaciones
- [x] Logs básicos de seguridad
- [x] Headers de seguridad
- [x] CSP con nonce por request en rutas de app/auth y bloqueo de `unsafe-eval`
- [x] MFA para usuarios (TOTP + recovery codes + passkeys)
- [x] MFA obligatorio para cuentas admin/host
- [x] Reautenticación reciente para acciones sensibles
- [x] No exposición de secretos en frontend
- [x] Segunda compuerta interna para host/admin
- [x] Webhook firmado para sincronizar billing
- [x] Planes de pago sin activación manual desde cliente
- [x] Documentación de riesgos y mitigaciones

## Riesgos pendientes

- Solo notas de deuda/pago están cifradas a nivel de aplicación; otros campos sensibles podrían requerir más cobertura si el producto amplía alcance.
  Mitigación recomendada: extender cifrado selectivo a metadata de perfil y plantillas administrativas si pasan a contener PII sensible.

- No hay SIEM ni alertas automáticas avanzadas ante anomalías.
  Mitigación recomendada: integrar Sentry/Datadog y alertas por patrón de abuso.

- La sanitización textual es conservadora y no reemplaza una política completa de contenido.
  Mitigación recomendada: usar una librería especializada si se habilita HTML enriquecido en el futuro.

- `style-src 'unsafe-inline'` sigue habilitado porque Recharts y elementos de runtime usan estilos inline. `script-src` ya opera con nonce y sin `unsafe-eval` en rutas dinámicas protegidas.
  Mitigación recomendada: planificar una migración gradual de charts/estilos inline si se quiere endurecer CSS al máximo sin romper UX.

- Passkeys funcionan mejor con configuración explícita de RP ID y orígenes permitidos en producción.
  Mitigación recomendada: definir `PASSKEY_RP_ID`, `PASSKEY_RP_NAME` y `PASSKEY_ALLOWED_ORIGINS` por entorno y validar el flujo contra el dominio final.

- El cambio de plan dentro del portal de Stripe depende de la configuración del portal en la cuenta de Stripe.
  Mitigación recomendada: habilitar actualización/cancelación de suscripciones y verificar en staging los cambios de `Price ID`.

- Las pruebas e2e requieren un entorno con PostgreSQL y navegador disponible.
  Mitigación recomendada: ejecutarlas siempre en CI y en staging antes de desplegar.

## Respuesta responsable

Checklist operativo complementario: [docs/PRODUCTION_SECURITY_CHECKLIST.md](./docs/PRODUCTION_SECURITY_CHECKLIST.md).

Si detectas una vulnerabilidad, repórtala de forma privada al equipo responsable del despliegue. No publiques detalles de explotación hasta que exista mitigación.
