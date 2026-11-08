# W1.3 — Créer, c’est montrer

Branch `feature/w1.3-create`, stacked on W1.2 (`feature/w1.2-smart-create`, PR #5). Approved
design: the W1.3 design canvas (11 screens), with the owner's corrections of 8 Nov 2026.
Nothing here is merged, applied to jefeli-staging or deployed publicly.

## 1. What changed for members

| Where | Before (W1.2) | Now (W1.3) |
|---|---|---|
| The + | A radial arc, « Commencer par » quick starts, « Reprendre » pill, dense scrim | Three cards side by side (Statut · Publication · Article), ±5°, no overlap, over a soft scrim: the feed stays recognizable. Nothing else |
| Drafts | Restored silently; separate drafts per entry point; « Recommencer » wiped without asking | One draft per kind. A card with a draft carries « BROUILLON ». Tapping it asks « Continuer le brouillon » or « Nouvelle … »; starting anew confirms before deleting. Editors opened from anywhere else ask the same question |
| Publication | A form: type pills, text box, media strip, voice card, article chips, audience pills | The content makes the layout: a serif writing canvas → photos become the preview → or the voice becomes the publication. Type and audience are small pills; Média · Voix · Article toolbar |
| Preview vs. feed | Composer-only widgets | The preview is the feed's own media block (`PostMedia`): same narration control, same gallery following the « visite guidée », same article chip |
| Recording | A sheet with a « Commencer » step and a review step | Full-screen studio that records at once; with photos, tap the photo you talk about. Terminer hands the clip back: the editor is the review |
| Gallery | Thumbnails with × only | Drag to reorder (the narration keeps pointing to the right photos), or select and use ← → (no drag needed) |
| Article | One-scroll form | A shop window: cover first (same media block as the article page), name and price in large type, Vendre · Wecci (troc) · Les deux, details as summary pills opening one sheet; a required empty pill turns gold and « Mettre en vente » lists what is missing |
| Article voice | — (only via a separate publication) | « Présenter en voix », stored with the article; plays on the article page over its photos, on the public web page, and in the optional feed share |
| Statut | A light form | Full screen in portrait: choose → photo/video fills the screen (Texte and Article on the side, audience at the top, Publier at the bottom) → or a voice with its own visual |
| Shared narrated publication in a status | Static first photo | Plays the publication's voice, photos following the cues, with pause; moves on when the voice ends |
| A failed feed request | « Oups » + retry on an otherwise dead page | A precise title (connexion, mise à jour, session, service), Réessayer, Explorer (or Se reconnecter), and copyable diagnostics; a failed refresh over visible posts is a quiet banner |

## 2. Statut narration: decision and tradeoff (owner's point 4)

- **Done, no backend change:** an existing photo + voice publication can be shared as a 24-hour
  status by reference (W1.2 `share_to_status`). The status points to the publication's files:
  nothing is uploaded or copied. W1.3 makes the viewer play its narration with the photos
  following the « visite guidée ». Expiry removes the status, never the publication.
- **Not done, reported:** a photo + voice status made directly in the Statut editor (not from a
  publication). `stories` holds one file per row; it would need a second file (the voice) with its
  own checks, quota, cleanup and moderation path, plus the viewer and reply flows. That is a schema
  change across `create_story`, `can_view_story`, `check_media_row` and the cleanup function. The
  Statut editor says how to do it today (« Publiez-la, puis « Partager en statut » »).

## 3. Backend changes (one migration)

`supabase/migrations/20261111000100_article_voice.sql`: `product_media` accepts one `audio` row
(language, waveform ≤ 64 values, cues ≤ 60), never with a video, 180 s at most, an `audio/*` file
the seller owns, cues inside the voice and pointing to existing photos. `create_listing` and
`set_listing_media` keep their signatures (the voice travels in `p_media`); a voice alone is not an
article. Two new `private.*` helpers, revoked from `public, anon, authenticated`. No rows changed.
Integration: 3 new tests in `18-connected-media` (storage, refusals, set_listing_media).

Nothing else on the server was rebuilt: create_post, statuses by reference, upload checks,
quotas, moderation and RLS are W1.2's.

## 4. The staging « Oups » (kept separate)

- **Cause:** jefeli-staging has 15 migrations; the W1.2 preview asks for `post_media.language`,
  `waveform`, `cues` (and `stories.post_id`) on every feed request; PostgREST rejects the whole
  request.
- **No silent fallback:** the app does not hide missing columns.
- **Plan, backup, rollback:** `docs/STAGING_MIGRATION_PLAN.md` (six pending migrations in order,
  owner backup, baseline counts, two rollback scripts captured read-only from staging and dry-run
  locally). **Not applied:** needs the owner's go-ahead and a write-capable token.
- **Recoverable errors:** `describeFailure()` (`packages/shared/src/errors.ts`) and the home
  feed's error screen (`ErrorState` with diagnostics). Queries are no longer retried when retrying
  can't help (database behind the app, expired session).
- **Deploy check:** `scripts/schema-contract.mjs` + `supabase/schema-contract.json`, run before
  every Vercel build of both apps and in CI. A preview whose database is behind fails to build
  and names what is missing and the migration that adds it. **Consequence:** previews of this
  stack against jefeli-staging will fail at that step until the plan is applied. That is intended.

## 5. Verification (local stack)

See `docs/RELEASE_STATUS.md` « W1.3 » for the numbers and SHA. Browser journeys:
`tests/e2e/specs/create.spec.ts` (CR-01 … CR-09) and the updated `smart-create`, `media`,
`pricing`, `resilience`, `journey`, `community`, `screens` specs. Screenshots:
`docs/evidence/e2e/create/` and `docs/evidence/e2e/smart-create/`.

| Journey | What it proves |
|---|---|
| CR-01, CR-02 | Three cards side by side, no overlap, ≥ 44 pt, fit at 360 pt; ×, outside tap, Escape |
| CR-03 | Draft badge; Continuer; Nouvelle publication asks and only deletes after confirming; the editor asks when opened elsewhere |
| CR-04 | Write canvas → 3 photos → studio records at once, photos tapped → narration with visite guidée, language → reorder by buttons and by drag, cues follow → article linked → the editor preview's narration moves the gallery → published |
| CR-05 | A buyer in Abonnements: nothing plays by itself; listens; photos follow; opens the article; writes to the seller |
| CR-06 | Article window: required pills flagged before sending; voice presentation with visite guidée; buyer hears it on the article page with photos following; the feed share carries it; the public web page plays it (no broken photo) |
| CR-07 | A narrated publication shared as a status plays its voice, photos following |
| CR-08, CR-09 | Statut editor: photo full screen with text and article; voice status with its own visual, heard before publishing |
| resilience | A feed the server can't answer: offline (3 attempts) and database behind the app (1 attempt) → precise screen, diagnostics, recovery with Réessayer |

Not tested: physical devices (none available); hosted previews (staging behind, see §4).

## 6. Owner review

1. On the Vercel preview, once the staging plan is applied: tap +, open each card; publish photos
   with a spoken explanation; listen from a second account; make an article with « Présenter en
   voix »; share the narrated publication as a status.
2. Decide whether the native photo + voice status (§2) is worth a schema change, or whether
   « Partager en statut » is enough for the beta.
