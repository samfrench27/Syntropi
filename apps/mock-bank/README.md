# Mock bank

The practice bank a customer is sent to when an organization creates a payment with `provider: "mock"`. No real money moves.

## Flow

1. `POST /api/payments` with the `mock` provider returns a link: `${MOCK_BANK_URL}/pay/<paymentId>?token=<jwt>`.
2. The customer sees a dummy login (test details `demo-customer` / `123456` are shown), then the payment request, then **Approve payment** or **Reject**.
3. The page calls the API (`GET /api/mock-bank/payments/:id`, `POST .../decision`) with the token as a bearer credential, then sends the customer to the merchant's `redirectUrl` after 2 seconds (http/https only).

## Hosting (Cloudflare Pages, static)

`next build` exports static files to `out/` (`output: 'export'`, no server code). The payment id is in the path and cannot be pre-rendered, so there is one client page at `/pay` and `public/_redirects` (`/pay/* /pay/index.html 200`) serves it for any id. The page reads the id from the last path segment (or `?paymentId=`), keeps the token in memory only and removes it from the address bar with `history.replaceState`. A refresh therefore needs a fresh link from the merchant. In `next dev` a rewrite (`/pay/:id` to `/pay`) does the same job.

Set `NEXT_PUBLIC_API_URL` at build time (see `.env.local.example`). The API must allow this app's origin (its `MOCK_BANK_URL`) in CORS.

## Scripts

- `npm run dev` on port 3002; `npm run build` then `npm start` (serves `out/` like Pages)
- `npm run check-types`; `npm test` (pure helpers, plain `node --test`)
- `node e2e/flow.mjs`: Playwright run against the local Worker, creating a real payment (needs `NODE_PATH` to a `playwright-core` install; reads `apps/api-worker/.dev.vars`, prints no secrets)
- `node e2e/shots.mjs`: screenshots of every state (light/dark, desktop/390px)
