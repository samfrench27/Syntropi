---
title: Testing with the Mock bank
slug: testing-with-the-mock-bank
order: 7
section: Developer docs
---
# Testing with the Mock bank

The Mock bank is a practice bank. It needs no credentials, moves no money, and every account can use it. Use it to build and test your integration before you ask for a real provider.

## Approve or reject

Create a payment with no `provider` (it defaults to `mock`) and open the `redirectUrl`. The page shows test login details already filled in:

- Customer ID: `demo-customer`
- Passcode: `123456`

Any details work. After logging in the customer sees the payment and chooses **Approve payment** or **Reject**.

## Make a payment take time

Real banks take seconds or minutes to settle. By default the Mock bank completes the payment straight away. Choose how it moves with the **Simulate how the payment moves** panel on the Mock bank page, or set `mockBank` when you create the payment so a test always behaves the same way.

```json
{
  "toAccount": { "accountName": "Acme Coffee Roasters Ltd", "sortCode": "04-00-04", "accountNumber": "12345678" },
  "amount": { "value": "12.50", "currency": "GBP" },
  "redirectUrl": "https://example.com/thanks",
  "mockBank": { "preset": "realistic" }
}
```

| Scenario | Moves through |
|---|---|
| `instant` (default) | `ACSC` straight away |
| `realistic` | `ACTC` now, `ACCP` after 5 seconds, `ACSP` after 15 seconds, `ACSC` after 1 minute |
| `slow` | `ACTC` now, `ACCP` after 30 seconds, `ACSP` after 2 minutes, `ACSC` after 10 minutes |
| `completeAfterSeconds: N` | `ACTC` now, `ACCP` at 10% of N, `ACSP` at 40% of N, `ACSC` at N seconds (1 to 3600). Very short values skip the middle steps. |

The times run from the moment the customer approves. The customer is sent back to your `redirectUrl` straight away, with the status at that moment, for example `AUTHORIZED`. Later steps appear when you next read the payment, so poll it as you would for a real bank.

If the person at the Mock bank page picks a scenario, it wins over the one in your request.

## Make a payment fail

Choose **Reject** on the Mock bank page. The payment becomes `FAILED` with ISO status `RJCT`. Choose the reason with `rejectReason`, or in the **If you reject** list on the page:

| `rejectReason` | ISO reason |
|---|---|
| `CUST` (default) | RequestedByCustomer |
| `AM04` | InsufficientFunds |
| `AC04` | ClosedAccountNumber |
| `NARR` | Narrative (any other reason) |

A payment nobody approves or rejects expires after 24 hours as `EXPIRED` (ISO `RJCT`, reason `NOAS`).

## What a timed payment looks like

```bash
# 1. create it with the realistic scenario, approve it on the Mock bank page, then:
curl https://api.syntropi.co.uk/api/payments/pay_... -H "x-api-key: $SYNTROPI_API_KEY"
```

Read it again over the next minute. `isoStatus.code` goes `ACTC`, `ACCP`, `ACSP`, `ACSC`, and `statusHistory` ends like this:

```json
[
  { "status": "PENDING",     "isoStatus": { "code": "RCVD" } },
  { "status": "AUTHORIZING", "isoStatus": { "code": "PDNG" } },
  { "status": "AUTHORIZED",  "isoStatus": { "code": "ACTC" } },
  { "status": "SUBMITTED",   "isoStatus": { "code": "ACCP" } },
  { "status": "ACCEPTED",    "isoStatus": { "code": "ACSP" } },
  { "status": "COMPLETED",   "isoStatus": { "code": "ACSC" } }
]
```

`mockBank` is only accepted with the `mock` provider. Any other provider returns **400** with the code `MOCK_BANK_ONLY`.
