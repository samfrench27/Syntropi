-- Stripe webhook support.
--   * stripe_events remembers every event id that was applied, so a replayed webhook does nothing.
--   * subscriptions.last_event_at is the Stripe time of the newest event applied, so an event that
--     arrives late (older than what we already have) cannot overwrite newer state.

create table stripe_events (
  id          text primary key,            -- Stripe's event id, e.g. evt_...
  type        text not null,
  received_at timestamptz not null default now()
);
create index stripe_events_received_idx on stripe_events (received_at);

alter table stripe_events enable row level security;
alter table stripe_events force row level security;
create policy api_worker_all on stripe_events for all to api_worker using (true) with check (true);
grant select, insert, update, delete on stripe_events to api_worker;

alter table subscriptions add column last_event_at timestamptz;
