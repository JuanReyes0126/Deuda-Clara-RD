# Demo Snapshot 1.1

Fecha de corte: `2026-04-06`

Esta snapshot marca la primera versión estable después del bloque fuerte de:

- hardening de seguridad
- auditoría y trazabilidad
- consentimiento legal auditable
- onboarding nuevo
- optimización del dashboard
- correcciones de runtime local, auth y fluidez

## Qué diferencia esta snapshot de la demo 1

- Consentimiento legal auditable en registro con:
  - checkbox obligatorio
  - versiones legales persistidas
  - historial `UserConsent`
  - páginas públicas de términos y privacidad
- Hardening activo de:
  - sesiones
  - CSRF
  - CSP
  - rate limiting
  - MFA
  - passkeys
  - auditoría
- Onboarding tipo wizard de 5 pasos
- Dashboard principal reorganizado para claridad inmediata y acción
- Corrección del runtime local para respetar `.env.local`
- Corrección de login/registro para funcionar tanto con fetch CSRF como con submit tradicional
- Optimización del dashboard para evitar carga duplicada
- Throttling de sincronización de notificaciones para reducir trabajo repetido por request

## Validación de snapshot

Checks completados sobre esta base:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:unit`
- `npm run test:integration`

Resultado esperado de la snapshot:

- app visualmente estable en local
- registro operativo
- login operativo
- host panel habilitado por config local
- acceso admin protegido por MFA obligatorio

## Estado funcional esperado

- URL local: `http://127.0.0.1:3000`
- admin:
  - email: `admin@deudaclarard.com`
  - password: `DeudaClara123!`
- host:
  - requiere MFA activo en la cuenta admin
  - segunda compuerta local: `HOST_SECONDARY_PASSWORD`

## Notas

- Esta snapshot no elimina ni relaja el hardening reciente.
- La referencia visual sigue siendo la versión pública estable, pero esta snapshot conserva el trabajo nuevo de seguridad y legal.
- El siguiente corte natural sería `snapshot 1.2` si se decide entrar en una ronda específica de performance fina, UX polish o preparación de beta cerrada.
