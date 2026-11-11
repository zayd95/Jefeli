# Jëfëli web beta — go / no-go (11 Nov 2026)

Scope: the W1 → W1.3 stack (draft PRs #2 → #6, all still drafts) on the Vercel previews of
`feature/w1.3-create`, against jefeli-staging. Nothing is public; nothing was merged.

## Decision

**NO-GO to invite outside beta testers today. GO for the owner's own acceptance on the
previews.** The product journeys work on the hosted stack; what blocks real testers is
configuration (account e-mails, account deletion) and one untested browser (Safari).

## Working previews (Vercel login of the owner's account opens them)

- App: https://jefeli-app-git-feature-w13-create-habibjallow95-9380.vercel.app
- Public web pages: https://jefeli-web-git-feature-w13-create-habibjallow95-9380.vercel.app

Both now build: the schema check before each build passes against the synchronized staging.

## Done and verified

| Area | Result |
|---|---|
| Staging migrations | 6/6 applied in order after a verified backup (handed to the owner); counts unchanged; schema identical to the local reference; history 15 → 21 (`docs/STAGING_MIGRATION_PLAN.md`) |
| Deploy check | `✓ Schema compatible: 45 tables, 53 functions` against staging; both previews build |
| Hosted security | 33/33 anonymous probes (private tables, writes, member functions, `private.*`, uploads, private bucket) |
| Hosted journeys (`tests/e2e/specs/hosted.spec.ts`) | 8/8 in the browser on the final previews (`46a2932`): H-00 → H-07. H-08 (public web page) checked through Vercel's authenticated fetch: three photos, the voice player and the article; the browser run of H-08 was refused by the preview's access protection, not by the page |
| Clean regression (local, database reset, code `46a2932`) | `pnpm check` pass (unit 28/28) · integration 297/297 · browser 53 passed, 10 skipped (9 hosted-only, 1 gated e-mail test) |

Hosted journeys, on the preview with two DÉMO test accounts:
- a real article;
- a publication with 3 photos, a narration that walks through them (« visite guidée ») and the
  linked article, published and found in Accueil;
- the buyer follows, listens (nothing plays by itself; photo 2 follows the voice), opens the
  article, writes to the seller, who receives it;
- the publication shared as a status: the voice plays, photos follow;
- after the status' 24 hours (forced on the test row), the status is gone and the publication
  and all its files are still there;
- a friends-only publication: invisible to a non-friend, its file not public;
- uploads cut twice: retried automatically; uploads failing: the draft stays, « Réessayer »
  publishes;
- a refused microphone at 360 pt: explained, nothing attached;
- sign-up with an address Supabase refuses, or after too many attempts: a precise message
  (it was « Une erreur est survenue » before this run, fixed);
- the public web page plays the voice and shows the three photos and the article.

## Blockers before inviting testers (owner decisions)

1. **Account e-mails (blocks sign-up).** On staging, new accounts must confirm their e-mail, but:
   the Site URL is `http://localhost:3000`; the redirect allow-list only has an old Lovable
   preview; e-mails go through Supabase's built-in sender (2 per hour, and per Supabase's
   documentation only to the project team's addresses). A tester would most likely never get a
   working confirmation link. Fix (Dashboard › Authentication): set the Site URL and redirect
   URLs to the beta address, and connect an e-mail provider (custom SMTP; a provider account may
   cost money: owner's choice). Not verified with a real inbox from here.
2. **Account deletion.** The `delete-account` Edge Function is not deployed on staging (no
   function is), so « Supprimer mon compte » fails on the hosted app. Deploying it (and the
   media/status clean-up functions) needs the owner's go-ahead.
3. **Safari / iPhone voice.** Chrome records voices as WebM/Opus. Recent Safari plays it; older
   iPhones may not. Not testable here (no Safari or device). Owner test: record in Chrome, listen
   on the iPhone (feed, status, article, public page); and record on the iPhone, listen in
   Chrome.

## To fix before a public launch (not blocking the owner's acceptance)

- The previews' public links point to the W1 previews (« Réagir sur Jëfëli », share and canonical
  URLs): set the site and app URLs of the beta deployment in Vercel.
- The previews are behind Vercel's login: testers need the production deployment (or share
  links that expire in 23 hours).
- Hardening: `private.upload_quota_ok()` is executable by PUBLIC (used by the upload policy;
  `private` is not exposed through the API): restrict it to `authenticated` in a later migration.
- Test data on staging: two DÉMO accounts (« Test Vendeuse W1.3 », « Test Acheteur W1.3 ») and
  their publications, article and conversation. Remove them when the owner wishes.

## What the owner can do now

1. Open the app preview, sign in with your own account, and try the journeys above (the + menu,
   a narrated publication, an article in your voice, a status).
2. Decide 1–3 above. With 1 and 2 done and 3 checked on an iPhone, the web beta can open to
   invited testers.
