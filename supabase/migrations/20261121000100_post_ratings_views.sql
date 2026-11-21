-- ⭐ « Noter » a publication, 👁 real views (author only), and the profile's « Apprécié » level.
-- Owner decisions (21 Nov 2026, docs/RATING_SYSTEM.md):
--   * ⭐ (1–5) + 🖤 (the existing positive vote, vote_post(…, 1)) replace the ▲/▼ buttons in the UI;
--   * a post's average is public only from 5 ratings (below, « pas encore noté »), never who rated;
--   * views are counted for real (one per member per post) and shown to the author only;
--   * « Apprécié » on a profile = DISTINCT genuine members who rated ≥ 4 or hearted in the last 90 days
--     (tiers 10 / 50 / 200). It never feeds the commerce « Confiance » (reviews of completed deals).
-- Nothing here is writable directly by clients: every write goes through a SECURITY DEFINER RPC.

-- ---------------------------------------------------------------------------
-- ⭐ Ratings
-- ---------------------------------------------------------------------------

create table public.post_ratings (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_ratings enable row level security;
create index post_ratings_user_idx on public.post_ratings (user_id, updated_at desc);

-- Members see only their own rating: nobody can list who rated what.
create policy post_ratings_select_own on public.post_ratings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.post_ratings from anon, authenticated;
grant select on public.post_ratings to authenticated;

alter table public.posts
  add column rating_count integer not null default 0,
  add column rating_avg numeric(2, 1);

-- Public aggregate: genuine raters only (active, onboarded); the average exists from 5 ratings.
create or replace function private.refresh_post_rating(pid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  mean numeric;
begin
  select count(*), avg(r.rating)::numeric into n, mean
  from public.post_ratings r
  join public.profiles pr on pr.id = r.user_id
  where r.post_id = pid and pr.status = 'active' and pr.onboarded_at is not null;
  update public.posts
  set rating_count = n,
      rating_avg = case when n >= 5 then round(mean, 1) end
  where id = pid and deleted_at is null;
end;
$$;
revoke execute on function private.refresh_post_rating(uuid) from public, anon, authenticated;

create or replace function private.post_ratings_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_post_rating(coalesce(new.post_id, old.post_id));
  return null;
end;
$$;
revoke execute on function private.post_ratings_refresh() from public, anon, authenticated;
create trigger post_ratings_refresh after insert or update or delete on public.post_ratings
  for each row execute function private.post_ratings_refresh();

-- Suspension / onboarding changes recount the posts the member rated (rows are untouched).
create or replace function private.profiles_recount_ratings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  for pid in select r.post_id from public.post_ratings r where r.user_id = new.id loop
    perform private.refresh_post_rating(pid);
  end loop;
  return null;
end;
$$;
revoke execute on function private.profiles_recount_ratings() from public, anon, authenticated;
create trigger profiles_recount_ratings after update of status, onboarded_at on public.profiles
  for each row when (old.status is distinct from new.status or old.onboarded_at is distinct from new.onboarded_at)
  execute function private.profiles_recount_ratings();

-- Rate (1–5), change, or withdraw (0). Same visibility rules as reading the post.
create or replace function public.rate_post(p_post_id uuid, p_rating integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  post public.posts;
  previous smallint;
begin
  if p_rating is null or p_rating not between 0 and 5 then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if not private.is_active_user(uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  select * into post from public.posts where id = p_post_id;
  if not found or post.deleted_at is not null or post.moderation_status <> 'active'
     or not private.can_view_post(p_post_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if post.author_id = uid then
    raise exception 'own_post_rating' using errcode = 'P0001';
  end if;

  select r.rating into previous from public.post_ratings r where r.post_id = p_post_id and r.user_id = uid;
  if p_rating = 0 then
    delete from public.post_ratings where post_id = p_post_id and user_id = uid;
  elsif previous is distinct from p_rating::smallint then
    perform private.enforce_rate_limit('rate_post', 200, interval '1 hour');
    insert into public.post_ratings (post_id, user_id, rating) values (p_post_id, uid, p_rating)
    on conflict (post_id, user_id) do update set rating = excluded.rating, updated_at = now()
      where public.post_ratings.rating is distinct from excluded.rating;
  end if;

  return jsonb_build_object(
    'post_id', p_post_id,
    'rating_count', (select rating_count from public.posts where id = p_post_id),
    'rating_avg', (select rating_avg from public.posts where id = p_post_id),
    'my_rating', coalesce((select rating from public.post_ratings where post_id = p_post_id and user_id = uid), 0)
  );
end;
$$;
revoke execute on function public.rate_post(uuid, integer) from anon, public;
grant execute on function public.rate_post(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 👁 Views: one per member per post, counted for real, shown to the author only
-- ---------------------------------------------------------------------------

create table public.post_views (
  post_id uuid not null references public.posts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);
alter table public.post_views enable row level security;
revoke all on public.post_views from anon, authenticated; -- no policy, no grant: RPC only

-- Called by the app once a publication has been on screen for a moment. Never the author's own,
-- never a DÉMO account, silent when the member cannot see the post.
create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  if not private.is_active_user(uid) then
    return;
  end if;
  if exists (select 1 from public.profiles where id = uid and is_demo) then
    return;
  end if;
  if not exists (
    select 1 from public.posts po
    where po.id = p_post_id and po.deleted_at is null and po.moderation_status = 'active' and po.author_id <> uid
  ) or not private.can_view_post(p_post_id) then
    return;
  end if;
  insert into public.post_views (post_id, viewer_id) values (p_post_id, uid) on conflict do nothing;
end;
$$;
revoke execute on function public.record_post_view(uuid) from anon, public;
grant execute on function public.record_post_view(uuid) to authenticated;

-- The author's own view counts (other members' posts are simply not returned).
create or replace function public.my_post_views(p_post_ids uuid[])
returns table (post_id uuid, views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.post_id, count(*)::bigint
  from public.post_views v
  join public.posts po on po.id = v.post_id
  where v.post_id = any (p_post_ids) and po.author_id = (select auth.uid())
  group by v.post_id;
$$;
revoke execute on function public.my_post_views(uuid[]) from anon, public;
grant execute on function public.my_post_views(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- « Apprécié » on the profile: distinct genuine members, last 90 days, tiers 10 / 50 / 200
-- ---------------------------------------------------------------------------

create or replace function public.member_appreciation(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
  tier integer := 0;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user)
     or not private.can_view_profile_content(auth.uid(), p_user) then
    return null;
  end if;
  select count(distinct s.uid) into n
  from (
    select r.user_id as uid, r.post_id from public.post_ratings r
      where r.rating >= 4 and r.updated_at > now() - interval '90 days'
    union all
    select v.user_id, v.post_id from public.post_votes v
      where v.value = 1 and v.updated_at > now() - interval '90 days'
  ) s
  join public.posts po on po.id = s.post_id and po.author_id = p_user
    and po.deleted_at is null and po.moderation_status = 'active'
  join public.profiles pr on pr.id = s.uid
  where s.uid <> p_user
    and pr.status = 'active' and pr.onboarded_at is not null and not pr.is_demo
    and pr.created_at <= now() - interval '14 days'
    and not private.is_blocked_between(p_user, s.uid);
  if n >= 200 then tier := 3; elsif n >= 50 then tier := 2; elsif n >= 10 then tier := 1; end if;
  return jsonb_build_object('tier', tier, 'key', (array['none', 'apprecie', 'tres_apprecie', 'incontournable'])[tier + 1]);
end;
$$;
revoke execute on function public.member_appreciation(uuid) from public;
grant execute on function public.member_appreciation(uuid) to anon, authenticated;
