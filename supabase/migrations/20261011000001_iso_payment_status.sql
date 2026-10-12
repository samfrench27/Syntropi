-- ISO 20022 payment status (pain.002 / pacs.002 ExternalPaymentTransactionStatus1Code) next to Syntropi's own status.
-- The Syntropi `status` column is unchanged; the API derives it from the ISO status through one table.

create type iso_payment_status as enum ('RCVD', 'PDNG', 'ACTC', 'ACCP', 'ACSP', 'ACSC', 'RJCT', 'CANC');

alter table payments
  add column iso_status             iso_payment_status not null default 'RCVD',
  add column iso_reason_code        text,
  -- Mock bank only: steps still to apply, as [{ "at": <iso time>, "iso": "ACSP", "reason": "..." }]
  add column scheduled_transitions  jsonb not null default '[]'::jsonb;

alter table payment_status_history
  add column iso_status      iso_payment_status,
  add column iso_reason_code text;

-- The ISO status a Syntropi status stands for, used for existing rows and whenever a caller gives no ISO status
create function iso_for_status(p_status payment_status, out iso iso_payment_status, out reason text)
language sql immutable as $$
  select case p_status
    when 'PENDING'     then 'RCVD'::iso_payment_status
    when 'AUTHORIZING' then 'PDNG'::iso_payment_status
    when 'AUTHORIZED'  then 'ACTC'::iso_payment_status
    when 'SUBMITTED'   then 'ACCP'::iso_payment_status
    when 'ACCEPTED'    then 'ACSP'::iso_payment_status
    when 'COMPLETED'   then 'ACSC'::iso_payment_status
    when 'CANCELLED'   then 'CANC'::iso_payment_status
    else 'RJCT'::iso_payment_status
  end,
  case p_status
    when 'FAILED'    then 'NARR'
    when 'CANCELLED' then 'CUST'
    when 'EXPIRED'   then 'NOAS'
    else null
  end;
$$;

-- Existing payments and history take the ISO status their Syntropi status stands for
update payments p set (iso_status, iso_reason_code) = (select iso, reason from iso_for_status(p.status));
update payment_status_history h set (iso_status, iso_reason_code) = (select iso, reason from iso_for_status(h.status));
alter table payment_status_history alter column iso_status set not null;

-- Mock bank steps that are due, found by the per-minute job
create index payments_scheduled_idx on payments (id)
  where scheduled_transitions <> '[]'::jsonb and status in ('AUTHORIZING', 'AUTHORIZED', 'SUBMITTED', 'ACCEPTED');

-- First history entry, now with its ISO status
create or replace function payments_initial_history() returns trigger
language plpgsql as $$
begin
  insert into payment_status_history (payment_id, status, provider_code, details, iso_status, iso_reason_code)
  values (new.id, new.status, new.provider_code, 'Payment created', new.iso_status, new.iso_reason_code);
  return new;
end;
$$;

-- Change a payment's status and record it, with its ISO status and reason, in one transaction.
drop function payment_set_status(uuid, payment_status, text);
create function payment_set_status(
  p_payment uuid,
  p_status payment_status,
  p_details text default null,
  p_iso iso_payment_status default null,
  p_iso_reason text default null
)
returns payments
language plpgsql as $$
declare
  result payments;
  v_iso iso_payment_status;
  v_reason text;
begin
  if p_iso is null then
    select iso, reason into v_iso, v_reason from iso_for_status(p_status);
  else
    v_iso := p_iso;
    v_reason := p_iso_reason;
  end if;

  update payments
     set status = p_status,
         iso_status = v_iso,
         iso_reason_code = v_reason,
         completed_at = case when p_status = 'COMPLETED' then now() else completed_at end
   where id = p_payment
   returning * into result;

  if not found then
    raise exception 'payment % not found', p_payment using errcode = 'P0002';
  end if;

  insert into payment_status_history (payment_id, status, provider_code, details, iso_status, iso_reason_code)
  values (p_payment, p_status, result.provider_code, coalesce(p_details, 'Status updated to ' || p_status), v_iso, v_reason);

  return result;
end;
$$;

revoke all on function payment_set_status(uuid, payment_status, text, iso_payment_status, text) from public;
revoke all on function iso_for_status(payment_status) from public;
grant execute on function payment_set_status(uuid, payment_status, text, iso_payment_status, text) to api_worker;
grant execute on function iso_for_status(payment_status) to api_worker;
