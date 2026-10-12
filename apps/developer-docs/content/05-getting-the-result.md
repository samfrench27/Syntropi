---
title: Getting the result
slug: getting-the-result
order: 5
section: Developer docs
---
# Getting the result

A payment finishes some time after the customer approves it, and the time depends on the bank. Read the result from your server.

## Read the payment

```bash
curl https://api.syntropi.co.uk/api/payments/pay_b969ae6ad9ebdd5406badb515614 \
  -H "x-api-key: $SYNTROPI_API_KEY"
```

`GET /api/payments/{paymentId}` returns the current `status`, the ISO 20022 `isoStatus`, and `statusHistory` with every step so far. If the provider has news, the payment is refreshed before it is returned.

A payment is finished when its status is one of:

| Status | ISO | Meaning |
|---|---|---|
| `COMPLETED` | `ACSC` | Paid. |
| `FAILED` | `RJCT` | Rejected or failed. See `error` and `isoStatus.reason`. |
| `CANCELLED` | `CANC` | Cancelled before it finished. |
| `EXPIRED` | `RJCT` with reason `NOAS` | The customer never answered in time. |

Any other status means it is still moving. Ask again later.

## How often to ask

- Read the payment when the customer returns to your site.
- If it is still moving, read it again every few seconds for the first minute, then back off to every minute or so.
- Stop when it reaches a finished status.

## Force a refresh

`POST /api/payments/{paymentId}/sync` asks the provider for the latest status right now. Unlike `GET`, it tells you if the provider could not be reached.

## Webhooks

Syntropi does not send webhooks to merchants yet, so you need to read the payment as described above. Syntropi itself receives webhooks from providers such as Token.io, which is how most payments update without you asking.

## Cancel a payment

`POST /api/payments/{paymentId}/cancel` cancels a payment that has not finished. A finished payment returns **409** with the code `PAYMENT_NOT_CANCELLABLE`.
