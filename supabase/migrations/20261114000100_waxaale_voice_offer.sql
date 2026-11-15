-- P1 identity sprint (owner, 14 Nov 2026): Waxaale voice offers. LOCAL ONLY until the owner's go.
--
-- A price or swap offer can carry one voice note from its proposer (« Écoute ma proposition »).
-- The note is an ordinary voice message in the conversation, linked to the offer by offer_id, so
-- every existing rule applies: membership, blocks, suspended accounts, own uploaded file in
-- private-media, audio only, ≤ 180 s (private.messages_before_insert). Clients cannot set
-- messages.offer_id themselves (not in the insert grant): only this RPC links a note to an offer.

create or replace function public.attach_offer_voice(
  p_offer_id uuid,
  p_attachment_path text,
  p_attachment_meta jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  o public.offers;
  mid uuid;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if o.proposer_id <> uid then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if o.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if o.expires_at <= now() then
    raise exception 'offer_expired' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.messages m where m.offer_id = o.id and m.kind = 'voice' and m.deleted_at is null) then
    raise exception 'offer_voice_exists' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, attachment_path, attachment_meta, offer_id, product_id)
  values (o.conversation_id, uid, 'voice', '', p_attachment_path, coalesce(p_attachment_meta, '{}'::jsonb), o.id, o.product_id)
  returning id into mid;
  return mid;
end;
$$;
revoke execute on function public.attach_offer_voice(uuid, text, jsonb) from public, anon;
grant execute on function public.attach_offer_voice(uuid, text, jsonb) to authenticated;
