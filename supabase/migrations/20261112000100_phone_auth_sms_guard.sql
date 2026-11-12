-- W1.4 — Phone sign-up/sign-in (+221). Server-side guard and usage log for the Supabase
-- "Send SMS" auth hook (Edge Function `send-sms`). The hook asks `sms_hook_begin` before every
-- SMS and reports the provider result with `sms_hook_finish`. Nothing here sends an SMS.
--
-- Privacy: no OTP and no full phone number are stored. The hook sends a keyed hash (HMAC with
-- an Edge Function secret) of the number and of the IP, plus the operator prefix ('22177').
-- Existing data: new objects only; no existing row or policy changes.

create table private.sms_settings (
  id boolean primary key default true check (id),
  -- Country code + first two national digits. Senegal mobile ranges only to start; add a
  -- country here once delivery to it has been verified with real SIM cards.
  allowed_prefixes text[] not null default array['22170', '22175', '22176', '22177', '22178'],
  per_number_hour integer not null default 3 check (per_number_hour > 0),
  per_number_day integer not null default 6 check (per_number_day > 0),
  per_ip_hour integer not null default 10 check (per_ip_hour > 0),
  daily_budget integer not null default 300 check (daily_budget >= 0),
  -- For monitoring estimates only (F CFA per SMS); billing is the provider's.
  est_cost_xof numeric(8, 2) not null default 20,
  updated_at timestamptz not null default now()
);
insert into private.sms_settings default values;

create table private.sms_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- The auth server's webhook-id: a retried hook call never sends a second SMS.
  hook_id text unique check (hook_id is null or hook_id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  phone_key text not null check (phone_key ~ '^[0-9a-f]{64}$'),
  phone_prefix text not null check (phone_prefix ~ '^[0-9]{3,6}$'),
  ip_key text check (ip_key is null or ip_key ~ '^[0-9a-f]{64}$'),
  -- No foreign key: the auth server calls the hook inside the transaction that creates the
  -- user, so the row is not visible yet. Cleared on account deletion (trigger below).
  user_id uuid,
  outcome text not null check (outcome in ('pending', 'sent', 'blocked', 'failed')),
  reason text check (reason is null or length(reason) <= 120),
  provider text check (provider is null or provider ~ '^[a-z_]{2,20}$'),
  provider_ref text check (provider_ref is null or length(provider_ref) <= 200),
  est_cost_xof numeric(8, 2)
);
create index sms_events_phone_idx on private.sms_events (phone_key, created_at desc);
create index sms_events_ip_idx on private.sms_events (ip_key, created_at desc) where ip_key is not null;
create index sms_events_created_idx on private.sms_events (created_at desc);
alter table private.sms_events enable row level security;
alter table private.sms_settings enable row level security;
revoke all on private.sms_events, private.sms_settings from public, anon, authenticated;

create index sms_events_user_idx on private.sms_events (user_id) where user_id is not null;

create or replace function private.sms_events_forget_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.sms_events set user_id = null where user_id = old.id;
  return old;
end;
$$;
revoke execute on function private.sms_events_forget_user() from public, anon, authenticated;

create trigger on_auth_user_deleted_forget_sms
  after delete on auth.users
  for each row execute function private.sms_events_forget_user();

-- ---------------------------------------------------------------------------
-- Called by the hook (service role) before sending. Returns {allowed, reason, event_id}.
-- ---------------------------------------------------------------------------
create or replace function public.sms_hook_begin(
  p_hook_id text,
  p_phone_key text,
  p_phone_prefix text,
  p_ip_key text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.sms_settings;
  v_reason text;
  v_id bigint;
  prior private.sms_events;
begin
  if p_hook_id !~ '^[A-Za-z0-9_.:-]{1,80}$' or p_phone_key !~ '^[0-9a-f]{64}$' or p_phone_prefix !~ '^[0-9]{3,6}$'
     or (p_ip_key is not null and p_ip_key !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  -- Serialize concurrent requests for the same number so the caps cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('sms:' || p_phone_key, 0));

  -- Retry of the same hook call: never send twice.
  select * into prior from private.sms_events where hook_id = p_hook_id;
  if found then
    if prior.outcome = 'failed' then
      update private.sms_events set outcome = 'pending', reason = null where id = prior.id;
      return jsonb_build_object('allowed', true, 'reason', null, 'event_id', prior.id);
    end if;
    return jsonb_build_object('allowed', false,
      'reason', case when prior.outcome = 'blocked' then prior.reason else 'duplicate' end,
      'event_id', prior.id);
  end if;

  select * into s from private.sms_settings where id;

  if not coalesce((select f.enabled from public.feature_flags f where f.key = 'phone_auth'), false) then
    v_reason := 'disabled';
  elsif not (p_phone_prefix = any (s.allowed_prefixes)) then
    v_reason := 'destination';
  elsif (select count(*) from private.sms_events e
         where e.outcome in ('pending', 'sent') and e.created_at > now() - interval '1 day') >= s.daily_budget then
    v_reason := 'daily_budget';
  elsif (select count(*) from private.sms_events e
         where e.phone_key = p_phone_key and e.outcome in ('pending', 'sent')
           and e.created_at > now() - interval '1 hour') >= s.per_number_hour then
    v_reason := 'number_hour';
  elsif (select count(*) from private.sms_events e
         where e.phone_key = p_phone_key and e.outcome in ('pending', 'sent')
           and e.created_at > now() - interval '1 day') >= s.per_number_day then
    v_reason := 'number_day';
  elsif p_ip_key is not null and (select count(*) from private.sms_events e
         where e.ip_key = p_ip_key and e.outcome in ('pending', 'sent')
           and e.created_at > now() - interval '1 hour') >= s.per_ip_hour then
    v_reason := 'ip_hour';
  end if;

  insert into private.sms_events (hook_id, phone_key, phone_prefix, ip_key, user_id, outcome, reason, est_cost_xof)
  values (p_hook_id, p_phone_key, p_phone_prefix, p_ip_key, p_user_id,
          case when v_reason is null then 'pending' else 'blocked' end,
          v_reason,
          case when v_reason is null then s.est_cost_xof end)
  returning id into v_id;

  -- Retention: 90 days, trimmed opportunistically.
  if random() < 0.02 then
    delete from private.sms_events where created_at < now() - interval '90 days';
  end if;

  return jsonb_build_object('allowed', v_reason is null, 'reason', v_reason, 'event_id', v_id);
end;
$$;
revoke execute on function public.sms_hook_begin(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.sms_hook_begin(text, text, text, text, uuid) to service_role;

-- Called by the hook after the provider answered.
create or replace function public.sms_hook_finish(
  p_event_id bigint,
  p_outcome text,
  p_provider text,
  p_provider_ref text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome not in ('sent', 'failed') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  update private.sms_events
     set outcome = p_outcome,
         provider = p_provider,
         provider_ref = left(p_provider_ref, 200),
         reason = left(p_reason, 120),
         est_cost_xof = case when p_outcome = 'sent' then est_cost_xof end
   where id = p_event_id and outcome = 'pending';
end;
$$;
revoke execute on function public.sms_hook_finish(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sms_hook_finish(bigint, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Monitoring (admins): SMS per day, refusals by reason, operator ranges, cost estimate.
-- ---------------------------------------------------------------------------
create or replace function public.admin_sms_usage(p_days integer default 14)
returns table (
  day date,
  sent bigint,
  failed bigint,
  blocked bigint,
  pending bigint,
  blocked_by_reason jsonb,
  sent_by_prefix jsonb,
  est_cost_xof numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  return query
  with ev as (
    select (e.created_at at time zone 'Africa/Dakar')::date as d, e.*
    from private.sms_events e
    where e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  )
  select ev.d,
         count(*) filter (where ev.outcome = 'sent'),
         count(*) filter (where ev.outcome = 'failed'),
         count(*) filter (where ev.outcome = 'blocked'),
         count(*) filter (where ev.outcome = 'pending'),
         coalesce((select jsonb_object_agg(r.reason, r.n) from (
           select x.reason, count(*) as n from ev x where x.d = ev.d and x.outcome = 'blocked' group by x.reason) r), '{}'::jsonb),
         coalesce((select jsonb_object_agg(p.phone_prefix, p.n) from (
           select x.phone_prefix, count(*) as n from ev x where x.d = ev.d and x.outcome = 'sent' group by x.phone_prefix) p), '{}'::jsonb),
         coalesce(sum(ev.est_cost_xof) filter (where ev.outcome = 'sent'), 0)
  from ev
  group by ev.d
  order by ev.d desc;
end;
$$;
revoke execute on function public.admin_sms_usage(integer) from public, anon;
grant execute on function public.admin_sms_usage(integer) to authenticated;

update public.feature_flags
   set description = 'Connexion et inscription par SMS (+221). Coupe aussi l’envoi côté serveur (hook send-sms).'
 where key = 'phone_auth';
