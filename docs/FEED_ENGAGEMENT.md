# Jëfëli — feed engagement and discovery pass

Branch `claude/jefeli-pilot`, migration `supabase/migrations/20261103000100_feed_engagement.sql`.
Before and after screenshots at three phone sizes are in `docs/evidence/feed-pass/{before,after}/`.

## What changed

### 1. Community votes (they replace the heart on publications)
- Each publication has a **▲ pour / ▼ contre** control. Each member gets one vote per publication and
  can change it: tap ▲ to vote for, tap it again to withdraw, or tap ▼ to switch.
- **Only the positive count is public** ("4"). A downvote is private feedback: only the member who
  cast it can see it. It never appears as a negative score and it is not readable through the API.
  It only lowers how often similar content is shown (see the ranking below).
- **Authors cannot vote on their own publications.** They see their count without buttons.
- Votes are about a publication, **not a product review and not a seller rating**. Reviews remain
  limited to completed agreements (`agreements` → `reviews`). Votes are never added up on a
  profile or a boutique.
- **The old heart was a duplicate control**, so it was retired. Existing likes were migrated as
  upvotes (except self-likes), and existing "a aimé" notifications were renamed rather than sent
  again. Product favourites (♥ on products) and status likes are different features and stay
  as they are.
- **Safeguards:**
  - All writes go through `vote_post()`; members cannot write to the table directly.
  - A member can only vote on content they are allowed to see (audience, blocks, moderation)
    and only while their account is active.
  - Limit: 200 new votes or vote changes per hour.
  - A block removes the votes between the two members, in both directions.
  - The author is notified only for the first upvote from each member, never for a downvote.
- **Optimistic UI:** the count changes instantly and is shared by the feed, the publication
  screen, the profile and saved items. If the server refuses, the count reverts and a French
  message is shown (covered by an E2E test).

### 2. Conversational publications (intents)
- The composer has a **Type de publication** choice: *Je partage* (default), *Je cherche*,
  *Je propose*, *Votre avis ?*. Each type has its own hint and example text. A request or a
  question needs a sentence; a photo alone is not enough.
- These are **labels on ordinary posts**: the same media, comments, sharing, product tags and
  messages work for every type. There is no separate marketplace or service catalogue.
- **On cards:**
  - Each type except *Je partage* shows a small label.
  - A contextual button appears for other members:
    - *Je cherche* → **Je peux aider** (opens a private chat with the author);
    - *Je propose* → **Écrire à …**;
    - *Votre avis ?* → **Donner mon avis** (opens the comments with the keyboard up).
- **Asking is one tap away:**
  - a **"Demandez à la communauté"** card at the top of *Pour toi*, with *Je cherche /
    Je propose / Votre avis ?* shortcuts;
  - a **Demande à la communauté** entry in the Publier menu.

### 3. Feed cards
- **Action row:** vote pill · comments (count, or "Commenter") · share, with save on the right.
  The product card ("Voir →") and the contact actions on product pages are unchanged.
- **Comment preview:** up to 2 genuine recent top-level comments, plus "Voir les N commentaires".
  They come from `get_comment_previews()`, which uses the viewer's own access rules: blocked
  members, muted members, hidden or deleted comments and restricted posts are excluded. An
  author's own reply is marked « · Auteur ».

### 4. Explainable ranking v2 (`get_feed`, *Pour toi*)
Each post gets a score, and a discreet reason is shown in the card's meta line:

| Signal | Effect |
|---|---|
| You follow the author / you are friends / it's your post | +3 / +3 / +1 |
| Same city as you | +1.5 |
| A tagged product matches your interests | +1 |
| Community | +0.5·ln(1+upvotes) + 0.35·ln(1+comments) |
| Private downvotes | 0 to −2, based on the share of downvotes and damped (one downvote barely matters) |
| Fair chance | account under 30 days: up to +0.8, fading over time; 3 posts or fewer: +0.4 |
| Request waiting for answers | *Je cherche* / *Votre avis ?* under 3 days old with fewer than 3 comments: +0.8 |
| Recency | −1 for every 18 hours of age |
| Author diversity | −1.2 for each earlier post by the same author (up to 4) |
| Type diversity | −0.2 for each earlier post of the same type (up to 4) |

Reasons: *Ami*, *Près de toi*, *Selon tes centres d'intérêt*, *Attend vos réponses*,
*Apprécié par la communauté* (3 or more public upvotes), *Nouveau sur Jëfëli*, *À découvrir*.

The feed still excludes:
- muted authors;
- members blocked in either direction;
- hidden, removed or deleted posts;
- posts whose audience does not include the viewer.

The *Abonnements* and *À proximité* tabs remain chronological. The score itself is **never
returned**: it includes the private downvote penalty, and a test checks that it stays null.

### 5. DÉMO content for playtesting (`pnpm seed`, local or staging only)
There are 10 fictional DÉMO accounts (password `Demo-jefeli-2026!`). The 5 new ones are:
- `khadija@` — tailor, *Je propose*
- `ibrahima@` — phone repair in Thiès
- `aissatou@` — caterer
- `mariama@` — student in Saint-Louis, *Je cherche* a laptop
- `ousmane@` — brand-new seller of wax tote bags

The set includes fashion showcases, used items and barter, service offers, requests, questions,
comment threads and votes cast by DÉMO members through `vote_post`. It also includes two private
follow-up conversations (Mariama ↔ Moussa about a laptop, Fatou ↔ Khadija about a fitting).
Everything is created through the real APIs and labelled DÉMO, and the seed refuses to run
against production.

## Try it
- **Votes:** sign in as `fatou@demo.jefeli.test`. On *Pour toi*, vote on Awa's post. Switch to ▼:
  the count goes down and nothing negative is displayed.
- **Ask the community:** tap **Je cherche** on the card under the tabs, write a request and
  publish.
- **Answer a request:** sign in as `khadija@…`. Fatou's request has **Je peux aider** (private
  chat) and comments.
- **Comment previews:** previews appear under each card. Tap one to open the full thread.

## Metrics for the next real-user playtest

There is **no analytics or impression tracking** in the app (nothing was added in this pass).
Every number below comes from the database. Exclude DÉMO accounts (`profiles.is_demo`) and set
the playtest start date. Run the queries with `psql` on the staging database.

```sql
-- Playtest window and real (non-DÉMO) members
create temp view real_posts as
  select p.* from posts p join profiles a on a.id = p.author_id
  where not a.is_demo and p.created_at >= '2026-11-10' and p.deleted_at is null;

-- 1. What people publish: share of requests, offers and questions vs shares
select intent, count(*), round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from real_posts group by intent order by 2 desc;

-- 2. Are requests answered? Share of « Je cherche » and « Votre avis ? » posts with a reply from
--    someone else, and the median time to that first answer
with firsts as (
  select p.id, min(c.created_at) - p.created_at as wait
  from real_posts p left join comments c
    on c.post_id = p.id and c.author_id <> p.author_id and c.deleted_at is null
  where p.intent in ('seek', 'opinion') group by p.id, p.created_at)
select count(*) as requests,
       round(100.0 * count(wait) / nullif(count(*), 0), 1) as pct_answered,
       percentile_cont(0.5) within group (order by wait) as median_first_answer
from firsts;

-- 3. Requests that led to a private conversation within 48 h (proxy for « Je peux aider » / « Écrire à »)
select count(distinct p.id) as requests_with_dm
from real_posts p
join conversation_members me on me.user_id = p.author_id
join conversations c on c.id = me.conversation_id
  and c.created_at between p.created_at and p.created_at + interval '48 hours'
  and c.created_by <> p.author_id
where p.intent in ('seek', 'offer');

-- 4. Engagement per publication (compare with the previous playtest, which had no previews or votes)
select round(avg(upvote_count), 2) as avg_upvotes, round(avg(comment_count), 2) as avg_comments,
       round(100.0 * avg((upvote_count > 0)::int), 1) as pct_with_upvote,
       round(100.0 * avg((comment_count > 0)::int), 1) as pct_with_comment
from real_posts;

-- 5. Private downvotes: overall share, and posts worth a moderation look (never shown in the app)
select round(100.0 * avg((v.value = -1)::int), 1) as pct_downvotes,
       count(*) filter (where v.updated_at > v.created_at + interval '1 second') as vote_switches
from post_votes v join real_posts p on p.id = v.post_id;
select p.id, p.author_id, p.upvote_count,
       count(*) filter (where v.value = -1) as downvotes
from real_posts p join post_votes v on v.post_id = p.id
group by p.id, p.author_id, p.upvote_count having count(*) filter (where v.value = -1) >= 3
   and count(*) filter (where v.value = -1) > p.upvote_count
order by downvotes desc;

-- 6. Fairness: share of all upvotes that go to the top 3 authors (lower = more spread out)
with per_author as (select author_id, sum(upvote_count) as up from real_posts group by author_id)
select round(100.0 * (select sum(up) from (select up from per_author order by up desc limit 3) t)
             / nullif(sum(up), 0), 1) as top3_share_pct
from per_author;

-- 7. Participation: real members who posted, commented or voted in the window
select count(distinct uid) from (
  select author_id as uid from real_posts
  union select c.author_id from comments c join profiles a on a.id = c.author_id
        where not a.is_demo and c.created_at >= '2026-11-10'
  union select v.user_id from post_votes v join profiles a on a.id = v.user_id
        where not a.is_demo and v.updated_at >= '2026-11-10') x;

-- 8. Safety: reports and blocks per 100 publications
select (select count(*) from reports where created_at >= '2026-11-10') * 100.0 / nullif((select count(*) from real_posts), 0) as reports_per_100,
       (select count(*) from blocks where created_at >= '2026-11-10') as blocks;
```

**Questions to ask playtesters** (we can't measure these):
- Did you understand the difference between ▲/▼ and leaving a review?
- Did you feel safe downvoting?
- Was *Je cherche* easy to find?
- Did someone actually help you?
- Did the feed feel varied, or repetitive?
- Did you discover a seller you didn't know?

**Watch for:**
- **Downvotes used to harass** a competitor: check query 5 and the reports.
- **Requests left unanswered:** query 2 shows a low answer rate.
- **Votes or comments concentrated on a few established sellers:** query 6 shows a high share.

## Known limits
- Downvotes still count after the voter's account is **suspended**. Moderation can hide the post;
  suspended accounts can't add new votes.
- A member's **feed position can still hint** at the effect of votes, as in any ranked feed. Only
  the order and a public reason are exposed.
- **No impression or click tracking.** Adding it would need an owner decision on privacy and
  consent.
- **All of this was checked in browser renders**, not on physical devices (see
  `RELEASE_STATUS.md`).
