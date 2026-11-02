-- Jëfëli — live commerce. Session rows are created and updated ONLY by trusted server code
-- (Edge Function `live` with the provider secret, and the provider webhook). Clients never
-- set status or viewer counts: a live is shown as "EN DIRECT" only when the provider said so.

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  status text not null default 'created' check (status in ('created', 'live', 'ended')),
  provider text not null default 'stream',
  provider_call_type text not null default 'livestream',
  provider_call_id text not null unique,
  viewer_count integer check (viewer_count is null or viewer_count >= 0),
  peak_viewer_count integer check (peak_viewer_count is null or peak_viewer_count >= 0),
  moderation_status public.moderation_state not null default 'active',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.live_sessions enable row level security;
create index live_sessions_status_idx on public.live_sessions (status, started_at desc);
create index live_sessions_host_idx on public.live_sessions (host_id, created_at desc);
create unique index live_sessions_one_active_per_host on public.live_sessions (host_id) where status in ('created', 'live');
create trigger live_sessions_updated_at before update on public.live_sessions
  for each row execute function private.set_updated_at();

create or replace function private.can_view_live(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.live_sessions l
    where l.id = p_session_id
      and (
        l.host_id = auth.uid()
        or private.is_staff()
        or (l.moderation_status = 'active' and private.can_view_profile_content(auth.uid(), l.host_id))
      )
  );
$$;
grant execute on function private.can_view_live(uuid) to anon, authenticated;

create policy live_sessions_select on public.live_sessions
  for select to anon, authenticated using (private.can_view_live(id));
revoke all on public.live_sessions from anon, authenticated;
grant select on public.live_sessions to anon, authenticated;

create table public.live_pins (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  pinned_at timestamptz not null default now(),
  unpinned_at timestamptz
);
alter table public.live_pins enable row level security;
create index live_pins_session_idx on public.live_pins (live_session_id, pinned_at desc);
create policy live_pins_select on public.live_pins
  for select to anon, authenticated using (private.can_view_live(live_session_id));
revoke all on public.live_pins from anon, authenticated;
grant select on public.live_pins to anon, authenticated;

create table public.live_comments (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  moderation_status public.moderation_state not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.live_comments enable row level security;
create index live_comments_session_idx on public.live_comments (live_session_id, created_at desc);
create trigger live_comments_rate_limit before insert on public.live_comments
  for each row execute function private.rate_limit_trigger('live_comment', '20', '1 minute');

create table public.live_mutes (
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (live_session_id, user_id)
);
alter table public.live_mutes enable row level security;

create or replace function private.live_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.live_sessions;
begin
  select * into l from public.live_sessions where id = new.live_session_id;
  if not found or l.status <> 'live' then
    raise exception 'live_not_active' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(new.author_id, l.host_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.live_mutes m where m.live_session_id = l.id and m.user_id = new.author_id) then
    raise exception 'muted_in_live' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger live_comments_before_insert before insert on public.live_comments
  for each row execute function private.live_comments_before_insert();

create policy live_comments_select on public.live_comments
  for select to anon, authenticated
  using (
    private.can_view_live(live_session_id)
    and not private.is_blocked_between((select auth.uid()), author_id)
    and (moderation_status = 'active' or author_id = (select auth.uid()))
  );
create policy live_comments_insert on public.live_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_active_user((select auth.uid()))
    and private.can_view_live(live_session_id)
  );
revoke all on public.live_comments from anon, authenticated;
grant select on public.live_comments to anon, authenticated;
grant insert (live_session_id, author_id, body) on public.live_comments to authenticated;

create policy live_mutes_select on public.live_mutes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.live_sessions l where l.id = live_session_id and l.host_id = (select auth.uid()))
  );
revoke all on public.live_mutes from anon, authenticated;
grant select on public.live_mutes to authenticated;

-- Host-side moderation and product pinning ---------------------------------------------

create or replace function private.require_host(p_session_id uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  l public.live_sessions;
begin
  select * into l from public.live_sessions where id = p_session_id for update;
  if not found or l.host_id <> uid then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return l;
end;
$$;

create or replace function public.pin_live_product(p_session_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.live_sessions := private.require_host(p_session_id);
begin
  if l.status = 'ended' then
    raise exception 'live_not_active' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and seller_id = l.host_id
                 and status in ('active', 'reserved') and moderation_status = 'active') then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  update public.live_pins set unpinned_at = now() where live_session_id = l.id and unpinned_at is null;
  insert into public.live_pins (live_session_id, product_id) values (l.id, p_product_id);
end;
$$;

create or replace function public.unpin_live_product(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.live_sessions := private.require_host(p_session_id);
begin
  update public.live_pins set unpinned_at = now() where live_session_id = l.id and unpinned_at is null;
end;
$$;

create or replace function public.hide_live_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select live_session_id into sid from public.live_comments where id = p_comment_id;
  perform private.require_host(sid);
  update public.live_comments set moderation_status = 'hidden' where id = p_comment_id;
end;
$$;

create or replace function public.mute_in_live(p_session_id uuid, p_user_id uuid, p_mute boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.live_sessions := private.require_host(p_session_id);
begin
  if p_mute then
    insert into public.live_mutes (live_session_id, user_id) values (l.id, p_user_id) on conflict do nothing;
    update public.live_comments set moderation_status = 'hidden'
    where live_session_id = l.id and author_id = p_user_id;
  else
    delete from public.live_mutes where live_session_id = l.id and user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.pin_live_product(uuid, uuid) from anon, public;
revoke execute on function public.unpin_live_product(uuid) from anon, public;
revoke execute on function public.hide_live_comment(uuid) from anon, public;
revoke execute on function public.mute_in_live(uuid, uuid, boolean) from anon, public;
grant execute on function public.pin_live_product(uuid, uuid) to authenticated;
grant execute on function public.unpin_live_product(uuid) to authenticated;
grant execute on function public.hide_live_comment(uuid) to authenticated;
grant execute on function public.mute_in_live(uuid, uuid, boolean) to authenticated;

-- Server-only state transitions (called by the `live` Edge Function / provider webhook
-- with the service role). Notifies followers once when a session really goes live.
create or replace function public.live_apply_provider_state(
  p_provider_call_id text,
  p_status text,
  p_viewer_count integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.live_sessions;
begin
  select * into l from public.live_sessions where provider_call_id = p_provider_call_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_status not in ('created', 'live', 'ended') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if l.status = 'ended' then
    return; -- terminal
  end if;
  update public.live_sessions set
    status = p_status,
    started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
    ended_at = case when p_status = 'ended' then now() else ended_at end,
    viewer_count = case when p_status = 'ended' then null else coalesce(p_viewer_count, viewer_count) end,
    peak_viewer_count = greatest(coalesce(peak_viewer_count, 0), coalesce(p_viewer_count, 0))
  where id = l.id;

  if p_status = 'live' and l.status <> 'live' then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, data)
    select f.follower_id, l.host_id, 'live_started', 'live_session', l.id, jsonb_build_object('title', l.title)
    from public.follows f
    join public.account_settings s on s.user_id = f.follower_id
    where f.followee_id = l.host_id and f.status = 'accepted' and s.notify_live
      and not private.is_blocked_between(f.follower_id, l.host_id)
    limit 5000;
  end if;
end;
$$;
revoke execute on function public.live_apply_provider_state(text, text, integer) from anon, authenticated, public;
grant execute on function public.live_apply_provider_state(text, text, integer) to service_role;
