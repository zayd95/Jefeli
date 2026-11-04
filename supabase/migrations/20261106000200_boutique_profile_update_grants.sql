-- Fix onboarding for both casual and boutique members.
-- The optional boutique migration added these two columns after the original
-- column-scoped profiles UPDATE grant. The frontend writes NULL for casual
-- members, so the authenticated role needs UPDATE on both columns regardless.
-- Keep the owner-only RLS profiles_update_own policy; do not grant table-wide UPDATE.
grant update (boutique_name, boutique_category_slug)
  on table public.profiles to authenticated;
