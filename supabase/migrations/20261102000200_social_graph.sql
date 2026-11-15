-- Jëfëli — social graph: follows (with approval for private accounts), mutual friendships,
-- blocks and mutes, plus the visibility helpers every content policy relies on.

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;
create index follows_followee_idx on public.follows (followee_id, status, created_at desc);
create index follows_follower_idx on public.follows (follower_id, status, created_at desc);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'canceled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
alter table public.friend_requests enable row level security;
create unique index friend_requests_one_pending
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';
create index friend_requests_receiver_idx on public.friend_requests (receiver_id, status);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friendships enable row level security;
create index friendships_b_idx on public.friendships (user_b);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table public.mutes enable row level security;

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function private.has_blocked(blocker uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select blocker is not null and target is not null and exists (
    select 1 from public.blocks where blocker_id = blocker and blocked_id = target
  );
$$;

create or replace function private.follows_accepted(follower uuid, followee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select follower is not null and exists (
    select 1 from public.follows
    where follower_id = follower and followee_id = followee and status = 'accepted'
  );
$$;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;

-- May `viewer` see the content of `owner` at all (account active, not blocked, privacy)?
create or replace function private.can_view_profile_content(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when owner is null then false
    when viewer is not null and viewer = owner then true
    when private.is_staff() then true
    else exists (
      select 1 from public.profiles p
      where p.id = owner
        and p.status = 'active'
        and not private.is_blocked_between(viewer, owner)
        and (not p.is_private or private.follows_accepted(viewer, owner) or private.are_friends(viewer, owner))
    )
  end;
$$;

-- Audience check for a piece of content ('public' | 'followers' | 'friends').
create or replace function private.audience_allows(viewer uuid, owner uuid, audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when viewer is not null and viewer = owner then true
    when not private.can_view_profile_content(viewer, owner) then false
    when private.is_staff() then true
    when audience = 'public' then true
    when audience = 'followers' then private.follows_accepted(viewer, owner) or private.are_friends(viewer, owner)
    when audience = 'friends' then private.are_friends(viewer, owner)
    else false
  end;
$$;

grant execute on function private.is_blocked_between(uuid, uuid) to anon, authenticated;
grant execute on function private.has_blocked(uuid, uuid) to anon, authenticated;
grant execute on function private.follows_accepted(uuid, uuid) to anon, authenticated;
grant execute on function private.are_friends(uuid, uuid) to anon, authenticated;
grant execute on function private.can_view_profile_content(uuid, uuid) to anon, authenticated;
grant execute on function private.audience_allows(uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles policies (need block helpers)
-- ---------------------------------------------------------------------------

-- Anyone can see active profiles, except people the owner has blocked. Blockers still
-- see the people they blocked (to manage the block list).
create policy profiles_select on public.profiles
  for select to anon, authenticated
  using (
    id = (select auth.uid())
    or (select private.is_staff())
    or (status = 'active' and not private.has_blocked(id, (select auth.uid())))
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- Column-level privileges: verification, status, counters and demo flag are NOT writable.
grant update (handle, display_name, bio, avatar_path, cover_path, city, neighborhood, interests,
  is_private, is_merchant, onboarded_at, adult_confirmed_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create or replace function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_private boolean;
begin
  select is_private into target_private from public.profiles where id = new.followee_id and status = 'active';
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(new.follower_id, new.followee_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if target_private then
    new.status := 'pending';
    new.accepted_at := null;
  else
    new.status := 'accepted';
    new.accepted_at := now();
  end if;
  return new;
end;
$$;
create trigger follows_before_insert before insert on public.follows
  for each row execute function private.follows_before_insert();
create trigger follows_rate_limit before insert on public.follows
  for each row execute function private.rate_limit_trigger('follow', '200', '1 day');

create or replace function private.follows_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    new.accepted_at := now();
  elsif new.status is distinct from old.status then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  new.follower_id := old.follower_id;
  new.followee_id := old.followee_id;
  return new;
end;
$$;
create trigger follows_before_update before update on public.follows
  for each row execute function private.follows_before_update();

create or replace function private.refresh_follow_counts(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set
    followers_count = (select count(*) from public.follows f where f.followee_id = p.id and f.status = 'accepted'),
    following_count = (select count(*) from public.follows f where f.follower_id = p.id and f.status = 'accepted')
  where p.id in (a, b);
$$;

create or replace function private.follows_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_follow_counts(old.follower_id, old.followee_id);
    return old;
  end if;
  perform private.refresh_follow_counts(new.follower_id, new.followee_id);
  return new;
end;
$$;
create trigger follows_after_change after insert or update or delete on public.follows
  for each row execute function private.follows_after_change();

-- Accepted follows are public (subject to blocks); pending requests only to participants.
create policy follows_select on public.follows
  for select to anon, authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
    or (
      status = 'accepted'
      and not private.has_blocked(follower_id, (select auth.uid()))
      and not private.has_blocked(followee_id, (select auth.uid()))
    )
  );

create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and private.is_active_user((select auth.uid())));

-- Only the followee can accept a pending request.
create policy follows_update on public.follows
  for update to authenticated
  using (followee_id = (select auth.uid()))
  with check (followee_id = (select auth.uid()) and status = 'accepted');

-- Follower unfollows, or followee removes a follower / declines a request.
create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

revoke all on public.follows from anon, authenticated;
grant select on public.follows to anon, authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
grant update (status) on public.follows to authenticated;
grant delete on public.follows to authenticated;

-- ---------------------------------------------------------------------------
-- Friendships (mutual). All writes through RPCs below.
-- ---------------------------------------------------------------------------

create policy friend_requests_select on public.friend_requests
  for select to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

create policy friendships_select on public.friendships
  for select to anon, authenticated
  using (
    not private.has_blocked(user_a, (select auth.uid()))
    and not private.has_blocked(user_b, (select auth.uid()))
  );

revoke all on public.friend_requests from anon, authenticated;
revoke all on public.friendships from anon, authenticated;
grant select on public.friend_requests to authenticated;
grant select on public.friendships to anon, authenticated;

create or replace function private.refresh_friend_counts(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set
    friends_count = (select count(*) from public.friendships f where f.user_a = p.id or f.user_b = p.id)
  where p.id in (a, b);
$$;

create or replace function private.friendships_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_friend_counts(old.user_a, old.user_b);
    return old;
  end if;
  perform private.refresh_friend_counts(new.user_a, new.user_b);
  return new;
end;
$$;
create trigger friendships_after_change after insert or delete on public.friendships
  for each row execute function private.friendships_after_change();

create or replace function private.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not private.is_active_user(uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  return uid;
end;
$$;

create or replace function public.send_friend_request(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  incoming uuid;
begin
  if p_target = uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not private.is_active_user(p_target) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(uid, p_target) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if private.are_friends(uid, p_target) then
    return 'already_friends';
  end if;

  -- If they already asked us, sending back means accepting.
  select id into incoming from public.friend_requests
  where sender_id = p_target and receiver_id = uid and status = 'pending'
  for update;
  if incoming is not null then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = incoming;
    insert into public.friendships (user_a, user_b) values (least(uid, p_target), greatest(uid, p_target))
    on conflict do nothing;
    return 'accepted';
  end if;

  perform private.enforce_rate_limit('friend_request', 50, interval '1 day');
  insert into public.friend_requests (sender_id, receiver_id) values (uid, p_target)
  on conflict do nothing;
  return 'pending';
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  req public.friend_requests;
begin
  select * into req from public.friend_requests where id = p_request_id for update;
  if not found or req.receiver_id <> uid then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if req.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_accept then
    if private.is_blocked_between(req.sender_id, uid) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
    update public.friend_requests set status = 'accepted', responded_at = now() where id = req.id;
    insert into public.friendships (user_a, user_b)
    values (least(req.sender_id, uid), greatest(req.sender_id, uid))
    on conflict do nothing;
    return 'accepted';
  end if;
  update public.friend_requests set status = 'declined', responded_at = now() where id = req.id;
  return 'declined';
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  update public.friend_requests set status = 'canceled', responded_at = now()
  where id = p_request_id and sender_id = uid and status = 'pending';
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.remove_friend(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  delete from public.friendships where user_a = least(uid, p_other) and user_b = greatest(uid, p_other);
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocks & mutes
-- ---------------------------------------------------------------------------

-- Blocking severs the relationship in both directions.
create or replace function private.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  update public.friend_requests set status = 'canceled', responded_at = now()
  where status = 'pending'
    and ((sender_id = new.blocker_id and receiver_id = new.blocked_id)
      or (sender_id = new.blocked_id and receiver_id = new.blocker_id));
  return new;
end;
$$;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function private.blocks_after_insert();
create trigger blocks_rate_limit before insert on public.blocks
  for each row execute function private.rate_limit_trigger('block', '100', '1 day');

create policy blocks_select_own on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_insert_own on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

create policy mutes_select_own on public.mutes
  for select to authenticated using (muter_id = (select auth.uid()));
create policy mutes_insert_own on public.mutes
  for insert to authenticated with check (muter_id = (select auth.uid()));
create policy mutes_delete_own on public.mutes
  for delete to authenticated using (muter_id = (select auth.uid()));

revoke all on public.blocks from anon, authenticated;
revoke all on public.mutes from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;
grant select, delete on public.mutes to authenticated;
grant insert (muter_id, muted_id) on public.mutes to authenticated;

-- Relationship summary from the caller's perspective (one round-trip for profile headers).
create or replace function public.relationship_with(p_target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_follow text;
  their_follow text;
  req record;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;
  select status into my_follow from public.follows where follower_id = uid and followee_id = p_target;
  select status into their_follow from public.follows where follower_id = p_target and followee_id = uid;
  select id, sender_id into req from public.friend_requests
  where status = 'pending'
    and ((sender_id = uid and receiver_id = p_target) or (sender_id = p_target and receiver_id = uid))
  limit 1;
  return jsonb_build_object(
    'authenticated', true,
    'is_self', uid = p_target,
    'follow_status', my_follow,
    'follows_me', their_follow = 'accepted',
    'is_friend', private.are_friends(uid, p_target),
    'friend_request_id', req.id,
    'friend_request_direction', case when req.id is null then null when req.sender_id = uid then 'outgoing' else 'incoming' end,
    'blocked', private.has_blocked(uid, p_target),
    'blocked_by', private.has_blocked(p_target, uid),
    'muted', exists (select 1 from public.mutes where muter_id = uid and muted_id = p_target)
  );
end;
$$;

revoke execute on function public.send_friend_request(uuid) from anon, public;
revoke execute on function public.respond_friend_request(uuid, boolean) from anon, public;
revoke execute on function public.cancel_friend_request(uuid) from anon, public;
revoke execute on function public.remove_friend(uuid) from anon, public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.relationship_with(uuid) to anon, authenticated;
