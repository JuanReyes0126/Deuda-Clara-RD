# Beta cerrada con amigos

Esta guía es para abrir una prueba corta con 5 o 6 personas reales y sacar feedback útil sin improvisar.

## Meta de esta beta

No es una beta para "ver si les gusta el diseño".

La meta real es descubrir:

- si entienden rápido qué hace la app
- si logran registrarse sin trabarse
- si pueden registrar su primera deuda
- si pueden registrar un pago sin dudas
- si el simulador les da una conclusión clara
- si entienden cuándo Premium tiene sentido

## Configuración recomendada antes de invitar gente

Usa un entorno compartible y estable:

- URL pública real en `APP_URL`
- `DEMO_MODE_ENABLED=false`
- PostgreSQL real y persistente
- `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` y `CRON_SECRET` configurados
- Stripe en test si quieres validar checkout
- Resend si quieres probar correos reales

Antes de compartir, corre:

```bash
npm run doctor
npm run prebeta
npm run lint
npm run typecheck
npm run test:integration
npm run build
```

Y para el orden operativo de staging y salida, apóyate en [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md).

## Qué testers invitar

Idealmente mezcla:

- 2 personas con varias deudas activas
- 2 personas ordenadas con poco contexto financiero
- 1 o 2 personas críticas que te digan dónde se confunden

No hace falta que sean expertos. De hecho, mejor si no lo son.

## Qué pedirles exactamente

Dales una misión concreta:

1. Crear cuenta
2. Registrar al menos una deuda
3. Registrar un pago
4. Abrir el simulador
5. Decirte qué entendieron del plan recomendado

Tiempo recomendado:

- 20 a 30 minutos por persona

## Mensaje sugerido para enviarles

Puedes mandar algo así:

> Estoy probando una beta cerrada de una app para organizar deudas personales.
> 
> Me ayudaría mucho si la pruebas 20 o 30 minutos y me dices:
> 1. qué entendiste rápido
> 2. dónde te confundiste
> 3. qué se sintió lento, raro o poco claro
> 
> Lo ideal es que hagas este recorrido:
> crear cuenta -> registrar una deuda -> registrar un pago -> abrir simulador -> revisar dashboard/planes.

## Qué feedback pedirles

Pídeles responder estas 5 preguntas:

1. ¿Entendiste rápido qué hace la app?
2. ¿Dónde dudaste o te perdiste?
3. ¿Qué parte se sintió más útil?
4. ¿Qué parte se sintió innecesaria o confusa?
5. ¿La usarías otra vez para seguir tus deudas?

## Qué observar tú

Mientras recibes feedback, clasifica todo en:

- `Bug`: algo roto o inconsistente
- `Claridad`: algo no se entiende rápido
- `Confianza`: algo da sensación de inseguridad o desorden
- `Valor`: algo útil que no se percibe suficiente

## Qué hacer después de la beta

Después de probar con 5 o 6 personas:

1. Junta todos los hallazgos en una sola lista.
2. Ordénalos por:
   - rompe flujo
   - confunde
   - baja conversión
   - detalle menor
3. Corrige primero:
   - registro/login
   - primera deuda
   - primer pago
   - simulador
   - cualquier error de confianza visual o técnica

## Regla práctica

No metas features nuevas entre testers si no son necesarias.

En beta cerrada vale más:

- estabilidad
- claridad
- confianza
- velocidad de aprendizaje

## 🔒 Salida a Producción

La transición de beta cerrada a producción requiere:

- Runbook ejecutado completamente
- Checklist de GO/NO-GO aprobado

Ver:

- [STAGING_GO_LIVE_RUNBOOK.md](./STAGING_GO_LIVE_RUNBOOK.md)
- [GO_NO_GO_CHECKLIST.md](./GO_NO_GO_CHECKLIST.md)
