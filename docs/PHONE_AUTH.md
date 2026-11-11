# Jëfëli — phone sign-up and sign-in (+221)

Status (11 Nov 2026): **built and verified on the local stack; waiting for the owner's
approval of the provider before staging.** Nothing has been bought, no paid provider is
enabled, and no SMS has been sent to a real number.

Branch `feature/w1.4-phone-auth` (stacked on W1.3). Code: `supabase/functions/send-sms`,
`supabase/migrations/20261112000100_phone_auth_sms_guard.sql`, `apps/mobile/src/components/auth`,
`apps/mobile/src/lib/phoneOtp.ts`, `packages/shared/src/phone.ts`.

## 1. Recommendation

**Send every OTP through a Supabase "Send SMS" hook (our own Edge Function `send-sms`), with the
Orange SMS API Sénégal as the provider. Keep LAfricaMobile as the second provider (quote needed).
Use Twilio only as a paid emergency fallback. Do not use Twilio Verify.**

Why:

1. **Cost.** At Orange's published bundle prices, one OTP costs 3.3–20 F CFA. A Twilio SMS to Senegal
   costs $0.5506, about 325 F CFA: 16 to 100 times more for the same message.
2. **Control.** Supabase's built-in providers send whatever GoTrue asks. With the hook, our server
   decides first:
   - only Senegalese mobile ranges are accepted (+221 70/75/76/77/78), which blocks SMS pumping to
     premium numbers;
   - caps per number, per IP and per day, with a hard daily budget;
   - every send is logged for monitoring;
   - the provider can be changed without touching the app.
3. **Compatibility.** Checked on our own Supabase auth server (v2.197.0):
   - the hook receives `sms.phone`, `sms.otp` and `metadata.ip_address`;
   - the request is signed (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,…`);
   - it works for sign-up, sign-in and changing the phone number on an account;
   - Supabase's documentation lists the Send SMS hook on the **Free and Pro** plans.

## 2. Costs per OTP to Senegal

| Option | Price per SMS | Other fees | Supabase | Source status |
|---|---|---|---|---|
| **Orange SMS API Sénégal** (via hook) | 100 SMS for 2,000 F (20 F) · 500 for 7,500 F · 1,000 for 12,000 F · 5,000 for 50,000 F (10 F) · 20,000 for 80,000 F (4 F) · 60,000 for 200,000 F (3.3 F) | Prepaid bundles; the larger ones are Orange Money only; 5 SMS/second | Hook | **Unverified.** developer.orange.com refused automated reading (bot check). Figures come from search results; confirm them in your Orange developer account. |
| **LAfricaMobile** (via hook) | Not published. A 2022 offer was 10,000 SMS for 100,000 F (10 F). | Sign-up gives 10 free test SMS (official home page) | Hook (REST API "LAMPUSH") | Quote needed. ARTP-licensed aggregator connected to Orange, Free/Yas and Expresso (press, unverified). |
| **Twilio Programmable SMS** | **$0.5506 per segment** (≈ 325 F) | $0.001 per failed message; optional SMS-pumping protection $0.025 per message | Built in (or via hook) | **Official page, 11 Nov 2026.** Since 8 Sep 2026, SMS to Orange and Expresso must use an alphanumeric sender ID registered with Twilio (Twilio's Senegal guidelines). |
| **Twilio Verify** | $0.5506 + **$0.05 per successful verification** ≈ $0.60 per sign-in | Fraud Guard included | Built in | Official page. |
| WhatsApp code (Meta) | Senegal is in Meta's "Rest of Africa" price zone (official). Search results put the authentication rate near $0.004 per message (unverified: the rate file was not reachable). | Needs a verified Meta business and an approved template | Twilio built in, or our hook → WhatsApp Cloud API | Possible later as a second channel; it is not SMS. |
| Vonage, Infobip, Plivo, Bird | No public Senegal price or ≥ $0.24 (third-party). Bird's Supabase integration depends on an API retired on 31 Dec 2026. | — | — | Not recommended. |

Exchange rate used: about 590 F CFA per US dollar (indicative).

### Expected monthly cost

A member needs a code only to create the account, on a new device, or after signing out: sessions
stay open. Assume 1.3 SMS per successful sign-in, to cover resends.

| Successful sign-ins per month | SMS | Orange (bundle) | Twilio SMS | Twilio Verify |
|---|---|---|---|---|
| Owner's tests (≈ 30) | ≈ 40 | 2,000 F (100-SMS bundle, ≈ $3.4) | ≈ $22 | ≈ $24 |
| 1,000 | 1,300 | ≈ 13,000 F at 10 F (≈ $22), from a 5,000-SMS bundle at 50,000 F | ≈ $716 | ≈ $766 |
| 10,000 | 13,000 | ≈ 52,000 F at 4 F (≈ $89), from a 20,000-SMS bundle at 80,000 F | ≈ $7,158 | ≈ $7,658 |

The Orange figures depend on the unverified bundle prices above.

## 3. What the owner needs to set up (nothing is done without your approval)

1. **Orange SMS API Sénégal** (developer.orange.com):
   - an Orange Developer account, linked to an Orange Sénégal line used for payment (airtime or
     Orange Money);
   - subscribe to "SMS Sénégal" to get the client ID, client secret and the sender number;
   - buy the starter bundle (100 SMS, 2,000 F) **after your approval**;
   - optional: request the sender name "JEFELI" from Orange.
2. **Cloudflare Turnstile** (free CAPTCHA, supported by Supabase):
   - create a widget for the beta addresses;
   - the site key goes into the Vercel app settings;
   - you paste the secret key yourself in Supabase › Authentication › Attack Protection.
3. **Credentials:** give me the Orange client ID and secret through the secure form only. They are
   stored as Edge Function secrets; they never go into the app, the repository or the chat.
4. **Your go-ahead on jefeli-staging** to:
   - deploy `send-sms` (and `delete-account`, already pending);
   - turn on the phone provider and point it at the hook;
   - set the SMS limits listed in § 4.
5. **Real tests** on your own phones and SIM cards: Orange, Free/Yas and Expresso numbers; Safari
   on iPhone; Chrome on Android (checklist in § 6).
6. **LAfricaMobile** (optional, recommended as backup): ask for a quote and an account.

## 4. Security and abuse protection

| Layer | Setting |
|---|---|
| Destination | Hook accepts only +221 70/75/76/77/78 (9 digits). Other countries and fixed lines (33) are refused before any SMS is sent. New countries are added in a settings table once delivery is verified. |
| Per number | Hook: at most 3 codes per hour and 6 per day. Supabase also enforces at least 60 s between two codes to the same number. |
| Per IP | Hook: at most 10 codes per hour from one IP address (from the hook's `metadata.ip_address`). |
| Whole project | Hook daily budget (default 300 SMS per day): the hook refuses past the budget and the refusals show in monitoring. Supabase's SMS rate limit is a second cap (default 30 per hour). |
| Bots | Cloudflare Turnstile on sign-up, sign-in, password reset and phone codes (web). |
| Code | 6 digits, valid 5 minutes, single use. Supabase also limits verification attempts per IP. |
| Kill switch | The `phone_auth` flag: when off, the hook refuses every send and the app shows email only. |
| Monitoring | `private.sms_events` table (no codes, no full numbers: a keyed hash plus the operator prefix). Admin view `admin_sms_usage()` gives SMS per day, blocked sends, failures and cost estimate; the pilot metrics script includes it. |
| Account discovery | « Se connecter » says when a number has no account, so the member can create one. The e-mail sign-up already says when an address is taken. CAPTCHA and the per-IP caps keep this from being used in bulk. |
| Account takeover | A phone-only account is created only by a verified code ("confirm phone" on). Adding a phone to an e-mail account sends a code to the new number. A number already used by another account is refused, so profiles are never duplicated. |

## 5. App behaviour

- « Créer un compte » and « Se connecter » offer **E-mail | Téléphone** side by side.
- The country picker starts with Sénégal (+221). Other countries appear once SMS delivery to them is
  verified.
- Phone: enter number → receive a 6-digit code by SMS → enter it.
  - « Renvoyer le code » is available after a 60-second countdown.
  - « Changer de numéro » goes back to the number.
  - A code request that was in progress survives a page reload for 10 minutes.
- Phone-only accounts need no e-mail address. Account deletion and data export work the same way.
- Réglages › « Numéro de téléphone » adds or changes a verified number on an existing account, with no
  new profile, boutique or articles.

## 6. Real-delivery acceptance (owner, with real SIM cards)

| Test | Orange | Free/Yas | Expresso |
|---|---|---|---|
| Sign-up by phone, code received in under 30 s, account created | | | |
| Sign-in on a second device | | | |
| Wrong code, then the right code | | | |
| Resend after 60 s | | | |
| Add a phone to an existing e-mail account | | | |
| Safari (iPhone): code suggested by the keyboard, sign-in | | | |
| Chrome (Android): code, sign-in | | | |

The hook logs each send with the provider's message ID, so every delivery can be matched in the
provider's console.

## 7. What is verified, and how

On the local Supabase stack, every code is generated and checked by the real auth server
(GoTrue v2.197.0). The hook's local `sink` provider hands each SMS to the test runner, the same
way the local mail catcher hands over e-mails. The sink refuses to run on a hosted project, so
nothing is simulated in staging or production.

| Check | Result |
|---|---|
| `tests/integration/src/19-phone-auth.test.ts` (15 tests) | Pass. Covers: sign-up with a real code (phone-only account, profile, no e-mail, single-use code, one SMS segment); sign-in; wrong code; expired code; 60 s resend rule; no account created from the sign-in screen; destination, kill-switch, per-number, per-IP and daily-budget refusals; forged, stale and replayed hook calls; retried hook never sends twice; no code or full number in the log; adding a number to an e-mail account (same profile); a number already used is refused; export and account deletion of a phone-only account; permissions on the hook and monitoring functions. |
| `tests/e2e/specs/phone.spec.ts` PH-01 → PH-06 (browser) | Pass. Covers: sign-up with precise number errors; wrong code, then right code; onboarding; sign-in on a second device; real 60 s countdown and resend; request survives a reload; unknown number → create with it (360 pt); network failure; server refusal message; add a number in Réglages, then sign in with it; number already used. Screenshots: `docs/evidence/e2e/phone/`. |
| Existing suites | See `docs/RELEASE_STATUS.md` « W1.4 »: no regression in e-mail auth, onboarding, deletion or RLS. |

**Not verified yet:**
- Orange adapter: written to the Orange SMS API's request format, never called (no account).
  The first real send on staging is its acceptance test.
- Turnstile: no keys, and challenges.cloudflare.com is not reachable from here.
- Real SIMs, Safari and Android Chrome: owner tests, § 6.

## 8. Staging enablement plan (after approval; same safeguards as the W1.3 migrations)

1. Read-only checks, backup, then apply `20261112000100_phone_auth_sms_guard.sql`. It adds new
   objects only and changes no existing rows.
2. Deploy `send-sms` with these secrets (set through the Management API from the secure channel,
   never committed):
   - `SEND_SMS_HOOK_SECRET`, generated with the hook;
   - `SMS_LOG_KEY`, random;
   - `SMS_PROVIDER=orange`, `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET`, `ORANGE_SENDER_ADDRESS`.
3. Auth settings:
   - phone provider on, phone confirmation required;
   - Send SMS hook → `https://<project>.supabase.co/functions/v1/send-sms`;
   - code valid 5 minutes, 6 digits, 60 s between codes;
   - SMS rate limit 60 per hour to start.
4. The owner pastes the Turnstile secret in Supabase; the site key goes in the Vercel preview
   variables (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`).
5. Turn on `phone_auth`. Then the owner runs the § 6 checklist; the result goes in
   `docs/WEB_BETA_GO_NO_GO.md`.

Rollback: turn `phone_auth` off (stops sends server-side at once), disable the hook. The
migration's objects are independent and can stay.
