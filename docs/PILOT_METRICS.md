# Jëfëli — private pilot metrics

A handful of questions answered from tables the app already writes. No tracking SDK, no new
table, no event pipeline, nothing sent to a third party. The owner runs these queries in the
Supabase SQL editor of the pilot project, about once a week, and copies the numbers into the
pilot notes.

## Privacy rules (non-negotiable)

- **Never read what people wrote to each other.** The queries below never select
  `messages.body`, `messages.attachment_path`, `conversations.last_message_preview` (a snippet of
  the last message), `offers.message`, `agreements.terms`, `agreements.close_reason`,
  `reports.details`, `reports.evidence`, `reviews.body`, `posts.body` or profile bios. They count
  rows and measure times between rows.
- Aggregates only. With 25 people, a per-person table identifies people: do not export one, and
  do not share any number below 3 outside the owner/moderator group.
- Excluded from every count: DÉMO accounts (`profiles.is_demo`), staff (`staff_roles`), suspended
  accounts, and test addresses ending in `.test`. The pilot project should hold no DÉMO data
  at all (`docs/SETUP_PRODUCTION.md`).
- Every block starts a read-only transaction, so a query pasted by mistake cannot change data.
- Set the pilot start date once in each `params` line (`2026-11-01` below is a placeholder).

All queries were run against the local stack on 7 Nov 2026 (`scripts/check-pilot-metrics.sh`).
Those numbers are E2E and DÉMO leftovers and mean nothing; only the pilot project's matter.

## 1. Activation funnel — do new members get to a first exchange?

```sql
begin read only;
with params as (select timestamptz '2026-11-01' as since),
members as (
  select p.id, p.created_at, p.onboarded_at
  from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
    and p.created_at >= (select since from params)
)
select
  count(*)                                                                                     as signed_up,
  count(*) filter (where m.onboarded_at is not null)                                           as onboarded,
  count(*) filter (where exists (select 1 from public.products x where x.seller_id = m.id))     as listed_an_item,
  count(*) filter (where exists (select 1 from public.messages x where x.sender_id = m.id))     as sent_a_message,
  count(*) filter (where exists (select 1 from public.offers x where x.proposer_id = m.id))     as made_an_offer,
  count(*) filter (where exists (select 1 from public.agreements x where m.id in (x.buyer_id, x.seller_id))) as reached_an_agreement
from members m;
commit;
```

## 2. Supply — are sellers listing, and what kind of listings?

```sql
begin read only;
with params as (select timestamptz '2026-11-01' as since),
members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
)
select date_trunc('week', x.created_at)::date                         as week,
       count(*)                                                        as listings_created,
       count(distinct x.seller_id)                                     as sellers,
       count(*) filter (where x.listing_mode <> 'sale')                as open_to_wecci,
       count(*) filter (where x.price_mode = 'fixed')                  as price_shown,
       count(*) filter (where x.price_mode in ('on_request', 'negotiable')) as price_on_request_or_negotiable,
       count(*) filter (where x.status = 'sold')                       as since_sold,
       count(*) filter (where x.moderation_status <> 'active')         as hidden_or_removed
from public.products x join members m on m.id = x.seller_id
where x.created_at >= (select since from params)
group by 1 order by 1;
commit;
```

Current stock (the cold-start target is ≈ 30 visible listings from 8–10 sellers):

```sql
begin read only;
with members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
)
select x.category_slug,
       count(*)                    as visible_listings,
       count(distinct x.seller_id) as sellers
from public.products x join members m on m.id = x.seller_id
where x.status in ('active', 'reserved') and x.moderation_status = 'active'
group by rollup (x.category_slug) order by 2 desc;
commit;
```

## 3. Demand — does a listing get contacted, and do sellers answer?

Share of listings older than 7 days that received an offer, or an article card sent by someone
else in a conversation, within 7 days of being published:

```sql
begin read only;
with members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
)
select count(*) as listings_older_than_7_days,
       count(*) filter (where
         exists (select 1 from public.offers o
                 where o.product_id = x.id and o.created_at < x.created_at + interval '7 days')
         or exists (select 1 from public.messages g
                    where g.product_id = x.id and g.sender_id <> x.seller_id
                      and g.created_at < x.created_at + interval '7 days')) as contacted_within_7_days
from public.products x join members m on m.id = x.seller_id
where x.created_at < now() - interval '7 days';
commit;
```

Time to a first answer, per conversation started by a pilot member (who wrote first and when the
other person first wrote back; message contents are not read):

```sql
begin read only;
with params as (select timestamptz '2026-11-01' as since),
members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
),
firsts as (
  select c.id,
         min(g.created_at) filter (where g.sender_id = c.created_by)  as asked_at,
         min(g.created_at) filter (where g.sender_id <> c.created_by) as answered_at
  from public.conversations c
  join public.messages g on g.conversation_id = c.id and g.deleted_at is null
  where c.created_by in (select id from members) and c.created_at >= (select since from params)
  group by c.id
)
select count(*)                                                          as conversations,
       count(*) filter (where answered_at > asked_at)                    as answered,
       round((percentile_cont(0.5) within group (order by extract(epoch from answered_at - asked_at) / 60)
              filter (where answered_at > asked_at))::numeric, 1)        as median_minutes_to_answer,
       count(*) filter (where answered_at is null and asked_at < now() - interval '24 hours') as unanswered_after_24h
from firsts where asked_at is not null;
commit;
```

## 4. Offers, Wecci and agreements

```sql
begin read only;
with params as (select timestamptz '2026-11-01' as since),
members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
)
select o.kind,
       count(*)                                                        as offers,
       count(*) filter (where o.parent_offer_id is not null)           as counter_offers,
       count(*) filter (where o.kind = 'barter' and o.amount_xof is not null) as barter_with_cash,
       count(*) filter (where o.status = 'accepted')                   as accepted,
       count(*) filter (where o.status = 'rejected')                   as rejected,
       count(*) filter (where o.status = 'countered')                  as countered,
       count(*) filter (where o.status = 'expired')                    as expired,
       count(*) filter (where o.status = 'withdrawn')                  as withdrawn,
       count(*) filter (where o.status = 'pending')                    as pending
from public.offers o join members m on m.id = o.proposer_id
where o.created_at >= (select since from params)
group by rollup (o.kind) order by 1;
commit;
```

Exchange outcomes, as declared by the members themselves in « Mes accords et échanges » (each
side marks the exchange done; Jëfëli holds no money and does not check delivery):

```sql
begin read only;
with params as (select timestamptz '2026-11-01' as since),
members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
)
select a.kind,
       count(*)                                                        as agreements,
       count(*) filter (where a.status = 'completed')                  as done_on_both_sides,
       count(*) filter (where a.status = 'agreed'
                          and (a.buyer_completed_at is not null or a.seller_completed_at is not null)) as done_on_one_side,
       count(*) filter (where a.status = 'agreed'
                          and a.buyer_completed_at is null and a.seller_completed_at is null)        as no_outcome_yet,
       count(*) filter (where a.status = 'canceled')                   as canceled,
       count(*) filter (where a.status = 'disputed')                   as disputed,
       round((percentile_cont(0.5) within group (
              order by extract(epoch from greatest(a.buyer_completed_at, a.seller_completed_at) - a.created_at) / 86400)
              filter (where a.status = 'completed'))::numeric, 1)      as median_days_to_done
from public.agreements a
where a.seller_id in (select id from members) and a.created_at >= (select since from params)
group by rollup (a.kind) order by 1;
commit;
```

Reviews left after a completed exchange (count and average only):

```sql
begin read only;
select count(*) as reviews, round(avg(rating)::numeric, 2) as average_rating
from public.reviews r join public.profiles p on p.id = r.reviewer_id
where not p.is_demo and r.moderation_status = 'active';
commit;
```

## 5. Safety — are reports handled in time?

```sql
begin read only;
select r.reason,
       count(*)                                                        as reports,
       count(*) filter (where r.status in ('open', 'in_review'))       as still_open,
       count(*) filter (where r.status = 'actioned')                   as actioned,
       count(*) filter (where r.status = 'dismissed')                  as dismissed,
       round((percentile_cont(0.5) within group (order by extract(epoch from r.resolved_at - r.created_at) / 3600)
              filter (where r.resolved_at is not null))::numeric, 1)   as median_hours_to_resolve,
       round(max(extract(epoch from now() - r.created_at) / 3600)
             filter (where r.status in ('open', 'in_review'))::numeric, 1) as oldest_open_hours
from public.reports r
group by rollup (r.reason) order by 2 desc;
commit;
```

```sql
begin read only;
select date_trunc('week', created_at)::date as week, action, count(*) as moderation_actions
from public.moderation_actions group by 1, 2 order by 1, 2;
select date_trunc('week', created_at)::date as week, count(*) as blocks
from public.blocks group by 1 order by 1;
select count(*) filter (where status = 'suspended') as suspended_accounts from public.profiles where not is_demo;
commit;
```

## 6. Retention — do people come back?

« Active » = did at least one visible thing that week: listed, sent a message, made an offer,
posted, published a status or followed someone. Opening the app without doing anything is not
recorded (there is no tracking).

```sql
begin read only;
with members as (
  select p.id, p.created_at from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
),
activity as (
  select seller_id as uid, created_at from public.products
  union all select sender_id, created_at from public.messages
  union all select proposer_id, created_at from public.offers
  union all select author_id, created_at from public.posts where deleted_at is null
  union all select author_id, created_at from public.stories
  union all select follower_id, created_at from public.follows
)
select date_trunc('week', a.created_at)::date as week, count(distinct a.uid) as active_members
from activity a join members m on m.id = a.uid
group by 1 order by 1;
commit;
```

```sql
begin read only;
with members as (
  select p.id, p.created_at from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
),
activity as (
  select seller_id as uid, created_at from public.products
  union all select sender_id, created_at from public.messages
  union all select proposer_id, created_at from public.offers
  union all select author_id, created_at from public.posts where deleted_at is null
  union all select author_id, created_at from public.stories
  union all select follower_id, created_at from public.follows
)
select count(*) as joined_more_than_14_days_ago,
       count(*) filter (where exists (select 1 from activity a where a.uid = m.id
                                        and a.created_at >= m.created_at + interval '7 days')) as active_again_after_day_7
from members m where m.created_at < now() - interval '14 days';
commit;
```

## 7. Phone codes — SMS sent, refused, failed, cost (W1.4)

Every phone sign-up / sign-in code goes through the `send-sms` hook, which logs each attempt
(no code, no full number: keyed hashes and the operator prefix only). Admins also get this from
`select * from admin_sms_usage(14);` in the app's SQL console.

```sql
begin read only;
select (created_at at time zone 'Africa/Dakar')::date as day,
       count(*) filter (where outcome = 'sent') as sent,
       count(*) filter (where outcome = 'failed') as failed,
       count(*) filter (where outcome = 'blocked') as blocked,
       count(*) filter (where outcome = 'blocked' and reason in ('number_hour', 'number_day', 'ip_hour')) as blocked_caps,
       count(*) filter (where outcome = 'blocked' and reason = 'destination') as blocked_destination,
       coalesce(sum(est_cost_xof) filter (where outcome = 'sent'), 0) as est_cost_xof
from private.sms_events
where created_at > now() - interval '14 days'
group by 1 order by 1 desc;
-- Operator ranges (sent, last 14 days): 22177/22178 Orange, 22176 Free/Yas, 22170 Expresso, 22175 Promobile
select phone_prefix, count(*) as sent, count(*) filter (where outcome = 'failed') as failed
from private.sms_events
where created_at > now() - interval '14 days' and outcome in ('sent', 'failed')
group by 1 order by 2 desc;
commit;
```

Watch: failures concentrated on one operator range (delivery problem), `blocked_caps` rising
(abuse or a confused member), daily sends near the budget in `private.sms_settings`.

## What « good » looks like (proposed — owner to confirm before the pilot)

| Question | Signal worth continuing | Stop and fix first |
|---|---|---|
| Activation | ≥ 70 % of invited members onboarded; ≥ 8 sellers with ≥ 3 listings each by the end of week 1 | Sellers stall before their first listing |
| Demand | ≥ 50 % of listings contacted within 7 days | Most listings never get a message |
| Responsiveness | Median first answer < 2 h; few conversations unanswered after 24 h | Buyers wait more than a day |
| Exchanges | ≥ 5 agreements declared done on both sides over the pilot | Agreements made but never completed, or disputes |
| Safety | Every report resolved within 48 h; no scam left visible | A report open for more than 48 h, any confirmed scam |
| Retention | ≥ 40 % of members active again after day 7 | Members try once and never return |

Qualitative feedback (what people tell the support channel, see `docs/PILOT_OPERATIONS.md`)
weighs as much as these numbers with 25 people.
