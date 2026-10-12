---
title: Errors
slug: errors
order: 9
section: Developer docs
---
# Errors

A failed request returns an HTTP status and a body like this:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_FAILED",
    "details": [
      { "field": "amount.value", "message": "must be a positive decimal with at most 4 decimal places" }
    ]
  }
}
```

- `message` explains the problem in plain words.
- `code` is a stable value your code can check. Not every error has one.
- `details` is only on `VALIDATION_FAILED`, with one entry per field.

## Errors by HTTP status

| Status | Meaning |
|---|---|
| 400 | The request was not valid. |
| 401 | The API key is missing, wrong, inactive or expired. See [Authentication](/guides/authentication/). |
| 403 | The key lacks a permission, or your organization is not approved for the provider. |
| 404 | No such payment or bank in your organization. |
| 409 | The payment is not in a state that allows this. |
| 410 | The payment has expired. |
| 502, 504 | The provider failed or timed out. |
| 503 | A provider or the hosted pages cannot be used right now. |

## Error codes

| Code | Status | What happened and what to do |
|---|---|---|
| `VALIDATION_FAILED` | 400 | A field is missing or wrong. Fix the fields listed in `details`. |
| `PROVIDER_NOT_SUPPORTED` | 400 | The `provider` you named does not take payments. Call `GET /api/payments/providers` to see what you can use. |
| `MOCK_BANK_ONLY` | 400 | You sent `mockBank` with a provider other than `mock`. Remove it. |
| `PROVIDER_NOT_APPROVED` | 403 | Your organization has no approval for this provider. See [Providers and going live](/guides/providers-and-going-live/). |
| `PAYMENT_NOT_CANCELLABLE` | 409 | The payment already finished, so it cannot be cancelled. Read it to see its final status. |
| `PAYMENT_NOT_PENDING` | 409 | The payment has already been decided or has finished. Read it to see where it is. |
| `PAYMENT_EXPIRED` | 410 | Returned to the Mock bank page when the customer took too long. Your own calls see the payment as `EXPIRED`. Create a new payment. |
| `PROVIDER_ERROR` | 502, 504 | The provider could not be reached or answered badly. The payment is marked `FAILED`. Create a new one. |
| `PROVIDER_NOT_CONFIGURED` | 503 | The provider cannot be used at the moment. Try again later or contact Syntropi. |
| `HOSTED_PAGES_NOT_CONFIGURED` | 503 | The hosted payment pages are unavailable. Use `API_ONLY`, or try again later. |

Anything else that goes wrong on Syntropi's side returns **500** with the message `Internal Server Error` and no detail. Contact Syntropi if it keeps happening.

## Provider failures are not retried

If a provider fails while a payment is being created, the payment ends as `FAILED` and the call returns the error. Do not retry the same request, because that would create a second payment. Create a new payment instead.
