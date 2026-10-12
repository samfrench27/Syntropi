# Payment statuses

Every payment has two statuses in API responses:

- `status`: Syntropi's own status (unchanged, what integrations use today).
- `isoStatus`: the ISO 20022 payment status (`ExternalPaymentTransactionStatus1Code`, as in pain.002 and pacs.002), with a reason code where ISO gives one.

Each ISO status maps to exactly one Syntropi status. The mapping lives in one place,
`apps/api-worker/src/services/isoStatus.ts`, and the Syntropi status is always derived from the ISO status, so the two cannot disagree.

```json
"status": "FAILED",
"isoStatus": {
  "code": "RJCT",
  "name": "Rejected",
  "description": "The payment was rejected, did not complete, or timed out.",
  "reason": { "code": "AM04", "name": "InsufficientFunds" }
}
```

`isoStatus` is returned on create, `GET /api/payments/:id`, the list, and on every entry of `statusHistory`. `reason` appears only on `RJCT` and `CANC`.

## ISO status to Syntropi status

| ISO code | ISO name | Syntropi `status` |
|---|---|---|
| `RCVD` | Received | `PENDING` |
| `PDNG` | Pending | `AUTHORIZING` |
| `ACTC` | AcceptedTechnicalValidation | `AUTHORIZED` |
| `ACCP` | AcceptedCustomerProfile | `SUBMITTED` |
| `ACSP` | AcceptedSettlementInProcess | `ACCEPTED` |
| `ACSC` | AcceptedSettlementCompleted | `COMPLETED` |
| `RJCT`, any reason except `NOAS` | Rejected | `FAILED` |
| `RJCT` with `NOAS` | Rejected, no answer from customer | `EXPIRED` |
| `CANC` | Cancelled | `CANCELLED` |

ISO has no "expired" status, so a payment that was never answered is reported as `RJCT` with reason `NOAS`.
Provider codes `ACWC` and `ACWP` are treated as `ACSP`, `ACFC` as `ACCP`, and `ACIS` as `ACSC`. An unknown code never moves a payment to a final status.

Reason codes in use: `AM04` InsufficientFunds, `AC04` ClosedAccountNumber, `CUST` RequestedByCustomer, `NOAS` NoAnswerFromCustomer, `NARR` Narrative (any other reason).

## Rules

- A live payment only moves forward: `RCVD` < `PDNG` < `ACTC` < `ACCP` < `ACSP`. A late or repeated message cannot move it back.
- `ACSC`, `RJCT` and `CANC` are final. Nothing changes a final payment.
- Completed and failed payments are counted once for billing, when they reach a final status.

## Token.io

| Token.io status | ISO | Syntropi |
|---|---|---|
| `INITIATION_PENDING*`, `PENDING_AUTHENTICATION` | `PDNG` | `AUTHORIZING` |
| `INITIATION_PENDING_REDEMPTION*`, `PENDING_SUBMISSION` | `ACTC` | `AUTHORIZED` |
| `INITIATION_PROCESSING`, `SUBMITTED` | `ACCP` | `SUBMITTED` |
| `SETTLEMENT_IN_PROGRESS`, `INITIATION_COMPLETED`, `ACCEPTED` | `ACSP` | `ACCEPTED` |
| `SETTLEMENT_COMPLETED`, `COMPLETED` | `ACSC` | `COMPLETED` |
| `INITIATION_REJECTED_INSUFFICIENT_FUNDS` | `RJCT` / `AM04` | `FAILED` |
| `INITIATION_REJECTED`, `INITIATION_FAILED`, `SETTLEMENT_INCOMPLETE`, `FAILED` | `RJCT` / `NARR` | `FAILED` |
| `INITIATION_DECLINED`, `CANCELLED` | `CANC` / `CUST` | `CANCELLED` |
| `INITIATION_EXPIRED`, `EXPIRED` | `RJCT` / `NOAS` | `EXPIRED` |

Changed from before: `SETTLEMENT_IN_PROGRESS` is now `ACCEPTED` (was `SUBMITTED`) and `INITIATION_EXPIRED` is now `EXPIRED` (was `CANCELLED`).

## Mock bank scenarios

On the Mock bank, approving does not have to complete the payment at once. Choose how it moves, on the Mock bank page ("Simulate how the payment moves") or when creating the payment:

```json
POST /api/payments
{ "...": "...", "mockBank": { "preset": "realistic", "rejectReason": "AM04" } }
```

| Scenario | Moves through |
|---|---|
| `instant` (default) | `ACSC` straight away |
| `realistic` | `ACTC` now, `ACCP` after 5s, `ACSP` after 15s, `ACSC` after 60s |
| `slow` | `ACTC` now, `ACCP` after 30s, `ACSP` after 2 minutes, `ACSC` after 10 minutes |
| `completeAfterSeconds: N` (1 to 3600) | `ACTC` now, `ACCP` at 10% of N, `ACSP` at 40% of N, `ACSC` at N (very short values skip middle steps) |

`rejectReason` (`CUST`, `AM04`, `AC04`, `NARR`) sets the reason if the payment is rejected. `mockBank` is only accepted for the `mock` provider (400 `MOCK_BANK_ONLY` otherwise). A scenario given on the Mock bank page wins over the one given at creation.

After approval the customer is sent back to the merchant straight away, with the status at that moment in the `status` query parameter (for example `AUTHORIZED`). Later steps appear as they fall due: when the payment is next read, and once a minute otherwise. Each step is written to `statusHistory`. Cancelling stops the remaining steps.
