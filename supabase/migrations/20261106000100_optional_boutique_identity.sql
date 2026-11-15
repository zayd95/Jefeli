-- Jëfëli: lightweight optional boutique identity.
-- Members can discover, post and list casually without registering a boutique.
-- Selecting the professional boutique option requires only a shop name and category.
-- This does NOT imply legal verification of the business.
alter table public.profiles
  add column if not exists boutique_name text,
  add column if not exists boutique_category_slug text
    references public.categories(slug) on update cascade on delete set null;

alter table public.profiles
  add constraint profiles_boutique_name_length
  check (
    boutique_name is null or
    char_length(btrim(boutique_name)) between 2 and 60
  );

alter table public.profiles
  add constraint profiles_boutique_identity_required
  check (
    not is_merchant or (
      nullif(btrim(coalesce(boutique_name, '')), '') is not null
      and boutique_category_slug is not null
    )
  );

comment on column public.profiles.boutique_name is
  'Member-selected storefront display name. Not legal-business verification.';
comment on column public.profiles.boutique_category_slug is
  'Primary public commercial category for an optional merchant storefront.';
