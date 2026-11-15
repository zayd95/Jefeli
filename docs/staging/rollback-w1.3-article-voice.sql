-- Rollback for 20261111000100_article_voice.sql (W1.3), captured READ-ONLY from jefeli-staging on 2026-11-08.
-- Undo this one FIRST (it is applied last). Article voices are deleted (their files stay in storage until
-- cleanup-media lists them). See docs/STAGING_MIGRATION_PLAN.md.

begin;

delete from public.product_media where kind = 'audio';
alter table public.product_media drop constraint if exists product_media_audio_fields_check, drop constraint if exists product_media_audio_duration_check;
alter table public.product_media drop column if exists language, drop column if exists waveform, drop column if exists cues;
alter table public.product_media drop constraint if exists product_media_kind_check;
alter table public.product_media add constraint product_media_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'video'::text])));

CREATE OR REPLACE FUNCTION public.create_listing(p_title text, p_description text, p_price_xof integer, p_category_slug text, p_condition item_condition, p_listing_mode listing_mode, p_quantity integer, p_city text, p_neighborhood text, p_delivery_options text[], p_delivery_notes text, p_media jsonb, p_collection_id uuid DEFAULT NULL::uuid, p_price_mode text DEFAULT 'fixed'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_listing_media(p_product_id uuid, p_media jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := private.require_user();
  m jsonb;
  i integer := 0;
begin
  if not exists (select 1 from public.products where id = p_product_id and seller_id = uid) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) < 1 then
    raise exception 'media_required' using errcode = 'P0001';
  end if;
  perform private.validate_media(p_media, 'public-media', 10);
  delete from public.product_media where product_id = p_product_id;
  for m in select * from jsonb_array_elements(p_media) loop
    insert into public.product_media (product_id, owner_id, kind, storage_path, poster_path, width, height, duration_ms, position)
    values (p_product_id, uid, m ->> 'kind', m ->> 'path', m ->> 'poster_path',
      (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_ms')::integer, i);
    i := i + 1;
  end loop;
end;
$function$;

drop function if exists private.insert_listing_media(uuid, uuid, jsonb, jsonb);
drop function if exists private.validate_listing_voice(jsonb, text);

commit;
