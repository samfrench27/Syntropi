# Supabase

- `migrations/`: the schema, applied with `supabase db push` (link the project first with `supabase link`).
- `config.toml`: auth settings (email confirmation, password rules, redirect URLs), applied with `supabase config push`.

## One-time database setup for the API

The API connects as a restricted role created by the first migration, `api_worker`. It has no login by
default. Give it one, with a strong random password, and keep the password out of git:

```sql
alter role api_worker with login password '<generated password>';
```

Connection string (Supabase pooler, **session mode**, which is what Hyperdrive uses):

```
postgresql://api_worker.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

- Local development: put it in `apps/api-worker/.dev.vars` as `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- Deployed: `wrangler hyperdrive create syntropi-db --connection-string="<the string>"`, then put the id in `wrangler.toml`.

Check that the role is restricted: it must not be a superuser or have `bypassrls`, and must not be able to create tables.

## Secrets
Never commit keys. The service-role key and the database passwords live only in gitignored files
(`supabase/.env.local`, `apps/api-worker/.dev.vars`) or Worker secrets.
