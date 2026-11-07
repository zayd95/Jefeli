# Jëfëli — private pilot go / no-go

**Decision asked of the owner:** approve this code as the private-pilot candidate, then do the
owner items below. The pilot itself is **NO-GO until they are done**. Nothing here is a
public release: no store listing, no public launch, no merge of PR #2 without the owner.

**Recommendation:** GO on the code (verified below, browser and backend only). The remaining
blockers are accounts, money and decisions that only the owner can make. None needs more
product work.

Legend: ✅ ready (verified in P1) · ⛔ blocker (owner/external) · ⚠️ accepted risk, tell
participants · 🔲 must be done on devices before inviting anyone

## 1. Product and code

| Item | Status | Evidence |
|---|---|---|
| Visual direction frozen (owner-approved native UI) | ✅ | No visual change in P1 except one new form screen (« Nouveau mot de passe ») built from existing components |
| Real-member journeys need no DÉMO data | ✅ | Empty database (0 users): integration 259/259, E2E journeys 31/31, with a moderator granted by one SQL insert |
| Sign-up, e-mail confirmation, sign-in, sign-out, session refresh, returning member | ✅ browser | E2E `journey`, `email-confirmation`, `resilience` (expired token refreshed) |
| Forgotten password | ✅ browser — **was broken** | The reset link opened « Unmatched Route »; fixed (`reset-password` screen), E2E `account-recovery` 3/3 |
| Publish / edit / delete, uploads with retry, drafts | ✅ browser | E2E `journey`, `pricing`, `resilience` |
| Messaging in real time, offers, counter-offers, barter with cash, immutable agreements | ✅ | E2E `journey` MSG-01, MKT-02, MKT-03; integration `07`, `15` |
| Races and double taps | ✅ — **one defect fixed** | A double-tapped offer showed a wrong error; integration `15`, E2E `resilience` |
| Follow, statuses, posts, comments, notifications | ✅ | E2E `journey`, `community`; integration `02–04`, `12` |
| Block, report, moderation, hidden content, account deletion | ✅ | E2E SAF-01 (also with a `moderator`); integration `08`, `11`, `15` |
| SMS sign-in shown as unavailable; live video disabled | ✅ | `phone_auth` and `live_streaming` flags off by default in the migrations; welcome screen copy |
| No payment collection, no escrow; « vérifié » only after an admin review | ✅ | No payment code; verification only through the admin RPC (integration `01`, `08`) |
| Privacy-safe metrics | ✅ | `docs/PILOT_METRICS.md`, 12 read-only queries, never read message contents |
| Fresh DÉMO seed (staging/demo only) | ✅ — **was broken** | First-time seed failed half-way; fixed |

## 2. Owner and external items

| # | Item | Status | What is needed | Cost (assumption, verify) |
|---|---|---|---|---|
| 1 | Pilot Supabase project | ⛔ | Create it (or reuse the staging project), `db push`, deploy functions, auth settings, **no DÉMO seed**, grant 1 admin + 1–2 moderators. `docs/SETUP_PRODUCTION.md` §1 | Free tier possible for a pilot (projects pause when idle); Pro ≈ US$25/month |
| 2 | E-mail delivery | ⛔ | Send a password reset to a non-team address and check it arrives. If not: a custom SMTP provider, or « Confirm email » off for the pilot (reset still needs e-mail) | Many SMTP providers have a free tier |
| 3 | Installable builds | ⛔ | Expo account + `eas init` (project id), EAS environment variables (§3.3: the app's `.env` is not uploaded), then an Android APK (`preview`) | Expo free plan |
| 3b | iPhone builds | ⛔ (only if iPhone testers) | Apple Developer Program membership; internal distribution (register UDIDs) or TestFlight | ≈ US$99/year |
| 4 | Web app online | ⛔ | Terms, privacy policy, community rules, shared/WhatsApp links and `/admin` are served by `apps/web`. Deployment needs approval | Vercel Hobby is non-commercial; Pro ≈ US$20/user/month, or any Node host |
| 5 | Legal pages | ⛔ | 19 placeholders in `apps/web/src/app/(public)/legal` (company identity, contact e-mail, CDP declaration receipt, retention periods, processors). Owner + legal counsel | Legal fees |
| 6 | Support channel | ⛔ | Choose a WhatsApp number/group or e-mail; put it in the invitation and the legal contact | — |
| 7 | Moderators | ⛔ | Name 1–2 people available twice a day; grant `moderator` | — |
| 8 | Two-phone script | 🔲 | `docs/PILOT_TEST_PLAN.md` §3 on real phones; any S1/S2 failure blocks | — |
| 9 | Push notifications | ⚠️ optional | FCM key (Android), APNs key (iPhone). Without them: in-app notifications only | Free (Firebase), APNs with the Apple membership |
| 10 | Bundle id `sn.jefeli.app` | ⛔ | Confirm before the first build | — |

## 3. Accepted risks to tell participants

- Device behaviour (camera, video, voice messages, keyboard, safe areas, push, real app kill)
  has only been checked in browser renders until item 8 is done.
- No crash-reporting service: crashes are visible only through TestFlight/Play Console, and not
  at all for a sideloaded APK; rely on the support channel.
- No over-the-air updates: every fix is a new build to install.
- Shared links open web pages; they do not open the app directly (no universal links yet).
- Payments, delivery and item condition are between members; Jëfëli holds no funds.

## 4. Sign-off

| | Name | Date | Decision |
|---|---|---|---|
| Owner — pilot candidate (code) | | | |
| Owner — items 1–8 done, invitations may go out | | | |
