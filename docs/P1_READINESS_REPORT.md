# Jëfëli — P1 private pilot readiness report

Date: 7 November 2026. Branch `feature/lovable-native-parity-20261104`, draft PR #2 → base
`claude/jefeli-pilot` (`27177c2`). P1 started from `371ed2a` (microcopy pass) and is a series of
small commits on top of it (§ Commits). **Not merged, not deployed, nothing purchased, nothing
submitted to a store.** Decision sheet: `docs/GO_NO_GO.md`.

**Where the evidence comes from.** A Linux cloud container with the local Supabase CLI stack
(Postgres 17, Auth, Storage, Realtime, Edge Runtime, Mailpit), the Expo SDK 58 **web build**
driven by Playwright/Chromium, and the Next.js web app in dev mode. No phone, simulator,
emulator, Expo account or Apple account was available, and docs.expo.dev / supabase.com could
not be reached (EAS facts were checked in the EAS CLI's own source from npm instead). Nothing
below is a device result.

## Summary

| | |
|---|---|
| Code verdict | Private-pilot candidate, ready for owner review |
| Defects reproduced and fixed | 4 (password recovery, double-tapped offer error, DÉMO statuses expiring mid-run, first-time seed failing) |
| Tests added | integration +18, E2E +10 (one gated on e-mail confirmation) |
| Last full run | `pnpm check` pass · integration **259/259** · E2E **34 passed, 1 skipped** (standard stack; the skip is the gated e-mail-confirmation spec) · empty database: integration 259/259, E2E journeys 31/31 |
| Pilot status | **NO-GO until the owner items** in GO_NO_GO §2 (pilot project, e-mail, builds, web hosting, legal placeholders, support, moderators, two-phone script) |

## Phase 1 — Release-candidate integrity

**Verified**
- Repository: PR #2 is a draft, the branch fast-forwards from the reviewed microcopy commit, no
  uncommitted owner work was touched. Rollback path: every P1 change is its own commit (§ Commits).
- The screen-tour failures seen at the start of P1 were caused by the DÉMO fixture statuses:
  they are real 24-hour statuses created when the seed ran, so the tour broke a day later.
- The suites pass on the final code (§ Tests), the iOS/Android bundles compile
  (`expo export`: iOS 11.2 MB and Android 11.4 MB Hermes bundles) and the web app builds (`next build` passes).

**Changed**
- `scripts/seed-demo.mjs`: on an existing DÉMO set, recreate fixture statuses that would expire
  within 2 hours, through the real `create_story` RPC (`5b7a635`); E2E global setup runs it before
  every run (`E2E_SEED=0` skips it). First-time seed fixed (`6022568`).
- `docs/SETUP_PRODUCTION.md`: auth redirect list, e-mail sending, moderator grant/removal SQL,
  EAS environment variables, Android APK default, push credentials, crash visibility, web app
  dependency. Rollback steps: `docs/PILOT_OPERATIONS.md` §8.

**Tests executed**: `pnpm check`, integration, E2E (full), fresh seed + re-run (no-op).

**External dependencies**: none for this phase.

**Unverified**: reproducibility on another machine than this container (the CI workflow on PR #2
re-runs typecheck, lint, unit, web build and integration on a fresh stack).

## Phase 2 — Real-user backend

**Verified**
- On a database with only the migrations (0 users, 0 listings), with no DÉMO seed:
  integration 259/259; E2E journey, community, pricing, resilience and account-recovery 31/31:
  registration, onboarding, login, logout, session refresh, returning member, uploads, real-time
  messaging, publish/edit/delete, offers, counter-offers, agreement snapshots, barter with a cash
  difference, follow, statuses, posts, comments, votes, notifications, block, report,
  moderation, hidden content.
- A pilot moderator is an ordinary account plus one SQL insert (`moderator` role); it can hide a
  reported listing from `/admin` (E2E SAF-01 with that account).
- E-mail confirmation (local Auth with confirmations on): « Vérifiez votre e-mail », sign-in
  before confirming says why it fails, the link lands in onboarding, the account works on a
  second device.
- Feature flags on a fresh database: `phone_auth` and `live_streaming` are off; the welcome
  screen keeps SMS labelled « bientôt ».

**Changed**
- **Password recovery (defect)**: the e-mail link pointed at `jefeli://reset-password`, which
  did not exist; it opened « Unmatched Route » and the recovery session was never used
  (`docs/evidence/p1/password-recovery/before-reset-link.png`). New `reset-password` screen outside
  the signed-in/out guards; it opens the session from the link (on a phone with `setSession`; on
  the web supabase-js does it, so the opening URL is read before it clears the fragment) and shows
  the form only for a session opened by that recovery link (`d6dd671`).
- Reset and confirmation links now come back to the running app: `jefeli://…` in a build,
  `exp://…/--/…` in Expo Go, the web origin on the web (`expo-linking` `createURL`, already a
  dependency) (`d6dd671`, `6022568`).
- French message for re-using the old password.

**Tests executed**: E2E `account-recovery` 3/3, `email-confirmation` 1/1 (confirmations on),
the unseeded run above.

**External dependencies**: a hosted pilot project (none exists; no hosted project was touched),
and a working e-mail sender for it (GO_NO_GO item 2).

**Unverified**: e-mail links opening the installed app on a phone; delivery through the hosted
project's e-mail sender; Realtime over a mobile network.

## Phase 3 — Adversarial reliability

**Verified** (integration `15-adversarial`, E2E `resilience`): one pending offer after a triple
tap; one agreement when both sides accept at once; a countered, expired or sold-item offer cannot
be accepted; agreement terms survive edits and deletion of the listing and cannot be tampered
with; three simultaneous « Message » taps open one conversation; after a block nobody can write or
offer, and the agreement stays readable and unchanged; deleted listings and posts disappear by id,
from search and from offers; a private account's listing stays hidden even with a pending follow;
avatars over 5 MB and HTML files are refused, nobody can write in another member's folder; forged,
expired and malformed tokens get 401, and after a global sign-out the old refresh token fails;
two network cuts during an upload still publish; a failed message keeps its text and goes out on
retry; a draft is restored after a reload; an expired access token is refreshed on return; a
deleted article's old link says « Article indisponible » in the app and 404 on the web.

**Changed** (only reproduced defects): the double-tapped offer (`2ff8b90`: French mapping for
`offers_one_pending_per_pair`, in-flight guard on the offer screen and offer card). No schema
change was needed: the database already held every invariant.

**Tests executed**: integration 18 new tests; E2E 6 new tests.

**External dependencies**: none.

**Unverified**: the same conditions on a phone (real app kill, airplane mode, hours in the
background, low memory).

## Phase 4 — Installable pilot path (iOS / Android)

**Verified** (EAS CLI 27.5.0 source): the `preview` profile builds an Android **APK** by default
(`distribution: internal`) and reads the EAS « preview » environment; the gitignored
`apps/mobile/.env` is not uploaded, so the Supabase URL/key must be created as EAS variables or
the build opens on « Configuration manquante »; the exact `eas env:create` commands. Permissions
strings are set for camera, photos and microphone; push registration degrades silently without
a project id.

**Changed**: documentation only (`docs/SETUP_PRODUCTION.md` §3). `eas.json` already fits.

**Tests executed**: none on devices (none available).

**External dependencies (precise)**:
- Expo account + `eas init` → `extra.eas.projectId` (free plan) — needed for any build and push.
- Android: nothing else for an APK; a Play Console account (one-time fee) only for a Play testing
  track. Firebase project + FCM V1 key for Android push.
- iPhone: Apple Developer Program (yearly fee) for any install outside Expo Go; APNs key for push.
- Physical phones for the two-phone script.

**Unverified**: everything on a device: install, permissions, safe areas, keyboard, startup,
session restoration after a kill, push, crash behaviour, performance on a modest Android phone.
No crash-reporting SDK is installed (owner decision); TestFlight/Play report release crashes.

## Phase 5 — Cold start with real sellers

**Verified**: the existing product already covers the buyer journey and voluntary outcome
reporting (agreements: done on both sides / canceled / disputed, then reviews), with no escrow
and no payment collection.

**Changed**: plan only — `docs/PILOT_OPERATIONS.md` §3 (8–10 sellers first with ≥ 3 real listings
each, ≈ 30 listings before 15–20 buyers are invited; what to tell participants).

**Tests executed**: the journey suites above.

**External dependencies**: recruiting sellers and buyers (owner).

**Unverified**: everything about real people.

## Phase 6 — Safety and operations

**Verified**
- Staff cannot read private conversations: `messages` and `conversations` are readable only by
  members (RLS policies checked); a report carries only the reporter's evidence snapshot.
- Reports are actionable by a `moderator`; hidden listings are unavailable to everyone else; the
  owner of moderated content is notified and can contest; the open queue is oldest first.
- « Vendeur vérifié » can only come from the admin review RPC (members have no update right on
  `verification_level`; integration `01`, `08`); moderators cannot grant it.
- Account deletion and data export exist and are tested (integration `11`).
- Backup and restore (local drill, `docs/PILOT_OPERATIONS.md` §9): a data-only dump, a wipe to
  migrations only, then a restore gave identical counts (29 users, 17 listings, 37 messages,
  11 offers, 4 agreements, 27 storage objects); a member signed in with their old password and read
  their conversation through RLS; a listing photo loaded; the Storage download fetched all files.

**Changed**: `docs/PILOT_OPERATIONS.md` (roles, moderation routine and targets, support channel,
incident severities and containment, rollback, backups).

**External dependencies**: support channel, named moderators, legal placeholders (19), web
hosting for the legal pages and `/admin`.

**Unverified**: the hosted plan's own backup features (dashboard), Storage file backup on the
hosted project.

## Phase 7 — Lean, privacy-safe metrics

**Verified**: 12 read-only queries over existing tables (`docs/PILOT_METRICS.md`) run without error
(`scripts/check-pilot-metrics.sh`); with the test-address filter lifted they return numbers that
match what the E2E journeys did. They never select message contents, previews, offer notes,
agreement terms, report details or review texts.

**Changed**: the metrics document and the checker script; no tracking code, no new table.

**Unverified**: values on real pilot data.

## Tests

Final code, local stack, 7 Nov 2026 (`3c02230` for code and tests; the documentation commit on
top changes no code).

| Command | Result |
|---|---|
| `pnpm check` (4 typechecks, mobile + web lint, unit) | pass, 23 unit tests |
| `pnpm test:integration` (with `.env.test` functions) | **259/259** (241 before P1 + 18 in `15-adversarial`) |
| `pnpm test:e2e` (journey 11, community 5, pricing 6, resilience 6, account-recovery 3, screens 3 sizes, email-confirmation gated) | **34 passed, 1 skipped** |
| Same suites on an empty database (`E2E_SEED=0`, SQL-granted moderator) | integration **259/259**, E2E **31/31** |
| `E2E_EMAIL_CONFIRMATIONS=1 … email-confirmation` with confirmations on | **1/1** (config restored after) |
| `scripts/check-pilot-metrics.sh` | 12/12 query blocks |
| `pnpm seed` on an empty database, then again | pass, then no-op |
| Backup → wipe → restore drill | identical counts, sign-in and RLS reads work |
| `npx expo export --platform ios --platform android` | pass |
| `pnpm --filter @jefeli/web build` | pass |

Not run: anything on a device, simulator or emulator; any EAS build; anything against a hosted
Supabase project.

## Commits

| Commit | Change |
|---|---|
| `5b7a635` | Seed refreshes the DÉMO fixture statuses relative to now; E2E global setup runs it |
| `2ff8b90` | Integration `15-adversarial` (18 tests); fix: double-tapped offer error (French mapping + in-flight guards) |
| `b498231` | E2E `resilience` (6 tests) and its evidence |
| `d6dd671` | Fix: password recovery (`reset-password` screen, per-runtime redirect), E2E `account-recovery` |
| `6022568` | Fix: first-time DÉMO seed; `E2E_SEED=0`, moderator from env, E2E `email-confirmation`; sign-up confirmation redirect |
| `3c02230` | Per-folder screenshot numbering; evidence from the final run |
| (head) | P1 documents: this report, GO_NO_GO, PILOT_TEST_PLAN, PILOT_OPERATIONS, PILOT_METRICS, the metrics checker, updated SETUP_PRODUCTION, RELEASE_STATUS, NEXT_ACTIONS, IMPLEMENTATION_LOG |

Rollback: each commit can be reverted on its own (`git revert <sha>`); none changes the database
schema, so no migration has to be undone.
