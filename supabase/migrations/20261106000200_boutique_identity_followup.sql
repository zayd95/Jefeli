-- Jëfëli: follow-up to 20261106000100_optional_boutique_identity.sql.
--
-- 1. Members can set their own boutique name and category (column grants; the existing
--    profiles_update_own policy keeps writes to the member's own row).
-- 2. An admin approving a merchant verification no longer forces is_merchant on a profile that
--    has no boutique identity, which the new check forbids:
--      - an empty boutique name takes the verified business name from the request;
--      - is_merchant becomes true only when a boutique category is set (the member chooses it);
--      - the verification level is granted either way, so the « Vendeur vérifié » badge shows.

grant update (boutique_name, boutique_category_slug) on public.profiles to authenticated;

create or replace function public.review_verification_request(p_request_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    update public.profiles p
       set verification_level = 'merchant_verified',
           boutique_name = coalesce(nullif(btrim(p.boutique_name), ''), left(btrim(vr.business_name), 60)),
           is_merchant = p.is_merchant or p.boutique_category_slug is not null
     where p.id = vr.user_id;
    insert into public.moderation_actions (moderator_id, action, target_type, target_id, target_owner_id, reason)
    values (auth.uid(), 'grant_verification', 'profile', vr.user_id, vr.user_id, left(coalesce(p_note, ''), 1000));
  end if;
  perform private.notify(vr.user_id, null, 'verification_result', 'verification_request', vr.id,
    jsonb_build_object('approved', p_approve));
  perform private.audit('verification_review', 'profile', vr.user_id::text, jsonb_build_object('approved', p_approve));
end;
$$;
revoke execute on function public.review_verification_request(uuid, boolean, text) from anon, public;
grant execute on function public.review_verification_request(uuid, boolean, text) to authenticated;
