-- Rollback for the pending staging migrations (W1 → W1.2), captured READ-ONLY from jefeli-staging
-- on 2026-11-08 before anything was applied. These are staging's CURRENT definitions, which can differ
-- from the repository's (staging received some changes through the dashboard). Apply in one transaction,
-- in this order, only if the migrations must be undone. See docs/STAGING_MIGRATION_PLAN.md.

begin;

-- 1. Objects the migrations add (dropped first; data in feedback is lost, export it before).
drop trigger if exists post_media_check on public.post_media;
drop trigger if exists product_media_check on public.product_media;
drop trigger if exists stories_media_check on public.stories;
drop function if exists public.share_to_status(uuid, uuid, text, text);
drop function if exists public.list_orphaned_media(interval, integer);
drop function if exists private.check_media_row();
drop function if exists private.assert_media_object(text, text, text);
alter table public.post_media drop constraint if exists post_media_video_duration_check, drop constraint if exists post_media_audio_duration_check, drop constraint if exists post_media_audio_fields_check;
alter table public.product_media drop constraint if exists product_media_video_duration_check;
-- Statuses that only W1.2 allows (voice, or pointing to a post/article) must be removed before the old checks return:
delete from public.stories where media_kind not in ('image', 'video') or storage_path is null;
alter table public.stories drop constraint if exists stories_video_duration_check, drop constraint if exists stories_audio_duration_check, drop constraint if exists stories_reference_check;
-- Voice rows in publications must be removed before the old kind check returns:
delete from public.post_media where kind = 'audio';
alter table public.post_media drop column if exists language, drop column if exists waveform, drop column if exists cues;
drop index if exists public.stories_post_idx;
alter table public.stories drop column if exists post_id;
alter table public.stories alter column storage_path set not null;

-- 2. Constraints, as they are on staging now.
alter table public.post_media drop constraint if exists post_media_kind_check;
alter table public.post_media add constraint post_media_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'video'::text])));
alter table public.stories drop constraint if exists stories_media_kind_check;
alter table public.stories add constraint stories_media_kind_check CHECK ((media_kind = ANY (ARRAY['image'::text, 'video'::text])));
alter table public.stories drop constraint if exists stories_duration_ms_check;
alter table public.stories add constraint stories_duration_ms_check CHECK (((duration_ms IS NULL) OR ((duration_ms >= 0) AND (duration_ms <= 60000))));

-- 3. Functions, as they are on staging now.
CREATE OR REPLACE FUNCTION public.review_verification_request(p_request_id uuid, p_approve boolean, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  vr public.verification_requests;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into vr from public.verification_requests where id = p_request_id for update;
  if not found or vr.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.verification_requests set status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(coalesce(p_note, ''), 1000)
  where id = vr.id;
  if p_approve then
    update public.profiles set verification_level = 'merchant_verified', is_merchant = true where id = vr.user_id;
    insert into public.moderation_actions (moderator_id, action, target_type, target_id, target_owner_id, reason)
    values (auth.uid(), 'grant_verification', 'profile', vr.user_id, vr.user_id, left(coalesce(p_note, ''), 1000));
  end if;
  perform private.notify(vr.user_id, null, 'verification_result', 'verification_request', vr.id,
    jsonb_build_object('approved', p_approve));
  perform private.audit('verification_review', 'profile', vr.user_id::text, jsonb_build_object('approved', p_approve));
end;
$function$;

CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.can_view_story(p_story_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id
      and s.deleted_at is null
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
$function$;

CREATE OR REPLACE FUNCTION private.messages_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  other uuid;
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
  elsif new.kind = 'text' and btrim(new.body) = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if new.kind = 'product' and (new.product_id is null or not private.can_view_product(new.product_id)) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_post(p_body text, p_visibility text, p_media jsonb, p_product_ids uuid[] DEFAULT '{}'::uuid[], p_intent text DEFAULT 'share'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_story(p_media_kind text, p_path text, p_poster_path text, p_width integer, p_height integer, p_duration_ms integer, p_caption text, p_audience text, p_product_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := private.require_user();
  aud text;
  new_id uuid;
begin
  aud := coalesce(p_audience, (select default_status_audience from public.account_settings where user_id = uid), 'followers');
  if aud not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if p_media_kind not in ('image', 'video') or not private.owns_object('private-media', p_path) then
    raise exception 'media_not_found' using errcode = 'P0001';
  end if;
  if p_poster_path is not null and not private.owns_object('private-media', p_poster_path) then
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
$function$;

-- 4. Storage: the upload policy and the public bucket's allowed types, as they are now.
drop policy if exists "jefeli: upload to own folder" on storage.objects;
create policy "jefeli: upload to own folder" on storage.objects for insert to authenticated with check (((bucket_id = ANY (ARRAY['avatars'::text, 'public-media'::text, 'private-media'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND private.is_active_user(( SELECT auth.uid() AS uid))));
drop function if exists private.upload_quota_ok();
update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'] where id = 'public-media';

-- 5. The feedback table (W1, 20261108000100) — export its rows first if any.
drop table if exists public.feedback;

commit;
