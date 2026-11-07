# Next actions

## Owner (now): P1 private-pilot decisions

Read `docs/GO_NO_GO.md` (one page), then `docs/P1_READINESS_REPORT.md` if you want the detail.
1. Approve or reject the code as the private-pilot candidate (draft PR #2 stays unmerged until
   you say so).
2. Decide the paid/external items: pilot Supabase project, e-mail sending, Expo account
   (Android APK) and, only for iPhone testers, the Apple Developer Program; web hosting for the
   legal pages, shared links and `/admin`.
3. Fill the 19 placeholders in the legal pages (company, contact e-mail, CDP receipt, retention
   periods) with your legal counsel; choose the support channel; name 1–2 moderators.
4. Then follow `docs/SETUP_PRODUCTION.md` §1 and §3, run the two-phone script in
   `docs/PILOT_TEST_PLAN.md` §3, and only then invite sellers (`docs/PILOT_OPERATIONS.md` §3).

Developer, once the owner has an Expo account: `eas init`, commit the project id, create the
EAS environment variables, build the Android `preview` APK, and record the first device results
in RELEASE_STATUS (P1-08, DEV-02).

## Owner (earlier): re-check the microcopy pass on the iPhone

`git pull` on `feature/lovable-native-parity-20261104`, then `pnpm preview:expo-go` and, in Expo Go:
- create a new account: the « Bienvenue chez vous. » screen should feel calm, « Disponible »
  appears only once your pseudo is checked, and with the keyboard open you can still reach the
  18+ box and the « Entrer dans Jëfëli » button;
- browse Explorer, Messages, Publier and your profile: say if any removed line is missed.
Before/after images: `docs/evidence/microcopy-pass/compare/`.

## Owner (now): review the Lovable native port — branch `feature/lovable-native-parity-20261104`, draft PR #2

1. Look at the side-by-side images first: `docs/evidence/lovable-parity/compare/` (Lovable on the
   left, native on the right, 390 and 360 pt), then `native/` (360 / 390 / 412) and `states/`
   (loading, empty, validation). The README there lists every deliberate difference.
2. On the Mac (Docker Desktop running): `git fetch && git checkout feature/lovable-native-parity-20261104`,
   `pnpm install`, `pnpm preview:expo-go --reset-demo`, then open it on the iPhone with Expo Go.
3. Check on the iPhone, with screenshots of anything wrong:
   - Accueil, Messages and Profil are dark; Explorer, article pages and forms are near-white;
     the status-bar icons are light on the dark screens and dark on the light ones;
   - the floating dock clears the home indicator and Plus opens « Publication » directly;
   - the article form scrolls in one page and the keyboard never hides the field you type in;
   - « Plus d’infos » on a profile opens reviews, statuses and lives.
4. Decide: approve the visual parity (then the PR can leave draft), or list the changes.


## Owner (now): next Expo Go playtest — post-playtest refinement
On the Mac (Docker Desktop running):

```bash
cd ~/Jefeli
git pull
pnpm install
pnpm preview:expo-go --reset-demo
```

- `--reset-demo` recreates the DÉMO accounts with the new examples: a « Prix sur demande »
  article, an « À discuter » lot, pinned posts and products, and Awa's cover photo. The new
  database migration is applied automatically.
- Scan the QR code with the iPhone (Expo Go for SDK 58, same Wi-Fi, allow « Réseau local »).
- To hide Expo Go's floating tools gear: shake the iPhone and switch off the floating tools
  button in Expo Go's developer menu. The gear belongs to Expo Go, not to Jëfëli, so the app
  cannot hide it.
- Follow `docs/TEST_IPHONE_FR.md`: §2 (3-step article), §5 bis (one Publication composer with an
  optional type) and §5 ter (flexible prices, pins, cover, WhatsApp share, several articles in
  one conversation, Explorer).
- Please note, with screenshots: anything cut off at your iPhone size, the keyboard covering a
  field, the gallery picker, and whether the three price choices are clear without explanation.
- New look from your two references (floating tab bar with a round « + », icon category tiles,
  white cards, quiet « F CFA »): say whether the icon-only tabs are clear and whether the
  floating bar sits well above the iPhone's home indicator.

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
4. Refinement follow-ups (not started):
   - an order summary built from the multi-article picker plus accepted offers (roadmap in
     `docs/CONVERSATION_COMMERCE.md`, needs the owner's go-ahead);
   - reorder pins (today the newest pin comes first);
   - the price mode in search result rows on the web admin;
   - a development build with `expo-dev-client` `toolsButton: false` once EAS is set up.
5. Small backlog:
   - collections UI (the table exists);
   - edit and reorder listing media (the RPC exists);
   - a report-history link from notifications;
   - `my_conversations` preview text for barter offers;
   - a server-side guard for `/admin` routes.
6. Performance pass on a mid-range Android: switch feed lists to FlashList (installed) and check
   image sizes.

## Resume instructions

Check out `claude/jefeli-pilot` and run `pnpm install`. Then run `pnpm exec supabase start`,
`pnpm exec supabase functions serve --env-file supabase/functions/.env` and `pnpm seed`. Start
the app with `pnpm mobile:web` (:8081) and `pnpm web` (:3000), and confirm `pnpm check`,
`pnpm test:integration` and `pnpm test:e2e` all pass. Then continue from "Engineering" above.
Read `docs/RELEASE_STATUS.md` first. It says what was actually verified, and where (browser
renders, not devices).
