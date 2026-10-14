# Syntropi

Open banking payments platform. Merchants create payments through an API; customers pay at their bank.
Every organization starts on a **Mock bank**; real providers (Token.io, ...) are enabled per organization
by a Syntropi admin in the **approval queue**.

## Architecture

| Part | Tech | Where |
|---|---|---|
| `apps/api-worker` | Hono on Cloudflare Workers, Postgres via Hyperdrive | the API |
| `apps/admin-dashboard` | Next.js 15 (client-side) | platform admin, org admin and developer screens |
| `apps/hosted-pages` | Next.js 14, static export | the page customers use to choose their bank |
| `apps/mock-bank` | Next.js 15, static export | the practice bank (dummy login, approve or reject) |
| `supabase/` | Supabase Postgres, Auth | schema migrations (`supabase/migrations`) and auth settings (`config.toml`) |

Identity (signup, sign-in, password reset, sessions) is **Supabase Auth**. Everything else lives in Postgres.
The API verifies Supabase access tokens locally against the project's published keys; roles come from the
token's `app_metadata`, never from user-editable data.

### Security model
- Every table has row-level security, deny by default. The API connects as a restricted `api_worker` role
  (not a superuser, no RLS bypass); the public anon key can read nothing.
- Every tenant table carries `organization_id`. The API scopes every query to the caller's organization;
  only a superadmin crosses organizations.
- API keys are stored hashed and shown once, when created.
- Hosted pages and the Mock bank use short-lived tokens that work for one payment only.
- Real providers are refused unless the organization is approved (`403 PROVIDER_NOT_APPROVED`).
- No secret has a fallback value: the Worker refuses to serve if one is missing.

## Local development

Requirements: Node 20+ for the apps and tests; **Node 22+ for `wrangler`** (the Worker runtime).

```sh
npm install

# API: tests run on an in-memory Postgres (PGlite), so no Docker or database is needed
npm test -w apps/api-worker

# Run the Worker locally against your Supabase project.
# 1. copy the values from apps/api-worker/.dev.vars.example into apps/api-worker/.dev.vars (gitignored)
# 2. create the api_worker login role and connection string (see supabase/README.md)
cd apps/api-worker && npx wrangler dev --config wrangler.dev.toml --port 8787

# First platform admin (there is no public endpoint for this)
npm run bootstrap:superadmin -w apps/api-worker -- --email you@company.com --first Ada --last Lovelace

# Front ends (each reads its own .env.local; see the .env.local.example files)
npm run dev -w apps/admin-dashboard   # http://localhost:3000
npm run dev -w apps/hosted-pages      # http://localhost:3001
npm run dev -w apps/mock-bank         # http://localhost:3002
```

### Database changes
Migrations are plain SQL in `supabase/migrations`, applied with `supabase db push`. The test suite runs
the real migrations, as the restricted role, so a missing grant or policy fails a test.

## Tests
- `apps/api-worker`: unit and integration tests (`npm test -w apps/api-worker`).
- `apps/admin-dashboard/e2e/crawl.mjs`: signs in as each role and visits every page, failing on any page
  error or failed API call.
- `apps/mock-bank/e2e/flow.mjs`, `apps/hosted-pages/e2e/flow.mjs`: drive a real payment end to end.

## Hosting (free to start)
Cloudflare Workers (API), Cloudflare Pages (the three front ends), Supabase (database and auth). See the
plan notes in the pull request for limits and when to upgrade: Supabase free projects pause when idle and
have no backups, so move to a paid plan before real customers use payments.
