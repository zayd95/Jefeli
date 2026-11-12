# Jëfëli — release status

**Readiness: Gate A (developer preview) reached locally. P1 private-pilot candidate prepared
(code verified in browser and backend); Gate B (invited pilot) waits for the owner items in
`docs/GO_NO_GO.md`.** Public release is **not authorised**.

- Branch `claude/jefeli-pilot`, draft PR #1 → `main` (main holds only the owner's spec package)
- Branch `feature/lovable-native-parity-20261104`, draft PR #2 → `claude/jefeli-pilot`: the
  approved Lovable visual port in native Expo code. Verified on code commit `0b1f547` (see
  « Lovable native parity pass » below). **Not merged; waits for the owner's screenshot and
  iPhone review.**
- Branch `feature/w1-web-beta`, draft PR #3 → PR #2's branch: web-first beta on Vercel previews
  (`docs/W1_WEB_BETA.md`). Branch `feature/w1.1-media-first`, draft PR #4 → PR #3's branch:
  Live hidden, 3-minute videos enforced by the database, feed and status playback
  (`docs/W1_1_MEDIA.md`). **Neither is merged, applied to jefeli-staging or deployed publicly.**
- Branch `feature/w1.2-smart-create`, draft PR #5 → PR #4's branch: smart + menu, composable
  publication (photos, video, voice, articles), voice in chat and statuses, statuses by
  reference (`docs/W1_2_SMART_CREATE.md`). **Not merged, not applied to staging.**
- Branch `feature/w1.3-create`, draft PR #6 → PR #5's branch: three-card +, explicit drafts,
  adaptive Publication / Article / Statut editors sharing the feed's media block, article voice,
  narrated statuses by reference, recoverable feed errors, staging migration plan and a schema
  check before every preview build (`docs/W1_3_CREATE.md`). **Not merged, not applied to
  staging, not deployed publicly.** Its Vercel previews stop at the schema check until the
  staging plan is applied (intended).
- Branch `feature/w1.4-desktop-web`, draft PR #8 → PR #7's branch (`feature/w1.4-phone-auth`):
  one app, two experiences. Desktop web gets a sidebar shell, a centred feed with a contextual
  rail (real content only), an Explorer grid, a two-column article, a social boutique grid, a
  three-pane Messages workspace and the W1.3 editor beside its exact feed preview. Phones are
  unchanged (`docs/W1_4_DESKTOP.md`). **Not merged, not deployed.**
- **W1.4 desktop verification (12 Nov), local stack:** `pnpm check` pass (unit 32/32), integration
  312/312, E2E 67 passed + 10 skipped (9 hosted + 1 gated), including the new desktop spec 8/8.
  No horizontal overflow at 1440/1280/1024/768/390/360 px and at zoom equivalents. Phone screens
  at 390/360 px are identical before/after (layout).
- Branch `feature/design-direction-v2`, draft PR #10 → #9's branch: « Dakar after dark » visual
  direction (forest + Senegalese gold, DM Serif Display / DM Sans) and the **white Explorer** with
  « Filtres », « Tendances cette semaine » and « Vendeurs à suivre » (real data only). New read-only
  migration `20261113000100_explore_discovery.sql`, **not applied to staging** (needs the owner's
  go). **Not merged, not deployed.**
- **Design v2 verification (12 Nov), local stack:** `pnpm check` pass (unit 32/32), integration
  321/321 (incl. 9 new discovery tests). Full E2E: 68 passed, 1 failed, 10 skipped (9 hosted + 1
  gated); the failure was SC-04 at 360 pt (a tilted « + » menu card 0.12 px past the screen edge).
  Fixed by keeping 12 pt side margin; SC-04 then passed 4 times, and create + smart-create +
  explore specs 15/15. New `explore.spec.ts` EX-01/EX-02 pass.
- Branch `feature/brand-logo`, draft PR → PR #8's branch: the owner-approved « Jëfëli. » logo
  and « J. » app icon (`brand/README.md`). Assets only, plus the desktop sidebar mark; the phone
  UI and every feature are unchanged. **Not merged.**
- **Web beta go/no-go (11 Nov): NO-GO for outside testers, GO for the owner's acceptance on the
  previews** (`docs/WEB_BETA_GO_NO_GO.md`). jefeli-staging is synchronized (6 migrations, verified
  backup, schema identical, 33/33 security probes); both previews build; hosted journeys 8/8 +
  public page checked; clean regression on `46a2932`: check pass, integration 297/297, E2E 53 passed.
  Blockers: account e-mail configuration, Safari voice untested. (`delete-account` was deployed on
  12 Nov; the hosted deletion check is pending.)
- **Phone auth on jefeli-staging (12 Nov, owner's go):** migration applied (history 22), `send-sms`
  and `delete-account` deployed, Auth hook and phone settings on, and every probe refuses as
  designed. `phone_auth` stays off until the Orange keys and Turnstile arrive
  (`docs/PHONE_AUTH.md` § 8).
- **W1.3 verification (8 Nov), local stack, code `50e7de8` + specs `f92237b`:** `pnpm check` pass
  (unit 28/28), integration 297/297, E2E 53 passed + 1 gated skip (full suite, then the four
  specs updated during the run re-run green), schema contract current and satisfied locally;
  iOS and Android bundles build. See « W1.3 » below.
- **W1.2 verification (7 Nov), local stack:** `pnpm check` pass (unit 25/25), integration 294/294,
  E2E 46 passed + 1 gated skip; iOS and Android bundles build. See « W1.2 » below.
- **W1.1 verification (7 Nov), local stack:** `pnpm check` pass (unit 24/24), integration 280/280,
  E2E 39 passed + 1 gated skip. See « W1.1 media-first commerce » below.
- **P1 verification (7 Nov) on `3c02230`:** `pnpm check` pass, integration 259/259, E2E 34 passed + 1 gated skip; on an empty database integration 259/259 and E2E journeys 31/31. See « P1 private-pilot readiness » below.
- Earlier verification: code commits `0c71062` (post-playtest refinement) and `507f7ff` (visual pass), see the refinement section. Earlier rows were verified on `2c996e9` and later feed commits. Re-run the suites on the final SHA before relying on this table.
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
| SEC-01 | Automated RLS matrix | **PASS** | `tests/integration`: **234/234** (199 after the feed pass, 162 before it). The first run found 11 real defects, fixed in migration `…0900_security_fixes.sql` (see `tests/integration/README.md`) |
| DEV-01 | Restart, denied permissions, poor network, upload retry, empty states | **PARTIAL** · restart, network loss, drafts PASS (browser) | Reload persistence PASS. P1 E2E `resilience`: two network cuts during an upload (automatic retry publishes), a cut while sending a message (text kept, retry sends), draft restored after a reload. Denied OS permissions and real device network loss are still NOT_TESTED |
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

### Post-playtest refinement pass (migration `…20261105000100_refinement.sql`)

Verified on code commit `0c71062` on a local stack rebuilt with `supabase db reset` (integration 234/234, E2E 25/25, `pnpm check`, web `next build`). Browser renders only: nothing in
this pass was observed on a physical device.

| ID | Item | Status | Evidence |
|---|---|---|---|
| REF-01 | One Publication composer with an optional type; « Demande à la communauté » and the home-feed shortcuts removed | **PASS** | E2E `community` (Publier → Publication → type « Je cherche » → published with its label); screenshots 01–03 |
| REF-02 | Publier: compact icon-led grid; Live honestly disabled | **PASS** | E2E `screens` (Live tile `aria-disabled`); screenshot 02 |
| REF-03 | Price modes Prix affiché / Prix sur demande / À discuter; price optional for the non-numeric modes, never 0 F | **PASS** | integration `13-refinement` (create/update rules, `price_required`, `invalid_amount`, `invalid_price_mode`, on-request never stores a price, visitors read `price_mode`, `browse_products`); unit `formatListingPrice`; E2E `pricing` (no « 0 F » on product, boutique, chat and web pages) |
| REF-04 | Offers, counter-offers, barter and agreements on listings without a displayed price | **PASS** | integration `13-refinement` (offer → agreement on « sur demande » and on « à discuter » without a price; barter snapshot keeps `price_mode`); E2E `pricing` (numeric offer on a « Prix sur demande » article); E2E `journey` MKT-02/03 unchanged |
| REF-05 | 3-step article composer with drafts and per-step validation | **PASS** (browser) · **NOT_TESTED** (draft restore after an app kill on a device) | E2E `journey` PROF-01/MKT-03 and `pricing` use the wizard; « Prix affiché » without a price is blocked at step 1 |
| REF-06 | Explorer: Tout/Neuf/Occasion/Troc, « Tous » default, « Voir tout », city sheet, clear filters | **PASS** (browser) | E2E `screens` (« Tous » selected by default); screenshots 06–07 at 3 sizes |
| REF-07 | Ranking v4: genuine upvotes (active and onboarded members), distinct meaningful commenters, repeated text and product ads sink | **PASS** | integration `13-refinement` (votes from members who never onboarded neither count nor rank; recount on onboarding; one member's 3 comments count once; repeated text −2.5, repeated product −1.5 vs controls). Downvotes stay personal (`12-feed-engagement` unchanged and green) |
| REF-08 | Seller visibility: cover photo, « Membre depuis », rating link, pinned posts and products (max 3 per kind), WhatsApp share, « Écrire » from a tagged article | **PASS** (backend + browser) · **NOT_TESTED** (cover upload from the iPhone photo library) | integration `set_pinned` (owner only, `pin_limit`, idempotent, no direct write path); web pages verified on DÉMO data (cover, « Épinglé », WhatsApp text with the price label); screenshots 08–10, 15–16 |
| REF-09 | Multi-article selection in a conversation (no cart, nothing reserved) | **PASS** | E2E `pricing` (buyer sends 2 articles; the seller receives both cards). Uses the existing `messages` RLS and insert trigger. Design note: `docs/CONVERSATION_COMMERCE.md` |
| REF-10 | Expo Go floating tools gear | **Documented** | It is Expo Go's own developer tools button, which app code cannot reach. Hide it from Expo Go's developer menu (shake). The launcher and `TEST_IPHONE_FR.md` explain how. A development build can disable it with the `expo-dev-client` `toolsButton` option (not installed yet) |
| REF-12 | Visual pass from the owner's two UI references (floating pill tab bar + round Publier button, pill search, round icon buttons, Explorer icon tiles, inset-image cards, quiet currency in app and web, grouped product details, segmented option rows) | **PASS** (browser renders) · **NOT_TESTED** (Expo Go: tab bar above the home indicator, touch targets) | `docs/DESIGN_SYSTEM.md` › patterns; screenshots `docs/evidence/refinement/after`; on `507f7ff`: E2E 25/25, `pnpm check`, web `next build` (no database change, so integration still 234/234 from `0c71062`) |
| REF-13 | Optional boutique identity (owner's migration `cb21596`): « Vendeur » requires a shop name and category; casual selling needs nothing | **PASS** | integration `14-boutique-identity` (7) + `05`/`08` adapted, 241/241; the migration chain verified on a local database that already had DÉMO merchants; onboarding and profile fields checked in browser renders · **NOT_TESTED** on a device |
| REF-11 | Before/after at phone sizes | **PASS** (browser renders) | `docs/evidence/refinement/{before,after}/{iphone-se,iphone-15,pixel-7}` (see its README) |

Defects found and fixed during this pass:
- A button nested inside a button (« Écrire » inside the tagged-article row) triggered a web
  error. It is now two sibling buttons.
- On a phone, the public product page's sticky contact bar covered the price. Its note is now
  one line, and the full explanation moved below it.
- A second focus ring appeared inside focused fields on web.
- Grid cards cut off « · à discuter ».

**Not tested on a device in this pass:** Expo Go on the iPhone for all of the new screens; the
gallery and camera in the article composer and the cover picker; keyboard behaviour in the
3-step composer; safe areas; WhatsApp opening from `wa.me` links; the native share sheet;
draft restore after the app is killed.

### Lovable native parity pass (branch `feature/lovable-native-parity-20261104`, code `0b1f547`)

Verified on a local stack rebuilt with `supabase db reset` + `pnpm seed`: `pnpm check` (4
typechecks, mobile + web lint, 23/23 unit), integration **241/241**, E2E **25/25** (journey 11,
community 5, pricing 6, screens at 3 sizes), and `expo export` for iOS and Android (Hermes
bundles). No database change in this pass. UI evidence is browser renders only.

| ID | Item | Status | Evidence |
|---|---|---|---|
| LOV-01 | Baseline bridge (tokens, one-screen onboarding, 5-tab dock) typechecks, lints, tests | **PASS** after fix | The E2E `signUp` helper still drove the removed 3-step onboarding (fixed in `e85f046`); onboarding no longer wipes boutique identity/interests |
| LOV-02 | Home on #091B19, no white cards; feed queries, votes, comments, statuses, pagination kept | **PASS** (browser) | `docs/evidence/lovable-parity/compare/*-01..03-home*`; E2E community 5/5 (votes, private downvote, rollback, « Je peux aider », comment preview on the feed card) and STA-01 |
| LOV-03 | Explorer / ListingCard / product page near-white #FAFBFA; categories, Wecci, offers, chat kept | **PASS** (browser) | `compare/*-04..06*`; E2E SOC-03, MSG-01, MKT-02, MKT-03, pricing 6/6. Home chips deep-link into Explorer filters |
| LOV-04 | Compact dark profile: ≈136-pt cover, overlapping avatar, bio, ≤ 3 interest chips +N, Publications / Boutique only, no carousel or pinned hero; statuses, highlights, reviews, live, privacy, report/block reachable | **PASS** (browser) | `compare/*-07..09*`; E2E PROF-01 (Boutique tab count), SOC-01 (real follower count), SAF-01 (report, block from the ⋯ menu); interests editor (≤ 5, existing `profiles.interests`) |
| LOV-05 | Publishing: Plus → Publication composer directly; Article / Statut in the switcher; article on one scroll with options collapsed; drafts, upload progress, RPCs and failure recovery kept | **PASS** (browser) · **NOT_TESTED** (draft restore after an app kill on a device) | `compare/*-10..13*`; E2E community (`/publish` → composer), journey PROF-01/MKT-03 and pricing (one-scroll form, « Prix affiché » blocked without a price, « Sur demande », « À discuter »). A failed feed share is now reported |
| LOV-06 | Dock (5 states), status bars, safe areas, sheets, keyboard | **PASS** (browser: dock, sheets, safe-area padding code) · **NOT_TESTED** on a device (status-bar icon switching, home indicator, keyboard avoidance, Android keyboard hiding the dock) | `native/` at 360/390/412; `useDarkStatusBar()` is a no-op on web |
| LOV-07 | Email login kept; SMS Senegal-only (+221) and visibly gated until a provider exists; no billing | **PASS** | unit `toSenegalE164`; welcome screen `states/*-00-welcome-osdark.png`; `phone_auth` flag off locally |
| LOV-08 | Screenshots at 360 / 390 / 412, light and dark surfaces, real empty and loading states | **PASS** (browser renders) | `docs/evidence/lovable-parity/{native,states,compare}`; OS dark-mode emulation leaves the app's own surfaces |
| LOV-09 | Two-user journey through the real UI | **PASS** | E2E journey 11/11 (two isolated browser contexts + moderation console) |
| LOV-10 | Native compile | **PASS** (bundles) · **NOT_TESTED** (running on iOS/Android) | `npx expo export --platform ios --platform android` |

**Not tested in this pass:** everything that needs a device or simulator — real status bars,
notches and home indicators, keyboard avoidance, gestures, the photo library and camera,
haptics, font rendering on iOS/Android. The owner's iPhone review is required before merge.

### Microcopy cleanup and mobile polish (owner iPhone feedback, Nov 6)

| ID | Item | Status | Evidence |
|---|---|---|---|
| COPY-01 | Onboarding: no filler lines, « Disponible » only when verified, short GPS note, age/legal/errors kept | **PASS** (browser) | `docs/evidence/microcopy-pass/compare/*-0{1,2,3}-onboarding*`; E2E sign-up helper (all specs) |
| COPY-02 | Fixed onboarding CTA never covers the age confirmation | **PASS** (browser, 360×640 / 390×844 / 412×915) · **NOT_TESTED** with a real iOS keyboard | footer now one CTA outside the scroll view; `*-03-onboarding-bottom` |
| COPY-03 | Redundant subtexts removed/shortened on Accueil, Explorer, Publier, Messages, Profil, Boutique, Statuts; trust, payment, privacy, barter/offer, validation and a11y text preserved | **PASS** (review + renders) | `docs/evidence/microcopy-pass/README.md` lists every string |
| COPY-04 | Touch targets ≥ 44 pt on pills and small links | **PASS** (code review) | hit areas extended without changing the visual size |

### P1 private-pilot readiness (branch `feature/lovable-native-parity-20261104`, draft PR #2)

Report: `docs/P1_READINESS_REPORT.md`. Decision sheet: `docs/GO_NO_GO.md`. Browser renders and
local backend only; no device.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| P1-01 | DÉMO statuses never expire mid-run; fresh seed works | **PASS** after 2 fixes | Seed refreshes fixture statuses relative to now (E2E global setup); a first-time seed failed half-way (`invalid_product`), fixed and re-run on an empty database |
| P1-02 | Real-member journeys with no DÉMO data | **PASS** | Empty database (migrations only, 0 users): integration 259/259; E2E journey, community, pricing, resilience, account-recovery 31/31; moderation by a SQL-granted `moderator` |
| P1-03 | E-mail confirmation path | **PASS** (local, confirmations on) · **NOT_TESTED** with the pilot project's e-mail sender | E2E `email-confirmation` (gated by `E2E_EMAIL_CONFIRMATIONS=1`) |
| P1-04 | Forgotten password | **PASS** after fix (browser) · **NOT_TESTED** deep link on a phone | Reproduced: the reset link opened « Unmatched Route ». New `reset-password` screen; E2E `account-recovery` 3/3 (new password, old refused, used link, no form without a recovery link) |
| P1-05 | Duplicate / concurrent / stale offers, immutable terms | **PASS** after fix | integration `15-adversarial` (18 tests); a concurrent duplicate showed a misleading error, now « Vous avez déjà une proposition en attente… », and the UI ignores the second tap |
| P1-06 | Network cuts, restart during publication, resume after token expiry, stale links | **PASS** (browser) · **NOT_TESTED** on a device | E2E `resilience` 6/6 |
| P1-07 | Blocking after a conversation/agreement, deleted/hidden/private content, forged tokens, oversized/invalid media | **PASS** | integration `15-adversarial` |
| P1-08 | Installable build path | **BLOCKED_EXTERNAL** | Documented and checked against the EAS CLI 27.5.0 source (APK by default for `preview`, EAS environment variables required because `.env` is not uploaded). Needs an Expo account; iPhone needs the Apple Developer Program |
| P1-09 | Operations, safety, metrics | **PASS** (documents, queries run) | `docs/PILOT_OPERATIONS.md`, `docs/PILOT_METRICS.md` (12 read-only queries run by `scripts/check-pilot-metrics.sh`), backup/restore drill on the local stack |

### W1.1 media-first commerce (branch `feature/w1.1-media-first`, draft PR #4)

Details, limits and the video-provider decision: `docs/W1_1_MEDIA.md`. Browser (Chromium) and
local backend only; no device, no hosted run.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| MED-01 | Live absent from the visible product, data kept | **PASS** | E2E screen tour (no Live tile, `/live/host` → Accueil) on 3 sizes; no migration touches live data |
| MED-02 | 180 s inclusive in posts, articles, statuses, enforced server-side | **PASS** | integration `17-media-videos` (180 000 ms accepted, 180 001 / 180 500 / 200 000 refused, duration required); E2E 3 min 01 s refused at selection, exactly 3 min published |
| MED-03 | Declared kind = stored file; ownership | **PASS** | integration: image declared as video, video as image, video poster → `invalid_media`; someone else's file → `media_not_found` |
| MED-04 | Upload quota | **PASS** | integration: 300 files / 24 h and 2 GB stored both block a new upload; a normal member uploads |
| MED-05 | Orphaned and expired media removed safely | **PASS** (local) · **NOT_TESTED** scheduled | integration: abandoned file listed after 48 h, never a file used by a post, article, live status or a shared file; `cleanup-media` refuses without the service key and deletes; expired status file unreadable by a follower |
| MED-06 | Feed: one video at a time, muted, pauses off-screen / away / background | **PASS** (browser) · **NOT_TESTED** on a device | E2E `media` MED-03: one playing, muted, full card width, tap pause/resume, paused after leaving Accueil |
| MED-07 | Status video plays to its end, not cut by a timer | **PASS** (browser) | E2E `media` MED-05: still on the status after 8 s of a 12 s video, closes at its end |
| MED-08 | Video → article → conversation | **PASS** (browser) | E2E `media` MED-04 |
| MED-09 | Any 3-minute phone video can be published and played everywhere | **BLOCKED_EXTERNAL** | Needs transcoding (Cloudflare Stream, owner approval and budget): raw 3-min phone videos from Android and the web usually exceed the 50 MB Free-plan file limit; iPhone HEVC may not play on Android/desktop |
| MED-10 | Hosted acceptance journey (staging + Vercel preview, two real accounts) | **BLOCKED_EXTERNAL** | Migration not applied to jefeli-staging (read-only token); preview hosts unreachable from this session; e-mail sender (`docs/W1_WEB_BETA.md` §5) |

### W1.2 smart create & connected media (branch `feature/w1.2-smart-create`, draft PR #5)

Details and limits: `docs/W1_2_SMART_CREATE.md` §6–7. Browser (Chromium with a fake microphone)
and local backend only.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| SC-01 | + menu (Publication · Article · Statut, no Live), dismissible, accessible, sheet on narrow screens | **PASS** (browser) · **NOT_TESTED** on a device | E2E SC-01, SC-08 (360/390/412 pt) |
| SC-02 | Seller: photos + narration (language) + article in one publication | **PASS** | E2E SC-02; integration `18-connected-media` |
| SC-03 | Buyer: no autoplay with sound, chooses to listen, gallery follows the narration, article, contact | **PASS** (browser) | E2E SC-03 |
| SC-04 | Voice-only publication (feed, profile) | **PASS** (browser) | E2E SC-05 |
| SC-05 | Chat voice about an article, preview, reply by voice | **PASS** (browser) | E2E SC-04; integration (voice checks, article visibility) |
| SC-06 | Status sharing an existing post, expiry keeps the post and its files | **PASS** | E2E SC-06; integration |
| SC-07 | Refused microphone, cancelled take, refresh with a draft, no broken item | **PASS** (browser) | E2E SC-07 |
| SC-08 | Private voice never public; others' recordings never republished | **PASS** | integration `18-connected-media` |
| SC-09 | Native recorder and players on iPhone / Android | **NOT_TESTED** | Bundles build; no device here |
| SC-10 | Chrome-recorded voice played in Safari on iPhone | **NOT_TESTED** | No device; see W1.2 doc §7 |

### W1.3 créer, c’est montrer (branch `feature/w1.3-create`, draft PR #6)

Details and limits: `docs/W1_3_CREATE.md`. Browser (Chromium with a fake microphone) and local
backend only.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| CR-01 | + : three cards side by side, ±5°, no overlap, ≥ 44 pt, feed recognizable; ×, outside tap, Escape | **PASS** (browser) · **NOT_TESTED** on a device | E2E CR-01, CR-02 (360 pt), SC-04 (360/390/412) |
| CR-02 | A draft is never replaced silently: badge, continue, new after confirmation, editor gate | **PASS** | E2E CR-03, SC-03; resilience (article draft) |
| CR-03 | Adaptive Publication: canvas → photos preview → voice; studio records at once; reorder by drag or buttons, cues follow | **PASS** (browser) | E2E CR-04, SC-02, SC-03 |
| CR-04 | Editor preview behaves like the published card (narration, photo navigation, article chip) | **PASS** | E2E CR-04 (preview follows the voice), CR-05 (feed); same component `PostMedia` |
| CR-05 | Buyer: no autoplay with sound, listens, photos follow, opens the article, writes | **PASS** (browser) | E2E CR-05 |
| CR-06 | Article shop window: same required fields, missing ones named before sending; voice stored with the article | **PASS** | E2E CR-06, pricing; integration `18-connected-media` (3 new tests) |
| CR-07 | Article voice heard on the article page (photos follow), the feed share and the public web page | **PASS** (browser) | E2E CR-06 |
| CR-08 | Narrated publication shared as a status plays its voice, photos following, no file copied | **PASS** | E2E CR-07; W1.2 integration (`share_to_status`) |
| CR-09 | Statut editor full screen: photo with text and article; voice with its own visual | **PASS** (browser) | E2E CR-08, CR-09, journey STA-01, media MED-05 |
| CR-10 | A failed feed request leaves a way forward (precise title, retry, Explorer, diagnostics) | **PASS** | E2E resilience (offline, database behind the app, recovery); unit `describeFailure` |
| CR-11 | Preview builds refuse a database that is behind | **PASS** | Vercel builds of PR #6 stopped at the check against jefeli-staging, naming every missing item; CI step in the integration job |
| CR-12 | Native photo + voice status (not from a publication) | **NOT_BUILT** | Schema change; tradeoff in W1.3 doc §2 |
| CR-13 | The new editors on iPhone / Android | **NOT_TESTED** | Bundles build; no device here |

### W1.4 phone sign-up and sign-in (branch `feature/w1.4-phone-auth`, draft PR #7)

Details, costs and setup: `docs/PHONE_AUTH.md`. Local stack: real auth server, codes delivered
to the hook's local sink (no SMS to a real phone), Chromium.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| PH-01 | E-mail and Téléphone offered side by side on sign-up and sign-in | **PASS** (browser) | E2E PH-01, PH-03 (360 pt) |
| PH-02 | Passwordless phone sign-up and returning sign-in through Supabase Auth | **PASS** (local) | Integration 19-phone-auth; E2E PH-01 (second device) |
| PH-03 | Senegal (+221) first; country picker ready for more once delivery is verified | **PASS** | `packages/shared/src/phone.ts`, server allow-list `private.sms_settings`; unit tests |
| PH-04 | Phone-only accounts without e-mail; export and deletion work | **PASS** (local) | Integration (export, delete-account, log link forgotten) |
| PH-05 | Add a verified phone to an e-mail account: same profile, boutique and articles; number of another account refused | **PASS** (local) | Integration; E2E PH-05, PH-06 |
| PH-06 | Invalid numbers, wrong or expired code, resend countdown, network failure, recovery after reload | **PASS** (browser) | E2E PH-01, PH-02 (real 60 s wait), PH-04; integration (expired code) |
| PH-07 | Server-side caps, kill switch, Senegal-only destinations, retry idempotency, usage log without codes or numbers, admin monitoring | **PASS** (local) | Integration 19-phone-auth (15 tests); `docs/PILOT_METRICS.md` § 7 |
| PH-08 | CAPTCHA (Turnstile) on every auth request on the web | **BUILT, NOT_TESTED** | Needs keys and network access to Cloudflare |
| PH-09 | Real SMS delivery: Orange, Free/Yas, Expresso; Safari and Android Chrome | **NOT_TESTED** | Needs the approved provider and real SIM cards (owner checklist § 6) |
| PH-10 | Existing auth, onboarding, deletion, security policies and member data preserved | **PASS** (local) | Full regression below; migration adds objects only |

- **W1.4 verification (11 Nov), local stack, clean database:** `pnpm check` pass (unit 32/32),
  integration 312/312. E2E full run: 55 passed, 10 skipped (9 hosted-only, 1 gated), PH-03 failed on a
  stale expected text (the test, not the app) so PH-04 → PH-06 did not run. After fixing the test,
  `phone.spec.ts` 6/6 on the same stack.

### Other workstreams

| Workstream | Status | Notes |
|---|---|---|
| Phone OTP (SMS) | **BLOCKED_EXTERNAL** | Screen + Supabase OTP calls implemented behind the `phone_auth` flag. Needs a paid SMS provider. Email/password is the working path and is clearly a separate method |
| Push notifications | **BLOCKED_EXTERNAL** | Token registration, the `push-dispatch` function (preferences, no message text on the lock screen, dead-token cleanup) and the pg_net trigger are implemented. Needs an EAS projectId, a device build, and `exp.host` (unreachable from this container) |
| Account deletion / data export | **PASS** | integration `11` (deletes files in all buckets, profile and auth user); export RPC returns only the caller's data |
| Apple / Facebook login, contacts matching | **NOT_STARTED** (by design) | Flags exist and are off. Needs an Apple Developer account, Meta app review and a privacy decision. Invites use a profile link + QR code instead (no contact import) |
| Moderation console | **PASS** | Web workstream ran its own Playwright pass: non-staff gate, take in charge, remove with reason, approve verification, reverse an appeal, toggle a flag |
| Legal drafts (CGU, confidentialité, règles) | **Draft** | `apps/web/src/app/(public)/legal/*`, marked « Projet — à valider », 19 placeholders left (P1 count). Needs owner and legal review (Senegal law 2008-12, CDP) |
| Brand / domain clearance | **Pending owner** | `Jëfëli` is used as a working name. Not described as cleared |
| Owner preview on a phone browser (`pnpm preview:lan`) | **PASS** in iPhone-on-Wi-Fi conditions · **NOT_TESTED** on the owner's computer and iPhone | Verified on a non-loopback http origin (Chromium, iPhone 15 size): 21-step walkthrough, new sign-up, E2E journey 11/11. Not yet run on macOS/Windows or in iOS Safari. Microphone recording is refused by browsers on http, so voice notes need a device build. There is no cloud preview: the cloud session cannot accept inbound connections |
| Native app in Expo Go (`pnpm preview:expo-go`) | **PASS** up to the bundle Expo Go loads · **NOT_TESTED** on the iPhone | Verified: Expo SDK 58.0.22 is the latest published SDK; `expo install --check` finds dependencies up to date (offline check); `expo export -p ios -p android` compiles Hermes bundles. Metro in Expo Go mode on a LAN address serves an `exposdk:58.0.0` manifest whose URLs all use the LAN IP, and a 17 MB iOS dev bundle with the LAN Supabase URL and local publishable key (no `127.0.0.1`). The web build through the same Metro passes the 21-step walkthrough. Live: the Stream/WebRTC code is lazy-loaded only when the native module exists, so Expo Go shows « Direct indisponible ». Push: reports "unavailable" without an EAS project id. Not run on a physical iPhone from here |
| Expo doctor | 18/20 | The 2 failing checks need exp.host / React Native Directory (blocked network). `expo prebuild` succeeds on iOS and Android with all plugins |

## External credentials and decisions still required

1. **Supabase** hosted project (staging, later production). Free tier for staging; production likely on the Pro plan.
2. **Expo account** + `eas init` (project id) for development/preview builds and push.
3. **Apple Developer Program** membership: iPhone development builds, TestFlight, Sign in with Apple.
4. **Stream** (or another live provider) account + API key/secret, and a decision on cost.
5. **SMS provider** for phone OTP in Senegal: Orange SMS API Sénégal recommended (`docs/PHONE_AUTH.md`); owner approval, account and credentials needed. Cloudflare Turnstile keys (free) for CAPTCHA.
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
| SMS OTP to +221 | **Checked 11 Nov:** Twilio $0.5506/SMS (official page); Twilio Verify +$0.05 per success. Orange SMS API Sénégal bundles 20 → 3.3 F per SMS (search results; Orange's page refused automated reading). Comparison and monthly estimates: `docs/PHONE_AUTH.md` § 2 | Phone sign-up/sign-in |
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
