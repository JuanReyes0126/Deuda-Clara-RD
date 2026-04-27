# Plan de límites por plan: Base (FREE), Premium (NORMAL) y Pro

Este documento define **cómo acotar funciones** entre planes de forma coherente con el código y con la facturación. La fuente de verdad numérica es `src/lib/feature-access.ts` (`PLAN_FEATURES` / `resolveFeatureAccess`). Los nombres comerciales en UI suelen ser **Base**, **Premium** y **Pro**; en base de datos y tipos aparecen como `FREE`, `NORMAL` y `PRO`.

## 1. Principios

1. **Una capacidad, una llave**  
   Toda función que deba limitarse debe mapear a un campo booleano o numérico en `FeatureAccessDefinition` (por ejemplo `canCompareScenarios`, `maxActiveDebts`). Evita bifurcaciones sueltas en componentes sin pasar por `resolveFeatureAccess`.

2. **Doble barrera: servidor + cliente**  
   - **Servidor**: validar con `getUserFeatureAccess` / `assertUserCapability` en rutas API y jobs (lo que ya hace `filterSimulatorResultForAccess` en el simulador de cartera).  
   - **Cliente**: ocultar, degradar o mostrar `LockedCard` / `UpgradeCTA` según `access`, pero **nunca** confiar solo en el cliente.

3. **Estado de facturación**  
   `resolveFeatureAccess` trata como Base a quien no tiene `membershipBillingStatus === "ACTIVE"` aunque el tier guardado sea Premium o Pro. Cualquier copy de “desbloqueado” debe alinearse con `access.hasPaidAccess` / `access.effectiveTier`.

4. **Nuevas funciones**  
   Antes de lanzar:  
   - Añadir la llave en `FeatureAccessDefinition` y en `FREE` / `NORMAL` / `PRO` dentro de `PLAN_FEATURES`.  
   - Usar `assertUserCapability(userId, "nuevaLlave")` en el endpoint.  
   - En UI, leer `access.nuevaLlave` o `hasCapability(access, "nuevaLlave")`.  
   - Documentar en la tabla de abajo.

## 2. Matriz resumida (estado actual del código)

| Área | Base (FREE) | Premium (NORMAL, activo) | Pro (PRO, activo) |
|------|-------------|---------------------------|-------------------|
| Deudas activas máx. | 2 | 10 | Ilimitadas (`MAX_SAFE_INTEGER`) |
| Simulador una deuda | Parcial (sin comparación completa de escenarios) | Completo en cliente | + guía Pro (`simulateDebt` + `proGuidance`) |
| Simulador **cartera** (`/api/simulator`) | Plan base + proyección corta + copy limitada | Comparación extra, foco y tarjeta; sin refinanciar tasa | Todo lo de Premium + escenario **refinanciar tasa** (`canSeeRefinanceScenario`) |
| Comparación de escenarios / ahorro optimizado | No | Sí | Sí |
| Estrategia recomendada / explicación extendida | No | Sí | Sí |
| Extra mensual en simulador cartera | No | Sí | Sí |
| Plan comparado completo en dashboard | No | Sí | Sí |
| Optimización “premium” en producto | No | Sí | Sí |
| Recordatorios avanzados / alertas | No | Sí | Sí |
| Exportación reportes | No | No | Sí (`canExportReports`) |
| Auto-estrategia / reoptimización dinámica | No | No | Sí |
| Plan paso a paso Pro | No | No | Sí |
| Historial / puntos en gráficos / límites de lista | Valores bajos (ver números en `PLAN_FEATURES`) | Valores medios | Valores altos |

Los valores exactos de límites numéricos (`riskAlertLimit`, `balanceHistoryPoints`, etc.) viven en `PLAN_FEATURES` y deben actualizarse solo ahí para no desincronizar.

## 3. Simulador: dos modos y qué cobra cada plan

- **Una deuda**: motor en cliente (`simulateDebt`), útil para educar y probar una línea; Premium/Pro desbloquean comparaciones y capas según `access` pasado al simulador.  
- **Toda la cartera**: motor en servidor (`runSimulator` vía `POST /api/simulator`), alineado con el dashboard; el resultado ya llega filtrado por `filterSimulatorResultForAccess`.

En la vista cartera, los **escenarios opcionales** (priorizar una deuda, dejar de cargar una tarjeta, refinanciar tasa) envían los mismos campos opcionales del API y muestran resultados solo cuando el plan lo permite: `canSeeRecommendedStrategy` para el foco, `canSeeOptimizedSavings` para la tarjeta (Premium/Pro activos) y **`canSeeRefinanceScenario` solo en Pro activo** para refinanciar (ver `PLAN_FEATURES`).

Base sigue viendo **valor** (meses e intereses del plan actual) sin regalar la comparación completa que justifica Premium.

## 4. Checklist al añadir o mover una función

- [ ] ¿Existe (o hace falta) una llave en `FeatureAccessDefinition`?  
- [ ] ¿Están definidos los tres valores en `PLAN_FEATURES`?  
- [ ] ¿El API comprueba la capacidad o filtra datos sensibles?  
- [ ] ¿La UI usa `resolveFeatureAccess` y no solo `membershipTier` crudo?  
- [ ] ¿Copy y CTAs dicen “Premium”/“Pro” según `access.upgradeTargetLabel` cuando aplica?  
- [ ] ¿Prueba con usuario FREE, Premium activo y Pro activo?

## 5. Ajustes de producto opcionales (siguiente iteración)

- Profundizar **Pro** en otros módulos (exportes, reoptimización, paso a paso) manteniendo el simulador cartera alineado con `PLAN_FEATURES` (foco + tarjeta en Premium; refinanciar solo con `canSeeRefinanceScenario`).  
- Unificar naming en toda la app: “Base” vs “Gratis” vs `FREE`.  
- Telemetría: ya existe `simulator_portfolio_run` para medir adopción de la vista cartera.
