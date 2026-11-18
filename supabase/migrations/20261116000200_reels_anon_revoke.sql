-- P2 follow-up: get_reels is for signed-in members only (as documented in STAGING_MIGRATION_PLAN).
-- 20261116000100 revoked it from `public` but Supabase's default privileges had also granted it to `anon`.
revoke execute on function public.get_reels(integer, integer, uuid) from anon;
