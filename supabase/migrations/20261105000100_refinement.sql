-- Jëfëli — post-playtest refinement.
--   1. Flexible listing prices: « Prix affiché » (a real price, never 0 F), « Prix sur demande »
--      (no price stored) or « À discuter » (optional indicative price). Ordinary posts never
--      need a price.
--   2. Pinned posts and products on a profile (owner only, up to 3 of each).
--   3. Feed ranking v4: genuine upvotes (active members who completed onboarding), meaningful
--      comments (distinct members other than the author), and repeated texts or products from
--      the same author sink. Downvotes stay personal (v3).

-- ---------------------------------------------------------------------------
-- 1. Flexible pricing
-- ---------------------------------------------------------------------------

alter table public.products
  add column price_mode text not null default 'fixed' check (price_mode in ('fixed', 'on_request', 'negotiable'));

-- A 0 F listing never meant « free »: it becomes « Prix sur demande » (trade listings just lose the 0).
update public.products set price_mode = 'on_request', price_xof = null where price_xof = 0 and listing_mode <> 'trade';
update public.products set price_xof = null where price_xof = 0;

alter table public.products drop constraint products_check;
alter table public.products drop constraint products_price_xof_check;
alter table public.products add constraint products_price_xof_check
  check (price_xof is null or price_xof between 1 and 100000000);
alter table public.products add constraint products_price_rules check (
  (price_mode = 'fixed' and (listing_mode = 'trade' or price_xof is not null))
  or (price_mode = 'on_request' and price_xof is null)
  or price_mode = 'negotiable'
);
grant update (price_mode) on public.products to authenticated;

drop function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode,
  integer, text, text, text[], text, jsonb, uuid);
create function public.create_listing(
  p_title text,
  p_description text,
  p_price_xof integer,
  p_category_slug text,
  p_condition public.item_condition,
  p_listing_mode public.listing_mode,
  p_quantity integer,
  p_city text,
  p_neighborhood text,
  p_delivery_options text[],
  p_delivery_notes text,
  p_media jsonb,
  p_collection_id uuid default null,
  p_price_mode text default 'fixed'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  mode text := coalesce(p_price_mode, 'fixed');
  price integer := p_price_xof;
  new_id uuid;
  m jsonb;
  i integer := 0;
begin
  if mode not in ('fixed', 'on_request', 'negotiable') then
    raise exception 'invalid_price_mode' using errcode = 'P0001';
  end if;
  if mode = 'on_request' then
    price := null; -- never store a hidden price
  end if;
  if price is not null and price < 1 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if mode = 'fixed' and p_listing_mode <> 'trade' and price is null then
    raise exception 'price_required' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) < 1 then
    raise exception 'media_required' using errcode = 'P0001';
  end if;
  perform private.validate_media(p_media, 'public-media', 10);

  insert into public.products (seller_id, title, description, price_xof, price_mode, category_slug, condition,
    listing_mode, quantity, city, neighborhood, delivery_options, delivery_notes, collection_id)
  values (uid, btrim(p_title), coalesce(p_description, ''), price, mode, p_category_slug, p_condition,
    p_listing_mode, coalesce(p_quantity, 1), nullif(btrim(p_city), ''), nullif(btrim(p_neighborhood), ''),
    coalesce(p_delivery_options, '{pickup}'), coalesce(p_delivery_notes, ''), p_collection_id)
  returning id into new_id;

  for m in select * from jsonb_array_elements(p_media) loop
    insert into public.product_media (product_id, owner_id, kind, storage_path, poster_path, width, height, duration_ms, position)
    values (new_id, uid, m ->> 'kind', m ->> 'path', m ->> 'poster_path',
      (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_ms')::integer, i);
    i := i + 1;
  end loop;
  return new_id;
end;
$$;
revoke execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode,
  integer, text, text, text[], text, jsonb, uuid, text) from anon, public;
grant execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode,
  integer, text, text, text[], text, jsonb, uuid, text) to authenticated;

-- Offers and message cards keep a snapshot of the listing: include how its price is shown.
create or replace function private.product_snapshot(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.id is null then null else jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'price_xof', p.price_xof,
    'price_mode', p.price_mode,
    'condition', p.condition,
    'listing_mode', p.listing_mode,
    'category_slug', p.category_slug,
    'city', p.city,
    'seller_id', p.seller_id,
    'image_path', (select m.storage_path from public.product_media m where m.product_id = p.id and m.kind = 'image' order by m.position limit 1),
    'poster_path', (select coalesce(m.poster_path, m.storage_path) from public.product_media m where m.product_id = p.id order by m.position limit 1)
  ) end
  from (select 1) dummy
  left join public.products p on p.id = p_product_id;
$$;

-- ---------------------------------------------------------------------------
-- 2. Pinned posts and products
-- ---------------------------------------------------------------------------

alter table public.posts add column pinned_at timestamptz;
alter table public.products add column pinned_at timestamptz;
create index posts_pinned_idx on public.posts (author_id, pinned_at desc) where pinned_at is not null and deleted_at is null;
create index products_pinned_idx on public.products (seller_id, pinned_at desc) where pinned_at is not null;

create or replace function public.set_pinned(p_kind text, p_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  pinned integer;
begin
  if p_kind = 'post' then
    if not exists (select 1 from public.posts where id = p_id and author_id = uid and deleted_at is null) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if coalesce(p_pinned, false) then
      select count(*) into pinned from public.posts
      where author_id = uid and pinned_at is not null and deleted_at is null and id <> p_id;
      if pinned >= 3 then
        raise exception 'pin_limit' using errcode = 'P0001';
      end if;
      update public.posts set pinned_at = coalesce(pinned_at, now()) where id = p_id;
    else
      update public.posts set pinned_at = null where id = p_id;
    end if;
  elsif p_kind = 'product' then
    if not exists (select 1 from public.products where id = p_id and seller_id = uid) then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if coalesce(p_pinned, false) then
      select count(*) into pinned from public.products
      where seller_id = uid and pinned_at is not null and id <> p_id;
      if pinned >= 3 then
        raise exception 'pin_limit' using errcode = 'P0001';
      end if;
      update public.products set pinned_at = coalesce(pinned_at, now()) where id = p_id;
    else
      update public.products set pinned_at = null where id = p_id;
    end if;
  else
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.set_pinned(text, uuid, boolean) from anon, public;
grant execute on function public.set_pinned(text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Genuine upvotes: active members who completed onboarding
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
                    where v.post_id = pid and v.value = 1 and pr.status = 'active' and pr.onboarded_at is not null),
    comment_count = (select count(*) from public.comments c
                     where c.post_id = pid and c.deleted_at is null and c.moderation_status = 'active'),
    save_count = (select count(*) from public.post_saves where post_id = pid)
  where id = pid and deleted_at is null;
$$;

drop trigger profiles_status_recount_votes on public.profiles;
create trigger profiles_status_recount_votes after update of status, onboarded_at on public.profiles
  for each row when (old.status is distinct from new.status or old.onboarded_at is distinct from new.onboarded_at)
  execute function private.profiles_status_recount_votes();

update public.posts po set upvote_count = (
  select count(*) from public.post_votes v
  join public.profiles pr on pr.id = v.user_id
  where v.post_id = po.id and v.value = 1 and pr.status = 'active' and pr.onboarded_at is not null
) where po.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Feed ranking v4
-- ---------------------------------------------------------------------------
--
-- for_you score = v3 (relationships, locality, interests, recency, personal downvotes, fair
-- chance for new members, requests awaiting answers, author and type diversity) with:
--   + 0.5·ln(1 + genuine upvotes)        upvote_count now counts active, onboarded members only
--   + 0.35·ln(1 + distinct commenters)   other members with a real message, not the author's
--                                        own replies or one-character comments
--   − 2.5 per earlier copy of the same text by the same author (max 2)
--   − 1.5 per earlier post tagging the same product by the same author (max 2)
-- The first publication keeps its place; repeated advertisements sink. The score is never returned.

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
      -- Meaningful comments: distinct members other than the author, with an actual message.
      (select count(distinct c.author_id) from public.comments c
       where c.post_id = po.id and c.author_id <> po.author_id and c.deleted_at is null
         and c.moderation_status = 'active' and char_length(btrim(c.body)) >= 3) as commenters,
      -- Repetition keys: the same text, or the same tagged product, published again by the author.
      case when char_length(btrim(po.body)) >= 12
        then md5(private.normalize_text(left(po.body, 500))) end as body_key,
      (select pp.product_id from public.post_products pp where pp.post_id = po.id
       order by pp.product_id limit 1) as product_key,
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
      (c.intent in ('seek', 'opinion') and c.commenters < 3 and c.created_at > now() - interval '3 days') as needs_answers,
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
      + 0.5 * ln(1 + s.upvote_count) + 0.35 * ln(1 + s.commenters)
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
      row_number() over (partition by sc.intent, sc.kind order by sc.base desc, sc.created_at desc) as type_rank,
      -- The first publication keeps its place; later copies of the same text or product sink.
      case when sc.body_key is null then 1
        else row_number() over (partition by sc.author_id, sc.body_key order by sc.created_at, sc.id) end as text_repeat,
      case when sc.product_key is null then 1
        else row_number() over (partition by sc.author_id, sc.product_key order by sc.created_at, sc.id) end as product_repeat
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
        - 2.5 * least(d.text_repeat - 1, 2) - 1.5 * least(d.product_repeat - 1, 2)
      else extract(epoch from d.created_at)
    end desc,
    d.created_at desc,
    d.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.get_feed(text, integer, integer, timestamptz) to anon, authenticated;
