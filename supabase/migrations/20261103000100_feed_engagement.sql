-- Jëfëli — feed engagement pass.
--   1. Publication intents: « Je partage », « Je cherche », « Je propose », « Votre avis ? ».
--      These are labels on ordinary posts, not separate marketplaces.
--   2. Community votes on publications (one reversible vote per member and post). They replace
--      the post heart, which did the same job (likes are migrated as upvotes). Only the positive
--      count is public. Downvotes are private relevance feedback for the feed ranking, are never
--      shown or exposed per post, and are unrelated to product reviews or seller reputation.
--   3. Compact previews of genuine recent comments for feed cards.
--   4. Explainable feed ranking v2: votes, recency, locality, relationships, author and content
--      diversity, a fair chance for new members, and requests that still need answers.

-- ---------------------------------------------------------------------------
-- 1. Intents
-- ---------------------------------------------------------------------------

alter table public.posts
  add column intent text not null default 'share' check (intent in ('share', 'seek', 'offer', 'opinion'));
create index posts_intent_idx on public.posts (intent, created_at desc)
  where deleted_at is null and moderation_status = 'active';

drop function public.create_post(text, text, jsonb, uuid[]);
create function public.create_post(
  p_body text,
  p_visibility text,
  p_media jsonb,
  p_product_ids uuid[] default '{}',
  p_intent text default 'share'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  bucket text;
  new_id uuid;
  m jsonb;
  i integer := 0;
  author_city text;
begin
  if p_visibility not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if coalesce(p_intent, 'share') not in ('share', 'seek', 'offer', 'opinion') then
    raise exception 'invalid_intent' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_body), '') = '' and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0 then
    raise exception 'empty_post' using errcode = 'P0001';
  end if;
  -- A request or a question needs words: a lone photo cannot say what is being looked for.
  if coalesce(p_intent, 'share') in ('seek', 'opinion') and coalesce(btrim(p_body), '') = '' then
    raise exception 'empty_request' using errcode = 'P0001';
  end if;
  bucket := case when p_visibility = 'public' then 'public-media' else 'private-media' end;
  perform private.validate_media(coalesce(p_media, '[]'::jsonb), bucket, 10);
  perform private.enforce_rate_limit('post', 30, interval '1 hour');

  if exists (
    select 1 from unnest(coalesce(p_product_ids, '{}')) pid
    where not exists (select 1 from public.products pr where pr.id = pid and pr.seller_id = uid)
  ) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;

  select city into author_city from public.profiles where id = uid;

  insert into public.posts (author_id, body, visibility, kind, city, intent)
  values (uid, coalesce(p_body, ''), p_visibility,
    case when cardinality(coalesce(p_product_ids, '{}')) > 0 then 'product' else 'personal' end,
    author_city, coalesce(p_intent, 'share'))
  returning id into new_id;

  for m in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    insert into public.post_media (post_id, owner_id, bucket, kind, storage_path, poster_path, width, height, duration_ms, position)
    values (new_id, uid, bucket, m ->> 'kind', m ->> 'path', m ->> 'poster_path',
      (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_ms')::integer, i);
    i := i + 1;
  end loop;

  insert into public.post_products (post_id, product_id)
  select new_id, pid from unnest(coalesce(p_product_ids, '{}')) pid
  on conflict do nothing;

  return new_id;
end;
$$;
revoke execute on function public.create_post(text, text, jsonb, uuid[], text) from anon, public;
grant execute on function public.create_post(text, text, jsonb, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Votes
-- ---------------------------------------------------------------------------

alter table public.posts add column upvote_count integer not null default 0;

create table public.post_votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_votes enable row level security;
create index post_votes_user_idx on public.post_votes (user_id, updated_at desc);
create index post_votes_post_value_idx on public.post_votes (post_id, value);

-- Members see only their own votes, so nobody can list who downvoted a post.
create policy post_votes_select_own on public.post_votes
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.post_votes from anon, authenticated;
grant select on public.post_votes to authenticated;
-- No direct writes: public.vote_post() validates every change.

-- Counters: upvotes are public on posts.upvote_count. Likes are retired (migrated below).
create or replace function private.refresh_post_counters(pid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set
    upvote_count = (select count(*) from public.post_votes where post_id = pid and value = 1),
    comment_count = (select count(*) from public.comments c
                     where c.post_id = pid and c.deleted_at is null and c.moderation_status = 'active'),
    save_count = (select count(*) from public.post_saves where post_id = pid)
  where id = pid and deleted_at is null;
$$;

create or replace function public.vote_post(p_post_id uuid, p_value integer)
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
  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception 'invalid_vote' using errcode = 'P0001';
  end if;
  if not private.is_active_user(uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  select * into post from public.posts where id = p_post_id;
  -- Same visibility rules as reading the post (audience, blocks), and only live content.
  if not found or post.deleted_at is not null or post.moderation_status <> 'active'
     or not private.can_view_post(p_post_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if post.author_id = uid then
    raise exception 'own_post_vote' using errcode = 'P0001';
  end if;

  select v.value into previous from public.post_votes v where v.post_id = p_post_id and v.user_id = uid;
  if p_value = 0 then
    delete from public.post_votes where post_id = p_post_id and user_id = uid;
  elsif previous is distinct from p_value then
    -- Every new vote or switch counts towards the limit, so toggling cannot be used to spam.
    perform private.enforce_rate_limit('vote', 200, interval '1 hour');
    insert into public.post_votes (post_id, user_id, value) values (p_post_id, uid, p_value)
    on conflict (post_id, user_id) do update set value = excluded.value, updated_at = now()
      where public.post_votes.value is distinct from excluded.value;
  end if;

  return jsonb_build_object(
    'post_id', p_post_id,
    'upvote_count', (select upvote_count from public.posts where id = p_post_id),
    'my_vote', coalesce((select value from public.post_votes where post_id = p_post_id and user_id = uid), 0)
  );
end;
$$;
revoke execute on function public.vote_post(uuid, integer) from anon, public;
grant execute on function public.vote_post(uuid, integer) to authenticated;

-- Notify the author of the first upvote by each member (never of downvotes, never repeated).
create or replace function private.notify_post_upvote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  if new.value <> 1 then
    return null;
  end if;
  select author_id into author from public.posts where id = new.post_id;
  if not exists (
    select 1 from public.notifications
    where recipient_id = author and actor_id = new.user_id and type = 'post_upvote' and entity_id = new.post_id
  ) then
    perform private.notify(author, new.user_id, 'post_upvote', 'post', new.post_id);
  end if;
  return null;
end;
$$;
revoke execute on function private.notify_post_upvote() from public, anon, authenticated;

-- Private relevance signal from downvotes, used by get_feed (security invoker) only. Returns a
-- bounded score adjustment, never raw counts, and nothing for posts the caller cannot see. The
-- private schema is not exposed by the API, so members cannot call it directly.
create or replace function private.post_vote_penalty(p_post_id uuid)
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.down = 0 or not private.can_view_post(p_post_id) then 0
    -- Ratio-based and damped: a few downvotes barely move a well-liked post; three or more
    -- downvotes on a post nobody upvotes push it down by up to 2 points (≈ 36 h of recency).
    else -2.0 * (s.down::double precision / (s.up + s.down + 2)) * least(1.0, s.down / 3.0)
  end
  from (
    select count(*) filter (where value = -1) as down, count(*) filter (where value = 1) as up
    from public.post_votes where post_id = p_post_id
  ) s;
$$;
revoke execute on function private.post_vote_penalty(uuid) from public;
grant execute on function private.post_vote_penalty(uuid) to anon, authenticated;

-- A block also removes the votes between the two members, in both directions, like it severs
-- follows: a blocked member's past votes (up or down) must not keep acting on the blocker's
-- posts, and they can no longer reach those posts to withdraw them.
create or replace function private.blocks_remove_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.post_votes v
  using public.posts p
  where p.id = v.post_id
    and ((v.user_id = new.blocker_id and p.author_id = new.blocked_id)
      or (v.user_id = new.blocked_id and p.author_id = new.blocker_id));
  return null;
end;
$$;
revoke execute on function private.blocks_remove_votes() from public, anon, authenticated;
create trigger blocks_remove_votes after insert on public.blocks
  for each row execute function private.blocks_remove_votes();

-- Likes → upvotes, before the vote triggers exist: copying old likes must not send new
-- notifications (existing like notifications are renamed below instead). A self-like does not
-- become a vote, since members cannot vote for their own posts.
insert into public.post_votes (post_id, user_id, value, created_at, updated_at)
select l.post_id, l.user_id, 1, l.created_at, l.created_at
from public.post_likes l
join public.posts p on p.id = l.post_id
where p.author_id <> l.user_id
on conflict do nothing;

create trigger post_votes_counters after insert or update of value or delete on public.post_votes
  for each row execute function private.post_counters_trigger();
create trigger post_votes_notify after insert or update of value on public.post_votes
  for each row execute function private.notify_post_upvote();

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted',
  'friend_request', 'friend_accepted',
  'post_upvote', 'post_comment', 'comment_reply',
  'message', 'story_reply', 'story_like',
  'offer_received', 'offer_countered', 'offer_accepted', 'offer_rejected', 'offer_withdrawn',
  'agreement_completed', 'agreement_canceled', 'agreement_disputed',
  'review_received', 'live_started',
  'moderation_action', 'report_resolved', 'verification_result', 'appeal_result'
)) not valid;
update public.notifications set type = 'post_upvote' where type = 'post_like';
alter table public.notifications validate constraint notifications_type_check;

drop table public.post_likes;
drop function private.notify_post_like();
alter table public.posts drop column like_count;

update public.posts po set upvote_count = (
  select count(*) from public.post_votes v where v.post_id = po.id and v.value = 1
);

-- Members' own votes are part of their data export.
create or replace function public.export_my_data()
returns jsonb
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
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'phone', u.phone, 'created_at', u.created_at) from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'settings', (select to_jsonb(s) from public.account_settings s where s.user_id = uid),
    'boutique', (select to_jsonb(b) from public.boutiques b where b.owner_id = uid),
    'posts', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.posts p where p.author_id = uid),
    'post_votes', (select coalesce(jsonb_agg(jsonb_build_object('post_id', v.post_id, 'value', v.value, 'updated_at', v.updated_at)), '[]') from public.post_votes v where v.user_id = uid),
    'products', (select coalesce(jsonb_agg(to_jsonb(p) - 'search_text'), '[]') from public.products p where p.seller_id = uid),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.comments c where c.author_id = uid),
    'stories', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.stories s where s.author_id = uid),
    'follows', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.follows f where f.follower_id = uid or f.followee_id = uid),
    'messages_sent', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.messages m where m.sender_id = uid),
    'offers', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from public.offers o where uid in (o.buyer_id, o.seller_id)),
    'agreements', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.agreements a where uid in (a.buyer_id, a.seller_id)),
    'reviews_written', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reviews r where r.reviewer_id = uid),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('target_type', r.target_type, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at)), '[]') from public.reports r where r.reporter_id = uid),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.blocks b where b.blocker_id = uid)
  );
end;
$$;
revoke execute on function public.export_my_data() from anon, public;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comment previews for feed cards
-- ---------------------------------------------------------------------------

-- The most recent top-level comments of each post, through the caller's own RLS (audience,
-- blocks, moderation). Comments from muted members are left out like their posts are.
create or replace function public.get_comment_previews(p_post_ids uuid[], p_per_post integer default 2)
returns table (
  post_id uuid,
  comment_id uuid,
  body text,
  created_at timestamptz,
  by_post_author boolean,
  author jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.post_id, c.id, c.body, c.created_at, (c.author_id = po.author_id),
    jsonb_build_object(
      'id', pr.id, 'handle', pr.handle, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path,
      'verification_level', pr.verification_level, 'is_demo', pr.is_demo, 'city', pr.city
    )
  from (select distinct unnest(p_post_ids[1:60]) as pid) ids
  join public.posts po on po.id = ids.pid
  cross join lateral (
    select cm.* from public.comments cm
    where cm.post_id = ids.pid
      and cm.parent_id is null
      and cm.deleted_at is null
      and cm.moderation_status = 'active'
      and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = cm.author_id)
    order by cm.created_at desc
    limit least(greatest(coalesce(p_per_post, 2), 1), 3)
  ) c
  join public.profiles pr on pr.id = c.author_id
  order by c.post_id, c.created_at desc;
$$;
grant execute on function public.get_comment_previews(uuid[], integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Feed ranking v2 (same signature; for_you is ranked, the other tabs stay chronological)
-- ---------------------------------------------------------------------------
--
-- for_you score =
--     relationships   followed +3, friend +3, own post +1
--   + locality        same city +1.5
--   + interests       tagged product in an interest category +1
--   + community       0.5·ln(1 + upvotes) + 0.35·ln(1 + comments) + private downvote penalty (≤ 0, ≥ −2)
--   + fair chance     account < 30 days: up to +0.8 (fading); 3 posts or fewer: +0.4
--   + participation   « Je cherche » / « Votre avis ? » under 3 days old with < 3 comments: +0.8
--   − recency         hours since publication / 18
--   − diversity       −1.2 per earlier post of the same author in the ranking (max 4),
--                     −0.2 per earlier post of the same type (intent × kind, max 4)
-- The reason returned with each post names its strongest honest signal. The score itself is
-- NOT returned (the column stays for compatibility and is always null): it includes the private
-- downvote penalty, and returning it would let anyone recompute a post's downvotes from changes
-- in its score. Only the order and the public reason are exposed.

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
      case when p_tab = 'for_you' then private.post_vote_penalty(c.id) else 0 end as vote_penalty
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
      + 0.5 * ln(1 + s.upvote_count) + 0.35 * ln(1 + s.comment_count) + s.vote_penalty
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
      -- Based on public upvotes only, so the label can never hint at private downvotes.
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
