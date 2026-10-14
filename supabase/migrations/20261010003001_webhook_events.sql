-- Inbound provider webhooks: every event id that was applied is remembered, so a retried
-- delivery does nothing the second time.
create table webhook_events (
  id          bigint generated always as identity primary key,
  provider    text not null,
  event_id    text not null,
  payment_id  uuid references payments (id) on delete set null,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);
create index webhook_events_received_idx on webhook_events (received_at);

alter table webhook_events enable row level security;
alter table webhook_events force row level security;
create policy api_worker_all on webhook_events for all to api_worker using (true) with check (true);
grant select, insert, update, delete on webhook_events to api_worker;
grant usage, select on all sequences in schema public to api_worker;
