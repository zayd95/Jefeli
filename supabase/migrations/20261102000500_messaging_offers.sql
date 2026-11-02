-- Jëfëli — 1:1 messaging, price offers, barter (troc) proposals, agreements and reviews.
--
-- Money is never held by Jëfëli. An "agreement" is a snapshot of terms both members
-- accepted; its status is user-declared and never a statement that the platform processed
-- a payment or guaranteed a delivery.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_message_sender_id uuid references public.profiles (id) on delete set null
);
alter table public.conversations enable row level security;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  hidden_at timestamptz,
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;
create index conversation_members_user_idx on public.conversation_members (user_id);

create or replace function private.is_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;
grant execute on function private.is_member(uuid) to authenticated;

create or replace function private.other_member(p_conversation_id uuid, p_me uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.conversation_members
  where conversation_id = p_conversation_id and user_id <> p_me
  limit 1;
$$;

create policy conversations_select on public.conversations
  for select to authenticated using (private.is_member(id));
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

create policy conversation_members_select on public.conversation_members
  for select to authenticated using (private.is_member(conversation_id));
create policy conversation_members_update_own on public.conversation_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.conversation_members from anon, authenticated;
grant select on public.conversation_members to authenticated;
grant update (last_read_at, muted, hidden_at) on public.conversation_members to authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'voice', 'product', 'offer', 'story_reply', 'system')),
  body text not null default '' check (char_length(body) <= 4000),
  attachment_path text,
  attachment_meta jsonb not null default '{}',
  product_id uuid references public.products (id) on delete set null,
  offer_id uuid,
  story_id uuid references public.stories (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (attachment_path is null or attachment_path like sender_id::text || '/%')
);
alter table public.messages enable row level security;
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_attachment_idx on public.messages (attachment_path) where attachment_path is not null;

create trigger messages_rate_limit before insert on public.messages
  for each row execute function private.rate_limit_trigger('message', '40', '1 minute');

create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid;
begin
  other := private.other_member(new.conversation_id, new.sender_id);
  if other is not null and private.is_blocked_between(new.sender_id, other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if not private.is_active_user(new.sender_id) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if new.kind in ('image', 'voice') then
    if new.attachment_path is null then
      raise exception 'attachment_required' using errcode = 'P0001';
    end if;
    -- Direct client inserts must reference a file the sender really uploaded.
    if auth.uid() is not null and not private.owns_object('private-media', new.attachment_path) then
      raise exception 'media_not_found' using errcode = 'P0001';
    end if;
  elsif new.kind = 'text' and btrim(new.body) = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if new.kind = 'product' and (new.product_id is null or not private.can_view_product(new.product_id)) then
    raise exception 'invalid_product' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function private.messages_before_insert();

create or replace function private.message_preview(m public.messages)
returns text
language sql
immutable
set search_path = ''
as $$
  select case m.kind
    when 'image' then 'Photo'
    when 'voice' then 'Message vocal'
    when 'product' then 'Article partagé'
    when 'offer' then 'Proposition'
    when 'story_reply' then 'Réponse à un statut'
    else left(m.body, 120)
  end;
$$;

create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  sender_name text;
  recipient_muted boolean;
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = private.message_preview(new),
      last_message_sender_id = new.sender_id
  where id = new.conversation_id;

  update public.conversation_members set hidden_at = null
  where conversation_id = new.conversation_id and hidden_at is not null;

  update public.conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;

  if new.kind in ('text', 'image', 'voice', 'product', 'story_reply') then
    recipient := private.other_member(new.conversation_id, new.sender_id);
    select muted into recipient_muted from public.conversation_members
    where conversation_id = new.conversation_id and user_id = recipient;
    if not coalesce(recipient_muted, false) then
      select display_name into sender_name from public.profiles where id = new.sender_id;
      -- Push copy deliberately omits the message content (lock-screen privacy).
      perform private.notify(recipient, new.sender_id,
        case when new.kind = 'story_reply' then 'story_reply' else 'message' end,
        'conversation', new.conversation_id,
        jsonb_build_object('sender_name', sender_name));
    end if;
  end if;
  return null;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

create or replace function private.messages_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if new.deleted_at is not null then
    -- Deleting a message erases its content for both members.
    new.body := '';
    new.attachment_path := null;
    new.attachment_meta := '{}';
  end if;
  return new;
end;
$$;
create trigger messages_before_update before update on public.messages
  for each row execute function private.messages_before_update();

create policy messages_select on public.messages
  for select to authenticated using (private.is_member(conversation_id));
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_member(conversation_id)
    and kind in ('text', 'image', 'voice', 'product')
  );
create policy messages_update_own on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()) and kind in ('text', 'image', 'voice', 'product', 'story_reply'))
  with check (sender_id = (select auth.uid()));
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, kind, body, attachment_path, attachment_meta, product_id)
  on public.messages to authenticated;
grant update (deleted_at) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Opening conversations
-- ---------------------------------------------------------------------------

create or replace function private.open_conversation(p_me uuid, p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := least(p_me, p_other)::text || ':' || greatest(p_me, p_other)::text;
  cid uuid;
  allow text;
begin
  if p_other = p_me then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if not private.is_active_user(p_other) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(p_me, p_other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  select id into cid from public.conversations where direct_key = key;
  if cid is not null then
    insert into public.conversation_members (conversation_id, user_id)
    values (cid, p_me), (cid, p_other)
    on conflict do nothing;
    return cid;
  end if;

  select allow_messages_from into allow from public.account_settings where user_id = p_other;
  if allow = 'following' and not private.follows_accepted(p_other, p_me) then
    raise exception 'messages_restricted' using errcode = 'P0001';
  elsif allow = 'friends' and not private.are_friends(p_me, p_other) then
    raise exception 'messages_restricted' using errcode = 'P0001';
  end if;
  perform private.enforce_rate_limit('new_conversation', 30, interval '1 day');

  insert into public.conversations (direct_key, created_by) values (key, p_me)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into cid;
  insert into public.conversation_members (conversation_id, user_id)
  values (cid, p_me), (cid, p_other)
  on conflict do nothing;
  return cid;
end;
$$;

create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.open_conversation(private.require_user(), p_other);
end;
$$;

-- "Contacter le vendeur" from an exact listing: opens the chat and posts a product card.
create or replace function public.message_about_product(p_product_id uuid, p_body text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  prod public.products;
  cid uuid;
begin
  select * into prod from public.products where id = p_product_id;
  if not found or not private.can_view_product(p_product_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if prod.seller_id = uid then
    raise exception 'own_product' using errcode = 'P0001';
  end if;
  cid := private.open_conversation(uid, prod.seller_id);
  insert into public.messages (conversation_id, sender_id, kind, body, product_id)
  values (cid, uid, 'product', '', p_product_id);
  if coalesce(btrim(p_body), '') <> '' then
    insert into public.messages (conversation_id, sender_id, kind, body) values (cid, uid, 'text', btrim(p_body));
  end if;
  return cid;
end;
$$;

-- Private reply to a status: lands in the author's DMs with the status as context.
create or replace function public.reply_to_story(p_story_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  author uuid;
  cid uuid;
begin
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'empty_message' using errcode = 'P0001';
  end if;
  if not private.can_view_story(p_story_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select author_id into author from public.stories where id = p_story_id;
  cid := private.open_conversation(uid, author);
  insert into public.messages (conversation_id, sender_id, kind, body, story_id)
  values (cid, uid, 'story_reply', left(btrim(p_body), 1000), p_story_id);
  return cid;
end;
$$;

create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  unread_count integer,
  muted boolean,
  other_last_read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         o.user_id,
         c.last_message_at,
         c.last_message_preview,
         c.last_message_sender_id,
         (select count(*)::integer from public.messages m
          where m.conversation_id = c.id and m.sender_id <> auth.uid()
            and m.created_at > me.last_read_at and m.deleted_at is null),
         me.muted,
         o.last_read_at
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  where me.user_id = auth.uid()
    and me.hidden_at is null
    and exists (select 1 from public.messages m where m.conversation_id = c.id)
  order by c.last_message_at desc
  limit 200;
$$;

create or replace function public.unread_messages_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.conversation_members me
  join public.messages m on m.conversation_id = me.conversation_id
  where me.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.created_at > me.last_read_at
    and m.deleted_at is null
    and me.hidden_at is null;
$$;

revoke execute on function public.get_or_create_conversation(uuid) from anon, public;
revoke execute on function public.message_about_product(uuid, text) from anon, public;
revoke execute on function public.reply_to_story(uuid, text) from anon, public;
revoke execute on function public.my_conversations() from anon, public;
revoke execute on function public.unread_messages_count() from anon, public;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.message_about_product(uuid, text) to authenticated;
grant execute on function public.reply_to_story(uuid, text) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.unread_messages_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Offers (price + barter) — explicit lifecycle, server-validated
--   pending -> accepted | rejected | countered | withdrawn | expired
-- ---------------------------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  kind text not null check (kind in ('price', 'barter')),
  product_id uuid references public.products (id) on delete set null,
  offered_product_id uuid references public.products (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  amount_xof integer check (amount_xof is null or amount_xof between 0 and 100000000),
  cash_payer text check (cash_payer in ('buyer', 'seller')),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired')),
  parent_offer_id uuid references public.offers (id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  check (buyer_id <> seller_id),
  check (proposer_id in (buyer_id, seller_id) and recipient_id in (buyer_id, seller_id) and proposer_id <> recipient_id),
  check (
    (kind = 'price' and amount_xof is not null and amount_xof > 0 and cash_payer is null)
    or (kind = 'barter' and amount_xof is not null and ((amount_xof = 0 and cash_payer is null) or (amount_xof > 0 and cash_payer is not null)))
  )
);
alter table public.offers enable row level security;
create index offers_conversation_idx on public.offers (conversation_id, created_at);
create index offers_product_idx on public.offers (product_id, status);
create unique index offers_one_pending_per_pair
  on public.offers (product_id, buyer_id) where status = 'pending';

alter table public.messages
  add constraint messages_offer_fk foreign key (offer_id) references public.offers (id) on delete set null;

create policy offers_select on public.offers
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));
revoke all on public.offers from anon, authenticated;
grant select on public.offers to authenticated;

create or replace function private.product_snapshot(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.id is null then null else jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'price_xof', p.price_xof,
    'condition', p.condition,
    'listing_mode', p.listing_mode,
    'category_slug', p.category_slug,
    'city', p.city,
    'seller_id', p.seller_id,
    'image_path', (select m.storage_path from public.product_media m where m.product_id = p.id and m.kind = 'image' order by m.position limit 1),
    'poster_path', (select coalesce(m.poster_path, m.storage_path) from public.product_media m where m.product_id = p.id order by m.position limit 1)
  ) end
  from (select 1) dummy
  left join public.products p on p.id = p_product_id;
$$;

create or replace function private.validate_offer_terms(
  p_kind text,
  p_product public.products,
  p_buyer uuid,
  p_amount integer,
  p_offered_product_id uuid,
  p_cash_payer text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  offered public.products;
begin
  if p_product.id is null or p_product.status <> 'active' or p_product.moderation_status <> 'active' then
    raise exception 'product_unavailable' using errcode = 'P0001';
  end if;
  if p_kind = 'price' then
    if p_product.listing_mode = 'trade' then
      raise exception 'not_for_sale' using errcode = 'P0001';
    end if;
    if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
      raise exception 'invalid_amount' using errcode = 'P0001';
    end if;
  elsif p_kind = 'barter' then
    if p_product.listing_mode = 'sale' then
      raise exception 'not_for_trade' using errcode = 'P0001';
    end if;
    select * into offered from public.products where id = p_offered_product_id;
    if not found or offered.seller_id <> p_buyer or offered.status <> 'active' or offered.moderation_status <> 'active' then
      raise exception 'invalid_offered_product' using errcode = 'P0001';
    end if;
    if offered.id = p_product.id then
      raise exception 'invalid_offered_product' using errcode = 'P0001';
    end if;
    if p_amount is null or p_amount < 0 or p_amount > 100000000 then
      raise exception 'invalid_amount' using errcode = 'P0001';
    end if;
    if p_amount > 0 and p_cash_payer not in ('buyer', 'seller') then
      raise exception 'invalid_cash_payer' using errcode = 'P0001';
    end if;
  else
    raise exception 'invalid_offer_kind' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.make_offer(
  p_product_id uuid,
  p_kind text,
  p_amount_xof integer,
  p_offered_product_id uuid default null,
  p_cash_payer text default null,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  prod public.products;
  cid uuid;
  oid uuid;
  amount integer := p_amount_xof;
  payer text := p_cash_payer;
begin
  select * into prod from public.products where id = p_product_id;
  if not found or not private.can_view_product(p_product_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if prod.seller_id = uid then
    raise exception 'own_product' using errcode = 'P0001';
  end if;
  if private.is_blocked_between(uid, prod.seller_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if p_kind = 'barter' then
    amount := coalesce(amount, 0);
    if amount = 0 then payer := null; end if;
  else
    payer := null;
  end if;
  perform private.validate_offer_terms(p_kind, prod, uid, amount, p_offered_product_id, payer);
  if exists (select 1 from public.offers where product_id = p_product_id and buyer_id = uid and status = 'pending') then
    raise exception 'offer_pending' using errcode = 'P0001';
  end if;
  perform private.enforce_rate_limit('offer', 30, interval '1 hour');

  cid := private.open_conversation(uid, prod.seller_id);
  insert into public.offers (conversation_id, kind, product_id, offered_product_id, buyer_id, seller_id,
    proposer_id, recipient_id, amount_xof, cash_payer, message, snapshot)
  values (cid, p_kind, p_product_id, case when p_kind = 'barter' then p_offered_product_id end, uid, prod.seller_id,
    uid, prod.seller_id, amount, payer, left(coalesce(p_message, ''), 500),
    jsonb_build_object(
      'product', private.product_snapshot(p_product_id),
      'offered_product', case when p_kind = 'barter' then private.product_snapshot(p_offered_product_id) end))
  returning id into oid;

  insert into public.messages (conversation_id, sender_id, kind, body, offer_id, product_id)
  values (cid, uid, 'offer', left(coalesce(p_message, ''), 500), oid, p_product_id);
  perform private.notify(prod.seller_id, uid, 'offer_received', 'offer', oid,
    jsonb_build_object('kind', p_kind, 'amount_xof', amount, 'product_title', prod.title));
  return oid;
end;
$$;

create or replace function private.lock_pending_offer_for_recipient(p_offer_id uuid, p_uid uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or p_uid not in (o.buyer_id, o.seller_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if o.recipient_id <> p_uid then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if o.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if o.expires_at <= now() then
    update public.offers set status = 'expired', responded_at = now() where id = o.id;
    raise exception 'offer_expired' using errcode = 'P0001';
  end if;
  return o;
end;
$$;

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_amount_xof integer,
  p_offered_product_id uuid default null,
  p_cash_payer text default null,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  o public.offers;
  prod public.products;
  offered_id uuid;
  amount integer := p_amount_xof;
  payer text := p_cash_payer;
  new_id uuid;
begin
  o := private.lock_pending_offer_for_recipient(p_offer_id, uid);
  if private.is_blocked_between(o.buyer_id, o.seller_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  select * into prod from public.products where id = o.product_id;

  if o.kind = 'barter' then
    -- Only the buyer can change which of their own items is offered.
    offered_id := case when uid = o.buyer_id then coalesce(p_offered_product_id, o.offered_product_id) else o.offered_product_id end;
    amount := coalesce(amount, 0);
    if amount = 0 then payer := null; end if;
  else
    offered_id := null;
    payer := null;
  end if;
  perform private.validate_offer_terms(o.kind, prod, o.buyer_id, amount, offered_id, payer);

  update public.offers set status = 'countered', responded_at = now() where id = o.id;
  insert into public.offers (conversation_id, kind, product_id, offered_product_id, buyer_id, seller_id,
    proposer_id, recipient_id, amount_xof, cash_payer, message, parent_offer_id, snapshot)
  values (o.conversation_id, o.kind, o.product_id, offered_id, o.buyer_id, o.seller_id,
    uid, o.proposer_id, amount, payer, left(coalesce(p_message, ''), 500), o.id,
    jsonb_build_object(
      'product', private.product_snapshot(o.product_id),
      'offered_product', case when o.kind = 'barter' then private.product_snapshot(offered_id) end))
  returning id into new_id;

  insert into public.messages (conversation_id, sender_id, kind, body, offer_id, product_id)
  values (o.conversation_id, uid, 'offer', left(coalesce(p_message, ''), 500), new_id, o.product_id);
  perform private.notify(o.proposer_id, uid, 'offer_countered', 'offer', new_id,
    jsonb_build_object('kind', o.kind, 'amount_xof', amount, 'product_title', prod.title));
  return new_id;
end;
$$;

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  kind text not null check (kind in ('price', 'barter')),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  offered_product_id uuid references public.products (id) on delete set null,
  amount_xof integer not null,
  cash_payer text,
  terms jsonb not null,
  status text not null default 'agreed' check (status in ('agreed', 'completed', 'canceled', 'disputed')),
  buyer_completed_at timestamptz,
  seller_completed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  close_reason text check (close_reason is null or char_length(close_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agreements enable row level security;
create index agreements_buyer_idx on public.agreements (buyer_id, created_at desc);
create index agreements_seller_idx on public.agreements (seller_id, created_at desc);
create trigger agreements_updated_at before update on public.agreements
  for each row execute function private.set_updated_at();

-- Accepted terms are immutable.
create or replace function private.agreements_protect_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.terms is distinct from old.terms or new.amount_xof is distinct from old.amount_xof
     or new.cash_payer is distinct from old.cash_payer or new.offer_id is distinct from old.offer_id
     or new.buyer_id is distinct from old.buyer_id or new.seller_id is distinct from old.seller_id
     or new.kind is distinct from old.kind then
    raise exception 'agreement_terms_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger agreements_protect_terms before update on public.agreements
  for each row execute function private.agreements_protect_terms();

create policy agreements_select on public.agreements
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.agreements from anon, authenticated;
grant select on public.agreements to authenticated;

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

  insert into public.messages (conversation_id, sender_id, kind, body, offer_id)
  values (o.conversation_id, uid, 'system', 'offer_accepted', o.id);
  perform private.notify(o.proposer_id, uid, 'offer_accepted', 'agreement', agreement_id,
    jsonb_build_object('product_title', prod.title));
  return agreement_id;
end;
$$;

create or replace function public.withdraw_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  o public.offers;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.proposer_id <> uid then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if o.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.offers set status = 'withdrawn', responded_at = now() where id = o.id;
  insert into public.messages (conversation_id, sender_id, kind, body, offer_id)
  values (o.conversation_id, uid, 'system', 'offer_withdrawn', o.id);
  perform private.notify(o.recipient_id, uid, 'offer_withdrawn', 'offer', o.id);
end;
$$;

-- Each party declares the exchange done; when both have, status becomes 'completed'.
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
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (a.conversation_id, uid, 'system', 'agreement_completed');
    perform private.notify(case when uid = a.buyer_id then a.seller_id else a.buyer_id end, uid,
      'agreement_completed', 'agreement', a.id);
    return 'completed';
  end if;
  return 'waiting_other_party';
end;
$$;

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
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (a.conversation_id, uid, 'system', 'agreement_' || p_outcome);
  perform private.notify(other, uid, 'agreement_' || p_outcome, 'agreement', a.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews: only after an agreement both members declared completed.
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 500),
  moderation_status public.moderation_state not null default 'active',
  created_at timestamptz not null default now(),
  unique (agreement_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);
alter table public.reviews enable row level security;
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create policy reviews_select on public.reviews
  for select to anon, authenticated
  using (
    reviewer_id = (select auth.uid())
    or (moderation_status = 'active' and private.can_view_profile_content((select auth.uid()), reviewee_id))
  );
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

create or replace function private.refresh_rating(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles p set
    rating_sum = coalesce((select sum(rating) from public.reviews r where r.reviewee_id = p.id and r.moderation_status = 'active'), 0),
    rating_count = (select count(*) from public.reviews r where r.reviewee_id = p.id and r.moderation_status = 'active')
  where p.id = uid;
$$;

create or replace function private.reviews_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_rating(coalesce(new.reviewee_id, old.reviewee_id));
  return null;
end;
$$;
create trigger reviews_after_change after insert or update of moderation_status or delete on public.reviews
  for each row execute function private.reviews_after_change();

create or replace function public.leave_review(p_agreement_id uuid, p_rating integer, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  a public.agreements;
  reviewee uuid;
  rid uuid;
begin
  select * into a from public.agreements where id = p_agreement_id;
  if not found or uid not in (a.buyer_id, a.seller_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if a.status <> 'completed' then
    raise exception 'review_not_allowed' using errcode = 'P0001';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  reviewee := case when uid = a.buyer_id then a.seller_id else a.buyer_id end;
  insert into public.reviews (agreement_id, reviewer_id, reviewee_id, rating, body)
  values (a.id, uid, reviewee, p_rating, left(coalesce(p_body, ''), 500))
  on conflict (agreement_id, reviewer_id) do nothing
  returning id into rid;
  if rid is null then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;
  perform private.notify(reviewee, uid, 'review_received', 'review', rid, jsonb_build_object('rating', p_rating));
  return rid;
end;
$$;

revoke execute on function public.make_offer(uuid, text, integer, uuid, text, text) from anon, public;
revoke execute on function public.counter_offer(uuid, integer, uuid, text, text) from anon, public;
revoke execute on function public.respond_offer(uuid, boolean) from anon, public;
revoke execute on function public.withdraw_offer(uuid) from anon, public;
revoke execute on function public.confirm_agreement_completed(uuid) from anon, public;
revoke execute on function public.close_agreement(uuid, text, text) from anon, public;
revoke execute on function public.leave_review(uuid, integer, text) from anon, public;
grant execute on function public.make_offer(uuid, text, integer, uuid, text, text) to authenticated;
grant execute on function public.counter_offer(uuid, integer, uuid, text, text) to authenticated;
grant execute on function public.respond_offer(uuid, boolean) to authenticated;
grant execute on function public.withdraw_offer(uuid) to authenticated;
grant execute on function public.confirm_agreement_completed(uuid) to authenticated;
grant execute on function public.close_agreement(uuid, text, text) to authenticated;
grant execute on function public.leave_review(uuid, integer, text) to authenticated;

-- Expire stale pending offers (called by cron / maintenance job).
create or replace function public.expire_stale_offers()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.offers set status = 'expired', responded_at = now()
    where status = 'pending' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired;
$$;
revoke execute on function public.expire_stale_offers() from anon, authenticated, public;
grant execute on function public.expire_stale_offers() to service_role;
