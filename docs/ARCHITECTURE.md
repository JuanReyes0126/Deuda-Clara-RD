# Arquitectura Deuda Clara RD

## Decisión principal

Se usa **Next.js App Router + Route Handlers + Server Components + TypeScript** como stack full-stack principal en lugar de NestJS.

### Justificación breve

- Reduce complejidad operativa: un solo runtime, un solo despliegue y una sola base de tipos.
- Permite compartir validaciones, tipos y lógica de dominio entre UI, API y rendering del servidor.
- Encaja mejor con el producto: dashboard, autenticación, formularios, reportes y panel admin viven cómodamente en un monolito modular.
- Facilita despliegue en **Vercel + Neon PostgreSQL**, con cron jobs, previews y observabilidad simple.
- Mantiene suficiente separación usando capas claras: `app -> features -> server -> prisma`.

## Estilo arquitectónico

Monolito modular con separación por capas:

1. `src/app`
   Rutas App Router, layouts, páginas, route handlers y middleware.
2. `src/features`
   Lógica de presentación y casos de uso por dominio: auth, deudas, pagos, dashboard, reportes, admin.
3. `src/server`
   Servicios de dominio, autorización, repositorios, notificaciones, auditoría y reglas de negocio.
4. `src/lib`
   Utilidades compartidas: Prisma client, env, seguridad, formateo monetario, fechas, rate limiting.
5. `prisma`
   Schema, migraciones y seed.

## Principios

- TypeScript estricto en todo el proyecto.
- Validación de entrada con Zod en frontend y backend.
- Autorización por recurso, no solo por rol.
- Reglas financieras encapsuladas y cubiertas con tests.
- Persistencia relacional con PostgreSQL y Prisma.
- UI calmada y clara para usuarios bajo estrés financiero.
- Errores seguros: mensajes útiles al usuario y detalles sensibles solo en logs controlados.

## Módulos principales

- Autenticación y cuenta
- Dashboard financiero
- Gestión de deudas
- Historial de pagos
- Motor de estrategia de pago
- Simulador financiero
- Notificaciones y recordatorios
- Reportes y exportaciones
- Panel administrativo
- Auditoría y seguridad

## Flujo de capas

`UI/Formulario -> Zod DTO -> Route Handler / Server Action -> Servicio de dominio -> Prisma -> PostgreSQL`

Regla:

- Las rutas no contienen lógica financiera compleja.
- Los componentes no consultan Prisma directamente.
- Los cálculos no dependen de React.

## Autenticación

Se implementará con **Auth.js** usando:

- sesiones persistidas en base de datos,
- proveedor de credenciales,
- hash de contraseña con **Argon2**,
- recuperación de contraseña por token de un solo uso,
- protección de rutas por middleware y verificación de rol.

## Estrategia de dominio financiero

La lógica financiera se separa en un motor puro y testeable:

- normalización monetaria,
- cálculo de balances y pagos,
- estrategia `snowball`,
- estrategia `avalanche`,
- estrategia híbrida configurable,
- simulaciones de pago extra, refinanciamiento y congelación de gasto.

## Seguridad

Buenas prácticas razonables aplicadas:

- validación estricta con Zod,
- cookies seguras y sesiones protegidas,
- rate limiting en login, recuperación y endpoints sensibles,
- headers de seguridad,
- sanitización y normalización de entradas,
- auditoría de eventos relevantes,
- manejo seguro de errores,
- minimización de exposición de datos,
- protección CSRF para formularios sensibles basados en sesión.

No se promete seguridad absoluta. `SECURITY.md` documentará controles implementados, riesgos residuales y mitigaciones.

## Escalabilidad

Escala vertical y horizontal razonable para SaaS inicial:

- aplicación stateless en capa web,
- PostgreSQL como fuente de verdad,
- cron jobs para recordatorios,
- rate limiting desacoplado para poder moverlo a Redis/Upstash en producción,
- servicios de dominio separados por responsabilidad.

## Despliegue recomendado

**Vercel + Neon PostgreSQL + Resend**

### Por qué esta combinación

- Vercel es la opción más natural para Next.js App Router.
- Neon ofrece PostgreSQL administrado, ramas de base de datos y pooling.
- Resend simplifica correo transaccional y plantillas.
- Permite un camino de producción rápido con buena DX y bajo overhead operativo.

Alternativas:

- Railway o Render funcionan, pero la experiencia con Next.js App Router y previews suele ser mejor en Vercel.
- AWS es válido para escala avanzada, pero añade complejidad innecesaria para esta fase del producto.
