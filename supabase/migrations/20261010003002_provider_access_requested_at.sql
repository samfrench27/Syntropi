-- When the organization last asked for access. created_at stays the time of the first request;
-- a re-request after a rejection or revocation moves requested_at so the queue sorts correctly.
alter table provider_access add column requested_at timestamptz not null default now();
update provider_access set requested_at = created_at;
create index provider_access_requested_idx on provider_access (status, requested_at desc);
