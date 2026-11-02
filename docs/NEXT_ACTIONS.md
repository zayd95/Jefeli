# Next actions

## Owner (now): playtest in Expo Go
On the Mac (Docker Desktop running): `git pull`, `pnpm install`, then `pnpm preview:expo-go`.
Scan the QR code with the iPhone (Expo Go for SDK 58, same Wi-Fi, allow « Réseau local »).
Live and push show « indisponible » in Expo Go; everything else is the native app. The
browser preview stays available with `pnpm preview:lan`.

## Owner: playtest in the browser (optional)

On your computer (Docker Desktop running, Node 22+, `corepack enable`): check out
`claude/jefeli-pilot`, run `pnpm install`, then `pnpm preview:lan`. Open the printed
`http://<IP>:8081` in Safari on the iPhone, which must be on the same private Wi-Fi. Send the
feedback with screenshots. The step-by-step guide is in `docs/TEST_IPHONE_FR.md`.

## Next playtest: feed engagement
- Test the community features from `docs/TEST_IPHONE_FR.md` §5 bis: votes, *Je cherche*,
  comment previews.
- After the playtest, run the 8 metric queries in `docs/FEED_ENGAGEMENT.md` on the staging
  database. Ask the playtesters the questions listed there, especially whether ▲/▼ is clearly
  different from a review and whether downvoting felt safe.
- Owner decisions (applied in `…20261104000100_feed_votes_personal.sql`):
  - suspended accounts' upvotes stop counting while suspended, and the rows are kept;
  - downvotes personalise the voter's feed only;
  - no view/click analytics for now;
  - no automatic moderation from downvotes.

## Owner (blocking for Gate B)

1. Create a **Supabase staging project** and follow `docs/SETUP_PRODUCTION.md` §1. That gives a
   reachable backend for phones and lets the web pages be shared.
2. Create an **Expo account** and an **Apple Developer** membership. Then run `eas init` and build
   `development` for two test iPhones (§3).
3. Decide on **live video**: approve a Stream account (or another provider) and its cost, or
   exclude live from the invited pilot (both are valid under Gate B).
4. Decide on **phone OTP**: approve an SMS provider and its budget, or keep email for the pilot.
5. Have a lawyer review the legal drafts (`apps/web/src/app/legal/*`). Name a moderation
   contact. Clear the brand and domain.
6. Confirm the bundle id `sn.jefeli.app` and the rights to the reference imagery used in DÉMO
   data.

## Engineering (next session)

1. On real devices (dev build): run `docs/TEST_IPHONE_FR.md`. Then check the camera, video
   upload and playback, voice notes, keyboard avoidance, safe areas, push token registration and
   deep links from push.
2. Live: with real Stream credentials, re-verify `_shared/stream.ts` against the docs, set up the
   webhook, and test host and viewer on two phones. Confirm the iOS setup on SDK 58 (Swift
   AppDelegate).
3. Watch the first CI run on PR #1 and fix anything environment-specific.
4. Small backlog:
   - collections UI (the table exists);
   - edit and reorder listing media (the RPC exists);
   - a report-history link from notifications;
   - `my_conversations` preview text for barter offers;
   - a server-side guard for `/admin` routes.
5. Performance pass on a mid-range Android: switch feed lists to FlashList (installed) and check
   image sizes.

## Resume instructions

Check out `claude/jefeli-pilot` and run `pnpm install`. Then run `pnpm exec supabase start`,
`pnpm exec supabase functions serve --env-file supabase/functions/.env` and `pnpm seed`. Start
the app with `pnpm mobile:web` (:8081) and `pnpm web` (:3000), and confirm `pnpm check`,
`pnpm test:integration` and `pnpm test:e2e` all pass. Then continue from "Engineering" above.
Read `docs/RELEASE_STATUS.md` first. It says what was actually verified, and where (browser
renders, not devices).
