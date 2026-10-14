---
title: Get started
slug: get-started
order: 2
section: Developer docs
---
# Get started

You will create an API key, make a payment on the Mock bank, approve it, and read the result. It takes about five minutes and moves no money.

## 1. Create an account and an API key

1. Sign up at [dashboard.syntropi.co.uk](https://dashboard.syntropi.co.uk/signup/) and confirm your email.
2. Open **API keys** and create a key with the `read` and `write` permissions.
3. Copy the key now. It is shown once and Syntropi stores only a hash of it.

Keep the key on your server. Never put it in a web page or a mobile app.

## 2. Create a payment

```bash
curl -X POST https://api.syntropi.co.uk/api/payments \
  -H "x-api-key: $SYNTROPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toAccount": { "accountName": "Acme Coffee Roasters Ltd", "sortCode": "04-00-04", "accountNumber": "12345678" },
    "amount": { "value": "12.50", "currency": "GBP" },
    "reference": "Order 1001",
    "redirectUrl": "https://example.com/thanks"
  }'
```

The response has a `paymentId` and a `redirectUrl`:

```json
{
  "success": true,
  "data": {
    "paymentId": "pay_b969ae6ad9ebdd5406badb515614",
    "status": "AUTHORIZING",
    "isoStatus": { "code": "PDNG", "name": "Pending" },
    "redirectUrl": "https://bank.syntropi.co.uk/pay/pay_b969...?token=...",
    "provider": "mock",
    "amount": { "value": "12.50", "currency": "GBP" }
  }
}
```

## 3. Approve it on the Mock bank

Open the `redirectUrl` in a browser. The Mock bank page shows test login details already filled in. Log in, then choose **Approve payment**.

## 4. Read the result

```bash
curl https://api.syntropi.co.uk/api/payments/pay_b969ae6ad9ebdd5406badb515614 \
  -H "x-api-key: $SYNTROPI_API_KEY"
```

The payment is now `COMPLETED` (ISO `ACSC`) and `statusHistory` lists every step it took.

## Use Postman instead

Import the [Syntropi payments collection](/syntropi-payments.postman_collection.json), set the `apiKey` variable, and run the requests in order.

## Next

- [Making a payment](/guides/making-a-payment/): every field and the three flows.
- [Testing with the Mock bank](/guides/testing-with-the-mock-bank/): make a payment take time, fail, or be rejected.
