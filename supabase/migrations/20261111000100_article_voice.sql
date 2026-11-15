-- Jëfëli W1.3 — an article can carry its seller's voice.
--
-- The Article editor offers an optional narration (« Présenter en voix »), shown on the article
-- page over its photos, with the same « visite guidée » cues as a publication. It is stored with
-- the article (product_media, kind 'audio'), so no publication is created behind the seller's back.
--
-- Same rules as W1.2 publications: at most one voice, never with a video (a video keeps its own
-- sound), 180 s at most, an audio/* file the seller owns, cues inside the voice and pointing to
-- existing photos. The voice travels in the existing p_media list: create_listing and
-- set_listing_media keep their signatures. No rows are changed.

alter table public.product_media drop constraint product_media_kind_check;
alter table public.product_media add constraint product_media_kind_check check (kind in ('image', 'video', 'audio'));

alter table public.product_media
  add column language text check (language is null or language in ('wo', 'fr', 'ff', 'srr', 'dyo', 'mnk', 'other')),
  add column waveform smallint[] check (waveform is null or (cardinality(waveform) <= 64 and 0 <= all (waveform) and 100 >= all (waveform))),
  add column cues jsonb check (cues is null or (jsonb_typeof(cues) = 'array' and jsonb_array_length(cues) <= 60));

alter table public.product_media add constraint product_media_audio_fields_check
  check (kind = 'audio' or (language is null and waveform is null and cues is null));
alter table public.product_media add constraint product_media_audio_duration_check
  check (kind <> 'audio' or (duration_ms is not null and duration_ms between 1 and 180000 and poster_path is null));

-- Splits a media list into its visual part (validated as before) and at most one voice (validated
-- like a publication's). Returns the voice element, or null.
create or replace function private.validate_listing_voice(p_media jsonb, p_bucket text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  audio jsonb;
  visual_count integer;
  photo_count integer;
  c jsonb;
  ms integer;
begin
  select count(*) filter (where e ->> 'kind' is distinct from 'audio'),
         count(*) filter (where e ->> 'kind' = 'image')
    into visual_count, photo_count
  from jsonb_array_elements(p_media) e;
  if (select count(*) from jsonb_array_elements(p_media) e where e ->> 'kind' = 'audio') > 1 then
    raise exception 'too_many_audio' using errcode = 'P0001';
  end if;
  select e into audio from jsonb_array_elements(p_media) e where e ->> 'kind' = 'audio';
  if audio is null then
    return null;
  end if;
  if exists (select 1 from jsonb_array_elements(p_media) e where e ->> 'kind' = 'video') then
    raise exception 'audio_with_video' using errcode = 'P0001';
  end if;
  if not private.owns_object(p_bucket, audio ->> 'path') then
    raise exception 'media_not_found' using errcode = 'P0001', hint = audio ->> 'path';
  end if;
  if (audio ->> 'poster_path') is not null or ((audio -> 'waveform') is not null and jsonb_typeof(audio -> 'waveform') not in ('array', 'null')) then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;
  if coalesce(audio ->> 'duration_ms', '') !~ '^[0-9]{1,7}$' then
    raise exception 'video_duration_required' using errcode = 'P0001';
  end if;
  ms := (audio ->> 'duration_ms')::integer;
  if (audio -> 'cues') is not null and jsonb_typeof(audio -> 'cues') <> 'null' then
    if jsonb_typeof(audio -> 'cues') <> 'array' or photo_count = 0 or photo_count <> visual_count then
      raise exception 'invalid_cues' using errcode = 'P0001';
    end if;
    for c in select * from jsonb_array_elements(audio -> 'cues') loop
      if jsonb_typeof(c -> 't') <> 'number' or jsonb_typeof(c -> 'i') <> 'number'
         or (c ->> 't')::numeric < 0 or (c ->> 't')::numeric > ms
         or (c ->> 'i')::numeric < 0 or (c ->> 'i')::numeric >= photo_count
         or (c ->> 'i')::numeric <> trunc((c ->> 'i')::numeric) then
        raise exception 'invalid_cues' using errcode = 'P0001';
      end if;
    end loop;
  end if;
  return audio;
end;
$$;
revoke execute on function private.validate_listing_voice(jsonb, text) from public, anon, authenticated;

-- Inserts an article's media: the photos/video as before, then the voice (if any) last.
create or replace function private.insert_listing_media(p_product_id uuid, p_owner uuid, p_media jsonb, p_audio jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb;
  i integer := 0;
begin
  for m in select e from jsonb_array_elements(p_media) e where e ->> 'kind' is distinct from 'audio' loop
    insert into public.product_media (product_id, owner_id, kind, storage_path, poster_path, width, height, duration_ms, position)
    values (p_product_id, p_owner, m ->> 'kind', m ->> 'path', m ->> 'poster_path',
      (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_ms')::integer, i);
    i := i + 1;
  end loop;
  if p_audio is not null then
    begin
      insert into public.product_media (product_id, owner_id, kind, storage_path, duration_ms, position, language, waveform, cues)
      values (p_product_id, p_owner, 'audio', p_audio ->> 'path', (p_audio ->> 'duration_ms')::integer, i,
        nullif(p_audio ->> 'language', ''),
        case when jsonb_typeof(p_audio -> 'waveform') = 'array'
          then (select array_agg(round(least(greatest(v::numeric, 0), 100))::smallint order by o)
                from jsonb_array_elements_text(p_audio -> 'waveform') with ordinality as w(v, o))
        end,
        case when jsonb_typeof(p_audio -> 'cues') = 'array' then p_audio -> 'cues' end);
    exception when check_violation then
      raise exception 'invalid_media' using errcode = 'P0001';
    end;
  end if;
end;
$$;
revoke execute on function private.insert_listing_media(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;

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
  if mode = 'on_request' then
    price := null; -- never store a hidden price
  end if;
  if price is not null and price < 1 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if mode = 'fixed' and p_listing_mode <> 'trade' and price is null then
    raise exception 'price_required' using errcode = 'P0001';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into visual
  from jsonb_array_elements(p_media) with ordinality as t(e, o) where e ->> 'kind' is distinct from 'audio';
  -- A voice alone is not an article: photos or a video are still required.
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
revoke execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode,
  integer, text, text, text[], text, jsonb, uuid, text) from anon, public;
grant execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode,
  integer, text, text, text[], text, jsonb, uuid, text) to authenticated;

create or replace function public.set_listing_media(p_product_id uuid, p_media jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  visual jsonb;
  audio jsonb;
begin
  if not exists (select 1 from public.products where id = p_product_id and seller_id = uid) then
    raise exception 'not_found' using errcode = 'P0001';
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
  delete from public.product_media where product_id = p_product_id;
  perform private.insert_listing_media(p_product_id, uid, visual, audio);
end;
$$;
revoke execute on function public.set_listing_media(uuid, jsonb) from anon, public;
grant execute on function public.set_listing_media(uuid, jsonb) to authenticated;
