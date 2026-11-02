-- Jëfëli — foundation: extensions, private helpers, identity, settings, staff roles,
-- feature flags, rate limiting, audit log.
--
-- Conventions
--   * Every table in `public` has RLS enabled and explicit, minimal grants.
--   * Helpers used by RLS policies live in schema `private` (not exposed by PostgREST),
--     are SECURITY DEFINER with an empty search_path and fully-qualified names.
--   * Errors raised to clients use short machine keys in the message (e.g. 'rate_limited')
--     which the apps translate to French copy.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- Lower-case, accent-free text for search ("Thiès" -> "thies"). Immutable because the
-- dictionary is pinned explicitly.
create or replace function private.normalize_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;
grant execute on function private.normalize_text(text) to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff roles (admin / moderator). Never writable by clients.
-- ---------------------------------------------------------------------------

create table public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'admin');
$$;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create policy staff_roles_select on public.staff_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

revoke all on public.staff_roles from anon, authenticated;
grant select on public.staff_roles to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: the public social identity. Private contact data (email/phone) stays in
-- auth.users and is never copied here.
-- ---------------------------------------------------------------------------

create type public.verification_level as enum ('none', 'merchant_verified');
create type public.account_status as enum ('active', 'suspended');
create type public.moderation_state as enum ('active', 'hidden', 'removed');

create table public.reserved_handles (handle text primary key);
alter table public.reserved_handles enable row level security;
revoke all on public.reserved_handles from anon, authenticated;
insert into public.reserved_handles (handle) values
  ('admin'), ('administrateur'), ('jefeli'), ('jefeli_officiel'), ('support'), ('aide'),
  ('moderation'), ('moderateur'), ('staff'), ('equipe'), ('api'), ('www'), ('app'),
  ('root'), ('system'), ('systeme'), ('securite'), ('security'), ('help'), ('contact'),
  ('p'), ('u'), ('post'), ('live'), ('explorer'), ('messages'), ('profil'), ('settings'),
  ('login'), ('signup'), ('auth'), ('legal'), ('cgu'), ('confidentialite'), ('null'), ('undefined');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z0-9_.]{3,30}$' and handle !~ '^[._]' and handle !~ '[.]$' and handle !~ '[.]{2}'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_path text,
  cover_path text,
  city text check (city is null or char_length(city) between 1 and 60),
  neighborhood text check (neighborhood is null or char_length(neighborhood) between 1 and 60),
  interests text[] not null default '{}' check (cardinality(interests) <= 20),
  is_private boolean not null default false,
  is_merchant boolean not null default false,
  verification_level public.verification_level not null default 'none',
  status public.account_status not null default 'active',
  is_demo boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  friends_count integer not null default 0,
  posts_count integer not null default 0,
  products_count integer not null default 0,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  onboarded_at timestamptz,
  adult_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (avatar_path is null or avatar_path like id::text || '/%'),
  check (cover_path is null or cover_path like id::text || '/%')
);
alter table public.profiles enable row level security;

create index profiles_handle_trgm on public.profiles using gin (handle extensions.gin_trgm_ops);
create index profiles_name_trgm on public.profiles
  using gin (private.normalize_text(display_name) extensions.gin_trgm_ops);
create index profiles_city_idx on public.profiles (city);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.check_profile_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.handle := lower(new.handle);
  if exists (select 1 from public.reserved_handles r where r.handle = new.handle)
     and not exists (select 1 from public.staff_roles s where s.user_id = new.id) then
    raise exception 'handle_reserved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger profiles_handle_check before insert or update of handle on public.profiles
  for each row execute function private.check_profile_handle();

create or replace function private.is_active_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = uid and status = 'active');
$$;
grant execute on function private.is_active_user(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account settings: owner-only private preferences.
-- ---------------------------------------------------------------------------

create table public.account_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  default_status_audience text not null default 'followers'
    check (default_status_audience in ('public', 'followers', 'friends')),
  allow_messages_from text not null default 'everyone'
    check (allow_messages_from in ('everyone', 'following', 'friends')),
  notify_push boolean not null default true,
  notify_messages boolean not null default true,
  notify_offers boolean not null default true,
  notify_social boolean not null default true,
  notify_live boolean not null default true,
  contacts_discoverable boolean not null default false,
  locale text not null default 'fr' check (locale in ('fr', 'wo', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.account_settings enable row level security;
create trigger account_settings_updated_at before update on public.account_settings
  for each row execute function private.set_updated_at();

create policy account_settings_select_own on public.account_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy account_settings_update_own on public.account_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.account_settings from anon, authenticated;
grant select on public.account_settings to authenticated;
grant update (default_status_audience, allow_messages_from, notify_push, notify_messages,
  notify_offers, notify_social, notify_live, contacts_discoverable, locale)
  on public.account_settings to authenticated;

-- ---------------------------------------------------------------------------
-- New auth user -> profile + settings. Handle is neutral (never derived from the
-- e-mail address, which would leak private contact data); onboarding asks for a real one.
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text;
  candidate text;
  dname text;
  attempts integer := 0;
begin
  dname := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Nouveau membre'), 50);
  wanted := lower(coalesce(new.raw_user_meta_data ->> 'handle', ''));
  if wanted ~ '^[a-z0-9_.]{3,30}$' and wanted !~ '^[._]' and wanted !~ '[.]$' and wanted !~ '[.]{2}'
     and not exists (select 1 from public.profiles where handle = wanted)
     and not exists (select 1 from public.reserved_handles where handle = wanted) then
    candidate := wanted;
  else
    loop
      candidate := 'membre' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      exit when not exists (select 1 from public.profiles where handle = candidate) or attempts > 10;
      attempts := attempts + 1;
    end loop;
  end if;

  insert into public.profiles (id, handle, display_name) values (new.id, candidate, dname);
  insert into public.account_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Feature flags: public, non-secret switches. Only admins change them (RPC).
-- ---------------------------------------------------------------------------

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  enabled boolean not null default false,
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.feature_flags enable row level security;
create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);
revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to anon, authenticated;

insert into public.feature_flags (key, enabled, description) values
  ('live_streaming', false, 'Diffusion en direct. Exige un fournisseur vidéo configuré (STREAM_API_KEY/SECRET) et des tests sur appareils réels.'),
  ('phone_auth', false, 'Connexion par SMS (OTP). Exige un fournisseur SMS payant configuré dans Supabase Auth.'),
  ('facebook_login', false, 'Connexion Facebook. Exige une app Meta approuvée et des identifiants OAuth.'),
  ('apple_login', false, 'Connexion Apple. Exige un compte Apple Developer et la configuration OAuth.'),
  ('push_notifications', true, 'Notifications push via Expo. Exige un build de développement et un projectId EAS.'),
  ('voice_messages', true, 'Messages vocaux dans les conversations.'),
  ('contacts_matching', false, 'Retrouver ses contacts (opt-in explicite). Désactivé tant que la politique de confidentialité n''est pas validée.');

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed windows per user/action). Raises 'rate_limited'.
-- ---------------------------------------------------------------------------

create table private.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);

create or replace function private.enforce_rate_limit(p_action text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  secs double precision := extract(epoch from p_window);
  ws timestamptz;
  n integer;
begin
  if uid is null then
    return; -- trusted server context (service role / migrations)
  end if;
  ws := to_timestamp(floor(extract(epoch from now()) / secs) * secs);
  insert into private.rate_limits as r (user_id, action, window_start, hits)
  values (uid, p_action, ws, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if n > p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = p_action;
  end if;
end;
$$;

-- Trigger form: rate_limit_trigger('action', max, 'interval')
create or replace function private.rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::interval);
  return new;
end;
$$;

-- Old windows are useless; keep the table small.
create or replace function private.prune_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rate_limits where window_start < now() - interval '2 days';
$$;

-- ---------------------------------------------------------------------------
-- Append-only audit log for sensitive actions (staff only, through RPC).
-- ---------------------------------------------------------------------------

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function private.audit(p_action text, p_entity_type text, p_entity_id text, p_data jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.audit_events (actor_id, action, entity_type, entity_id, data)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

-- Small server config (e.g. push webhook URL). Never readable by clients.
create table private.config (
  key text primary key,
  value text not null
);
