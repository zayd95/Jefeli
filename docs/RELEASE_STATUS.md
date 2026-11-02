# Jëfëli — release status

**Readiness: Gate A (developer preview) reached locally. Not yet at Gate B (invited pilot).**
Public release is **not authorised**.

- Branch `claude/jefeli-pilot`, draft PR #1 → `main` (main holds only the owner's spec package)
- Verified on commit `2c996e9` (code) plus a later docs-only commit. Re-run the suites on the final SHA before relying on this table.
- Environment: Ubuntu 24.04 cloud container, local Supabase CLI 2.122 stack (Postgres 17,
  GoTrue, PostgREST, Realtime, Storage, Edge Runtime). The Expo SDK 58 **web build** was driven
  by Playwright/Chromium 1.63. The Next.js 16 web app ran in dev mode.
- **No physical iPhone or Android device, and no iOS simulator or Android emulator, were
  available.** Every UI result below comes from browser renders of the React Native app
  (react-native-web), never from a device.

Status legend: **PASS** = executed and observed · **FAIL** · **BLOCKED_EXTERNAL** = needs an
owner account, credentials, devices or a paid service · **NOT_TESTED** = implemented but not
executed here.

## Acceptance matrix

| ID | Journey | Status | Evidence |
|---|---|---|---|
| ID-01 | A/B accounts, restart, logout, private data | **PASS** | E2E `journey.spec.ts` (sign-up + onboarding for two fresh accounts, reload persistence, logout blocks `/messages`); integration `01-identity` (24 tests: no email/phone in profiles, column grants block verification/status/counter tampering, settings owner-only) |
| SOC-01 | Follow count changes, unfollow reverses | **PASS** | E2E `SOC-01` (0 → 1 abonné after reload); integration `02-social-graph` (private accounts → pending, only followee accepts) |
| SOC-02 | Publish photo/video, react, comment, ownership | **PASS** (photo) · **NOT_TESTED** (video upload) | integration `03-posts-feed`; E2E listing + status photo uploads. Video picking, poster frames and playback are implemented (expo-video / expo-video-thumbnails) but were never run on a device |
| SOC-03 | Find non-followed seller by text/category/city, no GPS | **PASS** | E2E `SOC-03`; integration `05` (accent/typo: "thies" → "Thiès"). Location is voluntary city/neighbourhood only |
| SOC-04 | Public links work logged-out; share sheet | **PASS** (web pages, OG tags) · **NOT_TESTED** (native share sheet) | `apps/web/screenshots/*`, OG/Twitter tags checked with curl by the web workstream; screen tour `16-web-public-profile`. Native `Share.share` not exercised on a device |
| PROF-01 | First listing creates boutique, no wizard | **PASS** | E2E `PROF-01` (boutique on profile after the first listing); integration `05` |
| MKT-01 | Used listing, reserve/sell visible to buyer | **PASS** | integration `05` (status transitions, prohibited terms rejected, foreign media rejected); E2E listing with condition + mode |
| MKT-02 | Offer → counter → accept/reject, permissions | **PASS** | E2E `MKT-02` (28 000 → 32 000 → accepted, immutable agreement); integration `07` (double acceptance, self-offer, outsider blocked) |
| MKT-03 | Barter A-item ↔ B-item + XOF difference, survives restart | **PASS** | E2E `MKT-03` (+15 000 paid by buyer, both snapshots, reload); integration `07` (foreign item, sale-only listing, outsider accept, direct UPDATE refused) |
| MSG-01 | Realtime product-linked chat, two sessions | **PASS** (2 isolated browser sessions) | E2E `MSG-01` (unread badge, reply arrives without reload, "Vu" receipt); integration `06` (outsider sees nothing, including via Realtime) |
| MSG-02 | Photo + voice attachments | **NOT_TESTED** | Both implemented (private bucket, expo-audio recorder/player). Integration covers attachment privacy. The UI flow needs a device microphone and photo library |
| STA-01 | Status audience, reply → DM, expiry | **PASS** | E2E `STA-01` (followers-only status, private reply lands in chat); integration `04` (non-follower/anon denied, expires on read) |
| STA-02 | Highlights persist after 24 h | **PASS** (backend) · **NOT_TESTED** (UI) | integration `04` (expired highlighted status still visible to an authorised follower; outsider cannot highlight it) |
| LIVE-01 | Real B → A live video with pinning | **BLOCKED_EXTERNAL** | Needs Stream credentials, an EAS development build and two physical phones. Live stays disabled and honestly labelled in the app; nothing is faked |
| LIVE-02 | Provider auth + moderation | **PASS** (server side, fake credentials) · **BLOCKED_EXTERNAL** (real provider) | integration `11-edge-functions`: tokens signed for the caller only, ≤ 1 h; blocked viewer gets 404; non-host cannot end; bad webhook signature/API key rejected; only signed events set EN DIRECT, viewer counts and end. Integration `09`: comment/pin/mute rules |
| SAF-01 | Report, block, admin queue | **PASS** | E2E `SAF-01` (report → moderator hides it in `/admin` → listing unavailable → block → profile hidden); integration `08` |
| SAF-02 | No fake badge; reviews only after a completed agreement | **PASS** | integration `01`, `07`, `08` (verification only via admin RPC; review refused before both confirmations) |
| SEC-01 | Automated RLS matrix | **PASS** | `tests/integration`: **199/199** (162 before the feed pass). The first run found 11 real defects, fixed in migration `…0900_security_fixes.sql` (see `tests/integration/README.md`) |
| DEV-01 | Restart, denied permissions, poor network, upload retry, empty states | **PARTIAL** · restart PASS | Reload persistence PASS. Upload retry/backoff, cancel, local drafts and French permission-denied messages are implemented but NOT_TESTED under real network loss or denied OS permissions |
| DEV-02 | Real iOS/Android captures, safe areas, keyboard | **BLOCKED_EXTERNAL** (devices) · web renders PASS | `docs/evidence/e2e/screens/{iphone-se,iphone-15-pro-max,pixel-7}` (16 screens each, browser renders, no overflow). Real safe areas and keyboard behaviour need devices |
| REL-01 | Clean install / migrate / test | **PASS** | Locally: `supabase db reset` → seed → `pnpm check` → integration → E2E. GitHub Actions on PR #1 (head `f18c9dd`): both jobs green, with the typecheck/lint/unit/web build plus all 162 integration tests on a fresh Supabase stack ([run 41378067524](https://github.com/zayd95/Jefeli/actions/runs/41378067524)) |
| REL-02 | README, env names, staging link, checklist, owner script | **PASS** · staging link **BLOCKED_EXTERNAL** | `README.md`, `.env.example`, `docs/SETUP_PRODUCTION.md`, `docs/TEST_IPHONE_FR.md`. There is no hosted staging project or deployment yet (needs owner accounts and approval) |

### Feed engagement pass (migration `…20261103000100_feed_engagement.sql`)

| ID | Journey | Status | Evidence |
|---|---|---|---|
| FEED-01 | One reversible vote per member and publication. Public upvote count only; downvotes private; no self-vote | **PASS** | integration `12-feed-engagement` (switching, counters, no direct writes, anon/blocked/hidden/deleted/suspended/audience refused, rate limit, notification once, export); E2E `community` (up → down → persisted after reload, the author sees no negative) |
| FEED-02 | Downvotes never exposed | **PASS** | integration: `post_votes` readable only by its owner; the penalty function is not reachable over the API; `get_feed` returns no score (regression for a leak found during this pass); the « popular » label uses public upvotes only |
| FEED-03 | Optimistic vote with rollback and French error | **PASS** | E2E `community` (a server error is shown, then reverted, with « Une erreur est survenue. Réessayez. ») |
| FEED-04 | Intents Je partage / Je cherche / Je propose / Votre avis ? on ordinary posts | **PASS** | integration (stored, `invalid_intent`, `empty_request`); E2E (feed shortcut → composer preselected → label on the card → « Je peux aider » opens a private chat) |
| FEED-05 | Comment previews respect blocks, mutes, moderation and audience | **PASS** | integration `get_comment_previews`; E2E (the author sees a genuine reply under their card) |
| FEED-06 | Explainable ranking: votes, recency, locality, relationships, author/type diversity, new members, unanswered requests | **PASS** | integration (upvotes lift and downvotes sink equivalent posts; a prolific author cannot fill the top; `needs_answers`; muted/blocked/hidden/deleted absent). DÉMO feed inspected by hand |
| FEED-07 | Varied DÉMO content set | **PASS** | `pnpm seed`: 10 DÉMO accounts, 12 publications across the 4 intents, 12 comments, 24 votes, 3 conversations (one with a barter offer), all created through the real APIs |
| FEED-08 | Mobile sizes, before/after | **PASS** (browser renders) | `docs/evidence/feed-pass/{before,after}/{iphone-se,iphone-15,pixel-7}` |
| FEED-09 | Review: downvotes personalise the voter's feed only (no global suppression) | **PASS** | migration `…20261104000100_feed_votes_personal.sql`. Integration: other viewers and visitors get the same order however many members downvote (a brigade of 6 changes nothing); the voter's own feed sinks the post and lightly lowers that author's other posts |
| FEED-10 | Review: suspended accounts' upvotes don't count while suspended; rows kept for audit | **PASS** | integration: count 3 → 2 on suspension, rows still 3, « popular » removed, back to 3 on reactivation |
| FEED-11 | Review: no view/click analytics; no automatic moderation from downvotes | **PASS** (by inspection) | No tracking code in `apps/` or `packages/`. The feed migrations never write reports or moderation state |

Also in this pass:
- A block removes the votes between the two members.
- An allowlist test fails if a new `private.*` function is left executable by API roles. It
  caught one during this pass.
- Selected and checked states now reach the web build's accessibility tree: `aria-*` props are
  set next to `accessibilityState` in 16 places.

### Other workstreams

| Workstream | Status | Notes |
|---|---|---|
| Phone OTP (SMS) | **BLOCKED_EXTERNAL** | Screen + Supabase OTP calls implemented behind the `phone_auth` flag. Needs a paid SMS provider. Email/password is the working path and is clearly a separate method |
| Push notifications | **BLOCKED_EXTERNAL** | Token registration, the `push-dispatch` function (preferences, no message text on the lock screen, dead-token cleanup) and the pg_net trigger are implemented. Needs an EAS projectId, a device build, and `exp.host` (unreachable from this container) |
| Account deletion / data export | **PASS** | integration `11` (deletes files in all buckets, profile and auth user); export RPC returns only the caller's data |
| Apple / Facebook login, contacts matching | **NOT_STARTED** (by design) | Flags exist and are off. Needs an Apple Developer account, Meta app review and a privacy decision. Invites use a profile link + QR code instead (no contact import) |
| Moderation console | **PASS** | Web workstream ran its own Playwright pass: non-staff gate, take in charge, remove with reason, approve verification, reverse an appeal, toggle a flag |
| Legal drafts (CGU, confidentialité, règles) | **Draft** | `apps/web/src/app/legal/*`, marked « Projet — à valider ». Needs owner and legal review (Senegal law 2008-12, CDP) |
| Brand / domain clearance | **Pending owner** | `Jëfëli` is used as a working name. Not described as cleared |
| Owner preview on a phone browser (`pnpm preview:lan`) | **PASS** in iPhone-on-Wi-Fi conditions · **NOT_TESTED** on the owner's computer and iPhone | Verified on a non-loopback http origin (Chromium, iPhone 15 size): 21-step walkthrough, new sign-up, E2E journey 11/11. Not yet run on macOS/Windows or in iOS Safari. Microphone recording is refused by browsers on http, so voice notes need a device build. There is no cloud preview: the cloud session cannot accept inbound connections |
| Native app in Expo Go (`pnpm preview:expo-go`) | **PASS** up to the bundle Expo Go loads · **NOT_TESTED** on the iPhone | Verified: Expo SDK 58.0.22 is the latest published SDK; `expo install --check` finds dependencies up to date (offline check); `expo export -p ios -p android` compiles Hermes bundles. Metro in Expo Go mode on a LAN address serves an `exposdk:58.0.0` manifest whose URLs all use the LAN IP, and a 17 MB iOS dev bundle with the LAN Supabase URL and local publishable key (no `127.0.0.1`). The web build through the same Metro passes the 21-step walkthrough. Live: the Stream/WebRTC code is lazy-loaded only when the native module exists, so Expo Go shows « Direct indisponible ». Push: reports "unavailable" without an EAS project id. Not run on a physical iPhone from here |
| Expo doctor | 18/20 | The 2 failing checks need exp.host / React Native Directory (blocked network). `expo prebuild` succeeds on iOS and Android with all plugins |

## External credentials and decisions still required

1. **Supabase** hosted project (staging, later production). Free tier for staging; production likely on the Pro plan.
2. **Expo account** + `eas init` (project id) for development/preview builds and push.
3. **Apple Developer Program** membership: iPhone development builds, TestFlight, Sign in with Apple.
4. **Stream** (or another live provider) account + API key/secret, and a decision on cost.
5. **SMS provider** for phone OTP in Senegal, and a decision on cost.
6. Web hosting for `apps/web` once public exposure is approved; domain after brand clearance.
7. Legal review of the terms, privacy policy and community rules; a named moderation contact.
8. Confirmation of the bundle id `sn.jefeli.app` and of rights to the reference imagery used in DÉMO seed data.

## Costs (assumptions, not verified)

Pricing pages were unreachable from the build environment. Check every figure before you
approve anything.

| Item | Assumption to verify | Needed for |
|---|---|---|
| Supabase | Free tier for staging (projects pause when idle). Pro ≈ US$25/month per production project | Gate B / C |
| Expo EAS | Free plan with limited monthly builds. Paid plans ≈ US$19+/month for more builds/priority | Device builds |
| Apple Developer Program | ≈ US$99/year | iPhone builds, TestFlight, App Store |
| Google Play Console | ≈ US$25 one-time | Play Store |
| Stream Video | Possible free "Maker" programme for small companies. Otherwise usage-based (per participant-minute) | Live |
| SMS OTP to +221 | Roughly US$0.05–0.30 per SMS depending on provider; WhatsApp OTP is an alternative | Phone sign-in |
| Web hosting | Vercel Hobby is free but non-commercial. Pro ≈ US$20/user/month, or any Node host | Share pages, admin |
| Domain `.sn` | Registrar fee, to be confirmed | Share links, universal links |

**No paid service was subscribed, no public deployment was made, nothing was submitted to a store.**

## Known limitations and risks

- UI evidence comes from web renders. Native behaviour has not been observed: gestures,
  keyboard avoidance, camera, microphone, video encoding, push, and the safe areas on notched
  devices.
- The Stream REST endpoint shapes in `supabase/functions/_shared/stream.ts` were written without
  access to Stream's docs and must be re-verified. On iOS, the Stream config plugin made no
  AppDelegate change on SDK 58 (Swift); this needs checking on a device.
- Expired offers stay `pending` until the 15-minute cron job runs. The UI already treats them as
  expired.
- Demo seed imagery is cropped from the owner's reference artwork and is soft at full width.
  It is fine for demos but must not be used publicly without confirming rights.
- The admin console checks roles in the browser. The database enforces every permission, so no
  data is exposed, but there is no server-side route guard.
