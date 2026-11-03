-- Jëfëli: prepare existing databases for 20261106000100_optional_boutique_identity.sql.
--
-- That migration adds a check: a member who opts into the merchant identity (is_merchant) must
-- have a boutique name and category. On a database that already has merchants (for example the
-- local DÉMO data used for playtests), adding the check fails because those rows have neither.
--
-- No boutique name or category is invented for them: their « Vendeur » opt-in is cleared so the
-- rule can be enforced, and they can opt in again with a shop name and category. Listings,
-- boutiques and verification levels are untouched. Fresh databases have no rows and are
-- unaffected; databases where the identity columns already exist are already compliant.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'boutique_name'
  ) then
    update public.profiles set is_merchant = false where is_merchant;
  end if;
end;
$$;
