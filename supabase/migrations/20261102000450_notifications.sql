-- Jëfëli — in-app notifications + push device tokens. Notifications are created only by
-- trusted triggers/RPCs; recipients can read, mark read, and delete their own.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'follow', 'follow_request', 'follow_accepted',
    'friend_request', 'friend_accepted',
    'post_like', 'post_comment', 'comment_reply',
    'message', 'story_reply', 'story_like',
    'offer_received', 'offer_countered', 'offer_accepted', 'offer_rejected', 'offer_withdrawn',
    'agreement_completed', 'agreement_canceled', 'agreement_disputed',
    'review_received', 'live_started',
    'moderation_action', 'report_resolved', 'verification_result', 'appeal_result'
  )),
  entity_type text,
  entity_id uuid,
  data jsonb not null default '{}',
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Single entry point. Never notifies yourself, and never across a block.
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
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  if p_actor is not null and private.is_blocked_between(p_recipient, p_actor) then
    return;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id, data)
  values (p_recipient, p_actor, p_type, p_entity_type, p_entity_id, coalesce(p_data, '{}'::jsonb));
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null;
$$;
revoke execute on function public.mark_all_notifications_read() from anon, public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Push tokens (Expo). A device token belongs to the last account that registered it.
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create index push_tokens_user_idx on public.push_tokens (user_id);
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  insert into public.push_tokens (token, user_id, platform) values (p_token, uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke execute on function public.register_push_token(text, text) from anon, public;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Push fan-out: when configured (private.config: push_webhook_url + push_webhook_secret),
-- each new notification is POSTed to the `push-dispatch` Edge Function via pg_net.
-- Without configuration this is a no-op (local development).
create extension if not exists pg_net with schema extensions;

create or replace function private.queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select value into url from private.config where key = 'push_webhook_url';
  select value into secret from private.config where key = 'push_webhook_secret';
  if url is null or secret is null then
    return new;
  end if;
  begin
    perform net.http_post(
      url := url,
      body := jsonb_build_object('notification_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-jefeli-webhook-secret', secret)
    );
  exception when others then
    -- Never block the user action because push delivery is unavailable.
    raise warning 'push queue failed: %', sqlerrm;
  end;
  return new;
end;
$$;
create trigger notifications_queue_push after insert on public.notifications
  for each row execute function private.queue_push();

-- ---------------------------------------------------------------------------
-- Social notification triggers
-- ---------------------------------------------------------------------------

create or replace function private.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify(new.followee_id, new.follower_id,
      case when new.status = 'pending' then 'follow_request' else 'follow' end, 'profile', new.follower_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform private.notify(new.follower_id, new.followee_id, 'follow_accepted', 'profile', new.followee_id);
  end if;
  return null;
end;
$$;
create trigger follows_notify after insert or update on public.follows
  for each row execute function private.notify_follow();

create or replace function private.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(new.receiver_id, new.sender_id, 'friend_request', 'friend_request', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform private.notify(new.sender_id, new.receiver_id, 'friend_accepted', 'profile', new.receiver_id);
  end if;
  return null;
end;
$$;
create trigger friend_requests_notify after insert or update on public.friend_requests
  for each row execute function private.notify_friend_request();

create or replace function private.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  -- One like notification per (liker, post), even if they unlike/like again.
  if not exists (
    select 1 from public.notifications
    where recipient_id = author and actor_id = new.user_id and type = 'post_like' and entity_id = new.post_id
  ) then
    perform private.notify(author, new.user_id, 'post_like', 'post', new.post_id);
  end if;
  return null;
end;
$$;
create trigger post_likes_notify after insert on public.post_likes
  for each row execute function private.notify_post_like();

create or replace function private.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  parent_author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform private.notify(author, new.author_id, 'post_comment', 'post', new.post_id,
    jsonb_build_object('comment_id', new.id, 'excerpt', left(new.body, 80)));
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is distinct from author then
      perform private.notify(parent_author, new.author_id, 'comment_reply', 'post', new.post_id,
        jsonb_build_object('comment_id', new.id, 'excerpt', left(new.body, 80)));
    end if;
  end if;
  return null;
end;
$$;
create trigger comments_notify after insert on public.comments
  for each row execute function private.notify_comment();

create or replace function private.notify_story_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  select author_id into author from public.stories where id = new.story_id;
  perform private.notify(author, new.user_id, 'story_like', 'story', new.story_id);
  return null;
end;
$$;
create trigger story_likes_notify after insert on public.story_likes
  for each row execute function private.notify_story_like();
