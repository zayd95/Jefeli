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

## Commands that were run (latest results)

| Command | Result |
|---|---|
| `pnpm check` (typecheck all, lint mobile + web, unit tests) | pass |
| `pnpm test:integration` (with `.env.test` functions) | 162/162 |
| `pnpm test:e2e journey` | 11/11 |
| `pnpm test:e2e screens` | 3/3 sizes |
| `pnpm --filter @jefeli/web build` | pass (web workstream) |
| `npx expo prebuild --no-install` | pass (output gitignored) |
| `npx expo-doctor` | 18/20 (2 need blocked network) |
