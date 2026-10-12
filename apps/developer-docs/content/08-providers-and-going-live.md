---
title: Providers and going live
slug: providers-and-going-live
order: 8
section: Developer docs
---
# Providers and going live

A provider is a company that connects Syntropi to real banks, such as Token.io. Every account starts on the Mock bank only. A real provider has to be approved for your organization by a Syntropi administrator first.

## Ask for access

1. In the dashboard open **Providers**.
2. Choose **Request access** on the provider, and say what you will use it for.
3. A Syntropi administrator reviews the request in the approval queue and approves or rejects it. The Providers page shows the status: not requested, pending, approved or rejected.

Only an organization admin can ask for access.

## What changes when you are approved

- `GET /api/payments/providers` lists the provider.
- You can set `"provider": "token"` when you create a payment.
- `GET /api/banks` includes that provider's banks. Before approval, only the Mock bank's banks are listed.
- Each payment still uses one provider. A payment on the Mock bank never offers real banks to the customer, even when your organization is approved for a real provider.

## Before approval

Using a provider you are not approved for returns **403** with the code `PROVIDER_NOT_APPROVED`, before anything is sent to the provider.

```json
{
  "success": false,
  "error": {
    "message": "Your organization is not approved to use token. Request access from the Providers page.",
    "code": "PROVIDER_NOT_APPROVED"
  }
}
```

## If approval is withdrawn

Syntropi can revoke access. New payments with that provider then return `PROVIDER_NOT_APPROVED`, and refreshing a payment that was already started with that provider returns the same error.

## Real banks need a real customer

With a real provider the customer is sent to their own bank to approve. Amounts are real. Test with small amounts and your own account first.
