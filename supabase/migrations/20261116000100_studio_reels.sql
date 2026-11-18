-- P2 — Studio, statuses and Reels (owner feedback, 16 Nov 2026). LOCAL migration: not applied to
-- jefeli-staging until the owner gives the go (docs/STAGING_MIGRATION_PLAN.md).
--
--  1. Reels = permanent public videos. Two flags say where a publication shows: `in_feed` (Accueil
--     « Fil ») and `in_reels` (the Reels feed). Existing public video posts become Reels.
--  2. `set_post_surfaces`: the author chooses the destinations at publication (Studio checkboxes).
--  3. `get_reels`: the pilot ranking, simple and explainable (see the function comment).
--  4. A tunable threshold (`app_config.reel_keep_min_views`, 100) and the notification
--     « Le garder en Reel ? » raised when a well-watched video status expires.
--  5. The status rail orders: yours, unseen first, people you follow, sellers in your city.

-- ---------------------------------------------------------------------------
-- 1. Surfaces
-- ---------------------------------------------------------------------------

alter table public.posts
  add column in_feed boolean not null default true,
  add column in_reels boolean not null default false,
  add constraint posts_has_surface check (in_feed or in_reels);

-- Every public video publication already in the feed is a permanent video: it joins Reels.
update public.posts p set in_reels = true
where p.visibility = 'public' and p.deleted_at is null
  and exists (select 1 from public.post_media pm where pm.post_id = p.id and pm.kind = 'video');

create index posts_reels_idx on public.posts (created_at desc)
  where in_reels and deleted_at is null and moderation_status = 'active' and visibility = 'public';

create or replace function public.set_post_surfaces(p_post_id uuid, p_in_feed boolean, p_in_reels boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  v text;
begin
  if not (coalesce(p_in_feed, true) or coalesce(p_in_reels, false)) then
    raise exception 'no_destination' using errcode = 'P0001';
  end if;
  select visibility into v from public.posts where id = p_post_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception 'post_not_found' using errcode = 'P0001';
  end if;
  if coalesce(p_in_reels, false) then
    -- A Reel is a public, permanent video.
    if v <> 'public' or not exists (select 1 from public.post_media pm where pm.post_id = p_post_id and pm.kind = 'video') then
      raise exception 'not_a_reel' using errcode = 'P0001';
    end if;
  end if;
  update public.posts set in_feed = coalesce(p_in_feed, true), in_reels = coalesce(p_in_reels, false) where id = p_post_id;
end;
$$;
revoke execute on function public.set_post_surfaces(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_post_surfaces(uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. get_reels — pilot ranking: freshness + followed + nearby + has a product.
--    score = 3·followed + 1.5·same city + 1·tagged article + 2·freshness (1 → 0 over 7 days)
--    The reason shown nowhere but kept for support: the strongest signal that applied.
--    `p_start` pins one Reel first (opening a video from the feed or from a status end card).
-- ---------------------------------------------------------------------------

create or replace function public.get_reels(p_limit integer default 8, p_offset integer default 0, p_start uuid default null)
returns table (post_id uuid, score double precision, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select city from public.profiles where id = auth.uid()),
  cand as (
    select po.id, po.created_at,
      exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = po.author_id and f.status = 'accepted') as is_followed,
      (po.city is not null and po.city = (select city from me)) as is_nearby,
      exists (select 1 from public.post_products pp where pp.post_id = po.id) as has_product
    from public.posts po
    where po.in_reels and po.visibility = 'public' and po.deleted_at is null and po.moderation_status = 'active'
      and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = po.author_id)
      and not private.is_blocked_between(auth.uid(), po.author_id)
  )
  select c.id as post_id,
    (case when c.is_followed then 3 else 0 end) + (case when c.is_nearby then 1.5 else 0 end) + (case when c.has_product then 1 else 0 end)
      + 2 * greatest(0, 1 - extract(epoch from (now() - c.created_at)) / 604800.0) as score,
    case when c.is_followed then 'followed' when c.is_nearby then 'nearby' when c.has_product then 'product' else 'fresh' end as reason
  from cand c
  order by (c.id = p_start) desc nulls last, score desc, c.created_at desc
  limit least(greatest(p_limit, 1), 20)
  offset greatest(p_offset, 0);
$$;
revoke execute on function public.get_reels(integer, integer, uuid) from public;
grant execute on function public.get_reels(integer, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Config + « Le garder en Reel ? »
-- ---------------------------------------------------------------------------

create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated; -- read by SECURITY DEFINER jobs only
insert into public.app_config (key, value, description) values
  ('reel_keep_min_views', '100', 'Views a video status needs before its owner is offered « Le garder en Reel ? » when it expires.');

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted',
  'friend_request', 'friend_accepted',
  'post_upvote', 'post_comment', 'comment_reply',
  'message', 'story_reply', 'story_like',
  'offer_received', 'offer_countered', 'offer_accepted', 'offer_rejected', 'offer_withdrawn', 'offer_closed',
  'agreement_completed', 'agreement_canceled', 'agreement_disputed', 'agreement_handover',
  'review_received', 'live_started',
  'moderation_action', 'report_resolved', 'verification_result', 'appeal_result',
  'reel_candidate'
));

-- A video status that expires with enough views is offered to its owner as a Reel. Its file is
-- kept 48 hours so one tap can convert it; after that the normal purge reclaims it. Highlights
-- and the expiry rules are unchanged.
create or replace function public.purge_expired_stories()
returns table (storage_path text, poster_path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  threshold integer := coalesce((select (c.value #>> '{}')::integer from public.app_config c where c.key = 'reel_keep_min_views'), 100);
begin
  insert into public.notifications (recipient_id, type, entity_type, entity_id, data)
  select s.author_id, 'reel_candidate', 'story', s.id, jsonb_build_object('views', v.n, 'story_id', s.id)
  from public.stories s
  cross join lateral (select count(*)::integer as n from public.story_views sv where sv.story_id = s.id) v
  where s.deleted_at is null and s.expires_at < now() and s.media_kind = 'video' and v.n >= threshold
    and not exists (select 1 from public.highlight_items hi where hi.story_id = s.id)
    and not exists (select 1 from public.notifications n where n.type = 'reel_candidate' and n.entity_id = s.id);

  return query
  update public.stories s set deleted_at = now()
  where s.deleted_at is null
    and s.expires_at < now()
    and not exists (select 1 from public.highlight_items hi where hi.story_id = s.id)
    and not exists (
      select 1 from public.notifications n
      where n.type = 'reel_candidate' and n.entity_id = s.id and n.created_at > now() - interval '48 hours'
    )
  returning s.storage_path, s.poster_path;
end;
$$;
revoke execute on function public.purge_expired_stories() from anon, authenticated, public;
grant execute on function public.purge_expired_stories() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Status rail order: yours, unseen first, followed, same city, then newest.
-- ---------------------------------------------------------------------------

create or replace function public.get_story_rail()
returns table (
  author_id uuid,
  latest_at timestamptz,
  story_count integer,
  has_unseen boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.author_id,
         max(s.created_at) as latest_at,
         count(*)::integer as story_count,
         bool_or(not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()
         )) as has_unseen
  from public.stories s
  where s.expires_at > now()
    and s.deleted_at is null
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = s.author_id)
  group by s.author_id
  order by (s.author_id = auth.uid()) desc,
    bool_or(not exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) desc,
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = s.author_id and f.status = 'accepted') desc,
    -- Approximate location only: the same city, never a distance or a position.
    exists (select 1 from public.profiles me join public.profiles au on au.id = s.author_id
            where me.id = auth.uid() and me.city is not null and me.city = au.city) desc,
    max(s.created_at) desc
  limit 50;
$$;
grant execute on function public.get_story_rail() to anon, authenticated;
