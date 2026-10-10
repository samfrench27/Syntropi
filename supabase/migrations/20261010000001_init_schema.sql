-- Syntropi platform schema.
--
-- Replaces the MongoDB collections. Design rules:
--   * Every tenant table carries organization_id and its indexes lead with it, so a request for
--     one organization only touches that organization's rows.
--   * Row-level security is ON for every table. Only the `api_worker` role (the API) and, for a
--     couple of own-row reads, `authenticated` get policies. `anon` gets nothing.
--   * API keys are stored hashed. The plaintext is shown once, when the key is created.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type user_role as enum ('superadmin', 'admin', 'user');
create type active_status as enum ('active', 'inactive', 'suspended');
create type org_plan as enum ('free', 'starter', 'growth', 'enterprise');
create type api_environment as enum ('sandbox', 'production');
create type provider_status as enum ('active', 'maintenance', 'inactive');
create type provider_access_status as enum ('pending', 'approved', 'rejected', 'revoked');
create type payment_status as enum (
  'PENDING', 'AUTHORIZING', 'AUTHORIZED', 'SUBMITTED', 'ACCEPTED',
  'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
);
create type payment_flow_type as enum ('API_ONLY', 'HOSTED_PAGES', 'EMBEDDED_HOSTED_PAGES');
create type subscription_plan as enum ('starter', 'growth', 'enterprise');
create type subscription_status as enum ('active', 'inactive', 'canceled', 'past_due', 'unpaid', 'incomplete');

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Providers (catalogue of downstream payment providers)
-- ---------------------------------------------------------------------------
create table providers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_-]+$'),
  name        text not null,
  description text not null default '',
  logo_url    text,
  api_spec    jsonb not null default '{}'::jsonb,   -- { baseUrl, version, documentation }
  features    text[] not null default '{}',
  status      provider_status not null default 'active',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger providers_updated_at before update on providers for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  owner_id           uuid,                          -- FK to profiles added below (circular)
  plan               org_plan not null default 'free',
  status             active_status not null default 'active',
  contact_email      text not null,
  billing_email      text,
  stripe_customer_id text unique,
  address            jsonb,
  rate_limit         integer not null default 100 check (rate_limit > 0),
  webhook_url        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger organizations_updated_at before update on organizations for each row execute function set_updated_at();
create index organizations_name_trgm on organizations using gin (name extensions.gin_trgm_ops);

-- One row per sign-in identity. The id is the Supabase Auth user id (the JWT `sub`).
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  first_name      text not null,
  last_name       text not null,
  role            user_role not null default 'user',
  organization_id uuid not null references organizations (id) on delete restrict,
  status          active_status not null default 'active',
  is_verified     boolean not null default false,
  created_by      uuid references profiles (id) on delete set null,
  last_login      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index profiles_email_key on profiles (lower(email));
create index profiles_org_idx on profiles (organization_id, created_at desc);
create index profiles_search_trgm on profiles using gin ((first_name || ' ' || last_name || ' ' || email) extensions.gin_trgm_ops);
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();

alter table organizations
  add constraint organizations_owner_fk foreign key (owner_id) references profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- API keys (stored hashed)
-- ---------------------------------------------------------------------------
create table api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  key_hash        text not null unique,            -- sha-256 of the key, hex
  key_prefix      text not null,                   -- first characters, safe to show in the UI
  environment     api_environment not null default 'sandbox',
  permissions     text[] not null default '{}',
  created_by      uuid not null references profiles (id) on delete restrict,
  last_used       timestamptz,
  is_active       boolean not null default true,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index api_keys_org_idx on api_keys (organization_id, created_at desc);
create trigger api_keys_updated_at before update on api_keys for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
create table activities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles (id) on delete set null,
  organization_id uuid not null references organizations (id) on delete cascade,
  action          text not null,
  details         jsonb not null default '{}'::jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);
create index activities_org_idx on activities (organization_id, created_at desc);
create index activities_user_idx on activities (user_id, created_at desc);
create index activities_action_idx on activities (organization_id, action, created_at desc);

-- ---------------------------------------------------------------------------
-- Banks and the provider each bank can be reached through
-- ---------------------------------------------------------------------------
create table banks (
  id                       uuid primary key default gen_random_uuid(),
  syntropi_id              text not null unique,   -- friendly id, e.g. gb-monzo
  name                     text not null,
  display_name             text,
  logo_url                 text,
  country                  char(2) not null check (country = upper(country)),
  supported_payment_methods text[] not null default '{}',
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index banks_country_idx on banks (country) where active;
create index banks_name_trgm on banks using gin (name extensions.gin_trgm_ops);
create trigger banks_updated_at before update on banks for each row execute function set_updated_at();

-- Replaces the Mongo Map `providerMappings`.
create table bank_provider_mappings (
  bank_id                   uuid not null references banks (id) on delete cascade,
  provider_code             text not null references providers (code) on update cascade on delete cascade,
  provider_id               text not null,         -- the bank's id in the provider's system
  supported_payment_methods text[] not null default '{}',
  active                    boolean not null default true,
  last_updated              timestamptz not null default now(),
  metadata                  jsonb not null default '{}'::jsonb,
  primary key (bank_id, provider_code)
);
create index bank_mappings_provider_idx on bank_provider_mappings (provider_code, provider_id);
create index bank_mappings_stale_idx on bank_provider_mappings (provider_code, last_updated);

-- ---------------------------------------------------------------------------
-- Which organizations may use which real provider (the approval queue). `mock` needs no row.
-- ---------------------------------------------------------------------------
create table provider_access (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  provider_code   text not null references providers (code) on update cascade on delete cascade,
  status          provider_access_status not null default 'pending',
  requested_by    uuid references profiles (id) on delete set null,
  request_note    text,
  reviewed_by     uuid references profiles (id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider_code),
  check (provider_code <> 'mock')
);
create index provider_access_queue_idx on provider_access (status, created_at desc);
create trigger provider_access_updated_at before update on provider_access for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table payments (
  id                   uuid primary key default gen_random_uuid(),
  payment_id           text not null unique,        -- public id, e.g. pay_abc123
  organization_id      uuid not null references organizations (id) on delete restrict,
  client_id            text not null,
  from_account         jsonb,
  to_account           jsonb not null,
  amount_value         numeric(20, 4) not null check (amount_value > 0),
  currency             char(3) not null default 'GBP',
  reference            text,
  end_to_end_id        text,
  flow_type            payment_flow_type not null default 'API_ONLY',
  redirect_url         text,
  status               payment_status not null default 'PENDING',
  provider_code        text not null references providers (code) on update cascade,
  bank_id              text,
  provider_payment_id  text,                        -- the provider's id; the webhook looks payments up by this
  provider_redirect_url text,
  provider_data        jsonb not null default '{}'::jsonb,
  expires_at           timestamptz,
  completed_at         timestamptz,
  error_code           text,
  error_message        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index payments_org_status_idx on payments (organization_id, status, created_at desc);
create index payments_org_created_idx on payments (organization_id, created_at desc);
create index payments_org_client_idx on payments (organization_id, client_id, created_at desc);
create index payments_provider_status_idx on payments (provider_code, status);
create index payments_provider_payment_idx on payments (provider_code, provider_payment_id) where provider_payment_id is not null;
create index payments_expiry_idx on payments (expires_at) where status in ('PENDING', 'AUTHORIZING', 'AUTHORIZED');
create trigger payments_updated_at before update on payments for each row execute function set_updated_at();

create table payment_status_history (
  id          bigint generated always as identity primary key,
  payment_id  uuid not null references payments (id) on delete cascade,
  status      payment_status not null,
  provider_code text,
  details     text,
  created_at  timestamptz not null default now()
);
create index payment_status_history_idx on payment_status_history (payment_id, created_at);

-- The first history entry is written when the payment is created.
create function payments_initial_history() returns trigger
language plpgsql as $$
begin
  insert into payment_status_history (payment_id, status, provider_code, details)
  values (new.id, new.status, new.provider_code, 'Payment created');
  return new;
end;
$$;
create trigger payments_initial_history after insert on payments for each row execute function payments_initial_history();

-- Change a payment's status and record it in one transaction. Replaces Payment.updateStatus.
create function payment_set_status(p_payment uuid, p_status payment_status, p_details text default null)
returns payments
language plpgsql as $$
declare
  result payments;
begin
  update payments
     set status = p_status,
         completed_at = case when p_status = 'COMPLETED' then now() else completed_at end
   where id = p_payment
   returning * into result;

  if not found then
    raise exception 'payment % not found', p_payment using errcode = 'P0002';
  end if;

  insert into payment_status_history (payment_id, status, provider_code, details)
  values (p_payment, p_status, result.provider_code, coalesce(p_details, 'Status updated to ' || p_status));

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Billing and subscriptions
-- ---------------------------------------------------------------------------
create table billing_usage (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  month               text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  year                integer not null,
  payments            integer not null default 0,
  api_calls           integer not null default 0,
  successful_payments integer not null default 0,
  failed_payments     integer not null default 0,
  payment_fees        numeric(14, 4) not null default 0,
  api_call_fees       numeric(14, 4) not null default 0,
  subscription_fee    numeric(14, 4) not null default 0,
  total_fees          numeric(14, 4) not null default 0,
  payments_limit      integer not null default 100,
  api_calls_limit     integer not null default 1000,
  users_limit         integer not null default 5,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, month)
);
create index billing_usage_year_idx on billing_usage (organization_id, year);
create trigger billing_usage_updated_at before update on billing_usage for each row execute function set_updated_at();

-- Atomic counters: concurrent requests add up instead of overwriting each other.
create function billing_increment(
  p_org uuid, p_month text,
  p_payments integer default 0, p_api_calls integer default 0,
  p_successful integer default 0, p_failed integer default 0
) returns billing_usage
language sql as $$
  insert into billing_usage as b (organization_id, month, year, payments, api_calls, successful_payments, failed_payments)
  values (p_org, p_month, split_part(p_month, '-', 1)::integer, p_payments, p_api_calls, p_successful, p_failed)
  on conflict (organization_id, month) do update
    set payments = b.payments + excluded.payments,
        api_calls = b.api_calls + excluded.api_calls,
        successful_payments = b.successful_payments + excluded.successful_payments,
        failed_payments = b.failed_payments + excluded.failed_payments
  returning *;
$$;

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null unique references organizations (id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id        text not null,
  stripe_product_id      text not null,
  plan                   subscription_plan not null,
  status                 subscription_status not null default 'inactive',
  current_period_start   timestamptz not null,
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  trial_start            timestamptz,
  trial_end              timestamptz,
  metadata               jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index subscriptions_customer_idx on subscriptions (stripe_customer_id);
create index subscriptions_status_idx on subscriptions (status);
create trigger subscriptions_updated_at before update on subscriptions for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Security: row-level security everywhere, deny by default
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- The API connects as api_worker. It is a plain role: no BYPASSRLS, no superuser.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'api_worker') then
    create role api_worker nologin;
  end if;
end $$;

grant usage on schema public to api_worker;
grant select, insert, update, delete on all tables in schema public to api_worker;
grant usage, select on all sequences in schema public to api_worker;
grant execute on all functions in schema public to api_worker;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('create policy api_worker_all on public.%I for all to api_worker using (true) with check (true)', t);
  end loop;
end $$;

-- Direct access with a user's own token (the dashboard never does this today): own rows only.
create policy profiles_read_own on profiles for select to authenticated using (id = auth.uid());

-- A subquery on profiles inside an organizations policy would recurse through RLS,
-- so the user's organization is read through a security-definer function.
create function current_user_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;
revoke all on function current_user_org() from public;
grant execute on function current_user_org() to authenticated;
create policy organizations_read_own on organizations for select to authenticated using (id = current_user_org());
