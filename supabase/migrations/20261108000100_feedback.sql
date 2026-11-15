-- Jëfëli web beta (W1): optional feedback from members.
--
-- A member can send a short message (a problem, an idea, something unclear) from Réglages. Only
-- staff can read feedback; nobody can read anyone else's, including the author after sending
-- (nothing in the app needs it). No message content of conversations is involved: this is text
-- the member writes to the team on purpose. Deleting the account deletes its feedback.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('problem', 'idea', 'unclear', 'other')),
  message text not null,
  platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now(),
  constraint feedback_message_length check (char_length(btrim(message)) between 3 and 1000)
);
create index feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;

-- Members insert only these columns; user_id comes from the default and is checked below.
revoke all on public.feedback from anon, authenticated;
grant insert (kind, message, platform, app_version) on public.feedback to authenticated;
grant select on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy feedback_select_staff on public.feedback
  for select to authenticated
  using (private.is_staff());

create policy feedback_update_staff on public.feedback
  for update to authenticated
  using (private.is_staff())
  with check (private.is_staff());

create trigger feedback_rate_limit before insert on public.feedback
  for each row execute function private.rate_limit_trigger('feedback', '10', '1 day');

-- The member's own data export (Réglages › Mes données) includes the feedback they sent.
-- Same function as in …20261103000100_feed_engagement.sql, plus the 'feedback' key.
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
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.blocks b where b.blocker_id = uid),
    'feedback', (select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'message', f.message, 'created_at', f.created_at)), '[]') from public.feedback f where f.user_id = uid)
  );
end;
$$;
revoke execute on function public.export_my_data() from anon, public;
grant execute on function public.export_my_data() to authenticated;
