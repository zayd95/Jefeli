-- Pilot cut (f) — Wecci « Donner »: an article given away. Price 0 is allowed in this mode only
-- (and required there); every other mode keeps « no 0 F listing » (20261105000100_refinement).
-- A gift takes no price offer and no barter: the buyer writes to the giver.

alter table public.products drop constraint products_price_xof_check;
alter table public.products add constraint products_price_xof_check check (
  (listing_mode = 'give' and price_xof = 0 and price_mode = 'fixed')
  or (listing_mode <> 'give' and (price_xof is null or price_xof between 1 and 100000000))
);

-- create_listing: same contract; « give » forces price 0 / fixed whatever the client sent.
create or replace function public.create_listing(
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
  visual jsonb;
  audio jsonb;
begin
  if mode not in ('fixed', 'on_request', 'negotiable') then
    raise exception 'invalid_price_mode' using errcode = 'P0001';
  end if;
  if p_listing_mode = 'give' then
    mode := 'fixed';
    price := 0;
  else
    if mode = 'on_request' then
      price := null; -- never store a hidden price
    end if;
    if price is not null and price < 1 then
      raise exception 'invalid_amount' using errcode = 'P0001';
    end if;
    if mode = 'fixed' and p_listing_mode <> 'trade' and price is null then
      raise exception 'price_required' using errcode = 'P0001';
    end if;
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into visual
  from jsonb_array_elements(p_media) with ordinality as t(e, o) where e ->> 'kind' is distinct from 'audio';
  if jsonb_array_length(visual) < 1 then
    raise exception 'media_required' using errcode = 'P0001';
  end if;
  perform private.validate_media(visual, 'public-media', 10);
  audio := private.validate_listing_voice(p_media, 'public-media');

  insert into public.products (seller_id, title, description, price_xof, price_mode, category_slug, condition,
    listing_mode, quantity, city, neighborhood, delivery_options, delivery_notes, collection_id)
  values (uid, btrim(p_title), coalesce(p_description, ''), price, mode, p_category_slug, p_condition,
    p_listing_mode, coalesce(p_quantity, 1), nullif(btrim(p_city), ''), nullif(btrim(p_neighborhood), ''),
    coalesce(p_delivery_options, '{pickup}'), coalesce(p_delivery_notes, ''), p_collection_id)
  returning id into new_id;

  perform private.insert_listing_media(new_id, uid, visual, audio);
  return new_id;
end;
$$;

-- Offers: a gift takes neither a price offer nor a barter.
create or replace function private.validate_offer_terms(
  p_kind text,
  p_product public.products,
  p_buyer uuid,
  p_amount integer,
  p_offered_product_id uuid,
  p_cash_payer text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  offered public.products;
begin
  if p_product.id is null or p_product.status <> 'active' or p_product.moderation_status <> 'active' then
    raise exception 'product_unavailable' using errcode = 'P0001';
  end if;
  if p_product.listing_mode = 'give' then
    raise exception 'given_away' using errcode = 'P0001';
  end if;
  if p_kind = 'price' then
    if p_product.listing_mode = 'trade' then
      raise exception 'not_for_sale' using errcode = 'P0001';
    end if;
    if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
      raise exception 'invalid_amount' using errcode = 'P0001';
    end if;
  elsif p_kind = 'barter' then
    if p_product.listing_mode = 'sale' then
      raise exception 'not_for_trade' using errcode = 'P0001';
    end if;
    select * into offered from public.products where id = p_offered_product_id;
    if not found or offered.seller_id <> p_buyer or offered.status <> 'active' or offered.moderation_status <> 'active'
       or offered.listing_mode = 'give' then
      raise exception 'invalid_offered_product' using errcode = 'P0001';
    end if;
    if offered.id = p_product.id then
      raise exception 'invalid_offered_product' using errcode = 'P0001';
    end if;
    if p_amount is null or p_amount < 0 or p_amount > 100000000 then
      raise exception 'invalid_amount' using errcode = 'P0001';
    end if;
    if p_amount > 0 and p_cash_payer not in ('buyer', 'seller') then
      raise exception 'invalid_cash_payer' using errcode = 'P0001';
    end if;
  else
    raise exception 'invalid_offer_kind' using errcode = 'P0001';
  end if;
end;
$$;
