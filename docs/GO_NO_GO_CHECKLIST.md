# GO / NO-GO CHECKLIST

Usa este documento como cierre de lanzamiento. La idea no es revisar todo con el mismo peso, sino decidir con prioridades claras.

## 1. Información general

- Entorno: [staging / production]
- Fecha:
- Versión / commit:
- Responsable de decisión:

## 2. Estado real del producto

### Código y experiencia principal

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:unit`
- [ ] `npm run test:integration`
- [ ] smoke browser crítico pasando
- [ ] login, registro, onboarding y dashboard funcionan
- [ ] móvil validado en iPhone/Safari
- [ ] móvil validado en Android/Chrome

Estado: [GO / GO WITH RISK / NO-GO]

### Infraestructura

- [ ] proyecto Vercel correcto
- [ ] Neon conectado y estable
- [ ] variables cargadas correctamente
- [ ] migraciones aplicadas
- [ ] dominio principal apuntando al despliegue correcto

Estado: [GO / GO WITH RISK / NO-GO]

### Seguridad

- [ ] rate limiting activo
- [ ] CSRF activo
- [ ] `DEMO_MODE_ENABLED=false`
- [ ] `HOST_PANEL_ENABLED=false` o restringido por allowlist + MFA
- [ ] `PASSKEY_RP_ID` y `PASSKEY_ALLOWED_ORIGINS` correctos
- [ ] MFA funcional
- [ ] secretos de producción únicos y largos

Estado: [GO / GO WITH RISK / NO-GO]

### Billing

- [ ] `BILLING_PROVIDER=AZUL`
- [ ] merchant, `AuthKey`, moneda y URL correctos
- [ ] pago aprobado validado
- [ ] pago declinado validado
- [ ] pago cancelado validado
- [ ] activación de membresía validada tras confirmación

Estado: [GO / GO WITH RISK / NO-GO]

### Observabilidad

- [ ] logs disponibles
- [ ] errores visibles
- [ ] monitoreo mínimo activo para login, auth y billing
- [ ] procedimiento claro de rollback

Estado: [GO / GO WITH RISK / NO-GO]

### Base de Datos

- [ ] backups activos
- [ ] restore verificado al menos una vez
- [ ] datos consistentes
- [ ] conexiones estables después del despliegue

Estado: [GO / GO WITH RISK / NO-GO]

## 3. Prioridades de lanzamiento

### P1 · Bloqueadores absolutos

Si uno falla: NO-GO automático

- [ ] login y registro sanos en dominio real
- [ ] onboarding y dashboard sanos en dominio real
- [ ] migraciones aplicadas
- [ ] variables críticas correctas
- [ ] `DEMO_MODE_ENABLED=false`
- [ ] build de producción sano
- [ ] callbacks de AZUL funcionando si el cobro es parte del lanzamiento
- [ ] errores críticos visibles en logs

### P2 · Requeridos para salir bien

No deberían bloquear si hay excepción aprobada, pero sí requieren dueño y fecha

- [ ] QA manual completa en iPhone/Safari
- [ ] QA manual completa en Android/Chrome
- [ ] passkeys validadas en dominio real
- [ ] MFA validado extremo a extremo
- [ ] recordatorios/correos validados con remitente real
- [ ] restore de base de datos documentado
- [ ] rollback documentado y ensayado

### P3 · Mejoras posteriores al go-live

No bloquean salida, pero conviene calendarizarlas antes de crecer tráfico

- [ ] WAF/reglas avanzadas afinadas
- [ ] dashboards de observabilidad más completos
- [ ] optimización fina de prompts comerciales
- [ ] automatización extra de soporte/alertas
- [ ] capa 2 de AZUL para tokenización y recurrencia

## 4. Smoke test final

Obligatorio antes de decidir GO

- [ ] registro de usuario nuevo
- [ ] onboarding completo
- [ ] login con contraseña
- [ ] activación de MFA
- [ ] logout + login nuevamente
- [ ] acceso a dashboard
- [ ] navegación móvil en dashboard, deudas, pagos y simulador
- [ ] flujo de pago, si aplica
- [ ] recuperación de cuenta, si aplica

Todos deben funcionar sin errores visibles ni pantallas rotas.

## 5. Validación final de entorno

- [ ] `APP_URL` correcto
- [ ] dominio correcto configurado
- [ ] `PASSKEY_ALLOWED_ORIGINS` coincide con dominio real
- [ ] `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`, `HEALTHCHECK_SECRET` cargados
- [ ] `AZUL_*` correctas
- [ ] `RESEND_*` correctas
- [ ] `UPSTASH_*` correctas si rate limit/colas dependen de ello

## 6. Decisión final

- ✅ GO → listo para producción
- ⚠️ GO WITH RISK → salir con riesgos documentados
- ❌ NO-GO → no salir, requiere fixes

## 7. Riesgos documentados

- riesgo:
- impacto:
- mitigación:
- responsable:
- fecha objetivo:

## 8. Notas

- problemas detectados:
- decisiones tomadas:
- excepciones aprobadas:
