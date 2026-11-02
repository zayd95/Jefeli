-- Jëfëli — social content: posts (personal or product-tagged), media, likes, one-level
-- comments, saves; 24h statuses with views/likes and highlights.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2200),
  kind text not null default 'personal' check (kind in ('personal', 'product')),
  -- Audience is fixed at publication: media bucket (public vs private) depends on it.
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'friends')),
  city text,
  moderation_status public.moderation_state not null default 'active',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  save_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
alter table public.posts enable row level security;
create index posts_author_idx on public.posts (author_id, created_at desc) where deleted_at is null;
create index posts_recent_idx on public.posts (created_at desc) where deleted_at is null and moderation_status = 'active';
create index posts_city_idx on public.posts (city, created_at desc) where deleted_at is null;

create trigger posts_updated_at before update on public.posts
  for each row execute function private.set_updated_at();

create or replace function private.posts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  if old.deleted_at is not null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger posts_before_update before update on public.posts
  for each row execute function private.posts_before_update();

create or replace function private.refresh_post_count(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set posts_count = (
    select count(*) from public.posts po
    where po.author_id = p.id and po.deleted_at is null and po.moderation_status = 'active'
  ) where p.id = uid;
$$;

create or replace function private.posts_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_post_count(coalesce(new.author_id, old.author_id));
  return null;
end;
$$;
create trigger posts_after_change after insert or update of deleted_at, moderation_status or delete on public.posts
  for each row execute function private.posts_after_change();

create or replace function private.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and (
        p.author_id = auth.uid()
        or private.is_staff()
        or (p.moderation_status = 'active' and private.audience_allows(auth.uid(), p.author_id, p.visibility))
      )
  );
$$;
grant execute on function private.can_view_post(uuid) to anon, authenticated;

create policy posts_select on public.posts
  for select to anon, authenticated
  using (
    deleted_at is null
    and (
      author_id = (select auth.uid())
      or (select private.is_staff())
      or (moderation_status = 'active' and private.audience_allows((select auth.uid()), author_id, visibility))
    )
  );
create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));

revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
-- Creation through public.create_post(). Owners can edit text or soft-delete.
grant update (body, deleted_at) on public.posts to authenticated;

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null check (bucket in ('public-media', 'private-media')),
  kind text not null check (kind in ('image', 'video')),
  storage_path text not null,
  poster_path text,
  width integer check (width is null or width between 1 and 10000),
  height integer check (height is null or height between 1 and 10000),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  check (storage_path like owner_id::text || '/%'),
  check (poster_path is null or poster_path like owner_id::text || '/%')
);
alter table public.post_media enable row level security;
create index post_media_post_idx on public.post_media (post_id, position);
create index post_media_path_idx on public.post_media (storage_path);

create policy post_media_select on public.post_media
  for select to anon, authenticated using (private.can_view_post(post_id));
revoke all on public.post_media from anon, authenticated;
grant select on public.post_media to anon, authenticated;

create table public.post_products (
  post_id uuid not null references public.posts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  primary key (post_id, product_id)
);
alter table public.post_products enable row level security;
create index post_products_product_idx on public.post_products (product_id);
create policy post_products_select on public.post_products
  for select to anon, authenticated
  using (private.can_view_post(post_id) and private.can_view_product(product_id));
revoke all on public.post_products from anon, authenticated;
grant select on public.post_products to anon, authenticated;

create or replace function public.create_post(
  p_body text,
  p_visibility text,
  p_media jsonb,
  p_product_ids uuid[] default '{}'
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
  i integer := 0;
  author_city text;
begin
  if p_visibility not in ('public', 'followers', 'friends') then
    raise exception 'invalid_visibility' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_body), '') = '' and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0 then
    raise exception 'empty_post' using errcode = 'P0001';
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

  insert into public.posts (author_id, body, visibility, kind, city)
  values (uid, coalesce(p_body, ''), p_visibility,
    case when cardinality(coalesce(p_product_ids, '{}')) > 0 then 'product' else 'personal' end,
    author_city)
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
$$;
revoke execute on function public.create_post(text, text, jsonb, uuid[]) from anon, public;
grant execute on function public.create_post(text, text, jsonb, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Likes, comments, saves
-- ---------------------------------------------------------------------------

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

create policy post_likes_select on public.post_likes
  for select to anon, authenticated
  using (user_id = (select auth.uid()) or private.can_view_post(post_id));
create policy post_likes_insert on public.post_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_user((select auth.uid()))
    and private.can_view_post(post_id));
create policy post_likes_delete on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.post_likes from anon, authenticated;
grant select on public.post_likes to anon, authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;
grant delete on public.post_likes to authenticated;
create trigger post_likes_rate_limit before insert on public.post_likes
  for each row execute function private.rate_limit_trigger('like', '600', '1 hour');

create table public.post_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_saves enable row level security;
create index post_saves_post_idx on public.post_saves (post_id);
create policy post_saves_select_own on public.post_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy post_saves_insert_own on public.post_saves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_post(post_id));
create policy post_saves_delete_own on public.post_saves
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.post_saves from anon, authenticated;
grant select, delete on public.post_saves to authenticated;
grant insert (user_id, post_id) on public.post_saves to authenticated;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  moderation_status public.moderation_state not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.comments enable row level security;
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create trigger comments_updated_at before update on public.comments
  for each row execute function private.set_updated_at();
create trigger comments_rate_limit before insert on public.comments
  for each row execute function private.rate_limit_trigger('comment', '60', '1 hour');

create or replace function private.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  parent public.comments;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if private.is_blocked_between(new.author_id, post_author) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if not found or parent.post_id <> new.post_id or parent.parent_id is not null then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function private.comments_before_insert();

create or replace function private.refresh_post_counters(pid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set
    like_count = (select count(*) from public.post_likes where post_id = pid),
    comment_count = (select count(*) from public.comments c
                     where c.post_id = pid and c.deleted_at is null and c.moderation_status = 'active'),
    save_count = (select count(*) from public.post_saves where post_id = pid)
  where id = pid;
$$;

create or replace function private.post_counters_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_post_counters(coalesce(new.post_id, old.post_id));
  return null;
end;
$$;
create trigger post_likes_counters after insert or delete on public.post_likes
  for each row execute function private.post_counters_trigger();
create trigger post_saves_counters after insert or delete on public.post_saves
  for each row execute function private.post_counters_trigger();
create trigger comments_counters after insert or update of deleted_at, moderation_status or delete on public.comments
  for each row execute function private.post_counters_trigger();

create policy comments_select on public.comments
  for select to anon, authenticated
  using (
    deleted_at is null
    and private.can_view_post(post_id)
    and not private.is_blocked_between((select auth.uid()), author_id)
    and (moderation_status = 'active' or author_id = (select auth.uid()) or (select private.is_staff()))
  );
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_active_user((select auth.uid()))
    and private.can_view_post(post_id)
  );
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and deleted_at is null)
  with check (author_id = (select auth.uid()));
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (post_id, author_id, parent_id, body) on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;

-- The post author may remove comments under their own post.
create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  update public.comments c set deleted_at = now()
  where c.id = p_comment_id and c.deleted_at is null
    and (c.author_id = uid or exists (select 1 from public.posts p where p.id = c.post_id and p.author_id = uid));
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.delete_comment(uuid) from anon, public;
grant execute on function public.delete_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Statuses (24h stories) and highlights
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_kind text not null check (media_kind in ('image', 'video')),
  storage_path text not null,
  poster_path text,
  width integer,
  height integer,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 60000),
  caption text not null default '' check (char_length(caption) <= 200),
  audience text not null check (audience in ('public', 'followers', 'friends')),
  product_id uuid references public.products (id) on delete set null,
  moderation_status public.moderation_state not null default 'active',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz,
  check (storage_path like author_id::text || '/%'),
  check (poster_path is null or poster_path like author_id::text || '/%')
);
alter table public.stories enable row level security;
create index stories_author_idx on public.stories (author_id, created_at desc) where deleted_at is null;
create index stories_expiry_idx on public.stories (expires_at) where deleted_at is null;
create index stories_path_idx on public.stories (storage_path);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 30),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.highlights enable row level security;
create index highlights_owner_idx on public.highlights (owner_id, position);

create table public.highlight_items (
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (highlight_id, story_id)
);
alter table public.highlight_items enable row level security;
create index highlight_items_story_idx on public.highlight_items (story_id);

-- A status is visible while < 24h old, or forever once its owner saved it as a highlight.
-- The expiry is enforced here, at read time: a late cleanup job never leaks old statuses.
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

create policy stories_select on public.stories
  for select to anon, authenticated
  using (private.can_view_story(id));
create policy stories_update_own on public.stories
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
revoke all on public.stories from anon, authenticated;
grant select on public.stories to anon, authenticated;
grant update (deleted_at) on public.stories to authenticated;

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
$$;
revoke execute on function public.create_story(text, text, text, integer, integer, integer, text, text, uuid) from anon, public;
grant execute on function public.create_story(text, text, text, integer, integer, integer, text, text, uuid) to authenticated;

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
create policy story_views_select on public.story_views
  for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()))
  );
create policy story_views_insert on public.story_views
  for insert to authenticated
  with check (viewer_id = (select auth.uid()) and private.can_view_story(story_id));
revoke all on public.story_views from anon, authenticated;
grant select on public.story_views to authenticated;
grant insert (story_id, viewer_id) on public.story_views to authenticated;

create table public.story_likes (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_likes enable row level security;
create policy story_likes_select on public.story_likes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()))
  );
create policy story_likes_insert on public.story_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_story(story_id));
create policy story_likes_delete on public.story_likes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.story_likes from anon, authenticated;
grant select, delete on public.story_likes to authenticated;
grant insert (story_id, user_id) on public.story_likes to authenticated;

create policy highlights_select on public.highlights
  for select to anon, authenticated
  using (private.can_view_profile_content((select auth.uid()), owner_id));
create policy highlights_insert_own on public.highlights
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy highlights_update_own on public.highlights
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy highlights_delete_own on public.highlights
  for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.highlights from anon, authenticated;
grant select on public.highlights to anon, authenticated;
grant delete on public.highlights to authenticated;
grant insert (owner_id, title, position) on public.highlights to authenticated;
grant update (title, position) on public.highlights to authenticated;

create policy highlight_items_select on public.highlight_items
  for select to anon, authenticated using (private.can_view_story(story_id));
create policy highlight_items_insert_own on public.highlight_items
  for insert to authenticated
  with check (
    exists (select 1 from public.highlights h where h.id = highlight_id and h.owner_id = (select auth.uid()))
    and exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()) and s.deleted_at is null)
  );
create policy highlight_items_delete_own on public.highlight_items
  for delete to authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_id and h.owner_id = (select auth.uid())));
revoke all on public.highlight_items from anon, authenticated;
grant select on public.highlight_items to anon, authenticated;
grant insert (highlight_id, story_id, position) on public.highlight_items to authenticated;
grant delete on public.highlight_items to authenticated;

-- Story rail for the home screen: authors with currently visible statuses, own first,
-- then unseen before seen, most recent first.
create or replace function public.get_story_rail()
returns table (
  author_id uuid,
  latest_at timestamptz,
  story_count integer,
  has_unseen boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.author_id,
         max(s.created_at) as latest_at,
         count(*)::integer as story_count,
         bool_or(not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()
         )) as has_unseen
  from public.stories s
  where s.expires_at > now()
    and s.deleted_at is null
    and not exists (select 1 from public.mutes m where m.muter_id = auth.uid() and m.muted_id = s.author_id)
  group by s.author_id
  order by (s.author_id = auth.uid()) desc, bool_or(not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()
         )) desc, max(s.created_at) desc
  limit 50;
$$;
grant execute on function public.get_story_rail() to anon, authenticated;

-- Soft-delete expired statuses that were not highlighted; returns storage paths so a
-- trusted job can remove the files. Callable only by the service role.
create or replace function public.purge_expired_stories()
returns table (storage_path text, poster_path text)
language sql
security definer
set search_path = ''
as $$
  update public.stories s set deleted_at = now()
  where s.deleted_at is null
    and s.expires_at < now()
    and not exists (select 1 from public.highlight_items hi where hi.story_id = s.id)
  returning s.storage_path, s.poster_path;
$$;
revoke execute on function public.purge_expired_stories() from anon, authenticated, public;
grant execute on function public.purge_expired_stories() to service_role;
