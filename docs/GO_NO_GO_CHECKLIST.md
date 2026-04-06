# GO / NO-GO CHECKLIST

Usa este documento después de ejecutar el runbook completo.

## 1. Información general

- Entorno: [staging / production]
- Fecha:
- Versión / commit:
- Responsable de decisión:

## 2. Estado general

### App / Código

- auth, sesiones, permisos, CSP, MFA y passkeys funcionando
- build limpio sin errores
- pruebas E2E críticas pasando

Estado: [GO / GO WITH RISK / NO-GO]

### Infraestructura

- Vercel configurado correctamente
- Neon conectado y estable
- variables cargadas correctamente
- migraciones aplicadas

Estado: [GO / GO WITH RISK / NO-GO]

### Seguridad

- rate limiting activo
- CSRF activo
- passkeys correctamente configuradas (`PASSKEY_RP_ID`, `PASSKEY_ALLOWED_ORIGINS`)
- MFA funcional
- `DEMO_MODE_ENABLED=false` en producción

Estado: [GO / GO WITH RISK / NO-GO]

### Billing

- Stripe en modo correcto (`test` / `live`)
- productos y precios configurados
- flujo de pago probado

Estado: [GO / GO WITH RISK / NO-GO]

### Observabilidad

- logs funcionando
- errores visibles
- alertas mínimas configuradas (login fallido, errores críticos)

Estado: [GO / GO WITH RISK / NO-GO]

### Base de Datos

- backups activos
- restore test realizado
- datos consistentes

Estado: [GO / GO WITH RISK / NO-GO]

## 3. Bloqueadores absolutos

Si alguno está presente: NO-GO automático

- ❌ variables críticas mal configuradas, especialmente passkeys
- ❌ migraciones no aplicadas
- ❌ login o registro roto
- ❌ billing no funcional, si es requerido
- ❌ `DEMO_MODE_ENABLED=true` en producción
- ❌ errores críticos sin visibilidad

## 4. Riesgos aceptables

No bloquean salida, pero deben quedar documentados

- mejoras de UI pendientes
- logs no centralizados completamente
- WAF no completamente optimizado
- tests no críticos pendientes

## 5. Smoke test final

Obligatorio antes de decidir GO

- [ ] registro de usuario nuevo
- [ ] onboarding completo
- [ ] login con contraseña
- [ ] login con passkey
- [ ] activación de MFA
- [ ] logout + login nuevamente
- [ ] acceso a dashboard
- [ ] flujo de pago, si aplica
- [ ] recuperación de cuenta, si aplica

Todos deben funcionar sin errores.

## 6. Validación final

- [ ] variables correctas en entorno
- [ ] dominio correcto configurado
- [ ] `PASSKEY_ALLOWED_ORIGINS` coincide con dominio real
- [ ] `DEMO_MODE_ENABLED=false` en producción
- [ ] build desplegado sin errores
- [ ] runbook ejecutado completo

## 7. Decisión final

- ✅ GO → listo para producción
- ⚠️ GO WITH RISK → salir con riesgos documentados
- ❌ NO-GO → no salir, requiere fixes

## 8. Notas

- problemas detectados:
- decisiones tomadas:
- excepciones aprobadas:
