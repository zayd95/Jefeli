# Jëfëli integration and security tests

`@jefeli/integration-tests` exercises the real backend: Postgres RLS policies, column grants,
SECURITY DEFINER RPCs, Storage policies and Realtime. It runs against a **local** Supabase
stack. Every test signs in as real users through GoTrue and calls PostgREST, Storage and
Realtime with each user's own JWT, the same way the app does.

## Prerequisites

1. The local stack is running with all migrations applied (`pnpm db:start`, plus
   `pnpm db:reset` on a fresh checkout).
2. The GoTrue rate limits in `supabase/config.toml` are high enough. One run signs in about
   110 users, so `[auth.rate_limit] sign_in_sign_ups` and `token_refresh` must be well above
   the default of 30 per 5 minutes (the repo sets 2000). Restart the stack after you change
   them.
3. `psql` is on the `PATH`. One catalog check uses it; that test is skipped when `psql` is
   missing.

## Run

```bash
pnpm test:integration                          # from the repo root
pnpm --filter @jefeli/integration-tests test   # same thing
cd tests/integration && pnpm test              # from this folder
cd tests/integration && pnpm vitest run src/06-messaging-storage.test.ts   # one file
```

Files run one after another (`fileParallelism: false`). A full run takes about 25 seconds.

### Configuration

| Variable | Default |
|---|---|
| `SUPABASE_URL` | `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | the local demo anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the local demo service-role key |
| `SUPABASE_DB_URL` | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `KEEP_TEST_DATA` | unset. Set it to `1` to keep the created users and files for debugging |

**Safety:** the suite refuses to start unless `SUPABASE_URL` and `SUPABASE_DB_URL` point at
`localhost` or `127.0.0.1`, because it creates and deletes users with the service-role key.

### Data hygiene

- Each run creates fresh users with random e-mail addresses (`it-<run>-<label>-<rand>@example.com`).
  The suite runs against a database that already holds data and never needs `db reset`.
- After each file, the users it created are deleted (their content cascades) along with
  their uploaded files.
- The service role is used only to arrange fixtures (staff roles, live sessions, story
  expiry) and to check ground truth. Every assertion about permissions goes through an
  `anon` or `authenticated` client.

## Layout

| File | Covers |
|---|---|
| `src/helpers.ts` | `createUser`, `adminClient`, `anonClient`, `uploadImage`, `createListing`, `createPost`, `createStory`, realtime and error helpers |
| `01-identity.test.ts` | ID-01: profiles, column grants, settings privacy, `export_my_data`, anonymous RPC access, private-schema exposure |
| `02-social-graph.test.ts` | SOC-01: follows and counters, private accounts, notifications, friendships, blocks |
| `03-posts-feed.test.ts` | SOC-02: posts, media, likes, comments, saves, ownership, followers-only media, `get_feed` |
| `04-stories.test.ts` | STA-01/02: audiences, views, `reply_to_story`, expiry, highlights |
| `05-products-boutique.test.ts` | PROF-01, MKT-01, SOC-03/04: auto boutique, listing lifecycle, prohibited items, media ownership, `browse_products`, `search_profiles` |
| `06-messaging-storage.test.ts` | MSG-01: conversations, outsider isolation, message kinds, attachments, deletion, Realtime RLS, rate limit |
| `07-offers-agreements-reviews.test.ts` | MKT-02/03: offers, counters, barter, agreements, reviews, offers and agreements after a block |
| `08-safety-moderation.test.ts` | SAF-01/02: reports and evidence, moderation, appeals, suspension, verification, reported DMs, media evidence integrity |
| `09-live.test.ts` | Live: server-only state, `live_started` notifications, comments, pins, mutes |

## Defects found and fixed

The first run of this suite (135/146) exposed 11 real defects. All are fixed in
`supabase/migrations/20261102000900_security_fixes.sql`, and the suite is green (149/149):

- `01` internal `private.*` helpers were executable by anon/authenticated
- `02` a private account's follower list was visible to anyone
- `03`/`04` authors could not soft-delete their own post/status (now `delete_post` / `delete_story` RPCs)
- `03`, `04`, `05` `get_feed`, `get_story_rail` and `browse_products` failed for logged-out visitors
- `06` first-contact messages were not counted as unread
- `06` a deleted message's text stayed in the conversation preview
- `07` after a block, open offers could not be withdrawn and agreements could not be disputed
- `08` an owner could overwrite already published or reported media (`upsert`/`update`)
- `10` (added afterwards) blocked members could reply under the blocker's comment; `relationship_with`
  revealed the block to the blocked member
