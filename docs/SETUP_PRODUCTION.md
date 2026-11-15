# Jëfëli — staging / production setup runbook

These steps put the pilot on hosted infrastructure. Each one needs an owner account or
owner approval, because they involve **paid plans, credentials, signing or public
exposure**. Nothing here was done automatically. Prices are assumptions to verify (see
`RELEASE_STATUS.md › Costs`).

## 1. Supabase project (staging first)

1. Create a project at supabase.com. Pick a region close to West Africa (e.g. `eu-west`). Note
   the **project ref**, **URL**, **publishable (anon) key** and **service role key**. Keep the
   service role key out of the apps.
2. Link and push the schema from the repo root:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push        # applies supabase/migrations/* (RLS, RPCs, buckets, cron jobs)
   ```
3. Auth settings (Dashboard › Authentication):
   - **Confirm email**: on for staging and production. The app handles it (« Vérifiez votre
     e-mail », then the link opens sign-in); verified locally with confirmations on
     (`tests/e2e/specs/email-confirmation.spec.ts`, P1).
   - **E-mail sending**: confirmation and password-reset e-mails go through Supabase's built-in
     sender unless a custom SMTP is configured. That built-in sender is meant for testing: a very
     low hourly rate and, as far as we know, delivery only to the project team's own addresses
     (supabase.com could not be reached from the build environment to re-check). **Verify in the dashboard before inviting anyone**: send a reset
     to a non-team address. If it does not arrive, either configure an SMTP provider (owner
     approval; many have a free tier) or turn « Confirm email » off for the private pilot and accept
     unconfirmed addresses (password reset still needs e-mail). See `docs/GO_NO_GO.md`.
   - **Site URL**: the web domain. **Redirect URLs** (the app now sends per-runtime links,
     `apps/mobile/src/lib/recovery.ts`): `jefeli://**` for installed builds, plus
     `https://<web domain>/**`. Add `exp://**` **only on a staging project used with Expo Go**:
     it lets any Expo Go address receive sign-in tokens from an e-mail link, so never on the pilot
     or production project.
   - Set the password minimum to 8 and keep rate limits on.
   - Phone OTP: add an SMS provider (paid) only after approval, then enable the `phone_auth` flag
     (step 5).
4. Edge Functions:
   ```bash
   pnpm exec supabase functions deploy live delete-account --project-ref <ref>
   pnpm exec supabase functions deploy live-webhook push-dispatch cleanup-stories --no-verify-jwt --project-ref <ref>
   pnpm exec supabase secrets set PUSH_WEBHOOK_SECRET=<long random string> --project-ref <ref>
   # when live video is approved:
   pnpm exec supabase secrets set STREAM_API_KEY=<key> STREAM_API_SECRET=<secret> --project-ref <ref>
   ```
5. Server configuration (SQL editor):
   ```sql
   -- Push fan-out: each new notification is POSTed to push-dispatch via pg_net
   insert into private.config (key, value) values
     ('push_webhook_url', 'https://<ref>.supabase.co/functions/v1/push-dispatch'),
     ('push_webhook_secret', '<same value as PUSH_WEBHOOK_SECRET>')
   on conflict (key) do update set value = excluded.value;

   -- First administrator (after that person has signed up in the app)
   insert into public.staff_roles (user_id, role)
   select id, 'admin' from auth.users where email = '<admin email>';

   -- Pilot moderators: least privilege (reports, hide/restore, warnings, suspensions; no
   -- verification grants, no feature flags). Verified on an unseeded database in P1.
   insert into public.staff_roles (user_id, role)
   select id, 'moderator' from auth.users where email = lower('<moderator email>')
   on conflict (user_id) do update set role = excluded.role;

   -- Removing a staff member
   delete from public.staff_roles where user_id = (select id from auth.users where email = lower('<email>'));

   -- Feature flags are toggled in the web console (/admin › Réglages) by an admin.
   ```
6. Storage cleanup of expired statuses: statuses are hidden on read the moment they expire,
   whether or not this job runs. To reclaim the files, schedule `cleanup-stories` hourly with the
   service-role key, using a Supabase scheduled function or any external cron. The `pg_cron` jobs
   already expire offers and soft-delete statuses in the database.
7. Demo data on **staging only**:
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ALLOW_DEMO_SEED=staging pnpm seed`.
   Never run it on production.

## 2. Live video (Stream) — needs owner approval

1. Create a Stream account and a Video app. Check whether the free / "Maker" programme applies, or
   get a quote for live minutes.
2. Set `STREAM_API_KEY` and `STREAM_API_SECRET` as function secrets (above).
3. In the Stream dashboard, set the webhook URL to
   `https://<ref>.supabase.co/functions/v1/live-webhook`. Enable `call.live_started`,
   `call.ended`, `call.session_ended` and `call.session_participant_count_updated`.
4. Re-verify `supabase/functions/_shared/stream.ts` against Stream's current REST docs. The
   endpoint shapes were written without access to getstream.io from the build environment.
5. Turn on the `live_streaming` flag in `/admin › Réglages`.
6. Test on **two physical phones** with an EAS development build (Expo Go cannot load WebRTC).
   On iOS, confirm that Stream's config plugin needs no change for SDK 58's Swift `AppDelegate`:
   prebuild showed no iOS AppDelegate edits (Android was patched).

## 3. Mobile builds (EAS)

Facts below were checked in the EAS CLI source (`eas-cli` / `@expo/eas-json` 27.5.0, P1), not
on a real build: no Expo account was available.

1. Create an Expo account (free plan is enough to start). Then run
   `cd apps/mobile && npx eas-cli login && npx eas-cli init`, which writes `extra.eas.projectId`
   into `app.json` (commit it). Push tokens need that id (`src/lib/push.ts`).
2. Bundle identifiers are placeholders: `sn.jefeli.app` (iOS and Android). Confirm or change
   them in `app.json` before the first build: they cannot change once testers have installed it.
3. **Configuration of the build**: `apps/mobile/.env` is gitignored, so EAS never receives it. A
   build without these variables opens on « Configuration manquante ». Create them once per EAS
   environment (the `preview` profile reads the « preview » environment, `production` reads
   « production », by default):
   ```bash
   cd apps/mobile
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <publishable key> --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_WEB_BASE_URL --value https://<web domain> --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_ENV --value staging --visibility plaintext
   npx eas-cli env:create --environment preview --name EXPO_PUBLIC_EAS_PROJECT_ID --value <projectId> --visibility plaintext
   ```
   These are public values (they end up in the app). Never put the service-role key here.
4. **Android (no store needed)**: `npx eas-cli build --profile preview --platform android`. The
   `preview` profile is `distribution: internal`, for which EAS builds an **APK** by default; the
   build page gives a link/QR code that testers open on their phone (they allow « installer des
   applications inconnues » once). A Google Play internal-testing track is the alternative
   (one-time Play Console fee).
5. **iPhone**: needs an **Apple Developer Program** membership (yearly fee, owner approval). Then
   either internal distribution (register each tester's device UDID, then
   `npx eas-cli build --profile preview --platform ios`) or TestFlight
   (`npx eas-cli build --profile production --platform ios` then `npx eas-cli submit -p ios`,
   internal testers need no App Review). Expo Go is not a pilot channel: it needs the developer's
   machine running.
6. **Push**: Android needs a Firebase project and its FCM V1 service-account key uploaded with
   `npx eas-cli credentials`; iOS needs an APNs key (Apple Developer account). Without them the app
   still works and shows in-app notifications; nothing is pushed.
7. **Crashes**: no crash-reporting SDK is installed. A JavaScript error that nothing catches
   closes the app in a release build; TestFlight (App Store Connect › TestFlight › Crashes) reports
   those crashes at no cost, and so does the Play Console for installs through a Play testing
   track. A
   sideloaded APK reports nothing: ask testers to tell support what they were doing. Adding a
   service such as Sentry is an owner decision.
8. Store submission (App Store / Play public listing) is **not authorised** until legal review and
   an explicit owner decision.

## 4. Web app (share pages + admin)

The pilot needs it: the terms, privacy policy and community rules the app links to at sign-up
and in Réglages, every shared/WhatsApp link (`EXPO_PUBLIC_WEB_BASE_URL`), and the moderation
console (`/admin`) are all served by `apps/web`. Without it those links point nowhere. A
moderator can also run the console locally (`pnpm web` with the pilot project's public URL and
key) if no deployment is approved yet; the legal pages and shared links still need one.

- Deploy `apps/web` (Next.js 16) to Vercel or any Node host, only once **public exposure is
  approved**. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_ENV`.
- Pages are `noindex` unless `NEXT_PUBLIC_ENV=production`.
- After the domain is cleared, add universal links / app links (`apple-app-site-association`,
  `assetlinks.json`) so shared links open the app directly.

## 5. Release gates (from ACCEPTANCE_TESTS.md)

- **Gate A (developer preview):** reached locally. Real auth and data, all core flows,
  DÉMO-labelled seed.
- **Gate B (invited pilot):** needs a hosted staging project, EAS builds on real devices,
  multi-device tests, and a decision either to include live (with real provider tests) or to
  exclude it explicitly.
- **Gate C (public stores):** needs legal-reviewed terms and privacy policy, approved costs,
  staffed moderation, production builds, and explicit owner approval.
