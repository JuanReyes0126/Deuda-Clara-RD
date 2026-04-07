# Billing AZUL

Esta version usa una capa abstracta de billing con AZUL como proveedor principal para Republica Dominicana.

## Flujo actual

1. El usuario inicia checkout desde `/api/billing/checkout` con `membershipTier` y `billingInterval`.
2. El backend crea un `BillingPayment` en estado `PENDING`.
3. `AzulBillingProvider` genera los campos de Payment Page y el `AuthHash`.
4. El cliente hace `POST` del formulario a AZUL. La app no toca ni guarda datos de tarjeta.
5. AZUL retorna a:
   - `/api/billing/azul/approved`
   - `/api/billing/azul/declined`
   - `/api/billing/azul/cancelled`
6. Si la respuesta aprobada valida orden, monto y firma, se activa la membresia `Premium` o `Pro`.

## Variables

```env
BILLING_PROVIDER=AZUL
AZUL_PAYMENT_URL=https://pagos.azul.com.do/PaymentPage
AZUL_MERCHANT_ID=
AZUL_MERCHANT_NAME=Deuda Clara RD
AZUL_MERCHANT_TYPE=ECommerce
AZUL_AUTH_KEY=
AZUL_CURRENCY_CODE=USD
```

## Preparado para fase 2

El modelo ya tiene campos genericos para no amarrar el dominio a un proveedor:

- `billingInterval`
- `externalPaymentProvider`
- `externalCustomerId`
- `externalSubscriptionId`
- `externalPriceCode`
- `BillingPayment`
- `BillingProviderEvent`

La fase 2 debe conectar tokenizacion/boveda de datos y recurrencia automatica con AZUL usando `externalCustomerId` y `externalSubscriptionId`.
