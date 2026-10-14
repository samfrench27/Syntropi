---
title: Payment statuses
slug: payment-statuses
order: 6
section: Developer docs
---
# Payment statuses

Every payment has two statuses in API responses:

- `status`: Syntropi's own status.
- `isoStatus`: the ISO 20022 payment status (`ExternalPaymentTransactionStatus1Code`, as in pain.002 and pacs.002), with a reason code where ISO gives one.

Each ISO status maps to exactly one Syntropi status. Syntropi works out its own status from the ISO status, so the two never disagree.

```json
"status": "FAILED",
"isoStatus": {
  "code": "RJCT",
  "name": "Rejected",
  "description": "The payment was rejected, did not complete, or timed out.",
  "reason": { "code": "AM04", "name": "InsufficientFunds" }
}
```

`isoStatus` is returned on create, `GET /api/payments/{paymentId}`, the list, and on every entry of `statusHistory`. `reason` appears only on `RJCT` and `CANC`.

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

## Token.io statuses

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

