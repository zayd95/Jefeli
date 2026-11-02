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
   - Turn on **Confirm email** for staging and production. Set the Site URL to the web domain. Add
     redirect URLs `jefeli://**` and the web domain.
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

1. Create an Expo account. Then run `cd apps/mobile && npx eas-cli login && npx eas-cli init`,
   which writes `extra.eas.projectId`. Also set `EXPO_PUBLIC_EAS_PROJECT_ID` (this enables push).
2. Bundle identifiers are placeholders: `sn.jefeli.app` (iOS and Android). Confirm or change
   them in `app.json` before the first build.
3. iPhone builds need an **Apple Developer Program** membership. Register the test devices, then
   run `npx eas-cli build --profile development --platform ios`, then `npx eas-cli build --profile preview`.
4. Android: `npx eas-cli build --profile preview --platform android` produces an installable APK
   or AAB link.
5. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_BASE_URL`
   and `EXPO_PUBLIC_ENV` as EAS environment variables per profile.
6. Store submission (App Store / Play) is **not authorised** until legal review and an explicit
   owner decision.

## 4. Web app (share pages + admin)

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
