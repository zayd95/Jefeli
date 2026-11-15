-- Jëfëli — security & correctness fixes found by the automated RLS/integration suite
-- (tests/integration). Each item below corresponds to a test that failed before this
-- migration.

-- 1. private.* helpers were executable by PUBLIC: a per-schema default-privileges revoke
--    cannot remove the global PUBLIC EXECUTE default. Lock everything down, then re-grant
--    only the helpers that RLS policies call as the requesting role.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.normalize_text(text), private.is_staff(), private.is_admin(), private.is_active_user(uuid),
  private.is_blocked_between(uuid, uuid), private.has_blocked(uuid, uuid),
  private.follows_accepted(uuid, uuid), private.are_friends(uuid, uuid),
  private.can_view_profile_content(uuid, uuid), private.audience_allows(uuid, uuid, text),
  private.can_view_product(uuid), private.can_view_post(uuid), private.can_view_story(uuid),
  private.can_view_live(uuid)
  to anon, authenticated;
grant execute on function private.is_member(uuid), private.can_read_private_media(text) to authenticated;

-- 2. Private accounts' follower lists and friendships were readable by anyone.
drop policy follows_select on public.follows;
create policy follows_select on public.follows
  for select to anon, authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
    or (
      status = 'accepted'
      and private.can_view_profile_content((select auth.uid()), follower_id)
      and private.can_view_profile_content((select auth.uid()), followee_id)
    )
  );
drop policy friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to anon, authenticated
  using (
    private.can_view_profile_content((select auth.uid()), user_a)
    and private.can_view_profile_content((select auth.uid()), user_b)
  );

-- 3. Soft-deleting a post/status by direct UPDATE failed: Postgres re-checks the SELECT
--    policy (deleted_at is null) on the updated row. Use owner-checked RPCs instead and
--    remove the direct grant.
revoke update (deleted_at) on public.posts from authenticated;
revoke update (deleted_at) on public.stories from authenticated;

create or replace function public.delete_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  update public.posts set deleted_at = now()
  where id = p_post_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.delete_story(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
begin
  update public.stories set deleted_at = now()
  where id = p_story_id and author_id = uid and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.delete_post(uuid) from anon, public;
revoke execute on function public.delete_story(uuid) from anon, public;
grant execute on function public.delete_post(uuid) to authenticated;
grant execute on function public.delete_story(uuid) to authenticated;

-- 4. Logged-out discovery failed: SECURITY INVOKER feed/browse/rail functions reference
--    mutes and story_views. RLS on those tables only matches authenticated users, so anon
--    still reads zero rows.
grant select on public.mutes, public.story_views to anon;

-- 5. First-contact messages showed 0 unread (created_at = now() = new member's
--    last_read_at in the same transaction). clock_timestamp() also orders a product card
--    and its text inserted together.
alter table public.messages alter column created_at set default clock_timestamp();

-- 6. Deleting the latest message left its text in the conversation preview.
create or replace function private.messages_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.conversations c
       set last_message_preview = 'Message supprimé'
     where c.id = new.conversation_id
       and c.last_message_at = new.created_at
       and c.last_message_sender_id = new.sender_id;
  end if;
  return null;
end;
$$;
create trigger messages_after_delete after update of deleted_at on public.messages
  for each row execute function private.messages_after_delete();

-- 7. A block trapped open offers/agreements: trusted RPCs insert 'system' messages that
--    the block check rejected, so a victim could not dispute after blocking. System rows
--    can only come from trusted RPCs (the messages_insert policy excludes them).
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
  if new.kind <> 'system' and other is not null and private.is_blocked_between(new.sender_id, other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if not private.is_active_user(new.sender_id) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if new.kind in ('image', 'voice') then
    if new.attachment_path is null then
      raise exception 'attachment_required' using errcode = 'P0001';
    end if;
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

-- 8. Owners could overwrite published/reported media in place (upsert), swapping report
--    evidence after the fact. Objects are now immutable; the app always uploads to a new
--    random path.
drop policy "jefeli: update own objects" on storage.objects;

-- 9. A blocked member could still reply under the blocker's comment on a third party's post.
create or replace function private.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  parent public.comments;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if private.is_blocked_between(new.author_id, post_author) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if new.parent_id is not null then
    select * into parent from public.comments where id = new.parent_id;
    if not found or parent.post_id <> new.post_id or parent.parent_id is not null then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
    if private.is_blocked_between(new.author_id, parent.author_id) then
      raise exception 'blocked' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- 10. relationship_with told a blocked member that they were blocked. Only report the
--     caller's own block decision.
create or replace function public.relationship_with(p_target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_follow text;
  their_follow text;
  req record;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;
  select status into my_follow from public.follows where follower_id = uid and followee_id = p_target;
  select status into their_follow from public.follows where follower_id = p_target and followee_id = uid;
  select id, sender_id into req from public.friend_requests
  where status = 'pending'
    and ((sender_id = uid and receiver_id = p_target) or (sender_id = p_target and receiver_id = uid))
  limit 1;
  return jsonb_build_object(
    'authenticated', true,
    'is_self', uid = p_target,
    'follow_status', my_follow,
    'follows_me', their_follow = 'accepted',
    'is_friend', private.are_friends(uid, p_target),
    'friend_request_id', req.id,
    'friend_request_direction', case when req.id is null then null when req.sender_id = uid then 'outgoing' else 'incoming' end,
    'blocked', private.has_blocked(uid, p_target),
    'muted', exists (select 1 from public.mutes where muter_id = uid and muted_id = p_target)
  );
end;
$$;

-- 11. Expired offers were only marked by a raise-and-rollback path. Mark them on a
--     schedule, and also soft-delete expired statuses and prune rate-limit windows.
--     (Reads already treat an offer past expires_at as expired.)
create extension if not exists pg_cron;
select cron.schedule('jefeli-expire-offers', '*/15 * * * *', 'select public.expire_stale_offers()');
select cron.schedule('jefeli-purge-statuses', '7 * * * *', 'select public.purge_expired_stories()');
select cron.schedule('jefeli-prune-rate-limits', '17 3 * * *', 'select private.prune_rate_limits()');

-- Keep private helpers locked down for anything (re)created above.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.normalize_text(text), private.is_staff(), private.is_admin(), private.is_active_user(uuid),
  private.is_blocked_between(uuid, uuid), private.has_blocked(uuid, uuid),
  private.follows_accepted(uuid, uuid), private.are_friends(uuid, uuid),
  private.can_view_profile_content(uuid, uuid), private.audience_allows(uuid, uuid, text),
  private.can_view_product(uuid), private.can_view_post(uuid), private.can_view_story(uuid),
  private.can_view_live(uuid)
  to anon, authenticated;
grant execute on function private.is_member(uuid), private.can_read_private_media(text) to authenticated;
revoke execute on function public.my_staff_role() from anon, public;
grant execute on function public.my_staff_role() to authenticated;
