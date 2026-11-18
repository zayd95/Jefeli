# Jëfëli — implementation log

Branch `claude/jefeli-pilot` · draft PR #1 · all work dated 2026-11-02.

## Environment notes (honest constraints)

- Cloud container: no iOS simulator, no Android emulator (no KVM), no physical devices.
- The network policy blocked docs.expo.dev, supabase.com, getstream.io, exp.host,
  dl.google.com (Android SDK) and image CDNs. APIs were therefore checked against the
  **installed package type definitions**, which are authoritative for the installed versions.
  The npm registry and Docker Hub (through mirror.gcr.io) were reachable.
- Docker images for the local Supabase stack came from `mirror.gcr.io`
  (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`).

## Milestones

### `229bd25` — owner spec package on `main`
The owner's package (CLAUDE.md, docs/, reference/) was committed as the base, so the work can
be reviewed as a PR.

### `9e7740d` — Foundation: monorepo, schema with RLS, shared package
- pnpm workspace (hoisted), Expo SDK 58 scaffold, `@jefeli/shared` (13 unit tests).
- 9 migrations covering:
  - identity and settings, social graph (follows with approval, friendships, blocks, mutes);
  - commerce (categories, prohibited-terms filter, auto boutiques, listings, media, saves);
  - posts/comments/likes/saves; statuses + views/likes/highlights (expiry checked on read);
  - notifications + push hook; DMs, offers, barter, agreements (immutable terms), reviews;
  - live sessions/pins/comments/mutes (state only from server/provider);
  - reports with evidence snapshots, immutable moderation log, appeals, verification
    requests, data export;
  - storage buckets and policies, explainable feed, search, realtime publication.
- Checks run: every table has RLS; anon has no write privileges; authenticated has only
  column-scoped writes.

### `a7a29f1` — Mobile screens, security suite, RLS fixes
- Design system (Atlantic Sand, Inter, accessible tokens) and the full app on real data:
  - auth, onboarding, feed with six filters, explorer, search, profile with integrated
    boutique, composers (compression, progress, retry, cancel, drafts);
  - product detail, offer/barter composer, chat with product/offer cards, voice notes, images
    and read receipts;
  - agreement recap, status viewer, notifications, reports, settings, invite QR.
- `tests/integration`: 146 tests written by a delegated workstream; **11 failed on real
  defects**:
  - private helpers executable by PUBLIC;
  - private follower lists exposed;
  - soft-delete broken by RLS;
  - logged-out feed/browse failing;
  - first messages not unread;
  - deleted text left in the conversation preview;
  - blocks trapping offers and disputes;
  - mutable reported media.
- All fixed in `20261102000900_security_fixes.sql`, along with 3 more found afterwards:
  blocked comment replies, block-status leak, and offer expiry via pg_cron. Result: 149/149.

### `055ee94` — Web, edge functions, live, demo seed
- `apps/web` (delegated, reviewed): public pages with OpenGraph and deep links, French legal
  drafts, and a restricted admin console. Typecheck, lint and build pass.
- Edge Functions rewritten without dependencies (a fetch-based REST client), because the
  sandboxed runtime could not fetch npm modules through the proxy:
  - `live` (server-minted short-lived Stream tokens, honest not-configured state);
  - `live-webhook` (HMAC verification);
  - `push-dispatch`, `delete-account`, `cleanup-stories`.
  - 13 tests: **162/162** overall.
- Mobile live screens behind three checks: provider configured, feature flag on, native SDK
  present. The Stream SDK and config plugins are installed. `expo prebuild` succeeds on iOS and
  Android; the Android native setup was injected.
- `scripts/seed-demo.mjs` creates DÉMO accounts through the real APIs. It is guarded to
  local/staging only.

### `2c996e9` — E2E, screen tour, lint, brand icons
- `tests/e2e/specs/journey.spec.ts`: 11 stages with two fresh accounts through the real UI,
  **11/11 PASS on a clean `db reset` + seed** (≈ 1 min):
  sign-up/onboarding → photo listing → search without following → realtime chat → reload →
  offer/counter/accept → barter → follow count → status + private reply → report → moderator
  hides it in `/admin` → listing unavailable → block → logout.
- Bugs found by E2E and fixed:
  - `router.back()` crashed on screens opened without history (new `goBack()` helper);
  - the selected audience option was invisible on the dark status composer;
  - `/status` collided with Metro's dev endpoint (route renamed `/statut`);
  - a button label overflowed at 393 px.
- Screen tour at 3 sizes: 48 renders in `docs/evidence/e2e/screens/`.
- Mobile ESLint (expo config incl. React Compiler rules): 21 errors → 0, mostly derived state
  instead of setState in effects.
- App icon, adaptive icon, splash and favicon generated from the palette.

### Docs commit (after `2c996e9`)
README, SETUP_PRODUCTION runbook, French iPhone test script, RELEASE_STATUS, NEXT_ACTIONS, CI
workflow, EAS profiles, root scripts.

### Local interactive preview for the owner's iPhone (after `9b2cbd4`)
- **Cloud preview is not possible from this environment.** The Claude Code cloud container
  has no inbound connectivity and no built-in port forwarding. The environment's containment
  policy also denied an outbound tunnel. Nothing was exposed and nothing was deployed.
- New `pnpm preview:lan` (`scripts/preview-lan.mjs`) runs everything on the owner's own
  computer for a phone on the same Wi-Fi:
  - the Supabase API only (Studio, mailpit and postgres-meta are excluded), the Edge Functions
    and the DÉMO seed;
  - a production Expo web export served on :8081;
  - a production Next.js build on :3000.
  - Both front ends are built against `http://<LAN-IP>:54321`, so the phone never calls its own
    localhost.
- Bugs found while verifying under iPhone-over-Wi-Fi conditions (plain-http origin = insecure
  context):
  - **Uploads failed.** `crypto.randomUUID` does not exist on insecure origins, so object paths
    are now built from `getRandomValues` (`apps/mobile/src/lib/upload.ts`).
  - The Next.js **dev** server blocks dev assets requested from a non-localhost origin, so the
    moderation console stayed on « Chargement… ». The preview uses `next build` + `next start`.
  - **Local Realtime cold start.** The first postgres_changes subscriber after `supabase start`
    can miss events written while the change feed starts: reproduced as missed cold and
    delivered in ~250 ms warm. The launcher holds one warm-up subscription.
- Verification, on `192.0.2.2` (a non-loopback address, insecure context, Chromium at iPhone 15
  size):
  - 21-step walkthrough: feed, statuses, explore, search, product, two boutiques, chat with the
    barter card on both sides, a live reply, a photo upload, honest Live screen, public pages,
    admin console. All PASS, no page errors.
  - A new account sign-up with mailpit off: PASS.
  - `pnpm test:e2e journey`: **11/11** against the preview servers.
  - Test-environment note: this container's egress proxy intercepts the browser's `ws://`
    connection to `192.0.2.2`, but not to a home `192.168.x.x` address, which is on the proxy
    bypass list. The E2E therefore ran with that IP added to `NO_PROXY`.
- `pnpm check` (typecheck, lint, unit): pass.

### `cb3c9b2` — Feed engagement and discovery pass
Requested after the first local playtest. It is a focused pass on the existing feed: no new
module and no new navigation. The details, ranking table and playtest metrics are in
`docs/FEED_ENGAGEMENT.md`.
- Migration `20261103000100_feed_engagement.sql`:
  - `post_votes` + `vote_post()`, with a public `upvote_count` and private downvotes;
  - likes migrated as upvotes, then `post_likes`/`like_count` dropped;
  - `posts.intent` and `create_post(p_intent)`;
  - `get_comment_previews()`;
  - `get_feed` v2;
  - votes added to the data export;
  - a block removes the votes between the two members.
- Mobile:
  - `VoteControl` with optimistic update and rollback, through one cache helper (`lib/postCache.ts`);
  - intent picker in the composer, plus « Demandez à la communauté » on the feed and in the
    Publier menu;
  - intent labels and contextual actions on cards;
  - comment previews;
  - a new action-row hierarchy.
- Web share pages show upvotes instead of likes.
- Defects found during the pass, all fixed before commit:
  - `get_feed` returned its score to 3 decimals, including the downvote penalty, so anyone
    could compute a post's downvotes. Found by the integration test workstream. The score is
    no longer returned, and a regression test checks this.
  - « popular » hinted at downvotes; it now uses public upvotes only.
  - A blocked member's old votes kept counting.
  - A new trigger function was executable by anon. A new allowlist test now fails for any
    `private.*` function exposed to API roles.
  - Copying likes fired the new notification trigger, so the migration was reordered.
  - React Native Web ignores `accessibilityState`, so `aria-*` props were added in 16 places.
  - The web profile showed « 1 votes ».
- Evidence:
  - integration **196/196**;
  - E2E `community` 5/5 (vote switch and persistence, rollback on a server error, « Je peux
    aider » → chat, comment preview), `journey` 11/11 and `screens` 3/3;
  - `pnpm check` passes;
  - before/after screenshots in `docs/evidence/feed-pass/`.
  All of these are browser renders.

### Feed pass review (owner decisions)
- New migration `20261104000100_feed_votes_personal.sql`:
  - **Suspended accounts:** upvotes count from active members only. A suspension or
    reactivation recounts the affected posts, and the vote rows are kept for audit.
  - **Downvotes are personal:** a post the viewer voted down gets −4 in that viewer's feed, and
    that author's other posts −0.5 each (max −1.5). The global penalty and
    `private.post_vote_penalty` are removed.
  - **Visitors:** `get_feed` now reads the viewer's own votes, so logged-out visitors needed
    SELECT on `post_votes`. The suite caught this as a regression (the public feed returned
    "permission denied"). The fix grants SELECT to anon with no anon RLS policy, so visitors
    read zero rows; this is the same pattern as `mutes` and `story_views`.
- Confirmed by inspection, with nothing to change: there is no analytics code, and votes never
  write reports or moderation state.
- **Tests:** integration **199/199**, on the upgraded database and after a fresh
  `db reset`. New tests cover:
  - no global effect, with three viewers including visitors;
  - a downvote brigade of 6 that changes nothing for others;
  - personal author down-weighting;
  - suspension → recount → reactivation.
  E2E: community 5/5, journey 11/11, screens 3/3. `pnpm check` passes.

### Expo Go playtest mode
- **Audit:**
  - Expo 58.0.22 is the latest published SDK, and `expo install --check` reports dependencies up
    to date.
  - The only modules missing from Expo Go are Stream Video and `@stream-io/react-native-webrtc`.
    The config plugins only run at prebuild.
  - Stream is already isolated: `isLiveSdkAvailable()` checks for the native WebRTC module, and
    `StreamLive` is a `React.lazy` import rendered only when that module exists.
  - Push registration returns "unavailable" without an EAS project id.
  - `expo export -p ios -p android` compiles both Hermes bundles.
- **Launcher `--expo-go`** (`pnpm preview:expo-go`):
  - same backend steps as `preview:lan`;
  - Metro in the foreground with `--go --lan` so the terminal shows the QR code;
  - `REACT_NATIVE_PACKAGER_HOSTNAME` pinned to the detected Wi-Fi IP, so the QR code and the
    API address agree;
  - `CI` removed from the environment, since it would hide the QR code;
  - Metro also serves the web app on :8081.
- **Verified on a LAN address:**
  - the Expo Go manifest (`application/expo+json`, `exposdk:58.0.0`, hostUri on the LAN IP);
  - the 17 MB iOS dev bundle, which contains the LAN Supabase URL and publishable key;
  - the Android manifest;
  - the 21-step web walkthrough, all PASS through the same Metro.
- **Not verified:** the app was not run in Expo Go on a physical iPhone; no device is available
  here.

### Post-playtest UX and social-commerce refinement (code `0c71062`)
A focused refinement after the owner's Expo Go playtest. It is not a rebuild.
- **Migration `20261105000100_refinement.sql`:**
  - `products.price_mode` (`fixed` / `on_request` / `negotiable`) with table rules. A price is
    never 0 F, is required only for « Prix affiché » sales, and is never stored for « sur
    demande ». Existing 0 F listings became « sur demande ».
  - `create_listing` takes `p_price_mode`. The owner can update `price_mode` through a column
    grant. The offer snapshot keeps the mode.
  - `posts.pinned_at` / `products.pinned_at` and `set_pinned()`: owner only, at most 3 per
    kind, no direct write path.
  - Upvotes count only from active, onboarded members, with a recount trigger.
  - `get_feed` v4: distinct meaningful commenters, and repeated text or product ads sink.
- **Shared:** `formatListingPrice()` / `hasDisplayedPrice()` drive every price label (app, web,
  chat, offers, statuses, live). Also `PRICE_MODES`, `formatMemberSince()`, and the error keys
  `price_required`, `invalid_price_mode`, `pin_limit`.
- **Mobile:**
  - Publier is a 2×2 icon grid, and « Demande à la communauté » is removed.
  - The Publication composer puts the text first, with an optional type and optional
    product tagging.
  - The home feed loses the intent shortcuts.
  - Nouvel article is a 3-step wizard with the draft kept.
  - `listing-edit` handles the price modes.
  - Explorer is rebuilt (segmented type, « Tous » + « Voir tout », city sheet).
  - Profile: cover picker, « Membre depuis », rating link, a share sheet with WhatsApp, pinned
    posts first, pin markers, « Écrire au vendeur » in the boutique preview.
  - PostCard: « Écrire » on tagged articles, plus pin and unpin in the owner menu.
  - Chat: `ProductPicker` (several articles, one card each).
  - Web inputs lose the double focus ring.
- **Web:** share pages use the shared price labels. They also show pins first with « Épinglé »,
  a WhatsApp text that includes the price label, the cover photo, and a one-line sticky
  contact bar.
- **Seed:** DÉMO « Prix sur demande » and « À discuter » listings, pins, and Awa's cover.
- **Tests:**
  - integration `13-refinement` (35 tests), with `03`/`12` adapted to the onboarded-voter rule;
  - E2E `pricing.spec.ts` (6 tests);
  - `journey`, `community` and `screens` updated for the wizard, the composer and Explorer;
  - 2 new unit tests (`formatMemberSince`).
- **Expo Go gear:** this is Expo Go's own developer tools button, so app code cannot hide it.
  It is documented in the launcher output and in `TEST_IPHONE_FR.md`.
- **Not verified:** nothing in this pass ran on a physical device (see `RELEASE_STATUS.md`,
  REF-*).

### Visual pass from the owner's UI references (code `507f7ff`)
The owner shared two references, a travel app and a banking app, after the refinement. They
are adapted to Atlantic Sand, not copied.
- **Tab bar:** a floating white pill (the active tab is a mint-soft pill with its label, the
  others are icons with French accessibility labels) plus a separate round ink « Publier »
  button.
- **Headers and search:** a round white bell (`IconButton variant="surface"`, badge outside the
  circle) and a pill-shaped white `SearchBar`.
- **Explorer:**
  - a location pill beside the title;
  - a white segmented control;
  - 4-column icon tiles (`lib/categoryIcons.ts`, short labels, full names as accessibility
    labels) collapsed to « Tous » + 3, with « Voir tout » / « Réduire »;
  - quiet section headers (« Nouveautés » / « Résultats »).
- **Cards and prices:**
  - `ListingCard` is a white card with an inset photo, then the title, a pin + location line,
    the price and the DÉMO seller.
  - `PriceLabel` shows strong digits and a quiet « F CFA » / « · à discuter » in the app
    (cards, product, posts, boutique preview). The web `PriceText` does the same.
- **Product page:** details in a grouped rounded list with mint icon bubbles.
- **Forms:** `OptionRow` without hints becomes a segmented control. Fields get rounder corners
  and keep `borderStrong` for contrast. The web focus ring inside fields is removed via
  `outlineStyle: 'none'`; `outlineWidth: 0` was not enough in Chromium.
- **Tokens:** `typeScale.title` weight 800 → 700.
- **Tests:** the screens spec checks Explorer by the « Toutes les catégories » tile.

### Optional boutique identity (owner commit `cb21596`, follow-up `133ff3d`)
The owner added `20261106000100_optional_boutique_identity.sql`: `profiles.boutique_name` and
`profiles.boutique_category_slug`, plus a check that opting into the merchant identity
(`is_merchant`, « Vendeur ») requires both. CI went red: `05` set `is_merchant` without them,
and `review_verification_request` forced `is_merchant = true` on approval. Fixes, keeping the
owner's rule unchanged:
- **`20261105000200_merchant_identity_prepare.sql`** (runs before the owner's migration):
  - On a database that already has merchants (the local DÉMO data), the owner's `add
    constraint` failed and blocked `pnpm preview:*`.
  - Those members' « Vendeur » opt-in is cleared; no name or category is invented. Fresh
    databases are unaffected.
  - The launcher now runs `supabase migration up --include-all`, so this earlier-dated step
    still applies where the owner's migration already ran.
- **`20261106000200_boutique_identity_followup.sql`:**
  - column grants so members can set the two fields;
  - `review_verification_request` fills an empty boutique name with the verified business name
    and sets `is_merchant` only when a category is chosen. The badge is granted either way.
- **App:** onboarding and « Modifier le profil » show « Nom de la boutique » and « Catégorie
  principale » under « Je vends régulièrement ». The step or save is blocked until both are
  valid. Casual sellers never see the fields.
- **Shared:** French copy for `profiles_boutique_identity_required` and
  `profiles_boutique_name_length`.
- **Seed:** DÉMO merchants get a boutique name and a category.
- **Tests:**
  - integration `14-boutique-identity` (7 tests): casual listing, opt-in rules, name length,
    category FK, owner-only writes, public read, verification approval with and without a
    category;
  - `05` and `08` adapted;
  - 1 unit test.

### Lovable native parity pass (branch `feature/lovable-native-parity-20261104`, draft PR #2)

Visual authority: `zayd95/galsen-visual-playground@806a26f` (`src/lab/LabApp.tsx`,
`LabPages.tsx`, `index.css`, `docs/LOVABLE_PARITY.md`), rendered locally with its own Vite
build for reference screenshots. Functional authority: this repository. No Lovable browser
code, CSS, DOM, `live/backend.ts` or Supabase client was copied; every screen keeps its native
queries, RPCs, RLS and storage. Nothing was merged across repositories.

| Commit | Change |
|---|---|
| `e85f046` | **Baseline regression fixed:** the E2E `signUp` helper still drove the removed 3-step onboarding. Bridge onboarding no longer overwrites `is_merchant`/boutique/interests and picks the city from the shared list. `suggestHandle()` and Senegal-only `toSenegalE164()` (+ unit tests); welcome screen shows SMS (+221) as visibly gated |
| `92ef3aa` | Foundation: Fraunces + Hanken Grotesk (Inter removed), `dark` token group, serif wordmark with gold stop, glass `IconButton`, `<Motif />`, dark Skeleton/EmptyState/ErrorState/DemoBadge, `useDarkStatusBar()`, floating dock + `useDockSpace()` |
| `0bcf6d2` | Dark Home, PostCard, StoryRail, VoteControl, PriceLabel (Lovable PriceLine), dark post detail and saved posts |
| `95a2689` | Near-white Explorer (night intro, tiles, pills, lead card), ListingCard, image-led product page with sticky glass CTA |
| `029e8e2` | Compact dark profile (cover, avatar, bio, ≤ 3 interests, two tabs, « Plus d'infos », review/live sheets); business-interest editor (≤ 5) in edit-profile |
| `69e68ba` | Publishing: direct Publication · Article · Statut switcher (`/publish` redirects), one-scroll article form, reported feed-share failure, honest Live entry |
| `2717212` | Dark inbox (local search) and chat thread |
| `86e891b` | Glass action sheets (`Sheet tone="dark"`), onboarding typography |
| `0b1f547` | `app.json` cream → `#FAFBFA`; E2E opens products through the Boutique tab |

Defects found and fixed during the pass:
- E2E onboarding helper broken by the bridge (see `e85f046`).
- Bridge onboarding could wipe a returning member's boutique identity and interests.
- Phone OTP accepted any international number; now +221 only.
- A failed « Partager aussi dans mon fil » was silently swallowed after publishing an article.
- Compact prices rendered « 28 000 F CFA F » (NBSP before « F CFA » not matched).
- `app.json` still used the retired cream canvas.
- Metro had been started with `CI=1` (no reload) during the first check; restarted.

Verification on the final code (local Supabase CLI stack, `supabase db reset` + `pnpm seed`):
see « Commands that were run » below and `docs/RELEASE_STATUS.md` › « Lovable native parity ».
Screenshots and the side-by-side comparison: `docs/evidence/lovable-parity/` (README lists the
deliberate differences from the reference).

### Microcopy cleanup and mobile polish (owner iPhone feedback, Nov 6)

The owner tested the Lovable port on an iPhone in Expo Go and approved the direction, asking for
fewer explanatory subtexts. Copy-only and layout-polish changes in the existing screens: no new
screen, dependency or schema change. Full inventory (removed / shortened / preserved) and
before/after renders at 360×640, 390×844 and 412×915: `docs/evidence/microcopy-pass/`.

- Onboarding: two filler lines and the header filler removed; « Disponible » only once the
  server confirmed the handle; GPS note → « Ville choisie par vous, sans GPS. »; « Se déconnecter »
  moved to the header so the fixed footer is one CTA (≈ 88 pt instead of ≈ 175 pt); single-line
  checkboxes centred in their 44-pt target; interactive keyboard dismissal.
- Accueil, Explorer, Messages, Publication, Article, Statut, Profile, product, edit profile,
  boutique details, highlight sheet: redundant subtexts removed or shortened.
- Kept: payment and no-funds terms, chat safety card, barter/offer guidance, privacy and consent
  notes, validation/errors/toasts, accessibility labels.
- Touch targets: 40-pt pills get 48-pt hit areas; small profile links get larger ones.

### P1 — private pilot readiness (Nov 7)

Goal: make the approved native app a private-pilot candidate for a small group of real
sellers and buyers in Dakar, without changing the visual direction or adding product scope.
Full report: `docs/P1_READINESS_REPORT.md`; decision sheet: `docs/GO_NO_GO.md`.

Defects reproduced, then fixed (each with a test that failed first):
- E2E runs broke with time: the DÉMO statuses are 24-hour statuses created at seed time
  (`5b7a635`: seed refreshes them relative to now; E2E global setup runs it).
- A double-tapped offer raised the unique-index error, shown as a misleading French message;
  the offer screen and offer card now ignore a second tap in flight (`2ff8b90`).
- « Mot de passe oublié » sent a link to `jefeli://reset-password`, a route that did not exist:
  « Unmatched Route », no way to set a new password (`d6dd671`: `reset-password` screen, per-runtime
  redirect URL, form only for a session opened by that recovery link).
- A first-time DÉMO seed failed half-way (Awa's status was tied to Baol's listing) (`6022568`).

New tests: integration `15-adversarial` (18: races, stale/expired offers, immutable terms, blocks
after an agreement, deleted/private content, storage limits, forged tokens); E2E `resilience` (6),
`account-recovery` (3), `email-confirmation` (1, gated). The suites also ran on a database with no
DÉMO data, with a moderator granted by SQL. Screenshot numbering is now per evidence folder.

Not changed on purpose: no error boundary (a release build turns an uncaught error into a crash
that TestFlight/Play report; a boundary without a reporting service would hide it), no in-app
support link (owner's channel is not chosen), `eas.json` (its defaults were checked in the EAS CLI
source and already fit).

### W1.1 — media-first commerce (branch `feature/w1.1-media-first`, 7 Nov)

Report and provider decision: `docs/W1_1_MEDIA.md`.
- `aa2a40e` Live removed from the visible product (screens redirect while the flag is off; no
  data touched).
- `dda7b4b` Playback driven by the video: one muted video at a time in Accueil, paused off-screen,
  away and in the background, no autoplay with Save-Data/2G/reduced motion; status progress and
  advance follow the video instead of a 5.5 s timer.
- `446f304` Migration `20261109000100_media_videos.sql`: 180 s everywhere, kind/MIME match,
  upload quota (300 / 24 h, 2 GB), `list_orphaned_media` + `cleanup-media` Edge Function; web
  duration probe and cover capture.

Defects found while writing the browser test, then fixed: a video post's play button sat in a
disabled button, announced as dimmed (the test failed on it); on the web a `<video>` was drawn at
its pixel size in the top-left corner (seen in the evidence screenshots; the test now checks the
rendered width). Found by reading the code on the way: expo-image-picker returns web durations in
seconds, so an undecodable 10-minute file passed as 0.6 s; a clip at the 3-minute cap (180.03 s)
would have been refused by the server. Environment note: Metro started with `CI=1` does not watch files, which
served a stale bundle for two runs; dev servers are now started without it.

### W1.2 — smart create & connected media (branch `feature/w1.2-smart-create`, 7 Nov)

Design (audit first, then changes to the brief) and verification: `docs/W1_2_SMART_CREATE.md`.

| Commit | What |
|---|---|
| `87fc5e5` | Audit and optimized design |
| `3df6f02` | Server: voice in posts (narration cues, language, waveform), never with video; voice-message checks and article context; statuses by reference (`share_to_status`) |
| `ea3efef` | One playback slot; voice player; reusable recorder; draft files kept across a browser refresh |
| `283a4cf` | Smart + menu; composable publication; feed voice card and narration bar |
| `93ad91c` | Chat voice with preview; article context in conversations |
| `f2cac3f` | Voice statuses; « Partager en statut »; « Présenter cet article » |
| `26fdc2f` | Web share pages play voice publications |

Defects found on the way:
- Pre-existing:
  - A web draft restored after a refresh held dead `blob:` URLs.
  - A restored video would have uploaded `{}` as its poster.
  - Chat voice notes were labelled `audio/webm` even when Safari recorded MP4.
  - Chat voice notes played over feed videos.
- In W1.2's own first version:
  - On the web, `PixelRatio.getFontScale()` (the device pixel ratio) and react-native-web's
    always-true screen-reader answer forced the sheet menu on every phone.
  - A `bottom: undefined` override stretched the article chip on the web.

Test environment:
- Playwright's headless shell has no `getUserMedia`; `smart-create` runs on the full Chromium
  build with a fake microphone.

### W1.3 — créer, c’est montrer (branch `feature/w1.3-create`, 8 Nov)

Approved design canvas with the owner's corrections; decisions and verification:
`docs/W1_3_CREATE.md`. Staging: `docs/STAGING_MIGRATION_PLAN.md` (applied 11 Nov, below).

| Commit | What |
|---|---|
| `c189ef7` | Server: an article's voice in `product_media` (one audio row, never with video, cues → photos); 3 integration tests |
| `fe502c1` | Schema contract + check before every Vercel build and in CI |
| `bb9fb5f` | Staging plan, baseline counts, rollback scripts captured read-only from staging and dry-run locally |
| `3266484` | `describeFailure()`; feed error screen with Réessayer, Explorer / Se reconnecter and copyable diagnostics; refresh banner; no retry when it can't help |
| `18903b2` | Three-card + menu; explicit drafts (badge, Continuer, Nouvelle with confirmation, editor gate); W1.2 drafts adopted |
| `8dc98df` | Adaptive Publication editor; `PostMedia` shared by the feed card and the editor; full-screen studio; reorderable gallery with cues remapped |
| `c45f1a8` | Article shop window; « Présenter en voix »; article page and public web page play it |
| `50e7de8` | Full-screen Statut editor; shared narrated publications play in statuses |

Defects found on the way:
- Pre-existing:
  - Feed queries were retried three times on errors retrying can't fix (missing column, expired
    session), delaying the error screen by several seconds.
  - Removing a middle photo kept narration cues pointing past the end or to the wrong photo.
  - An article draft restored after a browser refresh held dead `blob:` URLs (now kept like
    publication drafts).
  - The public web article page would have shown an article's voice as a broken photo.
- In W1.3's own first version:
  - Status photos labelled through expo-image were exposed as `alt` only; the viewer's photo now
    has an image role and label of its own.

### Staging sync and hosted acceptance (11 Nov, owner-approved)

Go/no-go: `docs/WEB_BETA_GO_NO_GO.md`. Staging: `docs/STAGING_MIGRATION_PLAN.md`.

| Commit | What |
|---|---|
| `c3b5c46` | jefeli-staging: identity and history checked, verified logical backup handed to the owner, baseline counts, migrations reviewed; 6/6 applied in order through the official migrations endpoint; counts unchanged after each; schema fingerprint identical to local; schema check ✓; 33/33 anonymous security probes |
| `46a2932` | Hosted acceptance suite (`tests/e2e/specs/hosted.spec.ts`, `playwright.hosted.config.ts`, run only on demand against a preview); sign-up errors Supabase rejects now have a precise message; failed-publish banner no longer says « brouillon » twice nor adds a toast |

Hosted run on the `46a2932` previews: H-00 → H-07 passed in Chromium; H-08 (public web page)
checked through Vercel's authenticated fetch because the preview protection refused the browser
cookie. Findings that need the owner: account e-mail configuration (Site URL `localhost:3000`,
built-in sender), no Edge Function deployed (`delete-account`), voices recorded in Chrome are
WebM/Opus (Safari untested), preview links point to the W1 aliases, `private.upload_quota_ok()`
executable by PUBLIC, DÉMO test accounts left on staging.

### W1.4 — phone sign-up and sign-in (branch `feature/w1.4-phone-auth`, 11 Nov)

Owner requirement: phone registration and login next to e-mail, as a launch criterion.
Provider report first (`docs/PHONE_AUTH.md`, sent to the owner); nothing paid enabled.

| Commit | What |
|---|---|
| `b6cb3f9` | Server: `send-sms` Edge Function as the Supabase Send SMS hook. It verifies the Standard Webhooks signature, allows only Senegal mobile ranges, applies caps per number, IP and day plus a daily budget, has a kill switch (`phone_auth`) and retry idempotency, and uses Orange or Twilio adapters (no success without a provider). Also: `private.sms_events`/`sms_settings`, `sms_hook_begin`/`finish` (service role only), `admin_sms_usage()`, local test sink, 15 integration tests. |
| `61759f4` | App: « E-mail \| Téléphone » on sign-up and sign-in; shared `PhoneOtpForm`; country picker; precise errors; resend countdown; recovery after reload; « E-mail et numéro de mobile » in Réglages (`phone_change`); Turnstile when configured. Also: French copy, E2E PH-01 → PH-06, SMS block in pilot metrics. |

Verified on the local auth server (GoTrue v2.197.0) rather than from memory:
- hook payload (`sms.phone`, `sms.otp`, `metadata.ip_address`) and signature headers;
- refusals must be HTTP 200 with `{error:{http_code,message}}`: a 4xx becomes « Invalid
  payload » and a 5xx « Unexpected status »;
- the hook runs inside the transaction that creates the user, so `sms_events.user_id` has no
  foreign key; a trigger clears it on account deletion;
- the CLI enables phone auth only when a built-in provider is « enabled », hence placeholders that
  the hook replaces.

Defects found on the way, in W1.4's own first version:
- A foreign key from the log to `auth.users` blocked behind the uncommitted new user. The hook
  timed out and the auth server answered « Service currently unavailable due to hook ».
- Typing the 6th digit verified inside the hook without calling the settings screen's success
  callback. The number was attached but the screen stayed on the code step.
- `toSenegalE164` accepted fixed lines (33), which cannot receive an SMS; they are now refused
  with a precise message.

## Commands that were run (latest results)

| Command | Result |
|---|---|
| `pnpm check` (typecheck all, lint mobile + web, unit tests) | pass, 32 unit tests (W1.4); 28 (W1.3); 25 (W1.2); 24 (W1.1); 23 on `3c02230` (P1) |
| `pnpm test:integration` (with `.env.test` functions) | 312/312 (W1.4, adds `19-phone-auth`, clean database); 297/297 (W1.3, article voice); 294/294 (W1.2, adds `18-connected-media`); 280/280 (W1.1); 259/259 on `3c02230`, also on a database with no DÉMO data |
| `pnpm test:e2e` (journey 11, community 5, pricing 6, resilience 6, account-recovery 3, media 5, screens 3 sizes, email-confirmation gated) | W1.4: 55 passed + 10 skipped, then phone 6/6 after a stale test text was fixed; 53 passed, 1 skipped (W1.3, adds `create` 9, `smart-create` now 4; four specs re-run after mid-run edits); 46 passed, 1 skipped (W1.2, adds `smart-create` 8); 39 passed, 1 skipped (W1.1, Expo web dev server); 34 + 1 on `3c02230`; journeys 31/31 with `E2E_SEED=0` on an empty database; email-confirmation 1/1 with confirmations on |
| `npx expo export --platform ios --platform android` | pass: iOS 11 MB, Android 12 MB Hermes bundles (W1.3); ≈ 11 MB each on `3c02230` |
| `node scripts/schema-contract.mjs generate --verify` / `check` (local) | up to date; ✓ 45 tables, 53 functions (W1.3) |
| `playwright test -c playwright.hosted.config.ts` (previews `46a2932` + jefeli-staging) | 8 passed (H-00 → H-07); H-08 verified by authenticated fetch (preview protection refused the browser) |
| `scripts/check-pilot-metrics.sh` | 12/12 read-only query blocks (P1) |
| `pnpm --filter @jefeli/web typecheck` / `lint` | pass |
| `pnpm --filter @jefeli/web build` (`next build`) | pass |
| `npx expo prebuild --no-install` | pass (output gitignored) |
| `npx expo-doctor` | 18/20 (2 need blocked network) |

### W1.4 desktop web — branch `feature/w1.4-desktop-web` (12 Nov)

The approved design canvas was implemented with the owner's ten refinements (`docs/W1_4_DESKTOP.md`).

- **Layout rule** (`lib/layout.ts`): phone below 768 px or native; compact 768–1099; wide ≥ 1100.
  The phone path is untouched.
- **New components:** `DesktopShell` (sidebar of real links, « Créer » → the same menu) and
  `DiscoveryRail` (buyer requests, articles linked in the feed, nearby articles and their
  boutiques; empty sections hidden; verified badge only for `merchant_verified`). Also
  `MessagesWorkspace`, `ConversationList` and `ChatView`, extracted from the routes so phone and
  desktop share them, and `ChatContext` (article, proposals with real status, safety).
- **Screens with a desktop layout:** Accueil (640 px feed + rail), Explorer grid (3–5 columns),
  article in two columns, boutique grid, Publication editor beside the exact `PostCard` preview,
  and a 9:16 status stage. Other screens use a 720 px column; auth uses a 520 px column.
- **Read-only helpers:** `fetchRecentRequests`, `fetchLatestConversationProductId`. No migration.
- **Defects found and fixed:**
  - the sign-up terms link swallowed clicks on wide rows;
  - sidebar items ignored Enter, so they are now `<a href>`;
  - category tiles stacked;
  - the status viewer was stretched.
- **Tests:** `tests/e2e/specs/desktop.spec.ts` DT-01…08. `helpers.homeReady` accepts the
  sidebar link.
- **Results:** check pass (unit 32/32), integration 312/312, E2E 67 passed + 10 skipped.
- **Evidence:** `docs/evidence/desktop/` (before, after, compare) and `docs/evidence/e2e/desktop/`.

### Brand — branch `feature/brand-logo` (12 Nov)

Owner-approved « Jëfëli. » logo, built from geometry in `brand/source/wordmark.py`:
- one stroke weight with round ends, and a shared x-height and ascender;
- optical overshoot on the round letters, and a thinner `e` crossbar;
- no third-party font or artwork.

The app icon is the « J. » from the same letters.

Assets regenerated from the masters:
- iOS 1024 px icon (opaque);
- Android adaptive layers: foreground with 0 px outside the 66 dp safe zone, night background,
  monochrome;
- favicon.png, web `icon.svg` and `favicon.ico` (16/32/48);
- apple-touch-icon;
- splash (night background, logo 200 pt);
- both social previews, with their existing slogans.

In the app: `BrandLogo` / `BrandMark` in `@/design` (react-native-svg). The desktop sidebar
shows the logo (wide) and « J. » (compact rail).

Unchanged: the phone header, welcome and onboarding screens keep the Fraunces wordmark.

Verification:
- `pnpm check` pass;
- desktop E2E DT-01/DT-02 pass;
- the web build serves `/icon.svg` and `/favicon.ico`;
- real-size acceptance sheet in `docs/evidence/brand/`.

### Design direction v2 « Dakar after dark » + white Explorer — branch `feature/design-direction-v2` (12 Nov)

Owner request: « upgrade the design to match the reference, don't change anything major », then
« Explorer page should remain white, that's our commercial page; add extra filtering, most trendy
things, who to follow ». Screens, flows and layouts are unchanged; only the visual direction moved.

- Tokens (`packages/shared/src/tokens.ts`): forest greens (`#061D18` page, `#0B2922` cards,
  `#12382F` active), Senegalese gold `#EFBD38` + `onPrimary` for active states and primary actions,
  mint `#7ED8BD` for discovery icons, red `#DB4A35` for counts and favourites, warm text
  `#F6F5ED`; new `light` set for the white Explorer. Fonts: DM Serif Display + DM Sans (mobile via
  `@expo-google-fonts`, web via `@fontsource`).
- Components: gold selected states (segments, chips, pills, checkboxes), gold buttons, floating
  dock with a raised gold « Publier », gold desktop « Créer », redesigned `ListingCard` (badge,
  real favourite heart through `product_saves`, seller, serif title, place · condition, price),
  `Eyebrow`, paper tones for the white page. Brand assets regenerated on the new night + gold.
- Explorer: white page with a dark intro band; « Filtres » sheet (price range, to buy / Wecci,
  sort); « Tendances cette semaine » and « Vendeurs à suivre » rows, real data only, hidden when
  empty or filtered.
- Migration `20261113000100_explore_discovery.sql`: `explore_products` (security invoker, browse
  visibility), `trending_products` and `suggested_sellers` (security definer, authenticated only,
  block / mute / private-account rules, public fields only). Integration
  `20-explore-discovery.test.ts` (9 tests). E2E `explore.spec.ts` (EX-01 sort + price range,
  EX-02 sellers to follow).
- Defects found in review and fixed: white cards rendered dark on Explorer (missing paper style),
  « À discuter » pill invisible on white, filter sheet slightly translucent over the white page.
- Evidence: `docs/evidence/design-v2/` (before/after sheets, after shots, `explore/`).
- Full-run defect: « + » menu side card 0.12 px past a 360-pt screen (SC-04); the fan now keeps 12 pt side margin.

#### Hosted validation of the Explorer (12–13 Nov, owner-approved)

Security review before staging: both SECURITY DEFINER functions return only rows the existing
`products_select` / `profiles_select` policies already allow (active and moderated articles, active
sellers, `can_view_profile_content` for private accounts, blocks both ways, mutes), plus 3 new
integration tests (moderated, sold, suspended, private). Then backup → migration → grants →
hosted probes 40/40 → previews rebuilt → hosted Explorer 16/16 → clean E2E 69/0/10. The preview
hosts of this branch were added to the session's network allowlist to run the hosted UI check.
Evidence: `docs/evidence/design-v2/hosted/`.

### P1 identity sprint — branch `feature/p1-identity` (14 Nov, draft PR #11)

Owner brief « Step P1: identity sprint and the four pillars » (Wecci, Waxaale, Boutique, Jëf).

- **Consolidation:** `git merge-base --is-ancestor` true for all 10 other branches into
  `feature/design-direction-v2`; « v1 baseline » PR prepared in `docs/V1_BASELINE_PR.md`, not opened.
- **Docs:** `PILLARS_AUDIT.md` (inventory, model mapping, 19 schema deltas, three journeys with tap
  counts, ranked frictions), `IDENTITY.md` (lexicon, tone, Jëf economy, market, rituals, signature
  moments, templates), `SPEC_PILLARS.md` (per-pillar specs, acceptance tests, estimates ≈ 80–125
  dev-days, business model with prices as hypotheses), `ANDROID_RELEASE.md` (config review, blockers,
  owner checklist, data-safety draft). Nothing submitted anywhere.
- **Prototype (a) Waxaale in chat:** `OfferCard` redesigned (gold WAXAALE band, amount with gap to
  the displayed price, steps Offre → Réponse → Accord → Échange fait, expiry bar). Voice offers:
  migration `20261114000100_waxaale_voice_offer.sql` (`attach_offer_voice`: proposer only, pending
  only, one note, own audio ≤ 180 s through the existing message checks), recorder in the offer
  screen, player inside the card (the note no longer shows as a separate bubble).
- **Prototype (b) « Marché conclu ! »:** `components/DealSealed.tsx` — scrim, gold seal with spring
  and rotation, 12-dot burst, serif title, success haptic and an original 0.7 s chime
  (`assets/sounds/deal-sealed.wav`, synthesised in-house), auto close 2.4 s, reduced-motion
  fallback. Shown on acceptance (OfferCard) and as « Échange fait ! » when the second party confirms
  (agreement screen).
- **Prototype (c) Explorer as a market:** launch aisles Téléphones (telephones + electronique) and
  Mode (5 categories) with real article / seller counts, small aisles for the rest, « Près de moi ·
  <quartier> » from the profile, and an empty aisle that invites « Publier « Je cherche » » (opens
  the composer on the seek intent). Migration `20261114000200_market_aisles.sql` (`explore_market`,
  `market_counts`, security invoker = Explorer visibility).
- **Defect found and fixed:** a second chat screen for the same conversation (counter-offer →
  `router.replace`) reused the open Supabase channel and crashed (« cannot add postgres_changes
  callbacks … after subscribe() »). Each subscriber now gets its own channel topic (`lib/realtime.ts`).
- **Tests:** integration `21-waxaale-voice-offer` (3); E2E `identity.spec.ts` (PI-01 aisles + « Je
  cherche », PI-02 voice offer → « Marché conclu ») ; selectors updated for the new labels.
- **Evidence:** `docs/evidence/p1-identity/` (before / after at 390, 360, 1440 px; deal moment at
  650 and 1100 ms). Local DÉMO data only (a generated tone stands in for Fatou's voice note).
- Migrations are **local only**; staging unchanged; PR #11 previews stay red on the schema check
  until the owner's go.
- **Verification:** clean local database: check pass, integration 327/327, E2E 72 passed / 0 failed / 10 skipped.

#### P1 addendum — one visual system (owner, 14 Nov; done 15 Nov)

- **Theme:** one dark canvas everywhere (`#061D18`, surfaces `#0B2922` / `#12382F`). Reverses the
  12 Nov white Explorer: Explorer, article, forms, settings, web share pages, admin and desktop are
  dark. The `light` token set and every « paper » variant (ListingCard, PriceLabel, DemoBadge,
  Skeleton, EmptyState) are removed.
- **Three accents:** gold = action, active states, Waxaale, Jëf; mint (`colors.wecci`) = Wecci and
  discovery tags only (Wecci badge and chip, feed eyebrows, Accueil chips, aisle icons, profile
  interests); red = unread badges (Messages list now red), favourites, errors, live. Own chat
  bubbles moved from mint to the raised surface. Errors are ink text with a red border or icon
  (red text is 4.2:1, below AA).
- **Colour inventory → tokens:** 21 hex + 32 `rgba()` values in app code, 12 in web CSS/TSX, all
  replaced by tokens (new `media*`, `dangerPressed`, `wecci*`, `logoMint`, `black`, `white`).
  Config files (`app.json`, `index.html`, `icon.svg`, `apps/web/scripts`) now hold palette values
  only. Guard: `packages/shared/test/no-raw-colors.test.ts` (fails on any new hex / rgba; checked
  with a probe file). Contrast: `packages/shared/test/contrast.test.ts` (19 WCAG AA pairs, pass).
- **Type:** Nunito only (mobile `@expo-google-fonts/nunito` 400/600/700/800/900, web
  `@fontsource-variable/nunito`); DM Sans and DM Serif Display removed; headings 800/900 (the
  `serif` prop now renders Nunito ExtraBold), eyebrows 800 tracked +1, labels 600/700, body 400.
  Accents checked in every weight from the shipped TTFs.
- **Shape:** cards 20, buttons / chips / tags pill, sheets 25, shadows removed.
- **Order note:** the brief asked for this pass before the task-5 prototypes; they were already
  committed (59f172b, c4c9d30), so the pass was applied on top of them on the same branch (no
  history rewrite). The prototypes follow the new system (Waxaale band gold, Wecci badge mint).
- **Verification (clean local database):** `pnpm check` pass (54 unit tests incl. the colour guard
  and contrast), integration 327/327, E2E 72 passed / 0 failed / 10 skipped.
- **Evidence:** `docs/evidence/p1-identity/consistency/` (10 screens × 390 / 1440 px, before / after,
  plus `nunito-accents-400-900.png`).

### Pilot cut a–h — branch `feature/pilot-cut` (15 Nov, draft PR #13, base `feature/p1-identity`)
- **a** Share pages on the free Vercel production URL (jefeli-web, from `main`): anonymous 200 with OG tags (`docs/evidence/pilot-cut/a-share-page-production.md`). jefeli-app production stays behind Vercel protection (owner declined making it public).
- **b** `lib/returnTo.ts`: after sign-up / sign-in and onboarding the member returns to the article or offer they opened (allow-listed internal paths, 24 h). E2E PC-B1, PC-B2.
- **c** Migration `20261115000100` (local): accepting an offer reserves the item (both in a barter), closes competing offers (buyers told, `offer_closed`), « Remise » step (`set_agreement_handover`), completed → sold, cancelled → back on sale, every offer/agreement notification carries `conversation_id` (in-app + push deep link to the chat). Integration 22 (9 tests), E2E PC-C1.
- **d** « Faire une offre » / « Proposer un troc » on the public article page → `/offer/<id>`; Android App Links in `app.json` + `.well-known/assetlinks.json` written only from the real signing SHA-256 (`ANDROID_CERT_SHA256`). E2E PC-D1.
- **e** « Partage ta boutique » moment after the first listing; 9:16 WhatsApp status card (`apps/web/.../status-card`, next/og, Nunito OFL) shared via the share sheet / download. E2E PC-E1.
- **f** Wecci « Donner » (migrations `20261115000200/300`, price 0 only in this mode, no offer on a gift); swap mode renamed « Troquer ». Integration 23, E2E PC-F1.
- **g** « Jëf lite »: `member_level` (read-only levels from completed sales + swaps, no balance) and the 24 h « Nouveau » exposure of a first listing (migration `20261115000400`). Integration 24 (7 tests), E2E PC-G1.
- **h** EAS `pilot-internal` (AAB), `pilot-apk`, submit `internal` (draft); schema-validated; nothing built or submitted (`docs/ANDROID_RELEASE.md` § 0).
- All four migrations are **local only**; the Vercel previews of PR #13 stop at the staging schema check until the owner's go.

### Visual addendum, 15 Nov — canvas B, gold budget, CLAUDE.md
- **1a** Canvas `#0B1311` (owner picked variant B after the A/B/C test in `docs/evidence/p1-identity/canvas-test/`); new `palette.media` / `colors.mediaBackdrop` behind every photo container (app and web); green surfaces kept for headers, sheets, raised panels. Contrast re-run: 19/19 pass (red icons 4.5:1 on the new canvas).
- **1b** Gold budget (one filled gold element per screen): measured by `tests/e2e/specs/zz-gold-budget.spec.ts` on 31 app screens + 5 web pages at 390 px; 10 screens were over budget, 0 after. Fix list and before/after sheets: `docs/evidence/p1-identity/gold-budget/`.
- **3** `CLAUDE.md` and the authoritative top of `docs/DESIGN_SYSTEM.md` now describe the system (tokens only, Nunito, three accents, gold budget, neutral photo backdrops).

### Full regression after the visual addendum, 15 Nov
- `pnpm check` pass (54 unit tests), integration **347/347** on a clean DB, E2E full suite: **80 passed, 1 failed, 12 skipped** (hosted + ffmpeg/gated).
- The one failure, `desktop.spec.ts` DT-08, was a **stale test, not a product defect**: since migration `20261115000100` an accepted offer reserves the article (`products.status = 'reserved'`), so the test's « accept the price offer, then propose a swap on the same article » no longer has a swap button; and the context pane now says « Troquer · … » (was « Wecci (troc) · … »). The seller now refuses the price offer in that test and the pane assertion follows the new label. `desktop.spec.ts` re-run: 8/8 pass. The rest of the suite was not re-run after this test-only change.

### Pilot-cut migrations on staging, 15 Nov (owner go)
Verified backup → pre-check → `20261115000100…400` applied in order (history 25 → 29, counts unchanged) → schema identical to local (1 188 objects) →
deploy check `✓ 45 tables, 64 functions` → hosted probes 49/49 (`scripts/staging-security-probe.py`). Details: `docs/STAGING_MIGRATION_PLAN.md`.

## Merge of the pilot cut (15 Nov 2026)

Staging migrations, 49/49 hosted probes, full E2E 81/0/12 (3 runs), public share pages without
login wall: all green. PR #13 retargeted from `feature/p1-identity` to `main` (it contains PR #11)
and merged with a merge commit; tag `v0.9.1-pilot` requested (the session git proxy may refuse tag
pushes — see NEXT_ACTIONS).

## 16 Nov 2026 — P2: Studio, Statuts → Reels, barre d'onglets, actions en icônes (`feature/p2-studio`, non fusionné)

Détail fonctionnel et liste des boutons convertis : `docs/P2_STUDIO.md`. Schéma : migration **locale**
`20261116000100_studio_reels.sql` (non appliquée à staging, voir `docs/STAGING_MIGRATION_PLAN.md`).
- `pnpm check` : vert (shared 71 tests dont dock 7 et Studio 11). Intégration : 359/359 (nouveau fichier
  `25-studio-reels.test.ts` : surfaces, `get_reels`, seuil et notification « Le garder en Reel ? », ordre du rail).
- E2E (Playwright, caméra factice) : nouveaux `p2-tabbar`, `p2-actions`, `p2-studio` (9), `p2-status-reels` (3),
  `p2-studio-narration` (6) ; `create.spec` et `smart-create.spec` (anciens menu/éditeurs) remplacés ; les autres
  specs migrés vers le Studio. Résultat final (suite complète, 3e exécution) : **92 passés, 0 échec, 16 ignorés** (specs hébergés ou conditionnés).
- Constats en route : `expo-camera` n'enregistre pas la vidéo sur le web → enregistrement `MediaRecorder` (webm) ;
  le serveur refuse une voix sur une vidéo (`audio_with_video`) → pas de narration sur vidéo ; les zones de tape du
  statut n'avaient pas de rôle `button` (corrigé) ; le compte à rebours d'un statut attend désormais le chargement de
  son article ; la fin d'un statut affiche la carte « Voir les Reels » au lieu de fermer.

## 17 nov. 2026 — aperçu famille (`jefeli.vercel.app`, staging)

- Inscription par e-mail : fonctionne de bout en bout, mais **quota intégré de 2 e-mails/heure pour tout le projet**
  (pas de SMTP) ; liste de redirections complétée avec `https://jefeli.vercel.app/**`. Deux comptes de test confirmés
  créés (identifiants dans le rapport au propriétaire, jamais dans le dépôt). Détail : `docs/FAMILY_PREVIEW.md`.
- `scripts/demo-showcase.ts` (+ `--remove`, `--status`) : 8 boutiques DÉMO, 40 articles, 10 statuts, 6 Reels, 5
  « Je cherche ». Aucune statistique inventée. Retrait vérifié sur staging (comptes, lignes et fichiers identiques à l'état d'avant).
- Parcours 390 px sur l'aperçu réel : `tests/e2e/specs/family-journey.spec.ts` (vert, nettoyage inclus), captures dans
  `docs/evidence/e2e/family/`.
