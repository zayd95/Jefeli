# jefeli-staging — migration plan, backup and rollback

Status on 2026-11-11: **applied.** The owner approved on 8 Nov; applied through the Management API
with a write token entered in the secure form (the first token was read-only and was refused).

| Step | Result |
|---|---|
| Identity | `jefeli-staging`, ref `gbsoifwllbacwsknydkq`, eu-west-1, Postgres 17, 15 migrations (same history as the audit) |
| Pre-check | none of the new objects existed; counts unchanged since 4 Nov |
| Backup (8 Nov, unchanged by 11 Nov) | Logical: 15 migrations with their SQL, schema state, every row of 48 tables (incl. auth), 9/9 media files with sha256; every non-empty table reloaded under the same constraints locally; archive `staging-backup-2026-11-08.tar.gz` (sha256 `4c2939ad…c3a6`) handed to the owner, not committed (member data) |
| Review | no material data-loss risk: migration 1 is a no-op on staging (`boutique_name` exists); bucket MIME list only gains audio types; the one article photo passes every new check |
| Apply | 6/6 in order, each in its own call, history 15 → 21; counts identical after every step |
| Schema | 1 117 objects (columns, relations, constraints, indexes, policies, functions, triggers, grants) identical to a local database built from the same migrations, except how the hosted database prints the trigram operator's schema |
| Deploy check | `✓ Schema compatible: 45 tables, 53 functions` |
| Hosted security probes (public key) | 33/33: private tables, writes, member RPCs and `private.*` refused; no anonymous upload; private bucket closed |

Not done (not in the approval): the Edge Functions `delete-account` and `cleanup-media` are still
not deployed on staging (no function is deployed there).

**12 Nov 2026 (phone-auth go):**
- `20261112000100_phone_auth_sms_guard.sql` applied after a fresh backup (history 21 → 22, counts
  unchanged, schema check `✓ 45 tables, 56 functions`).
- `send-sms` and `delete-account` deployed. `cleanup-media` is still not deployed.
- Details: `docs/PHONE_AUTH.md` § 8.

## Why

jefeli-staging (`gbsoifwllbacwsknydkq`) has 15 migrations. The code on the W1 → W1.3 branches
expects 6 more. The W1.2 preview asks for `post_media.language`, `waveform` and `cues` on every
feed request; staging rejects the whole request and the feed shows « Oups ». No compatibility
fallback hides this: the database must be brought up to date, and the new deploy check
(below) now refuses to build a preview against a database that is behind.

## What is pending, in order

Each file runs once, in its own transaction, in this order. None deletes or rewrites rows.

| # | File | Branch | What it does |
|---|---|---|---|
| 1 | `20261105000200_merchant_identity_prepare.sql` | PR #2 | No-op (keeps the history complete) |
| 2 | `20261106000200_boutique_identity_followup.sql` | PR #2 | Replaces `review_verification_request` |
| 3 | `20261108000100_feedback.sql` | W1, PR #3 | `feedback` table, extended `export_my_data` |
| 4 | `20261109000100_media_videos.sql` | W1.1, PR #4 | 180 s videos, kind/MIME check, upload quota, `list_orphaned_media` |
| 5 | `20261110000100_connected_media.sql` | W1.2, PR #5 | Voice in posts and statuses, voice messages, `share_to_status` |
| 6 | `20261111000100_article_voice.sql` | W1.3 | An article's optional narration |

Edge Functions to deploy after the SQL: `delete-account` (W1) and `cleanup-media` (W1.1).
`cleanup-media` must be deployed with `verify_jwt = false`, as in `supabase/config.toml`; it checks
the service key itself.

## Before: backup and checks

1. **Backup (owner, about 2 minutes).**
   - Why it's needed: the Free plan keeps no automatic backups.
   - On your computer, with the database password (Dashboard › Project Settings › Database):

     ```sh
     supabase db dump --db-url "$STAGING_DB_URL" -f staging-schema-2026-11-08.sql
     supabase db dump --db-url "$STAGING_DB_URL" --data-only -f staging-data-2026-11-08.sql
     ```

   - Keep these files out of the repository: they contain members' data.
   - Storage files are not touched by any of these migrations.
2. **Baseline (done, read-only).** `docs/staging/preflight-counts-2026-11-08.json`:
   - 1 member, 1 profile, 1 article, 1 publication;
   - 9 stored files;
   - 0 conversations.
3. **Rollback captured (done, read-only).**
   - `docs/staging/rollback-w1.3-article-voice.sql` undoes #6.
   - `docs/staging/rollback-w1-to-w1.2.sql` undoes #2–#5.
   - Both restore staging's own current definitions (functions, constraints, the upload policy,
     the public bucket's types) as captured before any change.
   - Both were dry-run in order, in one transaction, on a local database with every migration
     applied. They ran cleanly and the transaction was rolled back.
4. **Pre-check (read-only), right before applying.** Re-run the counts query. Confirm none of the
   new objects exists yet: `feedback`, `post_media.language`, `share_to_status`,
   `validate_listing_voice`. A partial earlier attempt would show up here.

## Apply

For each file, in order:

```sh
# SUPABASE_ACCESS_TOKEN: a personal access token allowed to write migrations (never committed).
curl -sS -X POST "https://api.supabase.com/v1/projects/gbsoifwllbacwsknydkq/database/migrations" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --rawfile q supabase/migrations/<file>.sql --arg n <file-stem> '{query: $q, name: $n}')"
```

(Or paste the file in the SQL editor. The Management API call also records it in the migration
history.)

Stop at the first error: nothing after it runs, and the failed file's own transaction is rolled
back.

## After: verification

1. **Schema check, from any machine that can reach staging:**

   ```sh
   SCHEMA_CHECK_URL=https://gbsoifwllbacwsknydkq.supabase.co SCHEMA_CHECK_KEY=<publishable key> pnpm schema:check
   ```

   It must print « ✓ Schema compatible ».
2. **Counts unchanged** against the baseline.
3. **Previews:**
   - Re-deploy the W1.2/W1.3 previews: their build now runs the same check.
   - Open Accueil, publish a narrated publication, open it from a second account.

## Rollback

Only if something is wrong after applying:
1. Run `rollback-w1.3-article-voice.sql`.
2. Then run `rollback-w1-to-w1.2.sql`.

Both are written to run as a whole and stop on the first error.

Rolling back deletes what only the new versions allow:
- voices on publications and articles;
- voice statuses and statuses pointing to a post;
- the `feedback` table, so export its rows first.

Previews built from W1.1 onwards will then fail the deploy check again. That is intended.

## Never again: the deploy check

`scripts/schema-contract.mjs` compares a target database with `supabase/schema-contract.json`.
The contract lists every table, column and function the code expects, and is generated from the
migrations by `pnpm db:types` / `pnpm db:contract`.

- **Vercel:**
  - `apps/mobile/vercel.json` and `apps/web/vercel.json` run `schema-contract.mjs check` before
    building.
  - A preview whose database is behind fails to build and names the missing columns or functions
    and the migration that adds them.
  - It uses only the public key and reads nothing: tables use `limit=0`, functions run in a
    read-only transaction.
  - There is no switch to skip it, and an unreachable database fails it too.
- **CI:** the integration job fails if the committed contract is stale, then runs the check against
  the freshly migrated local database.
- **Consequence today:** previews of this stack built against jefeli-staging will fail at the
  check until the plan above is applied. That is the intended signal.

## 12 Nov 2026 — Explorer discovery (PR #10, owner-approved)

One more migration, applied the same way: fresh verified backup, then
`20261113000100_explore_discovery.sql` alone (three read-only functions, no table or row change),
then grants checked (`trending_products` / `suggested_sellers`: authenticated only, security
definer, `search_path=''`), hosted probes 40/40 and both previews rebuilt with the schema check
passing. Rollback: `drop function public.explore_products(text, text, text, text, text, integer,
integer, text, text, integer, integer), public.trending_products(integer, integer),
public.suggested_sellers(integer);` — nothing else depends on them except the PR #10 client.
