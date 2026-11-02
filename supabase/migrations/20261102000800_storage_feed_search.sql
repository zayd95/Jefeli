-- Jëfëli — storage buckets & policies, explainable home feed, search, realtime.

-- ---------------------------------------------------------------------------
-- Storage
--   avatars        public   profile photos / covers            {uid}/...
--   public-media   public   public posts + listing media       {uid}/...
--   private-media  private  statuses, non-public posts, DMs     {uid}/...   (signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('public-media', 'public-media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('private-media', 'private-media', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm',
          'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Who may read a private object? Its owner, members of the conversation it was sent in,
-- people allowed to see the status/post it belongs to, or staff handling a report on it.
create or replace function private.can_read_private_media(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.messages m
            where m.attachment_path = p_path and m.deleted_at is null and private.is_member(m.conversation_id))
    or exists (select 1 from public.stories s
               where (s.storage_path = p_path or s.poster_path = p_path) and private.can_view_story(s.id))
    or exists (select 1 from public.post_media pm
               where (pm.storage_path = p_path or pm.poster_path = p_path) and pm.bucket = 'private-media'
                 and private.can_view_post(pm.post_id))
    or private.is_reported_evidence(p_path);
$$;
grant execute on function private.can_read_private_media(text) to authenticated;

create policy "jefeli: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'public-media', 'private-media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_active_user((select auth.uid()))
  );

create policy "jefeli: update own objects" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'public-media', 'private-media')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check ((storage.foldername(name))[1] = (select auth.uid())::text);

create policy "jefeli: delete own objects" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'public-media', 'private-media')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Public buckets are served by public URL; listing is restricted to one's own folder.
create policy "jefeli: list own public objects" on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars', 'public-media') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "jefeli: read authorized private objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private-media'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or private.can_read_private_media(name))
  );

-- ---------------------------------------------------------------------------
-- Home feed (deterministic, explainable — no "AI" claims)
--
--   for_you    : followed (+3), friends (+3), same city (+1.5), interest category (+1),
--                new seller < 30 days (+0.6), light engagement boost, minus age decay.
--   following  : chronological posts from people you follow / friends / yourself.
--   nearby     : chronological posts from your (voluntarily set) city.
--
-- SECURITY INVOKER: posts RLS (visibility, blocks, moderation, privacy) applies on top.
-- ---------------------------------------------------------------------------

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
      po.city,
      po.like_count,
      po.comment_count,
      (po.author_id = auth.uid()) as is_self,
      exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = po.author_id and f.status = 'accepted') as is_followed,
      exists (select 1 from public.friendships fr where (fr.user_a = auth.uid() and fr.user_b = po.author_id) or (fr.user_b = auth.uid() and fr.user_a = po.author_id)) as is_friend,
      (po.city is not null and po.city = (select city from me)) as is_nearby,
      exists (
        select 1 from public.post_products pp join public.products pr on pr.id = pp.product_id
        where pp.post_id = po.id and pr.category_slug = any (coalesce((select interests from me), '{}'))
      ) as is_interest,
      (select a.created_at > now() - interval '30 days' from public.profiles a where a.id = po.author_id) as is_new_seller
    from public.posts po
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
  )
  select
    c.id,
    case
      when c.is_self then 'self'
      when c.is_friend then 'friend'
      when c.is_followed then 'following'
      when c.is_nearby then 'nearby'
      when c.is_interest then 'interest'
      when c.is_new_seller then 'new_seller'
      else 'discover'
    end,
    case when p_tab = 'for_you' then
      (case when c.is_followed then 3 else 0 end)
      + (case when c.is_friend then 3 else 0 end)
      + (case when c.is_self then 1 else 0 end)
      + (case when c.is_nearby then 1.5 else 0 end)
      + (case when c.is_interest then 1 else 0 end)
      + (case when coalesce(c.is_new_seller, false) then 0.6 else 0 end)
      + 0.4 * ln(1 + c.like_count + 2 * c.comment_count)
      - extract(epoch from (now() - c.created_at)) / 3600.0 / 18.0
    else extract(epoch from c.created_at) end,
    c.created_at
  from candidates c
  order by 3 desc, c.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;
grant execute on function public.get_feed(text, integer, integer, timestamptz) to anon, authenticated;

-- Listing feeds and search share one function. Returns product rows (RLS applies) so
-- PostgREST can embed seller + media on the result.
--   p_mode: 'recent' | 'occasions' (used/refurbished) | 'troc' (trade-capable) | 'nearby'
create or replace function public.browse_products(
  p_mode text default 'recent',
  p_query text default null,
  p_category text default null,
  p_city text default null,
  p_condition text default null,
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
    and (p_mode <> 'nearby' or (pr.city is not null and pr.city = coalesce(p_city, (select city from public.profiles where id = auth.uid()))))
    and (
      p_query is null or btrim(p_query) = ''
      or pr.search_text like '%' || private.normalize_text(btrim(p_query)) || '%'
      or extensions.word_similarity(private.normalize_text(btrim(p_query)), pr.search_text) > 0.45
      or exists (select 1 from public.categories c where c.slug = pr.category_slug
                 and private.normalize_text(c.name) like '%' || private.normalize_text(btrim(p_query)) || '%')
    )
  order by
    case when p_query is null or btrim(p_query) = '' then 0
         else -extensions.word_similarity(private.normalize_text(btrim(p_query)), pr.search_text) end,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;
grant execute on function public.browse_products(text, text, text, text, text, integer, integer) to anon, authenticated;

create or replace function public.search_profiles(p_query text, p_city text default null, p_limit integer default 20)
returns setof public.profiles
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.profiles p
  where p.status = 'active'
    and p.onboarded_at is not null
    and not private.is_blocked_between(auth.uid(), p.id)
    and (p_city is null or private.normalize_text(p.city) = private.normalize_text(p_city))
    and (
      p_query is null or btrim(p_query) = ''
      or p.handle like '%' || lower(btrim(p_query)) || '%'
      or private.normalize_text(p.display_name) like '%' || private.normalize_text(btrim(p_query)) || '%'
      or extensions.word_similarity(private.normalize_text(btrim(p_query)), private.normalize_text(p.display_name || ' ' || p.handle)) > 0.5
      or private.normalize_text(coalesce(p.neighborhood, '') || ' ' || coalesce(p.city, '')) like '%' || private.normalize_text(btrim(p_query)) || '%'
    )
  order by
    case when p_query is null or btrim(p_query) = '' then 0
         else -extensions.word_similarity(private.normalize_text(btrim(p_query)), private.normalize_text(p.display_name || ' ' || p.handle)) end,
    p.followers_count desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.search_profiles(text, text, integer) to anon, authenticated;

-- Cities that actually have listings (for the explorer's locality chips) — real counts only.
create or replace function public.active_cities(p_limit integer default 12)
returns table (city text, listings integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.city, count(*)::integer
  from public.products pr
  where pr.status = 'active' and pr.moderation_status = 'active' and pr.city is not null
  group by pr.city
  order by 2 desc, 1
  limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.active_cities(integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes honours RLS for each subscriber)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.messages,
  public.conversations,
  public.conversation_members,
  public.offers,
  public.notifications,
  public.live_sessions,
  public.live_comments,
  public.live_pins;
