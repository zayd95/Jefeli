-- Jëfëli — trust & safety: reports with evidence snapshots, moderation actions (immutable
-- log), appeals, merchant verification requests, staff RPCs, data export.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in
    ('profile', 'post', 'comment', 'product', 'story', 'message', 'live_session', 'live_comment', 'agreement', 'review')),
  target_id uuid not null,
  target_owner_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in
    ('spam', 'scam', 'prohibited_item', 'counterfeit', 'harassment', 'hate', 'nudity', 'violence',
     'minor_safety', 'impersonation', 'dispute', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  evidence jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note text
);
alter table public.reports enable row level security;
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status in ('open', 'in_review');
create trigger reports_updated_at before update on public.reports
  for each row execute function private.set_updated_at();

create policy reports_select on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- Resolve owner + minimal evidence snapshot for a target the reporter can actually see.
create or replace function private.report_target_info(p_type text, p_id uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  case p_type
    when 'profile' then
      select jsonb_build_object('owner', p.id, 'snapshot', jsonb_build_object('handle', p.handle, 'display_name', p.display_name, 'bio', p.bio))
      into r from public.profiles p where p.id = p_id;
    when 'post' then
      if private.can_view_post(p_id) then
        select jsonb_build_object('owner', p.author_id, 'snapshot', jsonb_build_object('body', p.body, 'visibility', p.visibility,
          'media', (select coalesce(jsonb_agg(jsonb_build_object('bucket', m.bucket, 'path', m.storage_path, 'kind', m.kind)), '[]') from public.post_media m where m.post_id = p.id)))
        into r from public.posts p where p.id = p_id;
      end if;
    when 'comment' then
      select jsonb_build_object('owner', c.author_id, 'snapshot', jsonb_build_object('body', c.body, 'post_id', c.post_id))
      into r from public.comments c where c.id = p_id and private.can_view_post(c.post_id);
    when 'product' then
      if private.can_view_product(p_id) then
        select jsonb_build_object('owner', p.seller_id, 'snapshot', private.product_snapshot(p.id) || jsonb_build_object('description', p.description))
        into r from public.products p where p.id = p_id;
      end if;
    when 'story' then
      if private.can_view_story(p_id) then
        select jsonb_build_object('owner', s.author_id, 'snapshot', jsonb_build_object('caption', s.caption, 'path', s.storage_path, 'kind', s.media_kind))
        into r from public.stories s where s.id = p_id;
      end if;
    when 'message' then
      -- Staff never get blanket DM access: the reported message content is copied into the report.
      select jsonb_build_object('owner', m.sender_id, 'snapshot', jsonb_build_object('body', m.body, 'kind', m.kind,
        'attachment_path', m.attachment_path, 'conversation_id', m.conversation_id, 'sent_at', m.created_at))
      into r from public.messages m
      where m.id = p_id and exists (select 1 from public.conversation_members cm where cm.conversation_id = m.conversation_id and cm.user_id = p_uid);
    when 'live_session' then
      if private.can_view_live(p_id) then
        select jsonb_build_object('owner', l.host_id, 'snapshot', jsonb_build_object('title', l.title, 'status', l.status))
        into r from public.live_sessions l where l.id = p_id;
      end if;
    when 'live_comment' then
      select jsonb_build_object('owner', c.author_id, 'snapshot', jsonb_build_object('body', c.body, 'live_session_id', c.live_session_id))
      into r from public.live_comments c where c.id = p_id and private.can_view_live(c.live_session_id);
    when 'agreement' then
      select jsonb_build_object('owner', case when a.buyer_id = p_uid then a.seller_id else a.buyer_id end, 'snapshot', a.terms || jsonb_build_object('status', a.status))
      into r from public.agreements a where a.id = p_id and p_uid in (a.buyer_id, a.seller_id);
    when 'review' then
      select jsonb_build_object('owner', v.reviewer_id, 'snapshot', jsonb_build_object('rating', v.rating, 'body', v.body))
      into r from public.reviews v where v.id = p_id;
    else
      r := null;
  end case;
  return r;
end;
$$;

create or replace function public.report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  info jsonb;
  rid uuid;
begin
  info := private.report_target_info(p_target_type, p_target_id, uid);
  if info is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (info ->> 'owner')::uuid = uid then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  perform private.enforce_rate_limit('report', 30, interval '1 day');
  insert into public.reports (reporter_id, target_type, target_id, target_owner_id, reason, details, evidence)
  values (uid, p_target_type, p_target_id, (info ->> 'owner')::uuid, p_reason, left(coalesce(p_details, ''), 1000), info -> 'snapshot')
  on conflict (reporter_id, target_type, target_id) where status in ('open', 'in_review') do nothing
  returning id into rid;
  if rid is null then
    select id into rid from public.reports
    where reporter_id = uid and target_type = p_target_type and target_id = p_target_id and status in ('open', 'in_review');
  end if;
  return rid;
end;
$$;
revoke execute on function public.report_content(text, uuid, text, text) from anon, public;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- Disputing an agreement also opens a moderation report.
create or replace function private.agreement_dispute_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'disputed' and old.status <> 'disputed' then
    insert into public.reports (reporter_id, target_type, target_id, target_owner_id, reason, details, evidence)
    values (new.closed_by, 'agreement', new.id,
      case when new.closed_by = new.buyer_id then new.seller_id else new.buyer_id end,
      'dispute', coalesce(new.close_reason, ''), new.terms)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger agreements_dispute_report after update of status on public.agreements
  for each row execute function private.agreement_dispute_report();

-- ---------------------------------------------------------------------------
-- Moderation actions (immutable) + staff RPC
-- ---------------------------------------------------------------------------

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in
    ('hide_content', 'remove_content', 'restore_content', 'suspend_user', 'unsuspend_user',
     'warn_user', 'dismiss_report', 'grant_verification', 'revoke_verification', 'reverse_on_appeal')),
  target_type text not null,
  target_id uuid not null,
  target_owner_id uuid references public.profiles (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.moderation_actions enable row level security;
create index moderation_actions_target_idx on public.moderation_actions (target_type, target_id);
create index moderation_actions_owner_idx on public.moderation_actions (target_owner_id, created_at desc);

-- Staff see the whole log; a user sees actions taken against their own content/account.
create policy moderation_actions_select on public.moderation_actions
  for select to authenticated
  using ((select private.is_staff()) or target_owner_id = (select auth.uid()));
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

create or replace function private.content_owner(p_type text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'profile' then p_id
    when 'post' then (select author_id from public.posts where id = p_id)
    when 'comment' then (select author_id from public.comments where id = p_id)
    when 'product' then (select seller_id from public.products where id = p_id)
    when 'story' then (select author_id from public.stories where id = p_id)
    when 'live_session' then (select host_id from public.live_sessions where id = p_id)
    when 'live_comment' then (select author_id from public.live_comments where id = p_id)
    when 'review' then (select reviewer_id from public.reviews where id = p_id)
    when 'message' then (select sender_id from public.messages where id = p_id)
    else null
  end;
$$;

create or replace function private.set_content_state(p_type text, p_id uuid, p_state public.moderation_state)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  case p_type
    when 'post' then update public.posts set moderation_status = p_state where id = p_id;
    when 'comment' then update public.comments set moderation_status = p_state where id = p_id;
    when 'product' then update public.products set moderation_status = p_state where id = p_id;
    when 'story' then update public.stories set moderation_status = p_state where id = p_id;
    when 'live_session' then update public.live_sessions set moderation_status = p_state where id = p_id;
    when 'live_comment' then update public.live_comments set moderation_status = p_state where id = p_id;
    when 'review' then update public.reviews set moderation_status = p_state where id = p_id;
    when 'message' then
      if p_state <> 'active' then
        update public.messages set deleted_at = coalesce(deleted_at, now()) where id = p_id;
      end if;
    else
      raise exception 'invalid_target' using errcode = 'P0001';
  end case;
end;
$$;

create or replace function public.moderate(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_report_id uuid default null,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  action_id uuid;
begin
  if not private.is_staff() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_action in ('grant_verification', 'revoke_verification') and not private.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  owner := private.content_owner(p_target_type, p_target_id);

  case p_action
    when 'hide_content' then perform private.set_content_state(p_target_type, p_target_id, 'hidden');
    when 'remove_content' then perform private.set_content_state(p_target_type, p_target_id, 'removed');
    when 'restore_content' then perform private.set_content_state(p_target_type, p_target_id, 'active');
    when 'suspend_user' then
      if owner is null then raise exception 'invalid_target' using errcode = 'P0001'; end if;
      if exists (select 1 from public.staff_roles where user_id = owner) then
        raise exception 'not_allowed' using errcode = 'P0001';
      end if;
      update public.profiles set status = 'suspended' where id = owner;
    when 'unsuspend_user' then
      update public.profiles set status = 'active' where id = owner;
    when 'grant_verification' then
      update public.profiles set verification_level = 'merchant_verified' where id = owner;
    when 'revoke_verification' then
      update public.profiles set verification_level = 'none' where id = owner;
    when 'warn_user', 'dismiss_report' then
      null;
    else
      raise exception 'invalid_action' using errcode = 'P0001';
  end case;

  insert into public.moderation_actions (moderator_id, action, target_type, target_id, target_owner_id, report_id, reason)
  values (uid, p_action, p_target_type, p_target_id, owner, p_report_id, left(coalesce(p_reason, ''), 1000))
  returning id into action_id;

  if p_report_id is not null then
    update public.reports set
      status = case when p_action = 'dismiss_report' then 'dismissed' else 'actioned' end,
      resolved_at = now(), resolved_by = uid, resolution_note = left(coalesce(p_reason, ''), 1000)
    where id = p_report_id;
    -- Close duplicate open reports on the same target with the same outcome.
    update public.reports set
      status = case when p_action = 'dismiss_report' then 'dismissed' else 'actioned' end,
      resolved_at = now(), resolved_by = uid
    where target_type = p_target_type and target_id = p_target_id and status in ('open', 'in_review');
    perform private.notify(r.reporter_id, null, 'report_resolved', 'report', r.id,
      jsonb_build_object('outcome', case when p_action = 'dismiss_report' then 'dismissed' else 'actioned' end))
    from public.reports r where r.target_type = p_target_type and r.target_id = p_target_id and r.resolved_by = uid
      and r.resolved_at > now() - interval '1 minute';
  end if;

  if p_action not in ('dismiss_report') and owner is not null then
    perform private.notify(owner, null, 'moderation_action', 'moderation_action', action_id,
      jsonb_build_object('action', p_action, 'target_type', p_target_type, 'reason', left(coalesce(p_reason, ''), 200)));
  end if;
  perform private.audit('moderate:' || p_action, p_target_type, p_target_id::text, jsonb_build_object('report_id', p_report_id));
  return action_id;
end;
$$;
revoke execute on function public.moderate(text, text, uuid, uuid, text) from anon, public;
grant execute on function public.moderate(text, text, uuid, uuid, text) to authenticated;

create or replace function public.set_report_status(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_status not in ('open', 'in_review') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.reports set status = p_status where id = p_report_id and status in ('open', 'in_review');
end;
$$;
revoke execute on function public.set_report_status(uuid, text) from anon, public;
grant execute on function public.set_report_status(uuid, text) to authenticated;

create or replace function public.my_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_roles where user_id = auth.uid();
$$;
grant execute on function public.my_staff_role() to authenticated;

create or replace function public.admin_set_feature_flag(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.feature_flags set enabled = p_enabled, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform private.audit('feature_flag', 'feature_flag', p_key, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke execute on function public.admin_set_feature_flag(text, boolean) from anon, public;
grant execute on function public.admin_set_feature_flag(text, boolean) to authenticated;

create or replace function public.admin_audit_log(p_limit integer default 100)
returns setof private.audit_events
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  return query select * from private.audit_events order by id desc limit least(p_limit, 500);
end;
$$;
revoke execute on function public.admin_audit_log(integer) from anon, public;
grant execute on function public.admin_audit_log(integer) to authenticated;

-- Staff may read private-media evidence referenced by a report (signed URL generation).
create or replace function private.is_reported_evidence(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff() and exists (
    select 1 from public.reports r
    where r.evidence::text like '%' || p_path || '%'
  );
$$;

-- ---------------------------------------------------------------------------
-- Appeals
-- ---------------------------------------------------------------------------

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  moderation_action_id uuid not null references public.moderation_actions (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'reversed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note text,
  unique (moderation_action_id, user_id)
);
alter table public.appeals enable row level security;
create policy appeals_select on public.appeals
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;

create or replace function public.submit_appeal(p_moderation_action_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
begin
  -- Suspended users may still appeal; require authentication only.
  if uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.moderation_actions where id = p_moderation_action_id and target_owner_id = uid
                 and action in ('hide_content', 'remove_content', 'suspend_user', 'warn_user', 'revoke_verification')) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.appeals (user_id, moderation_action_id, body) values (uid, p_moderation_action_id, btrim(p_body))
  on conflict do nothing returning id into aid;
  if aid is null then
    raise exception 'already_appealed' using errcode = 'P0001';
  end if;
  return aid;
end;
$$;
revoke execute on function public.submit_appeal(uuid, text) from anon, public;
grant execute on function public.submit_appeal(uuid, text) to authenticated;

create or replace function public.resolve_appeal(p_appeal_id uuid, p_reverse boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap public.appeals;
  ma public.moderation_actions;
begin
  if not private.is_staff() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into ap from public.appeals where id = p_appeal_id for update;
  if not found or ap.status <> 'open' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  select * into ma from public.moderation_actions where id = ap.moderation_action_id;
  if p_reverse then
    if ma.action in ('hide_content', 'remove_content') then
      perform private.set_content_state(ma.target_type, ma.target_id, 'active');
    elsif ma.action = 'suspend_user' then
      update public.profiles set status = 'active' where id = ma.target_owner_id;
    elsif ma.action = 'revoke_verification' then
      update public.profiles set verification_level = 'merchant_verified' where id = ma.target_owner_id;
    end if;
    insert into public.moderation_actions (moderator_id, action, target_type, target_id, target_owner_id, reason)
    values (auth.uid(), 'reverse_on_appeal', ma.target_type, ma.target_id, ma.target_owner_id, left(coalesce(p_note, ''), 1000));
  end if;
  update public.appeals set status = case when p_reverse then 'reversed' else 'upheld' end,
    resolved_at = now(), resolved_by = auth.uid(), resolution_note = left(coalesce(p_note, ''), 1000)
  where id = ap.id;
  perform private.notify(ap.user_id, null, 'appeal_result', 'appeal', ap.id,
    jsonb_build_object('outcome', case when p_reverse then 'reversed' else 'upheld' end));
end;
$$;
revoke execute on function public.resolve_appeal(uuid, boolean, text) from anon, public;
grant execute on function public.resolve_appeal(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Merchant verification requests. The badge is granted ONLY by an admin decision here.
-- ---------------------------------------------------------------------------

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 2 and 80),
  business_type text not null check (business_type in ('boutique', 'marche', 'artisan', 'entreprise', 'autre')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
alter table public.verification_requests enable row level security;
create unique index verification_requests_one_pending on public.verification_requests (user_id) where status = 'pending';
create policy verification_requests_select on public.verification_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy verification_requests_insert_own on public.verification_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_user((select auth.uid())));
revoke all on public.verification_requests from anon, authenticated;
grant select on public.verification_requests to authenticated;
grant insert (user_id, business_name, business_type, details) on public.verification_requests to authenticated;

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
    update public.profiles set verification_level = 'merchant_verified', is_merchant = true where id = vr.user_id;
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

-- ---------------------------------------------------------------------------
-- Personal data export (GDPR-style / Senegal law 2008-12 readiness)
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;
revoke execute on function public.export_my_data() from anon, public;
grant execute on function public.export_my_data() to authenticated;
