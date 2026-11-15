# Jëfëli — W1 web-first beta (Vercel + jefeli-staging)

Goal: Jëfëli usable from a link in a phone browser, on the existing Supabase project
**jefeli-staging**, promoted on KaaySamp and TikTok only after the owner approves. No new
product scope: the approved native UI is the web UI (Expo web build of the same code).

## 1. Architecture

| Vercel project | Source | Serves | Configuration |
|---|---|---|---|
| **jefeli-app** | `apps/mobile` (Expo SDK 58 web export, single-page app) | The marketplace itself: Accueil, Explorer, articles, profiles/boutiques, publishing, messages, offers, Wecci, statuses, notifications, reports, blocks, settings. **The link to promote.** | `apps/mobile/vercel.json` (export, SPA fallback, security headers, immutable static cache); `EXPO_PUBLIC_*` variables on Vercel |
| **jefeli-web** | `apps/web` (Next.js 16) | Shared product/profile/post pages with server-rendered social previews (OG/Twitter), legal pages, the moderation console `/admin` | `apps/web/vercel.json`; `NEXT_PUBLIC_*` variables. `NEXT_PUBLIC_APP_URL` makes « Écrire au vendeur » / « Ouvrir dans Jëfëli » open the web app |

Why two projects: both apps already own overlapping paths (`/`, `/p/:id`, `/post/:id`, a root-level
`/:handle`). One domain would mean renaming the approved app's routes or the share URLs. Two
projects keep both untouched; each points to the other through one variable. With a custom
domain later: e.g. `app.<domaine>` and `<domaine>`.

Both projects build from the GitHub repository (Vercel Git integration, pnpm 10 via corepack,
Node 22) and are protected by **Vercel Authentication on every deployment, production
addresses included** (`all_except_custom_domains`): nothing is public until the owner removes
the protection or adds a custom domain.

## 2. jefeli-staging audit (7 Nov 2026, read-only)

Done through the Supabase Management API with the owner's token, using the read-only SQL
endpoint (`supabase_read_only_user`, read-only transactions: even a temporary table is refused).

| Area | Finding |
|---|---|
| Project | `gbsoifwllbacwsknydkq`, eu-west-1, healthy, Postgres 17.11, created 3 Nov |
| Migrations | 15 applied (names match the repo except numbering; applied with generated versions). Missing: `20261105000200_merchant_identity_prepare` (no-op here: the columns exist) and `20261106000200_boutique_identity_followup` |
| Schema | Fingerprint of every column, constraint, index, policy, function body, grant, trigger, view, enum, bucket and Realtime table, compared with a local database built from the repo: **identical except one function**, `review_verification_request` (3 index definitions only print their operator schema differently) |
| Defect from the gap | Approving a verification for a member without a boutique identity fails on staging (`profiles_boutique_identity_required`); reproduced locally with staging's function, fixed by the missing follow-up |
| RLS | Enabled with the same policies as the repo (part of the fingerprint) |
| Storage | 3 buckets, same limits and MIME lists; 9 files |
| Edge Functions | **None deployed** (`delete-account` is needed for in-app account deletion); no function secrets |
| Cron | `jefeli-expire-offers`, `jefeli-prune-rate-limits`, `jefeli-purge-statuses`, identical to the repo |
| Flags | `live_streaming` off, `phone_auth` off, push and voice messages on |
| Data | 1 account (gmail.com, confirmed, onboarded, created 4 Nov), 1 profile (boutique), 1 listing, 1 post, 0 conversations, 0 staff, **no DÉMO data** |
| Auth | Site URL `http://localhost:3000`; redirect list = one Lovable preview URL; « Confirm email » on; **no custom SMTP** (built-in sender, 2 e-mails/hour for the whole project); password minimum 6; no CAPTCHA; e-mail sign-in only |
| Backups | **0 backups**, point-in-time recovery off (plan not visible to the token; consistent with the Free plan) |

## 3. Changes to jefeli-staging (none applied yet)

The owner's token is read-only (`database_migrations_write` missing), so **nothing was written to
jefeli-staging**. To apply, in order (each is idempotent and touches no rows):

1. `supabase/migrations/20261105000200_merchant_identity_prepare.sql` (no-op, keeps history complete)
2. `supabase/migrations/20261106000200_boutique_identity_followup.sql` (replaces `review_verification_request`)
3. `supabase/migrations/20261108000100_feedback.sql` (new `feedback` table, extended data export)
4. `supabase/migrations/20261109000100_media_videos.sql` (W1.1: 180 s videos, kind/MIME match,
   upload quota, orphan listing; new checks are `NOT VALID`, no rows changed), then deploy the
   `cleanup-media` Edge Function (`verify_jwt = false`, service key checked inside). Details in
   `docs/W1_1_MEDIA.md`. Rollback: `drop trigger post_media_check on public.post_media` (and
   `product_media_check`, `stories_media_check`), drop the four new constraints, restore the
   previous « jefeli: upload to own folder » policy (same text without `private.upload_quota_ok()`)
   and the previous `stories_duration_ms_check` (`0..60000`).
5. `supabase/migrations/20261110000100_connected_media.sql` (W1.2: voice in publications and
   statuses, narration cues, voice-message checks, `share_to_status`; no rows changed). Details in
   `docs/W1_2_SMART_CREATE.md`. Rollback: restore the previous `create_post`, `create_story`,
   `can_view_story`, `messages_before_insert`, `check_media_row` and `assert_media_object` (their
   W1.1 / P1 texts are in the earlier migrations), drop `share_to_status`, the new `post_media`
   columns and constraints, `stories.post_id` and the new `stories` constraints (only after
   deleting any `post`/`product`/`audio` statuses), and remove the audio types from `public-media`.
6. `supabase/migrations/20261111000100_article_voice.sql` (W1.3: an article's optional voice
   presentation in `product_media`; `create_listing` / `set_listing_media` keep their signatures;
   no rows changed). Details in `docs/W1_3_CREATE.md`.

**W1.3: the whole plan — order, owner backup, baseline counts, pre-check, apply commands,
verification and the two rollback scripts captured from staging — is in
`docs/STAGING_MIGRATION_PLAN.md`.** Every preview build now runs `scripts/schema-contract.mjs
check` first: previews of this stack against jefeli-staging fail at that step until the plan is
applied, instead of going live with a broken feed.

Rollback for 2 and 3: the previous definitions of `review_verification_request` and
`export_my_data`, saved from staging before any change, are in §6; `drop table public.feedback`
removes 3's table.

## 4. Safe for persistent, real data

| Risk | Protection | Verified |
|---|---|---|
| Integration tests (create and delete users) pointed at a hosted project | `tests/integration/src/env.ts` refuses any non-localhost URL | Refused `gbsoifwllbacwsknydkq.supabase.co` (W1) |
| DÉMO seed (`--reset` deletes DÉMO users) writing to jefeli-staging | `PROTECTED_PROJECT_REFS` in `scripts/seed-demo.mjs`: refused whatever `ALLOW_DEMO_SEED` says | Refused with `ALLOW_DEMO_SEED=staging --reset` (W1) |
| E2E against a deployment | Creates its own accounts through the UI, never deletes others'; run with `E2E_SEED=0` (the global setup otherwise seeds the **local** stack only) | — |
| `supabase db reset --linked` wiping staging | The repo is not linked to any project (`supabase/.temp` has no project ref); never link it on a shared machine; schema changes only as new migration files | Checked |
| Schema drift | Fingerprint comparison of §2 (`docs/w1/schema-fingerprint.sql`), to re-run before each change | Run 7 Nov: one function differed |
| Accidental public exposure | Vercel Authentication on all deployments of both projects | Project settings checked |
| Secrets in the apps | Only the **publishable** key is in Vercel and in the bundles; no service-role or secret key anywhere in Vercel or the repo | Variables listed in §1 |

### Backups and recovery

jefeli-staging shows **no backups** and no point-in-time recovery. Before real members arrive,
the owner picks one (both can coexist):

1. **Pro plan** (≈ US$25/month, assumption to verify): automatic daily backups kept 7 days,
   restorable from the dashboard. Optional point-in-time recovery is an extra add-on.
2. **Weekly logical backup from the owner's computer** (free): Supabase CLI with the database
   password (Dashboard › Project Settings › Database), procedure and restore drill in
   `docs/PILOT_OPERATIONS.md` §9 (drill passed on the local stack: identical counts, sign-in and
   RLS reads after restore). Replace `--linked` by `--db-url "<session pooler connection string>"`
   if the repo is not linked. Store the files encrypted; they hold personal data.

Before every migration on staging: re-run the fingerprint, save the definitions it replaces
(as in `docs/w1/staging-rollback.sql`), apply, re-run the fingerprint.

## 5. Before opening registrations (owner)

Registrations stay closed in practice until each line is done; the preview is protected meanwhile.

| # | Item | How | Status |
|---|---|---|---|
| 1 | Apply the migrations of §3 (now six, see `docs/STAGING_MIGRATION_PLAN.md`) | A token with `database_migrations_write` through the secure form (then I apply and verify), or paste each file in Dashboard › SQL editor in order | **Open** (token read-only) |
| 2 | Auth URLs | Dashboard › Authentication › URL Configuration: Site URL = the app address; Redirect URLs = `https://<app address>/**`, `https://<web address>/**`, keep `jefeli://**` for the native app; remove the Lovable preview URL unless still used | **Open** |
| 3 | Password minimum 8 (the app already asks for 8) | Authentication › Providers › Email | **Open** |
| 4 | E-mail sending | The built-in sender allows **2 e-mails per hour for the whole project**: two sign-up confirmations or password resets per hour. Configure an SMTP provider (Authentication › Emails › SMTP; several have a free tier) **or** turn « Confirm email » off for the beta (password reset still needs e-mail) | **Open — blocks any public promotion** |
| 5 | Account deletion | Deploy `delete-account`: `pnpm exec supabase functions deploy delete-account --project-ref gbsoifwllbacwsknydkq` (or with a write token I deploy it), then delete a test account from Réglages | **Open** |
| 6 | Legal pages | 19 placeholders in `apps/web/src/app/(public)/legal` (company identity, contact e-mail, CDP declaration receipt, retention periods, processors), with legal counsel | **Open** |
| 7 | Support and moderation | A support channel in the legal contact and the invitation message; 1–2 moderators granted with the SQL of `docs/SETUP_PRODUCTION.md` §1.5, using `/admin` (Signalements, Avis) twice a day | **Open** |
| 8 | Vercel plan | Hobby is for non-commercial use; a public marketplace beta needs **Pro** (≈ US$20/month, assumption to verify) before Wave B | **Open** |
| 9 | Bots | No CAPTCHA on sign-up; rate limits exist. Recommended before Wave B: Cloudflare Turnstile in Supabase Auth (needs a small client change) | Wave B |
| 10 | Existing staging data | 1 account with 1 listing and 1 post (probably the owner's test): keep or delete before launch | Owner |

## 6. Rollback

- Web: Vercel › project › Deployments › an earlier deployment › « Promote » (instant), or
  `git revert` and push.
- Database: `docs/w1/staging-rollback.sql` restores the two functions exactly as they were on
  staging before W1 and can drop the feedback table. Migrations are never edited.
- Data: backups of §4.

## 7. Launch in two waves

**Wave A — soft launch (trusted sellers and buyers, ≈ 10–25 people).** After §5 items 1–7:
share the app address personally (WhatsApp), with the plain-words limits of
`docs/PILOT_OPERATIONS.md` §4. Remove the Vercel protection (or attach a custom domain) only for
this, with the owner's approval. Watch for a week: /admin › Avis and Signalements twice a day,
metrics weekly, fix blockers.

**Wave B — public beta (owner approval).** After §5 items 8–9 and Wave A's blockers: promote on
KaaySamp and TikTok. Message (to adapt):

> **Jëfëli** — découvre, échange, achète et vends près de chez toi. Neuf, occasion ou Wecci
> (troc), tu discutes directement avec le vendeur et vous vous mettez d’accord. Rien à
> télécharger : ouvre le lien dans ton navigateur. Jëfëli ne gère pas les paiements : rencontrez-
> vous dans un lieu sûr et vérifiez l’article avant de payer.

No DÉMO data is ever shown: the first listings are real ones from Wave A sellers.

## 8. Feedback and what to observe

- **In the app**: Réglages › « Donner mon avis » (problème / idée / pas clair / autre, ≤ 1 000
  characters, 10 per day). Staff read it in `/admin › Avis` and mark it lu / traité. Members cannot
  read anyone's feedback. Included in « Exporter mes données », deleted with the account.
- **Numbers**, weekly, read-only SQL in `docs/PILOT_METRICS.md` (never message contents): sign-ups
  → onboarded → first listing → conversations → offers → agreements → declared exchanges,
  answer times, reports. Where people drop out shows as the gap between two steps.
- **Visitors** (optional, owner decision): Vercel Web Analytics on jefeli-app (cookieless, no
  personal data, enabled in the Vercel dashboard; not installed in the code yet). Without it,
  sign-ups are the first number we have.
- **Weekly triage**: one list of the top problems from Avis, Signalements and the support channel,
  each with a test written before its fix.

## 9. Status at hand-off (7 Nov 2026)

| Item | State |
|---|---|
| Code | Branch `feature/w1-web-beta` (stacked on PR #2, which is unchanged): web build, 16 px fields, social card, share pages → web app, « Donner mon avis », seed guard |
| Local verification | `pnpm check` pass · integration **265/265** · E2E journey, community, pricing, resilience, account-recovery **31/31 against the production export** (Vercel-style routing) with `next start` |
| Vercel | Projects `jefeli-app` and `jefeli-web` created, Git-linked, Node 22, pnpm 10.28 (corepack), Vercel Authentication on all deployments; preview variables set (staging URL, publishable key, cross-links) |
| jefeli-web preview | **Ready**: `https://jefeli-web-git-feature-w1-web-beta-habibjallow95-9380.vercel.app` — landing « Ouvrir Jëfëli », shared product page renders the real staging listing server-side with title/price/photo social tags and « Écrire au vendeur » → app |
| jefeli-app preview | **Ready**: `https://jefeli-app-git-feature-w1-web-beta-habibjallow95-9380.vercel.app` — French shell with absolute social tags and the new card; app paths such as `/p/<id>` serve the app (fixed in `c835010`: the first build returned Vercel's 404 for every path but `/`); static bundles served with an immutable cache. Behaviour inside the app (sign-up, publishing, chat) not exercised on the hosted preview yet |
| jefeli-staging writes | **None.** Blocked by the read-only token and by this session's safety rules on shared infrastructure; owner steps in §5 |
| Hosted two-user journey | **Not run.** Needs §5 items 1–4 (Auth URLs and e-mail: with « Confirm email » on and the built-in sender, a new account cannot finish signing up from an address outside the project team) and network access from the test machine to the preview and project hosts |
| Devices | **Not tested** on Safari iPhone or Chrome Android (none available); script in `docs/PILOT_TEST_PLAN.md` §3 applies unchanged to the web preview |
