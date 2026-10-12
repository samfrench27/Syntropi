---
title: Welcome
slug: welcome
order: 1
section: Developer docs
---
# Welcome to Syntropi

Syntropi lets you take payments straight from your customer's bank account. You create a payment through one API, send the customer to their bank to approve it, and read the result back from the same API.

## The four pieces

| Piece | What it is | Where |
|---|---|---|
| **API** | Create, read, list, refresh and cancel payments. This is what your backend calls. | `https://api.syntropi.co.uk` |
| **Hosted payment pages** | A Syntropi page where your customer chooses a bank and follows the payment. You send them there instead of building your own. | `https://pay.syntropi.co.uk` |
| **Mock bank** | A practice bank. It needs no credentials and moves no money. Every new account starts with this one only. | `https://bank.syntropi.co.uk` |
| **Dashboard** | Where you create API keys, look at payments and request access to real providers. | `https://dashboard.syntropi.co.uk` |

## How a payment moves

1. Your backend calls `POST /api/payments` with your API key.
2. The response contains one `redirectUrl`. You send the customer there.
3. The customer approves the payment at their bank.
4. Syntropi receives the result and updates the payment.
5. The customer returns to your site. Your backend reads the final status with `GET /api/payments/{paymentId}`.

## Start here

- [Get started](/guides/get-started/): make your first payment in about five minutes.
- [Payment statuses](/guides/payment-statuses/): how Syntropi's statuses line up with ISO 20022.
- [API Reference](/reference/): every endpoint, field and example.

## Practice first, then real banks

A new account can only use the Mock bank. To use a real provider such as Token.io, you ask for access in the dashboard and a Syntropi administrator approves it. See [Providers and going live](/guides/providers-and-going-live/).
