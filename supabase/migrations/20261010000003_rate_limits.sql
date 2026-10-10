-- Fixed-window rate limiting in Postgres, so it works across Worker instances with no extra service.
create table rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
alter table rate_limits force row level security;
create policy api_worker_all on rate_limits for all to api_worker using (true) with check (true);
grant select, insert, update, delete on rate_limits to api_worker;

-- Count one hit and say whether the caller is still within the limit.
-- Old windows are cleaned up opportunistically.
create function rate_limit_hit(p_key text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  total integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into total;

  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return total <= p_limit;
end;
$$;
grant execute on function rate_limit_hit(text, integer, integer) to api_worker;
