# Jëfëli — private pilot operations (Dakar)

How the owner and one or two moderators run a private pilot with 8–10 sellers and 15–20
buyers. It assumes the go/no-go items in `docs/GO_NO_GO.md` are done: a pilot Supabase project
with no DÉMO data, installable builds, the web app online for legal pages and shared links, and
a support channel chosen.

Everything here uses what the product already has. There is no escrow, no in-app payment, no
SMS sign-in and no live video in the pilot.

## 1. Roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| Owner (`admin`) | The owner | Everything a moderator can, plus feature flags (`/admin › Réglages`), verification reviews, staff list, backups, deployments | Read private conversations (no one can: RLS lets only members read them) |
| Moderator (`moderator`) | 1–2 named people the owner trusts, reachable daily | Report queue, hide/restore/remove content, warn, suspend/unsuspend, dismiss, appeals | Grant « vérifié », change flags, read private conversations |
| Support | Owner or a moderator | Answer the support channel, collect bug reports | — |

Grant and remove staff with the SQL in `docs/SETUP_PRODUCTION.md` §1.5 (verified on an unseeded
database in P1). Staff accounts are ordinary accounts first: sign up in the app, then grant.
Keep moderator accounts separate from the moderators' personal selling accounts.

## 2. Before inviting anyone

1. Pilot project ready (`docs/SETUP_PRODUCTION.md` §1), with **no** DÉMO seed. Check:
   `select count(*) from public.profiles where is_demo;` → 0.
2. Feature flags in `/admin › Réglages`: `live_streaming` **off**, `phone_auth` **off** (SMS stays
   « bientôt » in the app). Leave the others as they are.
3. One test round by the owner on two phones (the script in `docs/PILOT_TEST_PLAN.md` §3), then
   delete those test accounts from the app (Réglages › Mes données et suppression du compte).
4. A password reset sent to a non-team address actually arrives (see SETUP_PRODUCTION §1.3).
5. Support channel chosen and written into the invitation message (§5).

## 3. Cold start: sellers first, then buyers

The app is empty on day one: no DÉMO data in the pilot. Buyers who arrive to an empty Explorer
do not come back, so:

**Week 0 — sellers (8–10).** Choose sellers who already sell on WhatsApp/Instagram, across a
few categories that buyers in the group want (mode, chaussures, tissus/wax, beauté, électronique,
services). Meet them, in person if possible, in small groups:
- install the app with them (APK link or TestFlight invitation, SETUP_PRODUCTION §3), create
  the account, finish the one-screen onboarding (city, 18+);
- publish **at least 3 real listings each** with their own photos: title, price mode
  (« Prix affiché », « Sur demande » or « À discuter »), and « Vendre ou échanger » when they
  accept Wecci; first listing creates their boutique automatically;
- a first publication or status if they want (24-hour statuses);
- show them where messages, offers and « Mes accords et échanges » are.
Target before inviting buyers: **≈ 30 visible listings from 8–10 sellers** (PILOT_METRICS §2).

**Week 1 — buyers (15–20).** Invite people who would plausibly buy from those sellers. Ask
them to: follow 2–3 sellers, search in Explorer, write to a seller from a listing, make an offer
(or a counter-offer, or a Wecci proposal with or without a cash difference), and — if they
agree — meet and pay the way they normally would.

**Recording what happened (voluntary).** After a real exchange, both people mark it done in
« Mes accords et échanges »; if it fell through, either can cancel it, and a disagreement can be
flagged as a dispute. Then a review becomes possible. Nobody is required to do this, and Jëfëli
never holds money or confirms delivery. These declarations are what PILOT_METRICS §4 counts.

## 4. What to tell participants (limitations)

Put this in the invitation, in plain words:
- It is a private test: bugs are expected; tell us (support channel).
- Jëfëli does not handle payments: you pay each other directly (Wave, Orange Money, cash).
  Meet in a public place and check the item before paying. Never share an SMS code.
- No sign-in by SMS yet (e-mail only); no live video yet.
- No seller is « vérifié » during the pilot unless the owner has actually reviewed them.
- Your city is chosen by you; the app does not use GPS.
- You can block and report anyone from their profile, a listing or a conversation; you can
  delete your account yourself (Réglages › Mes données et suppression du compte).
- Push notifications may not arrive on every phone during the test (depends on the build).

## 5. Support channel

Not built into the app: choose one before inviting anyone and put it in the invitation —
e.g. a dedicated WhatsApp number or group run by the owner, or a dedicated e-mail address (the
legal pages also need a contact address; see the placeholders in `apps/web/src/app/(public)/legal`).

For each problem reported, write down: date/time, phone model, app build, what the person was
doing, a screenshot if possible. Never ask for a password or an SMS code. Bugs go to the owner,
who opens an issue or a task for the developer with those details.

## 6. Moderation routine

- Look at `/admin` (web console) **twice a day** during the pilot; the reports queue is sorted
  oldest first.
- **Within 4 hours** (hide first, investigate after): scams, minors, violence, threats,
  nudity, prohibited items. **Within 48 hours**: everything else. These are the targets
  PILOT_METRICS §5 checks.
- Every action needs a written reason (the console enforces it); the member is notified and can
  contest it in « Modération et contestations ». Review contests within 48 hours.
- Hidden listings disappear for everyone else at once (verified: E2E `journey`, SAF-01, also on
  an unseeded database with a `moderator` account).
- Suspend only for clear abuse (scam attempts, harassment after a warning). Note why.
- A dispute report about an exchange: Jëfëli cannot judge who paid; hide content only if it
  breaks the rules, otherwise remind both people that payments are between them.
- Moderators do not contact members outside the app with personal accounts.

## 7. Incidents

| Severity | Examples | First response |
|---|---|---|
| S1 — stop | Someone sees another member's private messages or data; accounts taken over; a wave of scams; the app unusable for everyone | Owner informed at once. Contain within the hour (below). Tell participants in the support channel what to avoid |
| S2 — broken | Messages, publishing, offers or sign-in fail for some people | Same day: reproduce, find the cause, plan a fix |
| S3 — annoying | Display glitches, wording, slow screens | Collect, fix in the next build |

**Contain** with what exists, no new code:
- content: hide it from `/admin`; an account: suspend it; a staff member: remove the staff role;
- a feature misbehaving: turn its flag off in `/admin › Réglages`;
- a leaked key: rotate it in the Supabase dashboard (publishable key → new build needed;
  service-role key or `PUSH_WEBHOOK_SECRET` → update the function secrets).

**Diagnose** in the Supabase dashboard: Logs (API, Auth, Postgres, Edge Functions) for the time
the member gave. Messages and media are private to members; investigate with the reporter's
evidence and the logs, not by reading conversations.

**Fix**: on a branch, reproduce it in a test first (`pnpm test:integration` or an E2E spec), fix,
run `pnpm check`, integration and E2E, then build. Write a short note in
`docs/IMPLEMENTATION_LOG.md` (what happened, cause, fix, how it was verified).

## 8. Rollback

- **App**: there is no over-the-air update (`expo-updates` is not installed), so every fix is a
  new build, and the previous build stays installable from the EAS build page (Android APK) or
  TestFlight (previous builds remain selectable while they have not expired). Keep the build
  number of the last good build in the pilot notes.
- **Database**: migrations only go forward; an applied migration is never edited. Undoing one
  means a new migration that reverses it, tested locally with `supabase db reset` first. Take a
  backup (§9) before every `supabase db push`.
- **Feature**: a flag off in `/admin › Réglages` (live, phone auth, push, voice messages…).
- **Web app**: redeploy the previous deployment from the hosting dashboard.
- **Code**: the pilot candidate is a list of small commits on draft PR #2 (see
  `docs/P1_READINESS_REPORT.md`); any one can be reverted with `git revert <sha>`.

## 9. Backups and recovery

- The schema is in Git (`supabase/migrations`): it can always be rebuilt.
- The data must be dumped by the owner: **weekly, and before every `supabase db push`**.
- Photos, videos and voice notes live in Supabase Storage, outside the database dump.
- Check in the dashboard what your plan adds (automatic daily backups, point-in-time recovery
  depend on the plan); do not rely on it without having looked.

A backup holds personal data (e-mails, password hashes, private messages, private media). Keep
it encrypted, outside the repository and shared drives, and delete old copies after the pilot.

**Back up** (from the repository root, with the pilot project linked, see SETUP_PRODUCTION §1):

```bash
D=~/jefeli-backups/$(date +%F) && mkdir -p "$D"
pnpm exec supabase db dump --linked --data-only -f "$D/data.sql"      # auth, storage rows, public, private
for b in avatars public-media private-media; do
  pnpm exec supabase storage cp -r "ss:///$b" "$D/storage/$b" --linked --experimental
done
git rev-parse HEAD > "$D/schema-commit.txt"                          # the migrations that match this data
```

**Restore** into an empty project (a new one, or after a disaster), never on top of live data:

1. Check out `schema-commit.txt`, link the target project, `pnpm exec supabase db push`.
2. Remove the reference rows the migrations inserted (the backup holds the pilot's own copy,
   including the feature flags as the owner left them):
   ```sql
   begin;
   set session_replication_role = replica;
   delete from public.categories; delete from public.feature_flags;
   delete from public.reserved_handles; delete from public.prohibited_terms;
   delete from storage.buckets;
   commit;
   ```
3. Load the data in one transaction:
   `psql "<target connection string>" -v ON_ERROR_STOP=1 -1 -f "$D/data.sql"`.
4. Upload the files back: `pnpm exec supabase storage cp -r "$D/storage/<bucket>" ss:///<bucket> --linked --experimental`
   for each bucket.
5. Redeploy the Edge Functions and secrets (SETUP_PRODUCTION §1.4–1.5), then sign in with a known
   account and open a conversation and a listing photo.

**Drill (P1, local stack, CLI 2.122):** dump → `supabase db reset` (migrations only) → steps 2–3
→ the same counts before and after (29 users, 29 profiles, 17 listings, 37 messages, 11 offers,
4 agreements, 4 statuses, 27 storage objects, 2 staff); a member signed in with their old
password, read their own conversation through RLS, and a listing photo loaded. The recursive
Storage download fetched all 19 `public-media` files. Not drilled: the hosted project, the Storage
upload back, a restore into a different project.
