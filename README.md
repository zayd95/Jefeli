# Jëfëli

**Découvre. Partage. Vends.** Le réseau social du commerce sénégalais.

Jëfëli is a social-first marketplace for Senegal. Members have social profiles with
posts, 24-hour statuses (statuts), lives, and a **boutique that builds itself from their
listings**. Discovery is local (Dakar first). Sales happen through private chat: messages,
price offers and **troc** (barter) with an optional cash difference. Jëfëli never holds
money and does not own stock.

> Pilot build, not yet launched. The brand name, domain and legal texts are still being
> cleared. Demo content is labelled **DÉMO**. Read [`docs/RELEASE_STATUS.md`](docs/RELEASE_STATUS.md)
> for what is tested and what is blocked.

## Repository

```text
apps/mobile/          Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript (iOS, Android, web preview)
apps/web/             Next.js 16 · public share pages (/handle, /p/id, /post/id, /live/id) + /admin moderation console
packages/shared/      Atlantic Sand tokens, XOF/date formatting, French labels, error mapping, DB types
supabase/migrations/  Postgres schema, RLS, RPCs, storage policies, cron jobs (10 migrations)
supabase/functions/   Edge Functions: live, live-webhook, push-dispatch, delete-account, cleanup-stories
tests/integration/    162 Vitest security/integration tests against a local Supabase stack
tests/e2e/            Playwright: two-account journey through the real UI + screen tour at 3 phone sizes
scripts/              seed-demo.mjs (DÉMO data), brand-assets.mjs (icons), compress-evidence.mjs
docs/                 spec package, implementation log, release status, runbooks, owner test script
reference/            Atlantic Sand visual reference (design benchmark, not app code)
```

## Prerequisites

- Node.js 22+ and pnpm 10 (`corepack enable`)
- Docker (for the local Supabase stack)
- Supabase CLI 2.x (installed as a dev dependency: `pnpm exec supabase …`)
- For a phone: the **Expo Go** app (most features), or an EAS development build (needed for live video and push)

## First launch (local)

```bash
pnpm install
pnpm exec supabase start              # Postgres, Auth, Storage, Realtime, Edge runtime; applies migrations
pnpm exec supabase functions serve --env-file supabase/functions/.env   # in a second terminal (see below)
pnpm seed                             # optional: DÉMO accounts + content (local/staging only)
cp apps/mobile/.env.example apps/mobile/.env   # then set the URL/key printed by `supabase start`
cp apps/web/.env.example apps/web/.env.local
pnpm mobile:web                       # app in the browser at http://localhost:8081
pnpm web                              # share pages + admin at http://localhost:3000
```

Create `supabase/functions/.env` (it is gitignored) containing
`PUSH_WEBHOOK_SECRET=<any random string>`. Live video stays **disabled** until
`STREAM_API_KEY` / `STREAM_API_SECRET` are added (see [`docs/SETUP_PRODUCTION.md`](docs/SETUP_PRODUCTION.md)).

Demo accounts (password `Demo-jefeli-2026!`, local/staging only): `awa@demo.jefeli.test`,
`baol@demo.jefeli.test`, `moussa@demo.jefeli.test`, `fatou@demo.jefeli.test`, and
`admin@demo.jefeli.test` for the admin console at `/admin`.

### On your phone's browser (fastest, one command)

```bash
pnpm install
pnpm preview:lan          # or: pnpm preview:lan --ip 192.168.1.20
```

This starts the local Supabase API (Studio, mailpit and postgres-meta stay off), the Edge
Functions and the DÉMO seed. It also builds the app and the share pages + moderation console
against `http://<your-computer-IP>:54321`, so the phone reaches the API instead of its own
localhost. Docker must be running. Then, on the iPhone (same Wi-Fi), open the printed
`http://<IP>:8081` in Safari. Add `--dev` for the Metro dev server with live reload, or
`--reset-demo` to recreate the demo content. Use a private network (home Wi-Fi or your phone's
hotspot), because the local stack uses well-known development keys. On macOS, allow incoming
connections for Node and Docker if prompted.

### On your phone (Expo Go)

1. Your phone and computer must be on the same Wi-Fi. In `apps/mobile/.env`, set
   `EXPO_PUBLIC_SUPABASE_URL=http://<your-computer-LAN-IP>:54321`. Do the same for `EXPO_PUBLIC_WEB_BASE_URL`.
2. `pnpm mobile`, then scan the QR code with the iPhone Camera app (or the Expo Go app on Android).
3. Expo Go cannot run live video or push notifications. Those need an EAS development build
   (`cd apps/mobile && npx eas-cli build --profile development`, which requires an Expo account and an
   Apple Developer account for iPhone).

Against a hosted Supabase project, use that project's URL and publishable key instead. The
step-by-step guide is in [`docs/SETUP_PRODUCTION.md`](docs/SETUP_PRODUCTION.md).

## Quality checks

```bash
pnpm check              # typecheck (all packages) + lint (mobile, web) + unit tests
pnpm test:integration   # 162 RLS/RPC/storage/realtime/edge-function tests (needs local stack + functions served
                        #   with supabase/functions/.env.test for the provider tests)
pnpm test:e2e           # Playwright journeys (needs :8081 Expo web, :3000 web app, demo seed)
```

CI (`.github/workflows/ci.yml`) runs the checks, the web build and the integration suite
against a fresh local Supabase on every pull request.

## Security model (summary)

- RLS is enabled on every table. Writes go through column-level grants or SECURITY DEFINER
  RPCs that check identity and ownership. Helpers live in a non-exposed `private` schema.
- Private media (statuses, non-public posts, DM attachments) sits in a private bucket. Signed
  URLs are issued only when RLS allows. Objects are immutable, so reported evidence cannot be swapped.
- Blocks, private accounts, 24-hour status expiry (enforced when read) and moderation states
  are enforced in the database, not only in the UI.
- Live-provider secrets stay server-side. Clients get short-lived user tokens, and webhooks are
  verified with HMAC.
- No service-role key ever ships in an app. `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` hold only
  non-secret values.

See [`tests/integration/README.md`](tests/integration/README.md) for the full test matrix.

## Documentation

- [`docs/RELEASE_STATUS.md`](docs/RELEASE_STATUS.md): acceptance matrix with evidence, blockers, costs, owner actions
- [`docs/IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md): what was built, how it was verified, commit SHAs
- [`docs/NEXT_ACTIONS.md`](docs/NEXT_ACTIONS.md): prioritised next steps and resume instructions
- [`docs/SETUP_PRODUCTION.md`](docs/SETUP_PRODUCTION.md): hosted Supabase, secrets, functions, EAS builds, web deploy
- [`docs/TEST_IPHONE_FR.md`](docs/TEST_IPHONE_FR.md): owner test script in French
- Product/design/architecture specs: `docs/PRODUCT_SPEC.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`
