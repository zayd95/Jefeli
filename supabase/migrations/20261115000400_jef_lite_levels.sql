-- Pilot cut (g) — « Jëf lite » (owner decision, 15 Nov 2026): public seller levels computed,
-- read-only, from real confirmed exchanges. No Jëf balance, no ledger, nothing to spend.
--   1 Nouveau / Nouvelle   default
--   2 Fiable               ≥ 3 completed exchanges with ≥ 2 different partners; rating ≥ 4.0 if ≥ 3 reviews
--   3 Confirmé / Confirmée ≥ 10 completed, ≥ 6 partners; rating ≥ 4.0 if ≥ 3 reviews; no upheld report in 90 days
--   4 Jambaar              ≥ 30 completed, ≥ 15 partners; rating ≥ 4.5 on ≥ 10 reviews; no upheld report in 180 days
-- « Completed » = an agreement both members declared done (status 'completed'): sales (kind
-- 'price') and swaps (kind 'barter') — the Jëf thresholds of IDENTITY.md § 3.7 stay deferred.
--
-- Plus: a new seller's very first listing is shown first in its aisle for 24 h, labelled
-- « Nouveau » (transparency). Set once per member (profiles.first_listing_at), so deleting and
-- re-listing does not earn it again. Neither column is writable by clients.

alter table public.profiles add column first_listing_at timestamptz;
alter table public.products add column new_seller_until timestamptz;

-- Members who already sold before this migration are not « new ».
update public.profiles p set first_listing_at = f.first
from (select seller_id, min(created_at) as first from public.products group by seller_id) f
where f.seller_id = p.id and p.first_listing_at is null;

create or replace function private.products_new_seller_exposure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed timestamptz;
begin
  update public.profiles set first_listing_at = now()
  where id = new.seller_id and first_listing_at is null
  returning first_listing_at into claimed;
  new.new_seller_until := case when claimed is not null then now() + interval '24 hours' end;
  return new;
end;
$$;
revoke execute on function private.products_new_seller_exposure() from public, anon, authenticated;
create trigger products_new_seller_exposure before insert on public.products
  for each row execute function private.products_new_seller_exposure();

-- Clients cannot forge it on update either (column grants do not include it; belt and braces).
create or replace function private.products_keep_exposure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.new_seller_until := old.new_seller_until;
  return new;
end;
$$;
revoke execute on function private.products_keep_exposure() from public, anon, authenticated;
create trigger products_keep_exposure before update of new_seller_until on public.products
  for each row execute function private.products_keep_exposure();

-- ---------------------------------------------------------------------------
-- The level, public (same visibility as the profile's content).
-- ---------------------------------------------------------------------------

create or replace function public.member_level(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  deals integer;
  swaps integer;
  partners integer;
  rating_n integer;
  rating_avg numeric;
  upheld_90 boolean;
  upheld_180 boolean;
  lvl integer := 1;
  rated_ok_4 boolean;
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user)
     or not private.can_view_profile_content(auth.uid(), p_user) then
    return null;
  end if;
  select count(*) filter (where a.kind = 'price'), count(*) filter (where a.kind = 'barter'),
         count(distinct case when a.buyer_id = p_user then a.seller_id else a.buyer_id end)
    into deals, swaps, partners
  from public.agreements a
  where a.status = 'completed' and p_user in (a.buyer_id, a.seller_id);
  select rating_count, case when rating_count > 0 then rating_sum::numeric / rating_count end
    into rating_n, rating_avg
  from public.profiles where id = p_user;
  select exists (select 1 from public.reports r where r.target_owner_id = p_user and r.status = 'actioned' and r.updated_at > now() - interval '90 days'),
         exists (select 1 from public.reports r where r.target_owner_id = p_user and r.status = 'actioned' and r.updated_at > now() - interval '180 days')
    into upheld_90, upheld_180;
  rated_ok_4 := rating_n < 3 or rating_avg >= 4.0;

  if deals + swaps >= 3 and partners >= 2 and rated_ok_4 then lvl := 2; end if;
  if lvl = 2 and deals + swaps >= 10 and partners >= 6 and not upheld_90 then lvl := 3; end if;
  if lvl = 3 and deals + swaps >= 30 and partners >= 15 and rating_n >= 10 and rating_avg >= 4.5 and not upheld_180 then lvl := 4; end if;

  return jsonb_build_object(
    'level', lvl,
    'key', (array['nouveau', 'fiable', 'confirme', 'jambaar'])[lvl],
    'deals', deals,
    'swaps', swaps,
    'partners', partners
  );
end;
$$;
revoke execute on function public.member_level(uuid) from public;
grant execute on function public.member_level(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Explorer: in the default order, a new seller's first listing (24 h) comes first in its aisle.
-- ---------------------------------------------------------------------------

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
    case when coalesce(p_sort, 'recent') = 'recent' and pr.new_seller_until > now() then 0 else 1 end,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;
