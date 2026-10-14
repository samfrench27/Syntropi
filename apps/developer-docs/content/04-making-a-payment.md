---
title: Making a payment
slug: making-a-payment
order: 4
section: Developer docs
---
# Making a payment

`POST /api/payments` creates a payment and tells you where to send the customer. It needs a key with the `write` permission.

## What you send

| Field | Required | Notes |
|---|---|---|
| `toAccount` | yes | Who gets paid. An `accountName`, plus an `iban` or a `sortCode` and `accountNumber`. |
| `amount` | yes | `value` as a decimal string such as `"12.50"` (up to 4 decimal places) and a three-letter `currency`. |
| `reference` | no | Up to 140 characters. Shown on the bank statement. |
| `redirectUrl` | no | Where the customer returns to. An `http` or `https` URL. |
| `flowType` | no | `API_ONLY` (default), `HOSTED_PAGES` or `EMBEDDED_HOSTED_PAGES`. |
| `provider` | no | Defaults to `mock`. Other providers need approval. |
| `bankId` | sometimes | Required for `EMBEDDED_HOSTED_PAGES`. Get ids from `GET /api/banks`. |
| `mockBank` | no | Mock bank only. See [Testing with the Mock bank](/guides/testing-with-the-mock-bank/). |

## The three flows

The response always has one `redirectUrl`. What it points to depends on `flowType`.

### `API_ONLY`

`redirectUrl` is the bank's own page. You choose the bank in your own interface (pass `bankId` for a real provider) and send the customer straight there. For the Mock bank it is the Mock bank page.

### `HOSTED_PAGES`

`redirectUrl` is the Syntropi hosted payment page. The customer chooses their bank there, then goes on to the bank. Nothing is sent to the provider until the customer has chosen. The payment stays `PENDING` until then.

### `EMBEDDED_HOSTED_PAGES`

Like `HOSTED_PAGES`, but you have already chosen the bank, so you must pass `bankId`.

## The response

```json
{
  "success": true,
  "data": {
    "paymentId": "pay_b969ae6ad9ebdd5406badb515614",
    "status": "PENDING",
    "isoStatus": { "code": "RCVD", "name": "Received" },
    "redirectUrl": "https://pay.syntropi.co.uk/sessions/pay_b969...?token=...",
    "provider": "mock",
    "amount": { "value": "25.00", "currency": "GBP" },
    "createdAt": "2026-10-11T05:33:03.049Z",
    "expiresAt": "2026-10-12T05:33:03.032Z"
  }
}
```

The link in `redirectUrl` carries a short-lived token (one hour for the hosted page, thirty minutes for the Mock bank). Send the customer to it straight away, and create a new payment if the link has expired.

A payment that nobody finishes expires 24 hours after it was created.

## The customer returns to you

After the bank, the customer goes back to your `redirectUrl`.

- **Mock bank:** Syntropi adds `paymentId` and `status` to your URL, for example `https://example.com/thanks?paymentId=pay_...&status=COMPLETED`. The status is the one at that moment. With a timed scenario it can be `AUTHORIZED`, with later steps still to come.
- **Hosted pages and real providers:** the customer returns to your URL as you gave it.

Never trust the URL alone. Read the payment with `GET /api/payments/{paymentId}` from your server before you ship the goods. See [Getting the result](/guides/getting-the-result/).
