# Jëfëli — persistent agent rules

This file is the operating contract for coding agents working on Jëfëli. Read `PASTE_INTO_CLAUDE_CODE.md` first for the full end-to-end mandate and all referenced `docs/` files. No mock-only deliverables; build functional vertical slices and verify them.

- Keep Jëfëli social-first; storefront is auto-generated from listings within a social profile.
- Use exact brand typography `Jëfëli` in UI and `jefeli` in technical identifiers. Accent `#A3E4D7`, ink `#10252C`, canvas `#F6F5F1`, slate `#607071`, surface `#FFFFFF`.
- Use Expo + Expo Router + TypeScript, Supabase/Postgres/Auth/Storage/Realtime, and development builds as needed. Check versions against current docs; do not assume historical SDK versions.
- Ship coherent working functionality with real auth/data, not pretty static screens. Mark all seeded users, listings and statistics as DEMO in test environments. Never invent live viewers, verification, payments or test results.
- Secure by default: RLS, ownership validation, per-user blocking/privacy, restricted admin roles, safe provider tokens, rate limits, abuse reporting. No service-role secrets in mobile.
- Do not create paid services, post publicly, release app-store binaries, or destroy unrelated work without owner's approval.
- Keep `docs/IMPLEMENTATION_LOG.md`, `docs/RELEASE_STATUS.md`, and `docs/NEXT_ACTIONS.md` current. Commit logical milestones; include real evidence and exact SHA.
- Always preserve user's working files and Git state. Never silently rewrite existing branches or discard their uncommitted changes.

## Repository conventions (added during the pilot build)

- Commands: `pnpm check` (typecheck + lint + unit), `pnpm test:integration` (needs `supabase start`
  and `supabase functions serve --env-file supabase/functions/.env.test`), `pnpm test:e2e`
  (needs Expo web on :8081, `pnpm web` on :3000 and `pnpm seed`). Run them before claiming a change works.
- Schema changes = new migration in `supabase/migrations/` (never edit applied ones), then
  `pnpm db:types`, then add RLS tests in `tests/integration/src/`. Every new `private.*`
  function must be `revoke execute … from public, anon, authenticated` unless an RLS policy calls it.
- Client writes go through column-level grants or SECURITY DEFINER RPCs that call
  `private.require_user()` and check ownership. Raise short error keys and map them in
  `packages/shared/src/errors.ts` (French copy).
- Mobile: Expo SDK 58 APIs are verified against installed type definitions; use `goBack()` from
  `@/lib/nav`, design primitives from `@/design`, never hardcode colors outside the tokens.
- Live video must never be simulated: `live_sessions.status` changes only via the provider
  webhook/server sync.
