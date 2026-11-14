-- P1 identity sprint (owner, 14 Nov 2026): Explorer as a Dakar market. LOCAL ONLY until the owner's go.
--
-- An aisle (« allée ») groups several categories (Téléphones = telephones + electronique; Mode =
-- mode-femme + mode-homme + chaussures + sacs-accessoires + tissus-wax). « Près de moi » narrows
-- to the member's neighbourhood. Read-only, security invoker: exactly the visibility of
-- explore_products (products RLS + mutes + blocks either way).

create or replace function public.explore_market(
  p_categories text[] default null,
  p_neighborhood text default null,
  p_city text default null,
  p_mode text default 'recent',
  p_condition text default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_offer text default null,
  p_sort text default 'recent',
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
    and (p_categories is null or cardinality(p_categories) = 0 or pr.category_slug = any (p_categories))
    and (p_neighborhood is null or btrim(p_neighborhood) = ''
         or private.normalize_text(coalesce(pr.neighborhood, '')) = private.normalize_text(p_neighborhood))
    and (p_city is null or private.normalize_text(pr.city) = private.normalize_text(p_city))
    and (p_condition is null or pr.condition::text = p_condition)
    and (p_mode <> 'occasions' or pr.condition <> 'new')
    and (p_mode <> 'troc' or pr.listing_mode in ('trade', 'sale_or_trade'))
    and (p_offer is null
         or (p_offer = 'sale' and pr.listing_mode in ('sale', 'sale_or_trade'))
         or (p_offer = 'trade' and pr.listing_mode in ('trade', 'sale_or_trade')))
    and (p_min_price is null or (pr.price_xof is not null and pr.price_xof >= p_min_price))
    and (p_max_price is null or (pr.price_xof is not null and pr.price_xof <= p_max_price))
  order by
    case when p_sort = 'price_asc' then pr.price_xof end asc nulls last,
    case when p_sort = 'price_desc' then pr.price_xof end desc nulls last,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;
revoke execute on function public.explore_market(text[], text, text, text, text, integer, integer, text, text, integer, integer) from public;
grant execute on function public.explore_market(text[], text, text, text, text, integer, integer, text, text, integer, integer) to anon, authenticated;

-- How full each category is (articles and distinct sellers the viewer can see), for the aisle
-- cards. Counts only: no article or seller is revealed that the products policy would hide.
create or replace function public.market_counts(p_city text default null, p_neighborhood text default null)
returns table (category_slug text, articles integer, sellers integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.category_slug, count(*)::integer, count(distinct pr.seller_id)::integer
  from public.products pr
  where pr.status = 'active'
    and pr.moderation_status = 'active'
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = pr.seller_id)
    and not private.is_blocked_between(auth.uid(), pr.seller_id)
    and (p_city is null or private.normalize_text(pr.city) = private.normalize_text(p_city))
    and (p_neighborhood is null or btrim(p_neighborhood) = ''
         or private.normalize_text(coalesce(pr.neighborhood, '')) = private.normalize_text(p_neighborhood))
  group by pr.category_slug;
$$;
revoke execute on function public.market_counts(text, text) from public;
grant execute on function public.market_counts(text, text) to anon, authenticated;
