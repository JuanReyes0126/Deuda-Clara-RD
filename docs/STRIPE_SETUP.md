# Stripe Setup

Esta guía deja configurado el cobro real de los planes de Deuda Clara RD usando la integración que ya está implementada en la app.

## Modelo comercial usado en la app

La app está preparada para **suscripciones mensuales**:

- `Premium`: `US$5/mes`
  - Plan interno: `NORMAL`
  - Mensaje comercial: salida rápida guiada en `6 meses`
- `Pro`: `US$10/mes`
  - Plan interno: `PRO`
  - Mensaje comercial: acompañamiento extendido por `12 meses`

La deuda del usuario sigue gestionándose en `DOP / RD$`, pero la facturación de membresía está definida en `USD`.

## Qué crear en Stripe

### 1. Producto Premium

Crea un producto con estos valores recomendados:

- Nombre: `Deuda Clara RD Premium`
- Descripción: `Plan de salida rápida con recomendaciones premium y guía de 6 meses.`
- Precio: `US$5`
- Tipo de precio: `Recurring`
- Intervalo: `Monthly`

Guarda el `Price ID` y colócalo en:

- `STRIPE_PREMIUM_PRICE_ID`

### 2. Producto Pro

Crea un producto con estos valores recomendados:

- Nombre: `Deuda Clara RD Pro`
- Descripción: `Acompañamiento extendido de 12 meses con consejos más profundos y mejor seguimiento.`
- Precio: `US$10`
- Tipo de precio: `Recurring`
- Intervalo: `Monthly`

Guarda el `Price ID` y colócalo en:

- `STRIPE_PRO_PRICE_ID`

## Variables de entorno

Debes definir estas variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PORTAL_RETURN_PATH`

Ejemplo:

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PREMIUM_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PORTAL_RETURN_PATH=/planes
```

## Webhook de Stripe

La app ya expone este endpoint:

- `/api/stripe/webhook`

En producción, la URL completa será algo como:

```text
https://tu-dominio.com/api/stripe/webhook
```

Suscribe estos eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Cuando Stripe entregue esos eventos, la app:

- crea o actualiza el estado de facturación del usuario
- activa `Premium` o `Pro` según el `Price ID`
- revoca el acceso premium cuando la suscripción deja de estar activa
- registra auditoría de billing

## Portal de facturación

La app ya usa Stripe Billing Portal para:

- cambiar entre `Premium` y `Pro`
- cancelar suscripción
- volver a `Base` al final del período

En Stripe debes habilitar dentro del portal:

- actualización de suscripción
- cancelación al final del período
- productos permitidos: `Premium` y `Pro`

## Flujo real que ya soporta la app

### Usuario nuevo sin plan pago

1. Entra a `/planes`
2. Elige `Premium` o `Pro`
3. Se abre Stripe Checkout
4. Stripe confirma el pago
5. El webhook sincroniza la suscripción
6. El dashboard desbloquea el plan recomendado

### Usuario con plan activo

1. Entra a `/planes`
2. Pulsa `Gestionar suscripción`
3. Se abre Stripe Billing Portal
4. Cambia plan o cancela
5. Stripe envía webhook
6. La app actualiza el acceso automáticamente

## Cómo probar en local

1. Arranca la app:

```bash
npm run dev
```

2. Expón el webhook de Stripe hacia:

```text
http://localhost:3000/api/stripe/webhook
```

3. Carga en `.env` tus llaves de prueba y `Price IDs` de test.

4. Ve a:

```text
http://127.0.0.1:3000/planes
```

## Verificación funcional

Cuando todo esté bien conectado, valida esto:

- un usuario Base puede abrir checkout
- al pagar Premium queda desbloqueado el plan recomendado
- al pagar Pro se mantiene acceso premium y cambia el acompañamiento
- al cancelar, la app marca `cancelAtPeriodEnd`
- al expirar o cancelarse la suscripción, el usuario vuelve a `Base`

## Notas importantes

- Si Stripe no está configurado, la app cae en modo local para pruebas y permite cambio manual de plan.
- En producción no conviene usar ese modo fallback.
- El desbloqueo premium no depende del frontend: depende del estado de facturación sincronizado desde Stripe.
