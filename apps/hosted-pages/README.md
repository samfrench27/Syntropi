# Syntropi hosted payment pages

The page a customer sees after a merchant creates a payment with `flowType: "HOSTED_PAGES"`. The customer
picks a bank, is sent to it (a real provider's authorisation page, or the Mock bank page for `mock`
payments), and sees the result. It is a **static export** (no server code) for Cloudflare Pages.

## The link

```
${HOSTED_PAGES_URL}/sessions/<paymentId>?token=<payment token>
```

`POST /api/payments` returns this as `redirectUrl`. The token is a short-lived (1 hour) JWT with purpose
`hosted-pages-access`; it only works for the payment id inside it. A `redirect_uri` query parameter may
also be present: the page ignores it. The merchant return URL is fixed when the payment is created and comes
back from the API (`merchant.redirectUri`).

## How the static export handles the id and token

- `/sessions/[paymentId]` cannot be pre-rendered per id, so there is **one page**, `src/app/sessions/page.tsx`,
  exported to `out/sessions/index.html`.
- `public/_redirects` serves it for every id: `/sessions/* /sessions/index.html 200`.
- In `next dev` (which has no `_redirects`) `next.config.mjs` adds a dev-only rewrite `/sessions/:id` to `/sessions`.
- The browser reads the payment id from the last segment of `window.location.pathname`
  (`paymentIdFromPathname` in `src/lib/logic.mjs`) and the token from `?token=`.
- The token is kept in memory and in `sessionStorage` (so a reload still works), never in `localStorage`.
  Right after load the query string is removed from the address bar with `history.replaceState`.
- `public/_headers` sets `Referrer-Policy: no-referrer` (plus `X-Frame-Options: DENY`, `nosniff` and a
  `frame-ancestors 'none'` CSP). These replace the old Next middleware.

## API the page uses

All calls send `Authorization: Bearer <payment token>`. Responses are `{ success, data }`; errors are
`{ success: false, error: { message, code? } }`. The page never shows `error.message` to the customer.

| Call | Used for |
| --- | --- |
| `GET /api/payments/:id/hosted` | Payment details and status on load |
| `GET /api/banks?limit=100&page=n` | The banks this payment's organization is approved for |
| `POST /api/payments/initiate` `{paymentId, bankId}` | Choose the bank and start the provider flow; returns `redirectUrl` (the Mock bank link for `mock` payments). Repeats are idempotent. |
| `GET /api/payments/:id/status` | Polled every 4 s while the bank is processing the payment |
| `POST /api/payments/:id/cancel` | "Cancel payment" |

`redirectUrl` and `merchant.redirectUri` are treated as untrusted: only `http:` and `https:` are followed.

Screens: loading; choose a bank (search, logos with a letter fallback, keyboard accessible); taking you to your
bank; processing; completed; failed; cancelled; expired; link not valid (401/403/404 or no token);
network error with retry; server error with retry. `AUTHORIZING` counts as "choose a bank" because a Mock
payment starts there.

## Develop

```bash
cd apps/hosted-pages
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, default http://127.0.0.1:8787
npm run dev                        # http://localhost:3001
```

Open the `redirectUrl` returned by the API. The Worker only allows CORS from its `HOSTED_PAGES_URL`
(`http://localhost:3001` locally). `NEXT_PUBLIC_USE_MOCK_DATA=true` shows fictional data without an API
(`src/lib/mockData.ts`); there is no silent fallback to mock data otherwise.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Static export to `out/` |
| `npm start` | Serves `out/` on port 3001 like Pages (`_redirects` and `_headers` applied) |
| `npm run check-types` | `tsc --noEmit` |
| `npm test` | Unit tests for the pure helpers and colour contrast (`node --test`, no extra dependencies) |
| `npm run e2e` | Playwright end-to-end flow (below) |

## Tests

`e2e/flow.mjs` creates a real hosted payment through the API (test organization, admin and API key, provider
`mock`), opens the page with its token, picks a Mock bank and asserts the page goes to the Mock bank link the
API returned. It also covers an invalid token, a missing token, a token for another payment, an expired
payment, completed and failed results, cancelling, network error and retry, and an unsafe redirect URL. The
Mock bank app is not needed. It needs the Worker running, with `apps/api-worker/.dev.vars` (never printed),
and the page on `http://localhost:3001` (it starts `next dev` if nothing answers).

```bash
NODE_PATH=<dir containing playwright-core>/node_modules node e2e/flow.mjs
```

`e2e/shots.mjs [outDir]` saves light and dark, desktop and 390 px screenshots of every state.

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `out`, with `NEXT_PUBLIC_API_URL` set to the Worker's public
URL. The Worker's `HOSTED_PAGES_URL` must be the Pages origin (it is used for CORS and for building
`redirectUrl`).
