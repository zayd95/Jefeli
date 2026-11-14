# Jëfëli — Android release readiness (Google Play, internal testing)

Read-only audit of what an Android build of `apps/mobile` would ship today, and what the owner
must do before a first **internal testing** release. Nothing was built, signed or submitted, and
no account was created.

- **Code audited:** branch `feature/p1-identity`, HEAD `2008b6d`.
- **Files read:** `apps/mobile/app.json` (there is no `app.config.*`), `apps/mobile/eas.json`,
  `apps/mobile/package.json`, `apps/mobile/src/lib/{push,env,share,diagnostics}.ts`,
  `apps/mobile/src/lib/api/feedback.ts`, `supabase/functions/push-dispatch`, the migrations and
  `apps/web`.
- **Resolved Android config:** `npx expo config --type introspect` was run in `apps/mobile`. It
  evaluates the config plugins without writing files and gives the permissions and manifest
  entries the plugins add.
- **Permissions declared by libraries:** read from the libraries' own
  `android/src/main/AndroidManifest.xml` under `node_modules`. They are merged at build time.
- **Not done:** no `eas build`, no `expo prebuild` and no merged-manifest check were run. Anything
  that depends on them is « non vérifié ».

Legend: **OK** · **missing** · **to decide**.

## 1. App identity and assets

| Item | Status | Current value | Note |
|---|---|---|---|
| Android package | **to decide** | `sn.jefeli.app` | Still a placeholder awaiting owner confirmation (`docs/GO_NO_GO.md` row 10). It **cannot change** after the first Play upload |
| App name | OK | `Jëfëli` (`expo.name`; resolved `app_name` string = `Jëfëli`) | — |
| `version` (versionName) | OK | `0.1.0` | — |
| `versionCode` | OK (managed remotely) | Not in `app.json`. `eas.json`: `cli.appVersionSource = "remote"` and `build.production.autoIncrement = true`, so EAS stores and increments it | Starting value non vérifié (EAS holds it, not the repo) |
| EAS project link | **missing** | `expo.extra.eas = {}`: no `projectId`, no `owner` | `eas init` under the owner's Expo account. This also unblocks push (§ 4) |
| Icon | OK | `./assets/images/icon.png`, 1024×1024 RGB | — |
| Adaptive icon | OK | foreground / background / monochrome PNGs, each 1024×1024, `backgroundColor` `#061D18` | Monochrome is present (Android 13+ themed icons) |
| Notification icon | **missing** | `expo-notifications` plugin sets only `color: "#10252C"`, no `icon` | Android draws the status-bar icon from the launcher icon's alpha. A full-colour icon can show as a plain shape. Add a white-on-transparent `icon` (the monochrome asset is a starting point) |
| Splash | OK | `expo-splash-screen`: `backgroundColor` `#061D18`, `image` `./assets/images/splash-icon.png` (1200×320), `imageWidth` 200, resize `contain` | Brand note: `#061D18` is the « Dakar after dark » v2 colour, not the CLAUDE.md canvas `#F6F5F1`. It is consistent with the app's current theme |
| Orientation | OK | `portrait` (resolved `android:screenOrientation="portrait"`) | — |
| `minSdkVersion` | OK | 24 (`expo-build-properties`) | — |
| `targetSdkVersion` / `compileSdk` | **to confirm** | Not set in the app. React Native 0.88's `gradle/libs.versions.toml` has `targetSdk = "36"` and `compileSdk = "37"` | The value Expo SDK 58's template uses is non vérifié without a prebuild. Google Play's current minimum target API: to confirm in the Play Console |
| Predictive back | OK | `predictiveBackGestureEnabled: false` | — |
| Backups | **to decide** | `android:allowBackup="true"` with `expo-secure-store` backup rules | Secure-store rules exclude the session keys (that is the plugin's purpose). Confirm that no other data needs excluding |

## 2. Build profiles (`eas.json`)

| Profile | Status | Current value | Note |
|---|---|---|---|
| `development` | **missing dependency** | `developmentClient: true`, `distribution: internal`, `EXPO_PUBLIC_ENV=local` | `expo-dev-client` is **not** in `apps/mobile/package.json`, so this profile cannot produce a working development client until it is added. `local` points the app at a local Supabase, which a phone cannot reach |
| `preview` | **to decide** | `distribution: internal`, `channel: preview`, `EXPO_PUBLIC_ENV=staging`; no `android.buildType` | For side-loaded testers an APK is usually wanted (`"android": { "buildType": "apk" }`). The current default output type is to confirm in the EAS docs |
| `production` | OK for Play | `channel: production`, `autoIncrement: true`, `EXPO_PUBLIC_ENV=production` | Builds the Play bundle (AAB by default; to confirm) |
| `channel` (all) | **to decide** | `preview` / `production` | `expo-updates` is **not installed**; the resolved manifest has `expo.modules.updates.ENABLED=false`. Channels do nothing until it is added, so there are no over-the-air updates |
| `submit.production` | **missing** | `{}` | No Play service-account key path and no `track`. For the first upload, upload the AAB by hand in the Play Console. Later: `"android": { "serviceAccountKeyPath": …, "track": "internal" }` |
| Public env | **missing** | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_WEB_BASE_URL`, optional `EXPO_PUBLIC_EAS_PROJECT_ID` and `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (`src/lib/env.ts`) | Must be set as EAS environment variables per profile. Without them the app shows « Configuration manquante ». `EXPO_PUBLIC_WEB_BASE_URL` defaults to `http://localhost:3000` |
| Signing key | OK (to be created) | No keystore in the repo | Let EAS generate and hold the upload key on the first `eas build -p android`. Enrol in Play App Signing, where Google holds the app signing key |

## 3. Permissions

`app.json` `android.permissions` is `["CAMERA", "RECORD_AUDIO"]`. There is no
`blockedPermissions`.

**Resolved by the config plugins** (`expo config --type introspect`, main manifest):
- `INTERNET`
- `SYSTEM_ALERT_WINDOW`
- `VIBRATE`
- `READ_EXTERNAL_STORAGE` (maxSdk 32)
- `WRITE_EXTERNAL_STORAGE` (maxSdk 32)
- `CAMERA`
- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `BLUETOOTH`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADMIN`
- `WAKE_LOCK`
- `ACCESS_NETWORK_STATE`

**Declared by library manifests** (merged at build time):

| Library | Adds |
|---|---|
| `expo-notifications` | `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` |
| `expo-image-picker` | `CAMERA`, `READ/WRITE_EXTERNAL_STORAGE` |
| `expo-file-system` | `READ/WRITE_EXTERNAL_STORAGE`, `INTERNET` |
| `expo-audio` | `MODIFY_AUDIO_SETTINGS`, plus a `mediaPlayback` foreground service (`AudioControlsService`) |
| `expo-video` | `INTERNET` |
| `@stream-io/video-react-native-sdk` | `INTERNET`, `WAKE_LOCK`, and a keep-alive service with `foregroundServiceType="mediaPlayback\|camera\|microphone"` |
| `@stream-io/react-native-webrtc` | A `MediaProjectionService` with `foregroundServiceType="mediaProjection"` (screen capture) |

The final merged manifest, including any `FOREGROUND_SERVICE_CAMERA`, `_MICROPHONE` or
`_MEDIA_PROJECTION` permissions, is non vérifié.

| Plugin / need | Status | Note |
|---|---|---|
| Camera (`expo-image-picker`, photos / videos of articles and statuses) | OK | Rationale strings are in French |
| Microphone (`expo-audio`: voice messages, narration, article voice; `expo-image-picker` video sound) | OK | — |
| Photos (`expo-image-picker`) | OK | No `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` in the resolved config. The picker relies on the system photo picker on recent Android (non vérifié on a device) |
| Notifications (`POST_NOTIFICATIONS`) | OK | Requested at runtime by `registerForPush()` after onboarding |
| Location (`expo-location`) | OK — absent | Not installed. Location is a text city / neighbourhood typed or picked by the member |
| **Live stack** (`@stream-io/video-react-native-sdk`, `@config-plugins/react-native-webrtc`): Bluetooth ×3, `WAKE_LOCK`, camera / microphone / mediaPlayback / mediaProjection foreground services | **to decide — blocker for a clean first review** | Live is off (`live_streaming = false`) and redirects to `/`, yet its SDKs ship in the binary. Each foreground-service type needs a Play Console declaration with a video of the feature in use, which cannot be filmed for a hidden feature. Recommended for the first Play build: remove both packages and their plugins (and lazy-load or stub `live/*`), or add `blockedPermissions` for the Bluetooth ones and confirm the merged manifest |
| `SYSTEM_ALERT_WINDOW` | **to decide** | Added by the Expo template / dev tooling, not used by app code. Add it to `android.blockedPermissions` |
| `READ/WRITE_EXTERNAL_STORAGE` (≤ API 32) | **to decide** | Kept by `expo-image-picker` / `expo-file-system` for old Android versions. Acceptable, or block it if the picker works without it (to test on an API 24–32 device) |

## 4. Push notifications

| Item | Status | Current value |
|---|---|---|
| Client | OK (code) | `expo-notifications ~58.1.7`. `src/lib/push.ts` creates the `default` channel, asks permission, gets an **Expo** push token with the EAS `projectId` and calls `register_push_token` (`push_tokens`: token, user_id, platform) |
| Server | OK (code) | `supabase/functions/push-dispatch`: pg_net → Expo Push API, honours preferences, lock-screen text never contains message content. Needs secret `PUSH_WEBHOOK_SECRET`; `EXPO_ACCESS_TOKEN` is optional |
| `projectId` | **missing** | `extra.eas.projectId` absent and `EXPO_PUBLIC_EAS_PROJECT_ID` unset, so `registerForPush()` returns `'unavailable'` and no token is ever stored |
| FCM (`google-services.json`) | **missing** | No `google-services.json` in the repo and no `android.googleServicesFile` in `app.json`. Expo push on Android needs a Firebase project + `google-services.json` in the app + FCM V1 service-account credentials uploaded to EAS (owner accounts) |
| Flag | OK | `push_notifications = true` (seed). In-app notifications work without push through Realtime |
| Deep link on tap | **partial** | `data.url` routes for `conversation`, `post`, `agreement` and `live_session`. Offer notifications open `/notifications` (`PILLARS_AUDIT.md` F5) |

## 5. Deep links and the web share pages

| Item | Status | Current value |
|---|---|---|
| Custom scheme | OK | `scheme: "jefeli"`. Resolved intent filter: `VIEW` + `DEFAULT` + `BROWSABLE`, `android:scheme="jefeli"`. Links: `jefeli://u/{handle}`, `jefeli://p/{id}`, `jefeli://post/{id}`, `jefeli://live/{id}` (`packages/shared/src/links.ts`) |
| `android.intentFilters` (https) | **missing** | None in `app.json` |
| Android App Links (`autoVerify`) | **missing** | No verified `https` filter, so web links always open in the browser |
| `assetlinks.json` | **missing** | `apps/web/public/.well-known/` does not exist (`apps/web/public` holds only `og-default.png`) |
| Web pages → app | **partial** | The public pages (`/p/[id]`, `/[handle]`, `/post/[id]`) use `OpenInApp` with `appLinks`. When `NEXT_PUBLIC_APP_URL` is set (web beta), the buttons go to the **web app**. Otherwise they go to `jefeli://…`, which opens the app only if installed; the page states this honestly and offers no fake store link |
| Domain | **missing** | The web runs on Vercel previews protected by Vercel Authentication (`docs/W1_WEB_BETA.md` §1). App Links need a stable public domain the owner controls |

**To add App Links later:**
1. Choose the domain.
2. Add an `android.intentFilters` entry with `autoVerify: true` for `https://<domaine>/p/*`, `/post/*`
   and the profile path. Profiles are `/{handle}` at the root, so this needs a path prefix
   decision.
3. Serve `/.well-known/assetlinks.json` with the Play App Signing SHA-256 certificate fingerprint.
4. Decide what the web buttons do when the app is installed.

## 6. Android blockers (summary)

| # | Blocker | Owner action? |
|---|---|---|
| A1 | No EAS project link (`extra.eas` empty) | Yes: Expo account, `eas init` |
| A2 | Package name `sn.jefeli.app` unconfirmed, and permanent once uploaded | Yes |
| A3 | Live SDKs (Stream / WebRTC) ship foreground services and Bluetooth permissions for a hidden feature | Decision: remove them for v1 (recommended) or declare them |
| A4 | Privacy policy not on a public domain, with 12 `<Todo>` placeholders (controller, contact, retention) | Yes: legal identity, domain |
| A5 | No `google-services.json` or FCM credentials, so no Android push | Yes: Firebase project (free) |
| A6 | Production env values (Supabase URL / key, web base URL) not set for EAS builds; `EXPO_PUBLIC_WEB_BASE_URL` falls back to `localhost` | Yes: production Supabase project (`docs/SETUP_PRODUCTION.md`) |
| A7 | No physical-device test of anything (camera, gallery, mic, keyboard, safe areas, push, share sheet) | Yes: at least one Android phone (`RELEASE_STATUS` DEV-02 BLOCKED_EXTERNAL) |
| A8 | `development` profile unusable (`expo-dev-client` missing) | No: dependency change, with the owner's go |

## 7. Owner checklist (do not submit until each line is ticked)

1. **Google Play developer account**: US$25 one-time registration fee (owner's account; identity
   verification by Google). Choose a personal or organisation account. An organisation needs a
   D-U-N-S number (to confirm on the Play Console).
2. **Expo / EAS**:
   - create or choose the Expo account and run `eas init` (sets `projectId`);
   - set the EAS environment variables per profile (§ 2);
   - free-tier limits (monthly build count, queue priority, build timeouts, EAS Update MAU):
     **to confirm on expo.dev**; they were not browsed for this audit.
3. **Signing**: let EAS create the upload keystore on the first Android build and keep it in EAS.
   Enrol in Play App Signing at the first upload. Record the app-signing SHA-256 for
   `assetlinks.json`.
4. **Package name**: confirm `sn.jefeli.app` or replace it **before** the first build that goes to
   Play.
5. **Privacy policy URL**:
   - the text exists at `/legal/confidentialite`, but only on Vercel preview URLs behind Vercel
     Authentication, so Google's reviewers cannot open it;
   - it still contains placeholders: « Raison sociale, adresse, RCCM / NINEA », the contact
     e-mail, the data contact, and retention periods such as « 30 jours »;
   - needed: a public domain (or lift protection on `jefeli-web`) and the filled-in text.
6. **Account deletion**: in-app deletion exists (Réglages › « Mes données et suppression du
   compte » → `delete-account` function; the hosted check is still pending per `RELEASE_STATUS`).
   Play also asks for a **web link** where users can request deletion without the app. Point it
   to the public privacy section « 8. Suppression du compte et export des données », or a
   dedicated page (to decide).
7. **Data safety form**: draft answers in § 8.
8. **Content rating questionnaire (IARC)**. Facts from the code:
   - user-generated content and **user-to-user messaging** (text, photo, voice);
   - user profiles are public by default; private accounts are optional;
   - users share their city / neighbourhood as text;
   - no gambling, no in-app purchases, no payments: Jëfëli processes no payment, and agreements
     say « Jëfëli ne détient aucun fonds »;
   - reporting, blocking and moderation tools exist (`report.tsx`, `settings/blocked.tsx`,
     `/admin/signalements`);
   - live video is off;
   - expect a rating that reflects unmoderated user interaction. The exact answers are the
     owner's.
9. **Target audience: 18+ only**:
   - sign-up requires the « J’ai 18 ans ou plus. » checkbox, and onboarding asks again (« Je
     confirme avoir 18 ans ou plus ») and stores `profiles.adult_confirmed_at`;
   - the caption reads « Jëfëli est réservé aux personnes majeures pendant la phase pilote. »;
   - it is a **self-declaration**: there is no date of birth and no server-side check (the column
     is client-writable through its grant);
   - select « 18 and over » only in the Play target audience section, and state that the app is
     not designed for children.
10. **Testers (internal testing track)**: up to 100 testers by e-mail list (Google accounts). Each
    tester accepts the opt-in link. Prepare the list, plus a French test script (adapt
    `docs/TEST_IPHONE_FR.md` for Android).
11. **Store listing basics** (internal testing needs few, closed / production need all): app
    name, short and full description in French, phone screenshots from a **real device** (the
    existing captures are browser renders), 512×512 icon, 1024×500 feature graphic, category
    (Shopping or Social: to decide), support e-mail.
12. **Firebase** (for push): create a free Firebase project for `sn.jefeli.app`, download
    `google-services.json` (add it to the app and set `android.googleServicesFile`), and upload
    the FCM V1 service-account key to EAS credentials.
13. **Live SDK decision** (A3) before the first upload.
14. **Do not submit** to review or publish anything without the owner's explicit go.

## 8. Data safety form — draft answers from the code

Google's categories, with what the code actually collects or sends:

| Play data type | Collected? | From where in the code | Shared with third parties? | Optional? | Purpose |
|---|---|---|---|---|---|
| Personal info › Name | Yes | `profiles.display_name` (public) | No (shown to other users = app functionality) | Required | App functionality, account management |
| Personal info › Email address | Yes | Supabase Auth (`sign-up.tsx`); never on the profile | No | Required for e-mail sign-up | Account management |
| Personal info › Phone number | Yes, once phone sign-in is on (`phone_auth` off today) | Supabase Auth phone OTP; `private.sms_events` stores a **hashed** phone key + prefix, never the number | SMS provider (Orange) as a service provider when enabled | Optional | Account management, fraud prevention (SMS abuse limits) |
| Personal info › User IDs | Yes | Account UUID, `@handle` | No | Required | App functionality |
| Personal info › Address / other | **to decide** | City and neighbourhood as free text, chosen by the member (profile, listings, posts) | No | Optional (city is asked at onboarding, default « Dakar ») | App functionality (local discovery) |
| Location › Approximate / Precise | **No** | No `expo-location` and no GPS. Only the text above | — | — | — |
| Photos and videos | Yes | Listings, posts, statuses, avatar / cover (`public-media`); chat photos (`private-media`) | No | Optional | App functionality |
| Audio › Voice or sound recordings | Yes | Voice messages, publication narration, article voice (`expo-audio`), video sound | No | Optional | App functionality |
| Messages › Other in-app messages | Yes | `messages` (text, photo, voice, article cards), `offers.message`, status replies | No | Optional | App functionality |
| App activity › Other user-generated content | Yes | Posts, comments, listings, reviews, reports, feedback text (« Donner mon avis »: kind + message + platform) | No | Optional | App functionality, safety |
| App activity › App interactions | Yes | Follows, friends, favourites, post votes (downvotes kept private), blocks / mutes | No | Optional | App functionality (feed ranking) |
| App activity › In-app search history | No | Search queries are not stored (no table or local key found) | — | — | — |
| Device or other IDs | Yes, if notifications are allowed | Expo push token + platform (`push_tokens`) | Expo / Google FCM as service providers to deliver push | Optional | App functionality (notifications) |
| App info and performance › Crash logs / Diagnostics | **No** | No crash or analytics SDK (`grep` for Sentry, Firebase Analytics, PostHog, Amplitude, Mixpanel, Bugsnag, Crashlytics: none). `diagnostics.ts` only shows text the member may copy by hand; console logs stay on the device | — | — | — |
| Financial info | No | No payments (the boutique « Paiement » note is free text written by the seller) | — | — | — |
| Contacts | No | `contacts_matching` is off and no contacts permission is requested | — | — | — |
| Server logs (IP address) | Yes (server side) | Supabase / Vercel request logs; `sms_events.ip_key` is a hash. The privacy page mentions « adresse IP » | No | — | Security, fraud prevention |

Further answers for the form:
- **Encrypted in transit:** yes (HTTPS to Supabase and the web).
- **Users can request deletion:** yes, in the app (and see checklist item 6 for the web link).
- **Data sold:** no. The privacy page says « Jëfëli ne vend pas vos données personnelles. »
- **Independent security review:** no.
