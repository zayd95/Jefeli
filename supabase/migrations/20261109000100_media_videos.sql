-- Jëfëli W1.1 — media-first commerce: three-minute videos, enforced on the server.
--
-- 1. One limit everywhere: a video is at most 180 s (exactly 180 s allowed), in publications,
--    listings and 24-hour statuses. Statuses were capped at 60 s, posts/listings at 10 min.
-- 2. What a member declares must match the file: a « video » must be a video/* object, an
--    « image » an image/* object, a poster an image; a video must declare its duration.
--    The storage server records the real MIME type (storage.objects.metadata), the client
--    cannot change it. The duration itself is declared by the client (no transcoding service
--    yet), so the file-size limit of the bucket stays the hard bound on cost.
-- 3. Upload quota per member (storage insert policy): 300 files per rolling 24 h and 2 GB
--    stored in total, so one account cannot consume unlimited storage or bandwidth.
-- 4. list_orphaned_media(): files that nothing references any more (a publication, listing,
--    status, message, profile photo or report evidence), older than 48 h, for the
--    cleanup-media function (service role only). Shared files are never listed while any
--    row still references them.
--
-- Nothing is deleted or rewritten by this migration. The stricter checks on post_media and
-- product_media are NOT VALID: they apply to new rows and never fail on existing data.

-- ---------------------------------------------------------------------------
-- 1. Durations
-- ---------------------------------------------------------------------------

alter table public.stories drop constraint stories_duration_ms_check;
alter table public.stories add constraint stories_duration_ms_check
  check (duration_ms is null or duration_ms between 0 and 180000);

alter table public.post_media add constraint post_media_video_duration_check
  check (kind <> 'video' or (duration_ms is not null and duration_ms between 1 and 180000)) not valid;
alter table public.product_media add constraint product_media_video_duration_check
  check (kind <> 'video' or (duration_ms is not null and duration_ms between 1 and 180000)) not valid;
alter table public.stories add constraint stories_video_duration_check
  check (media_kind <> 'video' or (duration_ms is not null and duration_ms between 1 and 180000)) not valid;

-- ---------------------------------------------------------------------------
-- 2. Declared kind must match the stored file
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
  if (p_kind = 'video' and mime not like 'video/%') or (p_kind = 'image' and mime not like 'image/%') then
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
  if kind = 'video' and (new.duration_ms is null or new.duration_ms <= 0) then
    raise exception 'video_duration_required' using errcode = 'P0001';
  end if;
  if kind = 'video' and new.duration_ms > 180000 then
    raise exception 'video_too_long' using errcode = 'P0001';
  end if;
  perform private.assert_media_object(bucket, new.storage_path, kind);
  perform private.assert_media_object(bucket, new.poster_path, 'image');
  return new;
end;
$$;
revoke execute on function private.check_media_row() from public, anon, authenticated;

create trigger post_media_check before insert on public.post_media
  for each row execute function private.check_media_row();
create trigger product_media_check before insert on public.product_media
  for each row execute function private.check_media_row();
create trigger stories_media_check before insert on public.stories
  for each row execute function private.check_media_row();

-- ---------------------------------------------------------------------------
-- 3. Upload quota
-- ---------------------------------------------------------------------------

create or replace function private.upload_quota_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from storage.objects o
      where o.owner_id = (select auth.uid())::text and o.created_at > now() - interval '24 hours') < 300
    and
    (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      where o.owner_id = (select auth.uid())::text) < 2147483648;
$$;
-- Called by the storage insert policy below.
grant execute on function private.upload_quota_ok() to authenticated;

drop policy "jefeli: upload to own folder" on storage.objects;
create policy "jefeli: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'public-media', 'private-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_active_user((select auth.uid()))
    and private.upload_quota_ok()
  );

-- ---------------------------------------------------------------------------
-- 4. Orphaned files (service role only)
-- ---------------------------------------------------------------------------

create or replace function public.list_orphaned_media(p_min_age interval default interval '48 hours', p_limit integer default 500)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('avatars', 'public-media', 'private-media')
    and o.created_at < now() - greatest(p_min_age, interval '24 hours')
    and not exists (select 1 from public.post_media pm where pm.storage_path = o.name or pm.poster_path = o.name)
    and not exists (select 1 from public.product_media x where x.storage_path = o.name or x.poster_path = o.name)
    and not exists (
      select 1 from public.stories s
      where (s.storage_path = o.name or s.poster_path = o.name)
        and (s.deleted_at is null or exists (select 1 from public.highlight_items hi where hi.story_id = s.id))
    )
    and not exists (select 1 from public.messages m where m.attachment_path = o.name)
    and not exists (select 1 from public.profiles p where p.avatar_path = o.name or p.cover_path = o.name)
    and not private.is_reported_evidence(o.name)
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;
revoke execute on function public.list_orphaned_media(interval, integer) from public, anon, authenticated;
grant execute on function public.list_orphaned_media(interval, integer) to service_role;
