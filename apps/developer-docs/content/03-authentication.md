---
title: Authentication
slug: authentication
order: 3
section: Developer docs
---
# Authentication

Every API request carries your API key in the `x-api-key` header.

```bash
curl https://api.syntropi.co.uk/api/payments/providers -H "x-api-key: YOUR_API_KEY"
```

## Permissions

Each key has one or both permissions:

| Permission | Allows |
|---|---|
| `read` | Get, list and refresh payments; list providers and banks. |
| `write` | Create and cancel payments. |

A request the key has no permission for returns **403**.

## Keys

- Create and revoke keys on the **API keys** page of the dashboard.
- A key is shown once, when you create it. Syntropi keeps only a hash, so a lost key cannot be recovered. Create a new one and revoke the old one.
- Keys belong to your organization. Every payment a key creates is visible to all of your organization's keys, and never to another organization.

## Errors

| Status | Message | Meaning |
|---|---|---|
| 401 | `API key required` | No `x-api-key` header. |
| 401 | `Invalid API key` | The key does not exist. |
| 401 | `API key is inactive` or `has expired` | Create a new key. |
| 403 | `API key lacks write permission` | The key needs the `write` permission. |
| 403 | `Organization is not active` | Contact Syntropi. |
