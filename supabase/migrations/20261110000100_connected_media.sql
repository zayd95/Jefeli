-- Jëfëli W1.2 — Smart create & connected media.
--
-- 1. Voice in publications: post_media.kind accepts 'audio' (a voice publication, or one
--    narration over photos), with an optional spoken language, a waveform preview and
--    « visite guidée » cues (narration time → photo index). At most one audio per post and
--    never with a video: a video keeps its own sound, nothing is mixed.
-- 2. The public-media bucket accepts audio files; the W1.1 media trigger now checks audio
--    (audio/* file, duration required, ≤ 180 s).
-- 3. Voice messages: audio/* file, ≤ 180 s; a text or voice message may carry the article it is
--    about (product_id), only if the sender can see that article.
-- 4. Statuses: voice statuses, and statuses that point to one of your own publications or
--    articles instead of copying their files (share_to_status). Such a status is visible only to
--    members who can also see the publication, and never to a wider audience than it.
--
-- No rows are changed or deleted. New checks on existing tables accept every existing row.

-- ---------------------------------------------------------------------------
-- 1. Storage: audio in public publications
-- ---------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm',
                               'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg']
where id = 'public-media';

-- ---------------------------------------------------------------------------
-- 2. post_media: audio, language, waveform, cues
-- ---------------------------------------------------------------------------

alter table public.post_media drop constraint post_media_kind_check;
alter table public.post_media add constraint post_media_kind_check check (kind in ('image', 'video', 'audio'));

alter table public.post_media
  add column language text check (language is null or language in ('wo', 'fr', 'ff', 'srr', 'dyo', 'mnk', 'other')),
  add column waveform smallint[] check (waveform is null or (cardinality(waveform) <= 64 and 0 <= all (waveform) and 100 >= all (waveform))),
  add column cues jsonb check (cues is null or (jsonb_typeof(cues) = 'array' and jsonb_array_length(cues) <= 60));

alter table public.post_media add constraint post_media_audio_fields_check
  check (kind = 'audio' or (language is null and waveform is null and cues is null));
alter table public.post_media add constraint post_media_audio_duration_check
  check (kind <> 'audio' or (duration_ms is not null and duration_ms between 1 and 180000 and poster_path is null));

-- ---------------------------------------------------------------------------
-- 3. Declared kind = stored file, now for audio too (W1.1 functions, extended)
-- ---------------------------------------------------------------------------

create or replace function private.assert_media_object(p_bucket text, p_path text, p_kind text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mime text;
begin
  if p_path is null then
    return;
  end if;
  select o.metadata ->> 'mimetype' into mime
  from storage.objects o
  where o.bucket_id = p_bucket and o.name = p_path;
  -- Existence and ownership are checked by the publishing RPCs (private.owns_object); here only
  -- the type. Rows written by trusted server code for files without metadata are not blocked.
  if mime is null then
    return;
  end if;
  if (p_kind = 'video' and mime not like 'video/%')
     or (p_kind = 'image' and mime not like 'image/%')
     or (p_kind = 'audio' and mime not like 'audio/%') then
    raise exception 'invalid_media' using errcode = 'P0001', hint = p_path;
  end if;
end;
$$;
revoke execute on function private.assert_media_object(text, text, text) from public, anon, authenticated;

create or replace function private.check_media_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket text;
  kind text;
begin
  if tg_table_name = 'post_media' then
    bucket := new.bucket;
    kind := new.kind;
  elsif tg_table_name = 'product_media' then
    bucket := 'public-media';
    kind := new.kind;
  else
    bucket := 'private-media';
    kind := new.media_kind;
  end if;
  if kind in ('video', 'audio') and (new.duration_ms is null or new.duration_ms <= 0) then
    raise exception 'video_duration_required' using errcode = 'P0001';
  end if;
  if kind = 'video' and new.duration_ms > 180000 then
    raise exception 'video_too_long' using errcode = 'P0001';
  end if;
  if kind = 'audio' and new.duration_ms > 180000 then
    raise exception 'audio_too_long' using errcode = 'P0001';
  end if;
  if kind in ('image', 'video', 'audio') then
    perform private.assert_media_object(bucket, new.storage_path, kind);
    perform private.assert_media_object(bucket, new.poster_path, 'image');
  end if;
  return new;
end;
$$;
revoke execute on function private.check_media_row() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. create_post: optional voice, never with a video
-- ---------------------------------------------------------------------------

create or replace function public.create_post(
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
  c jsonb;
  i integer := 0;
  author_city text;
  visual jsonb;
  audio jsonb;
  audio_count integer;
  visual_count integer;
  photo_count integer;
  audio_ms integer;
begin
  if p_visibility not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if coalesce(p_intent, 'share') not in ('share', 'seek', 'offer', 'opinion') then
    raise exception 'invalid_intent' using errcode = 'P0001';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    p_media := '[]'::jsonb;
  end if;
  if coalesce(btrim(p_body), '') = '' and jsonb_array_length(p_media) = 0 then
    raise exception 'empty_post' using errcode = 'P0001';
  end if;
  -- A request or a question needs words: a lone photo cannot say what is being looked for.
  if coalesce(p_intent, 'share') in ('seek', 'opinion') and coalesce(btrim(p_body), '') = '' then
    raise exception 'empty_request' using errcode = 'P0001';
  end if;
  bucket := case when p_visibility = 'public' then 'public-media' else 'private-media' end;

  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into visual
  from jsonb_array_elements(p_media) with ordinality as t(e, o) where e ->> 'kind' is distinct from 'audio';
  select coalesce(jsonb_agg(e), '[]'::jsonb) into audio
  from jsonb_array_elements(p_media) e where e ->> 'kind' = 'audio';
  audio_count := jsonb_array_length(audio);
  visual_count := jsonb_array_length(visual);
  select count(*) into photo_count from jsonb_array_elements(visual) e where e ->> 'kind' = 'image';

  -- Photos and videos: same rules as before (owned file, image/video kind, 10 at most).
  perform private.validate_media(visual, bucket, 10);

  if audio_count > 1 then
    raise exception 'too_many_audio' using errcode = 'P0001';
  end if;
  if audio_count = 1 then
    m := audio -> 0;
    -- A video keeps its own sound: no second, unsynchronised track.
    if exists (select 1 from jsonb_array_elements(visual) e where e ->> 'kind' = 'video') then
      raise exception 'audio_with_video' using errcode = 'P0001';
    end if;
    if not private.owns_object(bucket, m ->> 'path') then
      raise exception 'media_not_found' using errcode = 'P0001', hint = m ->> 'path';
    end if;
    if (m ->> 'poster_path') is not null then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if (m -> 'waveform') is not null and jsonb_typeof(m -> 'waveform') <> 'array' then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if (m ->> 'duration_ms') !~ '^[0-9]{1,7}$' then
      raise exception 'video_duration_required' using errcode = 'P0001';
    end if;
    audio_ms := (m ->> 'duration_ms')::integer;
    -- « Visite guidée »: each cue is a moment of the narration and the photo shown then.
    if (m -> 'cues') is not null and jsonb_typeof(m -> 'cues') <> 'null' then
      if jsonb_typeof(m -> 'cues') <> 'array' or photo_count = 0 or photo_count <> visual_count then
        raise exception 'invalid_cues' using errcode = 'P0001';
      end if;
      for c in select * from jsonb_array_elements(m -> 'cues') loop
        if jsonb_typeof(c -> 't') <> 'number' or jsonb_typeof(c -> 'i') <> 'number'
           or (c ->> 't')::numeric < 0 or (c ->> 't')::numeric > audio_ms
           or (c ->> 'i')::numeric < 0 or (c ->> 'i')::numeric >= photo_count
           or (c ->> 'i')::numeric <> trunc((c ->> 'i')::numeric) then
          raise exception 'invalid_cues' using errcode = 'P0001';
        end if;
      end loop;
    end if;
  end if;

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

  for m in select * from jsonb_array_elements(visual) loop
    insert into public.post_media (post_id, owner_id, bucket, kind, storage_path, poster_path, width, height, duration_ms, position)
    values (new_id, uid, bucket, m ->> 'kind', m ->> 'path', m ->> 'poster_path',
      (m ->> 'width')::integer, (m ->> 'height')::integer, (m ->> 'duration_ms')::integer, i);
    i := i + 1;
  end loop;

  if audio_count = 1 then
    m := audio -> 0;
    begin
      insert into public.post_media (post_id, owner_id, bucket, kind, storage_path, duration_ms, position, language, waveform, cues)
      values (new_id, uid, bucket, 'audio', m ->> 'path', audio_ms, i,
        nullif(m ->> 'language', ''),
        case when jsonb_typeof(m -> 'waveform') = 'array'
          then (select array_agg(round(least(greatest(v::numeric, 0), 100))::smallint order by o)
                from jsonb_array_elements_text(m -> 'waveform') with ordinality as w(v, o))
        end,
        case when jsonb_typeof(m -> 'cues') = 'array' then m -> 'cues' end);
    exception when check_violation then
      raise exception 'invalid_media' using errcode = 'P0001';
    end;
  end if;

  insert into public.post_products (post_id, product_id)
  select new_id, pid from unnest(coalesce(p_product_ids, '{}')) pid
  on conflict do nothing;

  return new_id;
end;
$$;
revoke execute on function public.create_post(text, text, jsonb, uuid[], text) from anon, public;
grant execute on function public.create_post(text, text, jsonb, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Voice messages and the article they are about
-- ---------------------------------------------------------------------------

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid;
  ms text;
begin
  other := private.other_member(new.conversation_id, new.sender_id);
  if new.kind <> 'system' and other is not null and private.is_blocked_between(new.sender_id, other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if not private.is_active_user(new.sender_id) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if new.kind in ('image', 'voice') then
    if new.attachment_path is null then
      raise exception 'attachment_required' using errcode = 'P0001';
    end if;
    if auth.uid() is not null and not private.owns_object('private-media', new.attachment_path) then
      raise exception 'media_not_found' using errcode = 'P0001';
    end if;
    perform private.assert_media_object('private-media', new.attachment_path, case when new.kind = 'voice' then 'audio' else 'image' end);
  elsif new.kind = 'text' and btrim(new.body) = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if new.kind = 'voice' and auth.uid() is not null then
    ms := new.attachment_meta ->> 'duration_ms';
    if ms is null or ms !~ '^[0-9]{1,7}(\.[0-9]+)?$' or ms::numeric <= 0 then
      raise exception 'video_duration_required' using errcode = 'P0001';
    end if;
    if ms::numeric > 180000 then
      raise exception 'audio_too_long' using errcode = 'P0001';
    end if;
  end if;
  if new.kind = 'product' and (new.product_id is null or not private.can_view_product(new.product_id)) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  -- Text and voice may say which article they are about; never one the sender cannot see.
  if new.kind in ('text', 'voice') and new.product_id is not null and not private.can_view_product(new.product_id) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Statuses: voice, and references to a publication or an article
-- ---------------------------------------------------------------------------

alter table public.stories drop constraint stories_media_kind_check;
alter table public.stories add constraint stories_media_kind_check
  check (media_kind in ('image', 'video', 'audio', 'post', 'product'));
alter table public.stories alter column storage_path drop not null;
alter table public.stories add column post_id uuid references public.posts (id) on delete cascade;
create index stories_post_idx on public.stories (post_id) where post_id is not null;

-- Own file for image/video/audio; a reference (and no file) for post/product.
alter table public.stories add constraint stories_reference_check check (
  case
    when media_kind in ('image', 'video', 'audio') then storage_path is not null and post_id is null
    when media_kind = 'post' then storage_path is null and poster_path is null and post_id is not null
    else storage_path is null and poster_path is null and post_id is null
  end
);
alter table public.stories add constraint stories_audio_duration_check
  check (media_kind <> 'audio' or (duration_ms is not null and duration_ms between 1 and 180000 and poster_path is null));

-- A referencing status is visible only while what it points to is visible to the viewer.
create or replace function private.can_view_story(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id
      and s.deleted_at is null
      and (s.media_kind <> 'post' or private.can_view_post(s.post_id))
      and (s.media_kind <> 'product' or (s.product_id is not null and private.can_view_product(s.product_id)))
      and (
        s.author_id = auth.uid()
        or private.is_staff()
        or (
          s.moderation_status = 'active'
          and private.audience_allows(auth.uid(), s.author_id, s.audience)
          and (s.expires_at > now() or exists (select 1 from public.highlight_items hi where hi.story_id = s.id))
        )
      )
  );
$$;
grant execute on function private.can_view_story(uuid) to anon, authenticated;

create or replace function public.create_story(
  p_media_kind text,
  p_path text,
  p_poster_path text,
  p_width integer,
  p_height integer,
  p_duration_ms integer,
  p_caption text,
  p_audience text,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  aud text;
  new_id uuid;
begin
  aud := coalesce(p_audience, (select default_status_audience from public.account_settings where user_id = uid), 'followers');
  if aud not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if p_media_kind not in ('image', 'video', 'audio') or not private.owns_object('private-media', p_path) then
    raise exception 'media_not_found' using errcode = 'P0001';
  end if;
  if p_poster_path is not null and (p_media_kind = 'audio' or not private.owns_object('private-media', p_poster_path)) then
    raise exception 'media_not_found' using errcode = 'P0001';
  end if;
  if p_product_id is not null and not exists (select 1 from public.products where id = p_product_id and seller_id = uid) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  perform private.enforce_rate_limit('story', 40, interval '1 day');
  insert into public.stories (author_id, media_kind, storage_path, poster_path, width, height, duration_ms, caption, audience, product_id)
  values (uid, p_media_kind, p_path, p_poster_path, p_width, p_height, p_duration_ms, coalesce(p_caption, ''), aud, p_product_id)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.create_story(text, text, text, integer, integer, integer, text, text, uuid) from anon, public;
grant execute on function public.create_story(text, text, text, integer, integer, integer, text, text, uuid) to authenticated;

-- Share one of your own publications or articles as a 24-hour status, without copying files.
create or replace function public.share_to_status(
  p_post_id uuid default null,
  p_product_id uuid default null,
  p_caption text default '',
  p_audience text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  aud text;
  post_vis text;
  new_id uuid;
begin
  if (p_post_id is null) = (p_product_id is null) then
    raise exception 'invalid_reference' using errcode = 'P0001';
  end if;
  aud := coalesce(p_audience, (select default_status_audience from public.account_settings where user_id = uid), 'followers');
  if aud not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_caption, '')) > 200 then
    raise exception 'caption_too_long' using errcode = 'P0001';
  end if;

  if p_post_id is not null then
    select visibility into post_vis from public.posts
    where id = p_post_id and author_id = uid and deleted_at is null and moderation_status = 'active';
    if post_vis is null then
      raise exception 'invalid_reference' using errcode = 'P0001';
    end if;
    -- Never wider than the publication itself.
    if (post_vis = 'followers' and aud = 'public') or (post_vis = 'friends' and aud <> 'friends') then
      raise exception 'audience_wider_than_post' using errcode = 'P0001';
    end if;
  else
    if not exists (
      select 1 from public.products
      where id = p_product_id and seller_id = uid and status in ('active', 'reserved')
    ) then
      raise exception 'invalid_product' using errcode = 'P0001';
    end if;
  end if;

  perform private.enforce_rate_limit('story', 40, interval '1 day');
  insert into public.stories (author_id, media_kind, storage_path, post_id, product_id, caption, audience)
  values (uid, case when p_post_id is not null then 'post' else 'product' end, null, p_post_id, p_product_id,
    coalesce(p_caption, ''), aud)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.share_to_status(uuid, uuid, text, text) from anon, public;
grant execute on function public.share_to_status(uuid, uuid, text, text) to authenticated;
