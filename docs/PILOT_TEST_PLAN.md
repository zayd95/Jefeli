# Jëfëli — private pilot test plan

Three layers: automated suites that run on every change, a short scripted pass on two real
phones before inviting anyone, and what the pilot itself tells us. Browser runs are renders of
the React Native app (Expo web build); they are **not** device tests, and nothing below claims a
device result that was not obtained on a device.

## 1. Automated suites

| Suite | Command | What it proves | Last result (P1, 7 Nov 2026) |
|---|---|---|---|
| Typecheck, lint, unit | `pnpm check` | Types across the monorepo, lint rules, shared formatting/error mapping | pass, 23 unit tests |
| Integration (RLS, RPCs, Storage, Edge Functions) | `pnpm test:integration` (needs `supabase start` and `supabase functions serve --env-file supabase/functions/.env.test`) | Every write path, permission and race against a real local Postgres/Auth/Storage | **259/259** |
| E2E (browser, two isolated sessions) | `pnpm test:e2e` (needs Expo web on :8081, `pnpm web` on :3000) | Real UI journeys: sign-up, onboarding, publish, search, chat, offers, barter, statuses, moderation, resilience, account recovery, DÉMO screen tour at 3 sizes | see `docs/P1_READINESS_REPORT.md` §Tests |
| E2E without DÉMO data | `supabase stop --no-backup && supabase start`, grant a moderator (SETUP_PRODUCTION §1.5), then `E2E_SEED=0 E2E_MODERATOR_EMAIL=… E2E_MODERATOR_PASSWORD=… pnpm test:e2e journey community pricing resilience account-recovery` | The member journeys need no seeded users; a SQL-granted `moderator` can act on reports | **31/31**, integration **259/259** on the same empty database |
| E2E with e-mail confirmation | set `enable_confirmations = true` under `[auth.email]` in `supabase/config.toml`, restart Supabase, `E2E_EMAIL_CONFIRMATIONS=1 pnpm test:e2e email-confirmation`, then restore the file | Sign-up on a project that requires confirmation (Mailpit catches the e-mail locally) | **1/1** |
| Pilot metrics queries | `scripts/check-pilot-metrics.sh` | Every query in `docs/PILOT_METRICS.md` runs, read-only | 12/12 blocks |

E2E global setup refreshes the DÉMO statuses that would expire during the run (they are
24-hour statuses created relative to now), so the screen tour does not break with time.

### Failure conditions covered (P1 attack list)

| Condition | Where | Result |
|---|---|---|
| Duplicate offers (triple tap, double tap in the UI) | integration `15-adversarial`; E2E `resilience` | One pending offer; the UI shows no error. **Defect found and fixed**: the concurrent duplicate surfaced a misleading French error |
| Concurrent / stale acceptance | integration `15` | Two simultaneous accepts → one agreement; a countered or expired offer cannot be accepted; a sold item refuses offers |
| Agreement terms immutable | integration `15` | Survive edits and deletion of the listing; direct tampering has no effect |
| Network cut during upload | E2E `resilience` | Two cuts in a row, automatic retry, the article is published |
| Network cut while sending a message | E2E `resilience` | « Connexion impossible… », the text stays in the composer, retry sends it |
| App closed during publication | E2E `resilience` (page reload) | Local draft restored, « Recommencer » clears it. Not tested as a real app kill on a phone |
| Expired statuses | integration `04`; seed fixture refresh | Hidden on read after 24 h; DÉMO fixtures refreshed before runs |
| Outdated shared link to a deleted article | E2E `resilience` | « Article indisponible » in the app, 404 on the web |
| Blocking after a conversation / agreement | integration `15` | No more messages either way, no new offers, the agreement record stays readable and unchanged |
| Deleted, hidden, private content | integration `15`; E2E `journey` (SAF-01) | Gone by id, from search and from offers; private accounts' listings hidden even with a pending follow; hidden listing unavailable |
| Unauthorized access | integration (whole RLS matrix), `15` (forged / expired / malformed tokens) | 401 for forged tokens; no cross-user writes in Storage |
| Invalid / oversized media | integration `15` | Avatar over 5 MB refused; HTML files refused in every bucket |
| Resume after prolonged inactivity | E2E `resilience` | An expired access token is refreshed silently on return |
| Auth expiration and recovery | E2E `resilience`, `account-recovery`; integration `15` | Refresh works; after sign-out everywhere the old refresh token fails; **defect found and fixed**: the password-reset link opened « Unmatched Route » |
| Fresh database seed | `pnpm seed` on an empty database | **Defect found and fixed**: the first-time DÉMO seed failed half-way |

## 2. What only devices can tell (not done yet)

No phone, simulator, Android SDK or Expo account was available to the build environment. These
stay **NOT_TESTED** until done on real devices:
- install from an EAS build (Android APK, iPhone internal/TestFlight), first launch, splash;
- OS permission prompts (camera, photos, microphone, notifications), accepted and refused;
- e-mail links opening the app: `jefeli://sign-in` (confirmation) and `jefeli://reset-password`;
- keyboard covering fields, safe areas, status-bar colours, Android back gesture;
- camera photo/video capture, video upload and playback, voice messages;
- a real app kill during publication, a real airplane-mode cut, hours in the background;
- push notifications (need EAS project id + FCM/APNs credentials);
- native share sheet and WhatsApp links opening the web page;
- performance on a modest Android phone (scrolling the feed, opening a chat with many messages).

## 3. Two-phone script before inviting anyone (owner, ≈ 45 minutes)

Use two phones (ideally one Android, one iPhone), each with the pilot build, against the pilot
project. Note the phone model, OS version and build number. Take a screenshot of anything wrong.

**Phone A (seller)**
1. Install, open: the welcome screen appears and says « Connexion par SMS (+221) : bientôt.
   Utilisez l’e-mail pour le moment. »
2. Create an account with a real e-mail. If confirmation is on: open the e-mail **on this
   phone**; the link opens the app on « Se connecter »; sign in.
3. Onboarding: name, pseudo (« Disponible »), city, 18+. Keyboard open: the button stays reachable.
4. Publish an article with a photo taken with the camera (allow the camera): « Prix affiché »,
   then a second one « Vendre ou échanger » « Sur demande ». Close the app during the second
   upload, reopen: the draft is offered back.
5. Publish a 24-hour status. Turn on airplane mode, try to publish, turn it off: it retries.

**Phone B (buyer)**
6. Create an account, onboard, find A's article in Explorer by text and by category.
7. Write to A from the article. On A: the message arrives without refreshing (and a push
   notification if push is configured). Reply.
8. B makes an offer; A counters; B accepts → agreement. Then a Wecci proposal on A's second
   article with a cash difference; A accepts.
9. Both mark the first exchange done in « Mes accords et échanges »; B leaves a review.
10. Share A's profile to WhatsApp from B: the link opens the web page.
11. B reports A's second article; in `/admin` (moderator account) hide it with a reason; on B the
    article is « indisponible ».
12. B blocks A; A can no longer open B's profile or write to B.
13. B: « Mot de passe oublié ? » → e-mail opened on the phone → the app opens « Nouveau mot de
    passe » → save → signed in. Sign out, sign in with the new password.
14. Leave both phones untouched for 2 hours (or overnight), reopen: still signed in, feed loads.
15. Delete both test accounts from Réglages.

Record each step as pass/fail with the phone model in the pilot notes. Any S1/S2 failure
(PILOT_OPERATIONS §7) blocks the invitations.

## 4. During the pilot

- Weekly: run the metrics (`docs/PILOT_METRICS.md`), read the support channel, list the top
  problems, decide fixes. Each fix: a failing test first, then the fix, then the suites above.
- Every reported bug gets: phone model, build, steps, screenshot, and the date/time to find it in
  the Supabase logs.
- Exit review after 4 weeks with the « What good looks like » table in PILOT_METRICS.
