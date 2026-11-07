-- jefeli-staging: definitions as they were on 7 Nov 2026, BEFORE the W1 migrations
-- (20261106000200_boutique_identity_followup, 20261108000100_feedback). Run only to undo them.
-- Captured read-only through the Supabase Management API. No data involved.

begin;

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
$function$

;

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
$function$

;

-- Feedback table (20261108000100_feedback): uncomment to remove it with its rows.
-- drop table public.feedback;

commit;
