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

## Commands that were run (latest results)

| Command | Result |
|---|---|
| `pnpm check` (typecheck all, lint mobile + web, unit tests) | pass |
| `pnpm test:integration` (with `.env.test` functions) | 196/196 |
| `pnpm test:e2e journey` | 11/11 |
| `pnpm test:e2e community` | 5/5 |
| `pnpm test:e2e screens` | 3/3 sizes |
| `pnpm --filter @jefeli/web build` | pass (web workstream) |
| `npx expo prebuild --no-install` | pass (output gitignored) |
| `npx expo-doctor` | 18/20 (2 need blocked network) |
