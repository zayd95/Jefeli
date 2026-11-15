-- Explorer discovery (owner request, 12 Nov 2026): more filters, trending articles, sellers to follow.
-- New read-only functions only; no table or row changes.
--
-- Visibility follows browse_products and the products/profiles RLS: active and moderated
-- articles, never from a blocked (either way) or muted member, private accounts only when the
-- viewer may see their content.

-- 1. explore_products: browse_products plus a price range, sale / Wecci, and a sort order.
create or replace function public.explore_products(
  p_mode text default 'recent',
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_condition text default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_offer text default null, -- 'sale' (to buy) | 'trade' (Wecci) | null (both)
  p_sort text default 'recent', -- 'recent' | 'price_asc' | 'price_desc'
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.products
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.*
  from public.products pr
  where pr.status = 'active'
    and pr.moderation_status = 'active'
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = pr.seller_id)
    and not private.is_blocked_between(auth.uid(), pr.seller_id)
    and (p_category is null or pr.category_slug = p_category)
    and (p_condition is null or pr.condition::text = p_condition)
    and (p_city is null or private.normalize_text(pr.city) = private.normalize_text(p_city))
    and (p_mode <> 'occasions' or pr.condition <> 'new')
    and (p_mode <> 'troc' or pr.listing_mode in ('trade', 'sale_or_trade'))
    and (p_offer is null
         or (p_offer = 'sale' and pr.listing_mode in ('sale', 'sale_or_trade'))
         or (p_offer = 'trade' and pr.listing_mode in ('trade', 'sale_or_trade')))
    -- A price filter only keeps articles with a shown price inside the range.
    and (p_min_price is null or (pr.price_xof is not null and pr.price_xof >= p_min_price))
    and (p_max_price is null or (pr.price_xof is not null and pr.price_xof <= p_max_price))
    and (
      p_query is null or btrim(p_query) = ''
      or pr.search_text like '%' || private.normalize_text(btrim(p_query)) || '%'
      or extensions.word_similarity(private.normalize_text(btrim(p_query)), pr.search_text) > 0.45
      or exists (select 1 from public.categories c where c.slug = pr.category_slug
                 and private.normalize_text(c.name) like '%' || private.normalize_text(btrim(p_query)) || '%')
    )
  order by
    case when p_sort = 'price_asc' then pr.price_xof end asc nulls last,
    case when p_sort = 'price_desc' then pr.price_xof end desc nulls last,
    case when p_query is null or btrim(p_query) = '' then 0
         else -extensions.word_similarity(private.normalize_text(btrim(p_query)), pr.search_text) end,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;
revoke execute on function public.explore_products(text, text, text, text, text, integer, integer, text, text, integer, integer) from public;
grant execute on function public.explore_products(text, text, text, text, text, integer, integer, text, text, integer, integer) to anon, authenticated;

-- 2. trending_products: articles saved as favourites by the most different members over the
-- last days (default 7). Real favourites only, a seller's own save never counts, and neither who
-- saved nor how many is returned. Security definer because favourites are private per member.
create or replace function public.trending_products(p_days integer default 7, p_limit integer default 10)
returns setof public.products
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (select auth.uid() as id),
  scores as (
    select s.product_id, count(distinct s.user_id) as savers, max(s.created_at) as last_saved
    from public.product_saves s
    join public.products pr on pr.id = s.product_id
    join public.profiles saver on saver.id = s.user_id and saver.status = 'active'
    where s.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
      and s.user_id <> pr.seller_id
    group by s.product_id
  )
  select pr.*
  from scores sc
  join public.products pr on pr.id = sc.product_id
  where pr.status = 'active'
    and pr.moderation_status = 'active'
    and pr.seller_id <> (select id from viewer)
    and private.can_view_profile_content((select id from viewer), pr.seller_id)
    and not private.is_blocked_between((select id from viewer), pr.seller_id)
    and not exists (select 1 from public.mutes m where m.muter_id = (select id from viewer) and m.muted_id = pr.seller_id)
  order by sc.savers desc, sc.last_saved desc, pr.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;
revoke execute on function public.trending_products(integer, integer) from public, anon;
grant execute on function public.trending_products(integer, integer) to authenticated;

-- 3. suggested_sellers: members with articles on sale whom the viewer does not follow yet,
-- same city first, then the most followed, then the most recent article. Only public profile
-- fields; private accounts only when the viewer may see their content.
create or replace function public.suggested_sellers(p_limit integer default 8)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_path text,
  city text,
  is_demo boolean,
  verification_level public.verification_level,
  boutique_name text,
  active_products integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select auth.uid() as id, (select p.city from public.profiles p where p.id = auth.uid()) as city
  ),
  sellers as (
    select pr.seller_id, count(*)::integer as n, max(pr.created_at) as last_listed
    from public.products pr
    where pr.status = 'active' and pr.moderation_status = 'active'
    group by pr.seller_id
  )
  select p.id, p.handle, p.display_name, p.avatar_path, p.city, p.is_demo, p.verification_level, p.boutique_name, s.n
  from sellers s
  join public.profiles p on p.id = s.seller_id
  where p.status = 'active'
    and p.onboarded_at is not null
    and p.id <> (select id from viewer)
    and not exists (select 1 from public.follows f where f.follower_id = (select id from viewer) and f.followee_id = p.id)
    and private.can_view_profile_content((select id from viewer), p.id)
    and not private.is_blocked_between((select id from viewer), p.id)
    and not exists (select 1 from public.mutes m where m.muter_id = (select id from viewer) and m.muted_id = p.id)
  order by
    (p.city is not null and p.city = (select city from viewer)) desc,
    (select count(*) from public.follows f2 where f2.followee_id = p.id and f2.status = 'accepted') desc,
    s.last_listed desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;
revoke execute on function public.suggested_sellers(integer) from public, anon;
grant execute on function public.suggested_sellers(integer) to authenticated;
