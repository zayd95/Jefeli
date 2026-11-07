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

Rollback for 2 and 3: the previous definitions of `review_verification_request` and
`export_my_data`, saved from staging before any change, are in §6; `drop table public.feedback`
removes 3's table.
