-- Jëfëli — commerce: categories, prohibited-goods policy, automatic boutiques,
-- listings (new / used / refurbished; sale / trade / sale-or-trade), media, saves.
-- No checkout, no stock owned by the platform, no payment custody.

create table public.categories (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  icon text not null,
  position integer not null,
  is_active boolean not null default true
);
alter table public.categories enable row level security;
create policy categories_read on public.categories for select to anon, authenticated using (true);
revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;

insert into public.categories (slug, name, icon, position) values
  ('mode-femme', 'Mode femme', 'shirt', 10),
  ('mode-homme', 'Mode homme', 'shirt', 20),
  ('tissus-wax', 'Tissus & wax', 'scissors', 30),
  ('chaussures', 'Chaussures', 'footprints', 40),
  ('sacs-accessoires', 'Sacs & accessoires', 'shopping-bag', 50),
  ('beaute', 'Beauté & soins', 'sparkles', 60),
  ('telephones', 'Téléphones & tablettes', 'smartphone', 70),
  ('electronique', 'Électronique', 'monitor', 80),
  ('maison', 'Maison & déco', 'sofa', 90),
  ('electromenager', 'Électroménager', 'refrigerator', 100),
  ('enfants', 'Enfants & bébé', 'baby', 110),
  ('sport', 'Sport & loisirs', 'dumbbell', 120),
  ('artisanat', 'Artisanat', 'palette', 130),
  ('epicerie', 'Épicerie & produits locaux', 'wheat', 140),
  ('autres', 'Autres', 'package', 900);

-- Configurable prohibited-goods list (matched on whole words, accent-insensitive).
create table public.prohibited_terms (
  term text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.prohibited_terms enable row level security;
create policy prohibited_terms_staff on public.prohibited_terms
  for select to authenticated using ((select private.is_staff()));
revoke all on public.prohibited_terms from anon, authenticated;
grant select on public.prohibited_terms to authenticated;

insert into public.prohibited_terms (term, reason) values
  ('arme', 'Armes'), ('armes', 'Armes'), ('pistolet', 'Armes'), ('fusil', 'Armes'),
  ('munition', 'Armes'), ('munitions', 'Armes'),
  ('drogue', 'Stupéfiants'), ('drogues', 'Stupéfiants'), ('cannabis', 'Stupéfiants'),
  ('yamba', 'Stupéfiants'), ('cocaine', 'Stupéfiants'), ('chanvre indien', 'Stupéfiants'),
  ('tramadol', 'Médicaments sur ordonnance'), ('medicament sur ordonnance', 'Médicaments sur ordonnance'),
  ('faux billets', 'Fausse monnaie'), ('faux billet', 'Fausse monnaie'),
  ('ivoire', 'Espèces protégées'), ('peau de leopard', 'Espèces protégées'),
  ('carte d identite', 'Documents officiels'), ('passeport', 'Documents officiels'),
  ('permis de conduire', 'Documents officiels');

create type public.item_condition as enum ('new', 'like_new', 'very_good', 'good', 'fair', 'refurbished');
create type public.listing_mode as enum ('sale', 'trade', 'sale_or_trade');
create type public.product_status as enum ('active', 'reserved', 'sold', 'archived');

-- ---------------------------------------------------------------------------
-- Boutique = part of the social profile, created automatically at first listing.
-- ---------------------------------------------------------------------------

create table public.boutiques (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  description text not null default '' check (char_length(description) <= 500),
  pickup_notes text not null default '' check (char_length(pickup_notes) <= 300),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 300),
  payment_notes text not null default '' check (char_length(payment_notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.boutiques enable row level security;
create trigger boutiques_updated_at before update on public.boutiques
  for each row execute function private.set_updated_at();

create policy boutiques_select on public.boutiques
  for select to anon, authenticated
  using (private.can_view_profile_content((select auth.uid()), owner_id));
create policy boutiques_update_own on public.boutiques
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke all on public.boutiques from anon, authenticated;
grant select on public.boutiques to anon, authenticated;
grant update (description, pickup_notes, delivery_notes, payment_notes) on public.boutiques to authenticated;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create index collections_owner_idx on public.collections (owner_id, position);

create policy collections_select on public.collections
  for select to anon, authenticated
  using (private.can_view_profile_content((select auth.uid()), owner_id));
create policy collections_insert_own on public.collections
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy collections_update_own on public.collections
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy collections_delete_own on public.collections
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.collections from anon, authenticated;
grant select on public.collections to anon, authenticated;
grant insert (owner_id, name, position) on public.collections to authenticated;
grant update (name, position) on public.collections to authenticated;
grant delete on public.collections to authenticated;

-- ---------------------------------------------------------------------------
-- Products / listings
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  price_xof integer check (price_xof is null or price_xof between 0 and 100000000),
  category_slug text not null references public.categories (slug),
  condition public.item_condition not null default 'new',
  listing_mode public.listing_mode not null default 'sale',
  quantity integer not null default 1 check (quantity between 0 and 100000),
  status public.product_status not null default 'active',
  city text check (city is null or char_length(city) between 1 and 60),
  neighborhood text check (neighborhood is null or char_length(neighborhood) between 1 and 60),
  delivery_options text[] not null default '{pickup}'
    check (delivery_options <@ array['pickup', 'delivery', 'shipping']::text[] and cardinality(delivery_options) >= 1),
  delivery_notes text not null default '' check (char_length(delivery_notes) <= 300),
  collection_id uuid references public.collections (id) on delete set null,
  moderation_status public.moderation_state not null default 'active',
  save_count integer not null default 0,
  search_text text generated always as (
    private.normalize_text(title || ' ' || description || ' ' || coalesce(city, '') || ' ' || coalesce(neighborhood, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  -- A pure trade listing may omit the price; everything for sale needs one.
  check (listing_mode = 'trade' or price_xof is not null)
);
alter table public.products enable row level security;
create index products_seller_idx on public.products (seller_id, status, created_at desc);
create index products_category_idx on public.products (category_slug, status, created_at desc);
create index products_city_idx on public.products (city, status, created_at desc);
create index products_recent_idx on public.products (created_at desc) where moderation_status = 'active';
create index products_search_trgm on public.products using gin (search_text extensions.gin_trgm_ops);

create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger products_rate_limit before insert on public.products
  for each row execute function private.rate_limit_trigger('product', '50', '1 day');

create or replace function private.check_prohibited_terms(content text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hit text;
begin
  select t.term into hit
  from public.prohibited_terms t
  where private.normalize_text(content) ~ ('\m' || private.normalize_text(t.term) || '\M')
  limit 1;
  if hit is not null then
    raise exception 'prohibited_item' using errcode = 'P0001', hint = hit;
  end if;
end;
$$;

create or replace function private.products_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.title is distinct from old.title or new.description is distinct from old.description then
    perform private.check_prohibited_terms(new.title || ' ' || new.description);
  end if;
  if new.collection_id is not null and not exists (
    select 1 from public.collections c where c.id = new.collection_id and c.owner_id = new.seller_id
  ) then
    raise exception 'invalid_collection' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.seller_id := old.seller_id;
    if new.status = 'sold' and old.status <> 'sold' then
      new.sold_at := now();
    elsif new.status <> 'sold' then
      new.sold_at := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger products_before_write before insert or update on public.products
  for each row execute function private.products_before_write();

create or replace function private.refresh_product_count(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set products_count = (
    select count(*) from public.products pr
    where pr.seller_id = p.id and pr.status in ('active', 'reserved') and pr.moderation_status = 'active'
  ) where p.id = uid;
$$;

create or replace function private.products_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_product_count(old.seller_id);
    return old;
  end if;
  if tg_op = 'INSERT' then
    -- The boutique appears automatically with the first listing: no setup wizard.
    insert into public.boutiques (owner_id) values (new.seller_id) on conflict do nothing;
  end if;
  perform private.refresh_product_count(new.seller_id);
  return new;
end;
$$;
create trigger products_after_change after insert or update of status, moderation_status or delete on public.products
  for each row execute function private.products_after_change();

create or replace function private.can_view_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id
      and (
        p.seller_id = auth.uid()
        or private.is_staff()
        or (p.moderation_status = 'active' and p.status <> 'archived'
            and private.can_view_profile_content(auth.uid(), p.seller_id))
      )
  );
$$;
grant execute on function private.can_view_product(uuid) to anon, authenticated;

create policy products_select on public.products
  for select to anon, authenticated
  using (
    seller_id = (select auth.uid())
    or (select private.is_staff())
    or (moderation_status = 'active' and status <> 'archived'
        and private.can_view_profile_content((select auth.uid()), seller_id))
  );
create policy products_update_own on public.products
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));
create policy products_delete_own on public.products
  for delete to authenticated using (seller_id = (select auth.uid()));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
-- Creation goes through public.create_listing() (validates media ownership atomically).
grant update (title, description, price_xof, category_slug, condition, listing_mode, quantity, status,
  city, neighborhood, delivery_options, delivery_notes, collection_id)
  on public.products to authenticated;
grant delete on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- Media (shared shape for products and posts)
-- ---------------------------------------------------------------------------

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
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
alter table public.product_media enable row level security;
create index product_media_product_idx on public.product_media (product_id, position);

create policy product_media_select on public.product_media
  for select to anon, authenticated using (private.can_view_product(product_id));
create policy product_media_delete_own on public.product_media
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.product_media from anon, authenticated;
grant select on public.product_media to anon, authenticated;
grant delete on public.product_media to authenticated;

create table public.product_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.product_saves enable row level security;
create index product_saves_product_idx on public.product_saves (product_id);

create policy product_saves_select_own on public.product_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy product_saves_insert_own on public.product_saves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_product(product_id));
create policy product_saves_delete_own on public.product_saves
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.product_saves from anon, authenticated;
grant select, delete on public.product_saves to authenticated;
grant insert (user_id, product_id) on public.product_saves to authenticated;

create or replace function private.product_saves_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products set save_count = (select count(*) from public.product_saves where product_id = pid)
  where id = pid;
  return null;
end;
$$;
create trigger product_saves_after_change after insert or delete on public.product_saves
  for each row execute function private.product_saves_after_change();

-- Is this uploaded object really owned by the caller? (Prevents referencing other users' files.)
create or replace function private.owns_object(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = p_bucket and o.name = p_path and o.owner_id = auth.uid()::text
  );
$$;

-- media jsonb: [{ "kind": "image"|"video", "path": "...", "poster_path": "...", "width": 1, "height": 1, "duration_ms": 0 }]
create or replace function private.validate_media(p_media jsonb, p_bucket text, p_max integer)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m jsonb;
begin
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_media) > p_max then
    raise exception 'too_many_media' using errcode = 'P0001';
  end if;
  for m in select * from jsonb_array_elements(p_media) loop
    if (m ->> 'kind') not in ('image', 'video') then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if not private.owns_object(p_bucket, m ->> 'path') then
      raise exception 'media_not_found' using errcode = 'P0001', hint = m ->> 'path';
    end if;
    if (m ->> 'poster_path') is not null and not private.owns_object(p_bucket, m ->> 'poster_path') then
      raise exception 'media_not_found' using errcode = 'P0001', hint = m ->> 'poster_path';
    end if;
  end loop;
end;
$$;

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
  p_collection_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  new_id uuid;
  m jsonb;
  i integer := 0;
begin
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) < 1 then
    raise exception 'media_required' using errcode = 'P0001';
  end if;
  perform private.validate_media(p_media, 'public-media', 10);

  insert into public.products (seller_id, title, description, price_xof, category_slug, condition,
    listing_mode, quantity, city, neighborhood, delivery_options, delivery_notes, collection_id)
  values (uid, btrim(p_title), coalesce(p_description, ''), p_price_xof, p_category_slug, p_condition,
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
$$;

-- Replace the media list of an owned listing (ordering + additions + removals).
create or replace function public.set_listing_media(p_product_id uuid, p_media jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode, integer, text, text, text[], text, jsonb, uuid) from anon, public;
revoke execute on function public.set_listing_media(uuid, jsonb) from anon, public;
grant execute on function public.create_listing(text, text, integer, text, public.item_condition, public.listing_mode, integer, text, text, text[], text, jsonb, uuid) to authenticated;
grant execute on function public.set_listing_media(uuid, jsonb) to authenticated;
