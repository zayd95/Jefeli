-- Pilot cut (c) — Waxaale: an accepted offer reserves the item, closes the competing offers
-- (their buyers are told), adds a handover step to the agreement, and every offer / deal
-- notification carries the conversation it belongs to so it can open the right chat.
--
--   offers.status      + 'closed'   (another buyer's offer on the same item was accepted)
--   notifications.type + 'offer_closed', 'agreement_handover'
--   agreements         + handover_at, handover_place, handover_by, handover_set_at
--   products.status    active -> reserved on accept; reserved -> sold when both declare the
--                      exchange done; reserved -> active when the agreement is cancelled.
--
-- Nothing here moves money or claims a payment happened: the agreement stays a declaration
-- between members (disclaimer unchanged).

-- ---------------------------------------------------------------------------
-- Statuses and notification types
-- ---------------------------------------------------------------------------

alter table public.offers drop constraint offers_status_check;
alter table public.offers add constraint offers_status_check
  check (status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired', 'closed'));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'follow', 'follow_request', 'follow_accepted',
  'friend_request', 'friend_accepted',
  'post_upvote', 'post_comment', 'comment_reply',
  'message', 'story_reply', 'story_like',
  'offer_received', 'offer_countered', 'offer_accepted', 'offer_rejected', 'offer_withdrawn', 'offer_closed',
  'agreement_completed', 'agreement_canceled', 'agreement_disputed', 'agreement_handover',
  'review_received', 'live_started',
  'moderation_action', 'report_resolved', 'verification_result', 'appeal_result'
));

alter table public.agreements
  add column handover_at timestamptz,
  add column handover_place text check (handover_place is null or char_length(handover_place) between 2 and 120),
  add column handover_by uuid references public.profiles (id) on delete set null,
  add column handover_set_at timestamptz;

-- ---------------------------------------------------------------------------
-- Every offer / agreement notification knows its conversation (deep link to the chat).
-- ---------------------------------------------------------------------------

create or replace function private.notify(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_data jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := coalesce(p_data, '{}'::jsonb);
  cid uuid;
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  if p_actor is not null and private.is_blocked_between(p_recipient, p_actor) then
    return;
  end if;
  if not d ? 'conversation_id' then
    if p_entity_type = 'offer' then
      select conversation_id into cid from public.offers where id = p_entity_id;
    elsif p_entity_type = 'agreement' then
      select conversation_id into cid from public.agreements where id = p_entity_id;
    end if;
    if cid is not null then
      d := d || jsonb_build_object('conversation_id', cid);
    end if;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, data)
  values (p_recipient, p_actor, p_type, p_entity_type, p_entity_id, d);
end;
$$;

-- Older offer / agreement notifications get the same link.
update public.notifications n set data = n.data || jsonb_build_object('conversation_id', o.conversation_id)
from public.offers o
where n.entity_type = 'offer' and n.entity_id = o.id and not n.data ? 'conversation_id';
update public.notifications n set data = n.data || jsonb_build_object('conversation_id', a.conversation_id)
from public.agreements a
where n.entity_type = 'agreement' and n.entity_id = a.id and not n.data ? 'conversation_id';

-- ---------------------------------------------------------------------------
-- Close every other pending offer that involves these items (the item asked for, or the item
-- offered in a barter). Each buyer gets a system line in their chat and a notification.
-- ---------------------------------------------------------------------------

create or replace function private.close_competing_offers(p_accepted public.offers, p_actor uuid, p_title text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.offers;
  n integer := 0;
  items uuid[] := array_remove(array[p_accepted.product_id, p_accepted.offered_product_id], null);
begin
  for r in
    select * from public.offers
    where status = 'pending' and id <> p_accepted.id
      and (product_id = any (items) or offered_product_id = any (items))
    for update
  loop
    update public.offers set status = 'closed', responded_at = now() where id = r.id;
    insert into public.messages (conversation_id, sender_id, kind, body, offer_id)
    values (r.conversation_id, p_actor, 'system', 'offer_closed', r.id);
    -- Tell the member who is left waiting (the one who did not just accept).
    perform private.notify(case when r.proposer_id = p_actor then r.recipient_id else r.proposer_id end,
      p_actor, 'offer_closed', 'offer', r.id,
      jsonb_build_object('product_title', p_title, 'conversation_id', r.conversation_id));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function private.close_competing_offers(public.offers, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- respond_offer: accepting reserves the item(s) and closes the competition.
-- ---------------------------------------------------------------------------

create or replace function public.respond_offer(p_offer_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  o public.offers;
  prod public.products;
  agreement_id uuid;
  buyer public.profiles;
  seller public.profiles;
begin
  o := private.lock_pending_offer_for_recipient(p_offer_id, uid);

  if not p_accept then
    update public.offers set status = 'rejected', responded_at = now() where id = o.id;
    insert into public.messages (conversation_id, sender_id, kind, body, offer_id)
    values (o.conversation_id, uid, 'system', 'offer_rejected', o.id);
    perform private.notify(o.proposer_id, uid, 'offer_rejected', 'offer', o.id);
    return null;
  end if;

  if private.is_blocked_between(o.buyer_id, o.seller_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  select * into prod from public.products where id = o.product_id for update;
  if o.offered_product_id is not null then
    perform 1 from public.products where id = o.offered_product_id for update;
  end if;
  -- An item already reserved by another accepted offer is 'reserved', not 'active': refused here.
  perform private.validate_offer_terms(o.kind, prod, o.buyer_id, o.amount_xof, o.offered_product_id, o.cash_payer);

  select * into buyer from public.profiles where id = o.buyer_id;
  select * into seller from public.profiles where id = o.seller_id;

  update public.offers set status = 'accepted', responded_at = now() where id = o.id;
  insert into public.agreements (offer_id, conversation_id, kind, buyer_id, seller_id, product_id,
    offered_product_id, amount_xof, cash_payer, terms)
  values (o.id, o.conversation_id, o.kind, o.buyer_id, o.seller_id, o.product_id,
    o.offered_product_id, o.amount_xof, o.cash_payer,
    jsonb_build_object(
      'kind', o.kind,
      'product', private.product_snapshot(o.product_id),
      'offered_product', case when o.kind = 'barter' then private.product_snapshot(o.offered_product_id) end,
      'amount_xof', o.amount_xof,
      'cash_payer', o.cash_payer,
      'buyer', jsonb_build_object('id', buyer.id, 'handle', buyer.handle, 'display_name', buyer.display_name),
      'seller', jsonb_build_object('id', seller.id, 'handle', seller.handle, 'display_name', seller.display_name),
      'accepted_by', uid,
      'accepted_at', now(),
      'disclaimer', 'Accord déclaré entre membres. Jëfëli ne détient aucun fonds et ne garantit ni le paiement, ni la livraison, ni l''état des articles.'
    ))
  returning id into agreement_id;

  -- Reserve what changes hands (a barter reserves both items).
  update public.products set status = 'reserved'
  where id in (o.product_id, o.offered_product_id) and status = 'active';

  insert into public.messages (conversation_id, sender_id, kind, body, offer_id)
  values (o.conversation_id, uid, 'system', 'offer_accepted', o.id);
  perform private.notify(o.proposer_id, uid, 'offer_accepted', 'agreement', agreement_id,
    jsonb_build_object('product_title', prod.title));
  perform private.close_competing_offers(o, uid, prod.title);
  return agreement_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Handover step: either member proposes (or changes) when and where they meet.
-- ---------------------------------------------------------------------------

create or replace function public.set_agreement_handover(p_agreement_id uuid, p_at timestamptz, p_place text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  a public.agreements;
  place text := btrim(coalesce(p_place, ''));
begin
  select * into a from public.agreements where id = p_agreement_id for update;
  if not found or uid not in (a.buyer_id, a.seller_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if a.status <> 'agreed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if char_length(place) < 2 or char_length(place) > 120 then
    raise exception 'invalid_handover' using errcode = 'P0001';
  end if;
  if p_at is null or p_at < now() - interval '1 hour' or p_at > now() + interval '30 days' then
    raise exception 'invalid_handover' using errcode = 'P0001';
  end if;
  perform private.enforce_rate_limit('handover', 20, interval '1 hour');
  perform private.check_prohibited_terms(place);
  update public.agreements
  set handover_at = p_at, handover_place = place, handover_by = uid, handover_set_at = now()
  where id = a.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (a.conversation_id, uid, 'system', 'agreement_handover');
  perform private.notify(case when uid = a.buyer_id then a.seller_id else a.buyer_id end, uid,
    'agreement_handover', 'agreement', a.id, jsonb_build_object('place', place, 'at', p_at));
end;
$$;
revoke execute on function public.set_agreement_handover(uuid, timestamptz, text) from public, anon;
grant execute on function public.set_agreement_handover(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Both members declared the exchange done -> the reserved item(s) are sold.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_agreement_completed(p_agreement_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  a public.agreements;
begin
  select * into a from public.agreements where id = p_agreement_id for update;
  if not found or uid not in (a.buyer_id, a.seller_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if a.status <> 'agreed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if uid = a.buyer_id then
    update public.agreements set buyer_completed_at = coalesce(buyer_completed_at, now()) where id = a.id returning * into a;
  else
    update public.agreements set seller_completed_at = coalesce(seller_completed_at, now()) where id = a.id returning * into a;
  end if;
  if a.buyer_completed_at is not null and a.seller_completed_at is not null then
    update public.agreements set status = 'completed' where id = a.id;
    update public.products set status = 'sold'
    where id in (a.product_id, a.offered_product_id) and status = 'reserved';
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (a.conversation_id, uid, 'system', 'agreement_completed');
    perform private.notify(case when uid = a.buyer_id then a.seller_id else a.buyer_id end, uid,
      'agreement_completed', 'agreement', a.id);
    return 'completed';
  end if;
  return 'waiting_other_party';
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelled (or disputed) agreement -> the reserved item(s) go back on sale.
-- ---------------------------------------------------------------------------

create or replace function public.close_agreement(p_agreement_id uuid, p_outcome text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  a public.agreements;
  other uuid;
begin
  if p_outcome not in ('canceled', 'disputed') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  select * into a from public.agreements where id = p_agreement_id for update;
  if not found or uid not in (a.buyer_id, a.seller_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if a.status <> 'agreed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  other := case when uid = a.buyer_id then a.seller_id else a.buyer_id end;
  update public.agreements set status = p_outcome, closed_by = uid, close_reason = left(coalesce(p_reason, ''), 500)
  where id = a.id;
  -- Only a cancellation frees the items; a dispute keeps them reserved for moderation.
  if p_outcome = 'canceled' then
    update public.products p set status = 'active'
    where p.id in (a.product_id, a.offered_product_id) and p.status = 'reserved'
      and not exists (
        select 1 from public.agreements x
        where x.id <> a.id and x.status in ('agreed', 'disputed')
          and p.id in (x.product_id, x.offered_product_id)
      );
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (a.conversation_id, uid, 'system', 'agreement_' || p_outcome);
  perform private.notify(other, uid, 'agreement_' || p_outcome, 'agreement', a.id);
end;
$$;
