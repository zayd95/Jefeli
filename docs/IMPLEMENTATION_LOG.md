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

## Commands that were run (latest results)

| Command | Result |
|---|---|
| `pnpm check` (typecheck all, lint mobile + web, unit tests) | pass, 24 unit tests (W1.1); 23 on `3c02230` (P1) |
| `pnpm test:integration` (with `.env.test` functions) | 280/280 (W1.1, adds `17-media-videos`); 259/259 on `3c02230`, also on a database with no DÉMO data |
| `pnpm test:e2e` (journey 11, community 5, pricing 6, resilience 6, account-recovery 3, media 5, screens 3 sizes, email-confirmation gated) | 39 passed, 1 skipped (W1.1, Expo web dev server); 34 + 1 on `3c02230`; journeys 31/31 with `E2E_SEED=0` on an empty database; email-confirmation 1/1 with confirmations on |
| `npx expo export --platform ios --platform android` | pass: iOS and Android Hermes bundles (≈ 11 MB each) (on `3c02230`) |
| `scripts/check-pilot-metrics.sh` | 12/12 read-only query blocks (P1) |
| `pnpm --filter @jefeli/web typecheck` / `lint` | pass |
| `pnpm --filter @jefeli/web build` (`next build`) | pass |
| `npx expo prebuild --no-install` | pass (output gitignored) |
| `npx expo-doctor` | 18/20 (2 need blocked network) |
