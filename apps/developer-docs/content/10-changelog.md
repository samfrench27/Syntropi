---
title: Changelog
slug: changelog
order: 10
section: Developer docs
---
# Changelog

## October 2026

### Added

- **ISO 20022 statuses.** Every payment and every `statusHistory` entry now has an `isoStatus` next to `status`, with a reason on rejections and cancellations. Each ISO status maps to one Syntropi status. See [Payment statuses](/guides/payment-statuses/).
- **Mock bank timing.** `mockBank` on `POST /api/payments`, and a **Simulate** panel on the Mock bank page, make a payment move through `ACTC`, `ACCP`, `ACSP` and `ACSC` over time, or fail with a chosen reason. See [Testing with the Mock bank](/guides/testing-with-the-mock-bank/).
- **Provider approval.** Accounts start on the Mock bank only; real providers need approval.

### Changed

- **One `redirectUrl`.** For `HOSTED_PAGES` payments, `redirectUrl` is now the Syntropi hosted page. The separate `hostedPageUrl` field is gone, and the bank's own link is no longer returned alongside it.
- **Hosted payments wait for the customer.** A `HOSTED_PAGES` payment stays `PENDING` until the customer has chosen a bank, for the Mock bank too.
- **Token.io mapping.** `SETTLEMENT_IN_PROGRESS` is now `ACCEPTED` (it was `SUBMITTED`), and `INITIATION_EXPIRED` is now `EXPIRED` (it was `CANCELLED`).
