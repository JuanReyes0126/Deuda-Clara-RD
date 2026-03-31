# Seguridad

Deuda Clara RD aplica buenas prácticas razonables de seguridad para una aplicación web financiera personal. No ofrece seguridad absoluta. La meta es reducir superficie de ataque, limitar impacto y documentar riesgos pendientes con claridad.

## Controles implementados

- Validación estricta con Zod en frontend y backend para auth, deudas, pagos, simulador, admin y configuración.
- Autorización por recurso en servicios de deudas, pagos, notificaciones y configuración usando `userId` en todas las consultas sensibles.
- Sesiones protegidas con cookie `httpOnly`, `sameSite=strict`, prioridad alta y `secure` en producción.
- Hashing de contraseñas con `@node-rs/argon2`, una alternativa moderna y fuerte a bcrypt.
- Protección básica CSRF para requests que mutan estado mediante validación de `Origin`.
- Protección contra SQL injection mediante Prisma y validación previa.
- Rate limiting para login, registro y recuperación de contraseña con Upstash Redis o fallback en memoria.
- Sanitización básica de texto de entrada para evitar payloads HTML inesperados en notas, plantillas y campos libres.
- Cifrado simétrico en reposo para notas de deudas y pagos usando `DATA_ENCRYPTION_KEY` o `AUTH_SECRET` como fallback documentado.
- Manejo de errores sin filtrar stack traces o secretos a cliente.
- Cabeceras de seguridad configuradas en `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Registro de eventos críticos en auditoría: login exitoso/fallido, cambios de contraseña, CRUD de deudas/pagos, cambios de configuración y estado de usuarios.
- Activación de planes Premium/Pro controlada por Stripe checkout + webhook firmado; el frontend no desbloquea planes pagos por sí solo.
- Portal de facturación separado para cambios de plan o cancelación, evitando toggles directos inseguros desde cliente.
- Secretos externalizados a variables de entorno.
- Dependencias innecesarias retiradas del proyecto (`next-auth`, `@auth/prisma-adapter`, `vite-tsconfig-paths`).

## Checklist de seguridad

- [x] Validación server-side obligatoria
- [x] Validación client-side en formularios críticos
- [x] Sanitización de inputs de texto libre
- [x] Hash fuerte de contraseñas
- [x] Sesiones con cookie segura
- [x] Cifrado en reposo para notas sensibles
- [x] Autorización por recurso
- [x] Rate limit en login y recuperación
- [x] Logs básicos de seguridad
- [x] Headers de seguridad
- [x] No exposición de secretos en frontend
- [x] Webhook firmado para sincronizar billing
- [x] Planes de pago sin activación manual desde cliente
- [x] Documentación de riesgos y mitigaciones

## Riesgos pendientes

- No hay MFA todavía.
  Mitigación recomendada: agregar TOTP o passkeys para cuentas admin y usuarios que lo activen.

- La protección CSRF actual se basa en `Origin` + `SameSite`, sin token por formulario.
  Mitigación recomendada: introducir token anti-CSRF por sesión para endurecer formularios sensibles.

- Solo notas de deuda/pago están cifradas a nivel de aplicación; otros campos sensibles podrían requerir más cobertura si el producto amplía alcance.
  Mitigación recomendada: extender cifrado selectivo a metadata de perfil y plantillas administrativas si pasan a contener PII sensible.

- No hay SIEM ni alertas automáticas avanzadas ante anomalías.
  Mitigación recomendada: integrar Sentry/Datadog y alertas por patrón de abuso.

- La sanitización textual es conservadora y no reemplaza una política completa de contenido.
  Mitigación recomendada: usar una librería especializada si se habilita HTML enriquecido en el futuro.

- El cambio de plan dentro del portal de Stripe depende de la configuración del portal en la cuenta de Stripe.
  Mitigación recomendada: habilitar actualización/cancelación de suscripciones y verificar en staging los cambios de `Price ID`.

- Las pruebas e2e requieren un entorno con PostgreSQL y navegador disponible.
  Mitigación recomendada: ejecutarlas siempre en CI y en staging antes de desplegar.

## Respuesta responsable

Si detectas una vulnerabilidad, repórtala de forma privada al equipo responsable del despliegue. No publiques detalles de explotación hasta que exista mitigación.
