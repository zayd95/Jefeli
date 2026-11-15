# Jëfëli — persistent agent rules

This file is the operating contract for coding agents working on Jëfëli. Read `PASTE_INTO_CLAUDE_CODE.md` first for the full end-to-end mandate and all referenced `docs/` files. No mock-only deliverables; build functional vertical slices and verify them.

- Keep Jëfëli social-first; storefront is auto-generated from listings within a social profile.
- Use exact brand typography `Jëfëli` in UI and `jefeli` in technical identifiers (name in text; the logo asset keeps its own letters `#A3E4D7`).
- One visual system, everywhere (owner, 14–15 Nov 2026; authoritative copy in `docs/DESIGN_SYSTEM.md`):
  - **Tokens only.** Every colour value is written once, in `packages/shared/src/tokens.ts`. No hex, `rgb()` or `rgba()` anywhere else — screens, CSS, web pages and tests use the tokens (`packages/shared/test/no-raw-colors.test.ts` fails the build otherwise; config, HTML and SVG files may only use palette values). Contrast pairs are checked against WCAG AA (`packages/shared/test/contrast.test.ts`): re-run it whenever a token changes.
  - **One dark theme**, phone, desktop and public web. Canvas `#0B1311` (near-black, slight green). Green surfaces `#0B2922` / `#12382F` for headers, sheets, raised panels and brand moments. Ink `#F6F5ED`, slate `#9BADA7`. No light theme.
  - **Photos read true.** Every photo, video, thumbnail, gallery and loading backdrop sits on the neutral `colors.mediaBackdrop` (`#0B1311`), never on a tinted green surface.
  - **Nunito only** (one family): headings 800/900, eyebrows tracked +1, labels 600/700, body 400. Check ë é è à ç render.
  - **Three accents, one job each.** Gold `#EFBD38` = the primary action and Jëf. Mint `#7ED8BD` = Wecci and discovery tags. Red `#DB4A35` = unread, favourites, errors; `live` red only for a real « EN DIRECT ». Errors are light text with a red border or icon, never red text.
  - **Gold budget: at most ONE filled gold element per screen** (the primary action; on the tab screens it is the « + »). Every other gold use is a small marker (active tab, Jëf, Waxaale tag, hairline, selected-state border). Selected chips, toggles and segments are a raised fill + gold border + ink text; secondary buttons are outline. `tests/e2e/specs/zz-gold-budget.spec.ts` measures it (≥ 28 px gold fills) and fails above one.
  - **Shape:** cards radius 20, chips and buttons pill-shaped, sheets 25, no heavy shadows.
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
- Start Supabase with `pnpm db:start` (it writes the local Send SMS hook secret to the gitignored
  `supabase/.env` first). Phone codes in tests come from the hook's local `sink` provider on
  :54399, never from a simulated verification (docs/PHONE_AUTH.md).
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
