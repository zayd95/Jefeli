-- Jëfëli — feed pass review (owner decisions after the engagement pass).
--   1. Votes from suspended accounts stop counting while the account is suspended: they leave
--      the public upvote count and therefore the ranking. The vote rows are kept for audit and
--      count again if the account is reactivated.
--   2. Downvotes personalise the voter's own feed only. They no longer lower a post for anyone
--      else, so coordinated accounts cannot suppress another seller. The global penalty
--      function private.post_vote_penalty is removed.
--   Votes never feed moderation: only reports and the existing safety tools do.

-- ---------------------------------------------------------------------------
-- 1. Counters count only active voters
-- ---------------------------------------------------------------------------

create or replace function private.refresh_post_counters(pid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set
    upvote_count = (select count(*) from public.post_votes v
                    join public.profiles pr on pr.id = v.user_id
                    where v.post_id = pid and v.value = 1 and pr.status = 'active'),
    comment_count = (select count(*) from public.comments c
                     where c.post_id = pid and c.deleted_at is null and c.moderation_status = 'active'),
    save_count = (select count(*) from public.post_saves where post_id = pid)
  where id = pid and deleted_at is null;
$$;

-- Suspension or reactivation recounts the posts the member voted for (rows are untouched).
create or replace function private.profiles_status_recount_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  for pid in select v.post_id from public.post_votes v where v.user_id = new.id and v.value = 1 loop
    perform private.refresh_post_counters(pid);
  end loop;
  return null;
end;
$$;
revoke execute on function private.profiles_status_recount_votes() from public, anon, authenticated;
create trigger profiles_status_recount_votes after update of status on public.profiles
  for each row when (old.status is distinct from new.status)
  execute function private.profiles_status_recount_votes();

-- Bring existing counters in line (accounts may already be suspended).
update public.posts po set upvote_count = (
  select count(*) from public.post_votes v
  join public.profiles pr on pr.id = v.user_id
  where v.post_id = po.id and v.value = 1 and pr.status = 'active'
) where po.deleted_at is null;

-- get_feed (security invoker) now reads the viewer's own votes. Postgres checks table privileges
-- for every relation a query references, so logged-out visitors need SELECT on post_votes for
-- the public feed to load. RLS has no policy for anon, so they read zero rows (same pattern as
-- mutes and story_views in 20261102000900_security_fixes.sql).
grant select on public.post_votes to anon;

-- ---------------------------------------------------------------------------
-- 2. Feed ranking v3: downvotes are personal
-- ---------------------------------------------------------------------------
--
-- for_you score = as in v2 (relationships, locality, interests, upvotes from active members,
-- comments, fair chance for new members, requests awaiting answers, recency, author and type
-- diversity), with the global downvote penalty replaced by the viewer's own feedback:
--   − 4    for a post the viewer voted down (it sinks in the viewer's feed only)
--   − 0.5  per other post of the same author the viewer voted down (max 3 → −1.5)
-- The score is still never returned (always null).

create or replace function public.get_feed(
  p_tab text default 'for_you',
  p_limit integer default 20,
  p_offset integer default 0,
  p_before timestamptz default null
)
returns table (post_id uuid, reason text, score double precision, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select p.id, p.city, p.interests from public.profiles p where p.id = auth.uid()
  ),
  candidates as (
    select
      po.id,
      po.created_at,
      po.author_id,
      po.intent,
      po.kind,
      po.upvote_count,
      po.comment_count,
      (po.author_id = auth.uid()) as is_self,
      exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = po.author_id and f.status = 'accepted') as is_followed,
      exists (select 1 from public.friendships fr where (fr.user_a = auth.uid() and fr.user_b = po.author_id) or (fr.user_b = auth.uid() and fr.user_a = po.author_id)) as is_friend,
      (po.city is not null and po.city = (select city from me)) as is_nearby,
      exists (
        select 1 from public.post_products pp join public.products pr on pr.id = pp.product_id
        where pp.post_id = po.id and pr.category_slug = any (coalesce((select interests from me), '{}'))
      ) as is_interest,
      a.created_at as author_since,
      a.posts_count as author_posts
    from public.posts po
    join public.profiles a on a.id = po.author_id
    where po.deleted_at is null
      and po.moderation_status = 'active'
      and (p_before is null or po.created_at < p_before)
      and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = po.author_id)
      and (
        (p_tab = 'for_you' and po.created_at > now() - interval '45 days')
        or (p_tab = 'following' and (
              po.author_id = auth.uid()
              or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = po.author_id and f.status = 'accepted')
              or exists (select 1 from public.friendships fr where (fr.user_a = auth.uid() and fr.user_b = po.author_id) or (fr.user_b = auth.uid() and fr.user_a = po.author_id))))
        or (p_tab = 'nearby' and po.city is not null and po.city = (select city from me))
      )
  ),
  signals as (
    select
      c.*,
      (c.author_since > now() - interval '30 days') as is_new_member,
      (c.intent in ('seek', 'opinion') and c.comment_count < 3 and c.created_at > now() - interval '3 days') as needs_answers,
      -- The viewer's own votes only (RLS: members can read nothing but their own rows).
      (exists (select 1 from public.post_votes v
               where v.post_id = c.id and v.user_id = auth.uid() and v.value = -1)) as i_downvoted,
      least(3, (select count(*) from public.post_votes v
                join public.posts op on op.id = v.post_id
                where v.user_id = auth.uid() and v.value = -1
                  and op.author_id = c.author_id and op.id <> c.id)) as my_author_downvotes
    from candidates c
  ),
  scored as (
    select
      s.*,
      (case when s.is_followed then 3 else 0 end)
      + (case when s.is_friend then 3 else 0 end)
      + (case when s.is_self then 1 else 0 end)
      + (case when s.is_nearby then 1.5 else 0 end)
      + (case when s.is_interest then 1 else 0 end)
      + 0.5 * ln(1 + s.upvote_count) + 0.35 * ln(1 + s.comment_count)
      -- Personal relevance: a post you voted down sinks in YOUR feed, and that author's other
      -- posts a little. Nobody else's feed changes.
      - (case when p_tab = 'for_you' and s.i_downvoted then 4 else 0 end)
      - (case when p_tab = 'for_you' then 0.5 * s.my_author_downvotes else 0 end)
      + (case when s.is_new_member
           then 0.8 * greatest(0, 1 - extract(epoch from (now() - s.author_since)) / 86400.0 / 30.0) else 0 end)
      + (case when coalesce(s.author_posts, 0) <= 3 then 0.4 else 0 end)
      + (case when s.needs_answers then 0.8 else 0 end)
      - extract(epoch from (now() - s.created_at)) / 3600.0 / 18.0 as base
    from signals s
  ),
  diversified as (
    select
      sc.*,
      row_number() over (partition by sc.author_id order by sc.base desc, sc.created_at desc) as author_rank,
      row_number() over (partition by sc.intent, sc.kind order by sc.base desc, sc.created_at desc) as type_rank
    from scored sc
  )
  select
    d.id,
    case
      when d.is_self then 'self'
      when d.is_friend then 'friend'
      when d.is_followed then 'following'
      when d.needs_answers then 'needs_answers'
      when d.is_nearby then 'nearby'
      when d.is_interest then 'interest'
      -- Public upvotes from active members only, so the label never hints at downvotes.
      when d.upvote_count >= 3 then 'popular'
      when d.is_new_member or coalesce(d.author_posts, 0) <= 3 then 'new_seller'
      else 'discover'
    end,
    null::double precision,
    d.created_at
  from diversified d
  order by
    case when p_tab = 'for_you'
      then d.base - 1.2 * least(d.author_rank - 1, 4) - 0.2 * least(d.type_rank - 1, 4)
      else extract(epoch from d.created_at)
    end desc,
    d.created_at desc,
    d.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(text, integer, integer, timestamptz) to anon, authenticated;

drop function private.post_vote_penalty(uuid);
