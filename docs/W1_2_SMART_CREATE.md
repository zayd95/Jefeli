# W1.2 — Smart create & connected media

Branch `feature/w1.2-smart-create`, stacked on W1.1 (draft PR #4). Principle: **Montre, raconte, vends.**

## 1. Audit (7 Nov 2026, before any change)

| Area | Found |
|---|---|
| Entry | The dock's « Publier » opens the Publication composer directly; Article and Statut sit in its top switcher. No menu, no draft hint |
| Publication composer | One scroll: intent chips, text, photos/video strip (10), « Identifier un article » (horizontal list of the member's active articles, max 5), audience. Local draft (AsyncStorage) with a « restored » banner |
| Article, Statut | Working, separate screens (one-scroll listing form; status composer with gallery, caption, audience, article tag) |
| Audio | **Only in chat**: tap the mic, recording bar, stop **sends immediately** (no pause, no preview), 120 s cap, no waveform. The web MIME type is hard-coded `audio/webm`, although Safari records MP4 |
| Server, audio | `post_media.kind` and `stories.media_kind` accept image/video only; `public-media` bucket has no audio types; a voice message's file is checked for ownership but **not for type or length** |
| Product context in chat | `message_about_product` opens the conversation with a product card; later messages carry no product context |
| Statuses | Own file only (`storage_path` required): sharing a post's media to a status would mean uploading it again |
| Playback | W1.1 store: one **video** at a time. Chat voice notes play independently (a voice note and a video can sound together) |
| Thumbnails | Profile previews, the web share pages and the status viewer assume `media[0]` is an image or a video |

## 2. What we change in the brief, and why

The brief is right on the structure (one global entry, one composer, one recorder, references
instead of copies). These changes make it faster to use and more honest about what it can do:

1. **Publication sits directly above the + button.** + then a tap on the same spot = Publication,
   so the most common action costs no extra travel. Statut (left) and Article (right) fan out on a
   shallow arc within thumb reach. On a phone under 360 pt wide, with large text or a screen
   reader, the same choices come as a plain sheet with one-line descriptions.
2. **« Commencer par » quick starts** in the menu, because a seller often knows *how* they want to
   speak before *what* they publish:
   - 🎙 **Ma voix**: opens the composer with the recorder already listening, for a voice
     publication or a narration.
   - 🏷 **Présenter un article**: shown only to members with active articles. Pick one and the
     composer opens with it attached and the recorder ready.
   - ↺ **Reprendre le brouillon** appears only when a real draft exists, with what it holds
     (« 4 photos · voix 0:42 »).
3. **« Visite guidée » narration.** While recording over photos, the seller taps the photo they are
   talking about. Buyers who press play see the gallery follow along; a manual swipe hands
   control back to them, and the audio keeps playing. This needs no video rendering, only a few
   timestamps stored with the audio.
4. **The spoken language is shown before you listen**: optional Wolof · Français · Pulaar ·
   Sérère · Diola · Mandinka · Autre chips, shown as « 🎙 Wolof · 0:42 ». A buyer knows whether
   to press play.
5. **Waveform and 1× / 1.5× / 2× speed** on every voice card: a 3-minute explanation is skimmable.
6. **Voice messages carry their article.** A conversation opened from an article keeps an
   « À propos de … » chip; voice and text sent with it show the article under the bubble.
7. **Share to status by reference.** « Partager en statut » on your own publication or article
   creates a 24-hour status that points to it: nothing is uploaded again (good for data costs), and
   expiry removes only the status.
8. **Honest rule for video.** A video keeps its own sound. While a video is attached, « Voix » is
   disabled and says why (« La vidéo garde son propre son »). There is no mixing in this
   milestone.
9. **Words for those who cannot listen**: the composer suggests a short text under voice-only
   publications (accessibility, and search).

## 3. Design

### + menu
- The feed stays visible behind an ink scrim. The + turns into × in the same place.
- Dismissed by ×, a tap outside, Android back or Escape.
- Every action is ≥ 56 pt with a label and an accessibility hint.
- Opens with a short spring; reduced motion gets an instant fade; a light haptic on native.
- Layout: three circles on an arc (Statut · **Publication** · Article), the « Commencer par » pills
  above them, and the draft pill on top when a draft exists.

### Publication composer
- Unchanged top: the Publication · Article · Statut switcher.
- The body shows what is attached:
  - text;
  - a photo/video strip;
  - the voice card (play, waveform, language, Refaire, Retirer);
  - article chips;
  - audience.
- New **attachment toolbar** at the bottom, in thumb reach: **Photos · Vidéo** · **Voix** ·
  **Article** (an article picker sheet with up to 5). Labels are always visible.
- Allowed combinations:
  - text;
  - photos;
  - video;
  - voice alone;
  - photos + one narration;
  - any of these + up to 5 articles.
- Refused: video + voice. A post needs text, visual media or a voice.

### Recorder (one component: publication, status, chat)
- Record · Pause · Reprendre · Terminer, with a live waveform and « 0:42 / 3:00 ».
- Warns at 2:45 and stops at 3:00. Recordings under 1 s are refused.
- After stopping: preview, play from any point, Refaire, Supprimer, Utiliser.
- Microphone permission: an explanation first. If refused, a clear message and, on a phone, a
  shortcut to the settings.
- Interruption: if the app goes to the background or the tab is hidden, it pauses instead of
  losing the take.
- Draft recovery: the take is kept with the draft (a file on the phone; IndexedDB in the browser,
  where a blob URL dies on refresh).
- Recording format:
  - web: AAC/MP4 when the browser can record it (plays everywhere, Safari included), WebM/Opus
    otherwise;
  - native: AAC.
  - The MIME type sent is the one the browser actually produced.

### Feed, profile, Explorer
- **Narrated photos**: an « ▶ Écouter · Wolof · 0:42 » bar over the photos. It never plays sound
  by itself and keeps playing while the gallery changes.
- **Voice only**: a voice card with the author's photo, a large play button, the waveform,
  language and speed.
- **One audible source at a time** for every video, voice publication, narration and chat voice
  note. Each pauses when its card leaves the screen, when you leave the screen, when the tab is
  hidden or when the app goes to the background.
- Profile previews and the web share pages show a voice tile, never a broken image.
- Explorer stays product-first; tagged publications lead to the live article page (same
  visibility rules).

### Chat
- Mic → recording bar with Pause and Terminer → preview bar (play, Supprimer, Envoyer).
- Product context chip as described in §2.6.
- A voice message stays private: it has no share action, its file is in the private bucket, and
  publishing anything requires its own new publication. Only the creator can attach their own
  files to a publication: the server checks ownership.

### Statuses
- New « Voix » status (voice card with the caption).
- « Partager en statut » from your own publication or article.
- The status viewer renders the referenced item (photo, video, voice) and links to it.
- The status audience can never be wider than the shared publication's.

## 4. Server (migration `20261110000100_connected_media.sql`)

`post_media`:
- `kind` accepts `audio`;
- new optional columns `language`, `waveform` (≤ 64 values 0–100) and `cues` (narration
  timestamps → photo index).

`create_post`:
- at most one audio, never with a video;
- 10 visual items maximum;
- cues must point to existing photos inside the audio's length.

Audio MIME types are added to `public-media`. The W1.1 trigger now checks audio too:
- `audio/*` file;
- duration required, ≤ 180 s.

Voice messages:
- `audio/*` file, ≤ 180 s;
- `product_id` allowed on text and voice messages when the sender can see that article.

`stories`:
- `media_kind` accepts `audio`;
- new `post_id`;
- `storage_path` may be empty only when the status points to a post or an article.

New RPC `share_to_status(post | article, caption, audience)`:
- you can only share your own items;
- the audience can be no wider than the post's;
- it is rate-limited like statuses.

Orphan cleanup keeps every file referenced by a post, article, message or live status (W1.1).

## 5. Out of scope (stated, not hidden)
- Video + separate voice-over (no synchronised mixing pipeline).
- Speech-to-text, translation, AI features.
- A paid video provider (decision pending, W1.1 §5).
- Native device tests: no iPhone or Android device in this environment.

## 6. What was built and verified (local stack, Chromium)

| Journey (brief) | Status | Evidence |
|---|---|---|
| + menu: three choices over the dimmed feed; Live gone; closes by ×, outside tap, Escape; sheet on narrow screens | **PASS** (browser) | E2E `smart-create` SC-01 (arc geometry, ≥ 44 pt targets), SC-08 (360/390/412 pt) |
| Seller: 4 photos + narration in Wolof + an article, published | **PASS** | SC-02 (real recording from the fake microphone, upload, `create_post`) |
| Buyer: photos without sound, chooses to listen, gallery follows the narration, article, contact | **PASS** | SC-03 (no sound before the press; « Photo 2 sur 4 » then 3 at the recorded moments; article → « Envoyer un message » → chat with the article as context) |
| Audio-only publication in the feed and on the profile | **PASS** | SC-05 (« Ma voix » quick start, voice card, « Publication vocale » on the profile) |
| Chat: voice about an article, preview before sending, seller answers by voice | **PASS** | SC-04 (pause/resume, preview, « À propos de … » under the bubble, both voices listed after reload) |
| Existing post shared to a 24-hour status by reference; expiry keeps the post | **PASS** | SC-06; integration `18-connected-media` (no copy, audience never wider, hidden when the post is deleted or the article archived, files not listed as orphans) |
| Reliability: refused microphone, cancelled take, refresh with a draft | **PASS** (browser) | SC-07 (« Micro non autorisé » at 360 pt, nothing attached after « Annuler », photo + voice restored from IndexedDB after a reload, then published) |
| Server rules: one voice, never with a video, 180 s, audio files only, owner's files only, cues valid, voice messages checked, private voice never public | **PASS** | integration `18-connected-media` (14) |

Suites on this branch: `pnpm check` pass (unit 25/25) · integration **294/294** · E2E **46 passed,
1 gated skip** (e-mail confirmation), including `smart-create` 8/8. The W1.1 video spec expected
the chat URL to end at the conversation id; a conversation opened from an article now carries
`?about=<article>`, and its pattern was updated (the journey itself is unchanged). Native path:
`expo export --platform ios --platform android` builds both Hermes bundles (≈ 11 MB each).
Evidence: `docs/evidence/e2e/smart-create/`.

## 7. Not verified, or limited (stated, not hidden)

- **No physical iPhone or Android device, no simulator.** The recorder and players use expo-audio's
  native APIs (metering, pause/resume, AAC); they compile in the native bundles but were not run
  on a phone.
- **Safari (iPhone):**
  - Chrome records WebM/Opus. iPhone playback of those files is untested (recent iOS versions
    play WebM audio; older ones may not).
  - Safari records MP4, which plays everywhere.
  - A voice status starts by itself when opened. Safari may ask for a tap; the play button is in
    the status header.
- A recording interrupted by the app being closed (not just backgrounded) is lost. Backgrounding
  pauses it; a finished take is kept with the draft.
- The voice length is declared by the app, like video length in W1.1: the server checks it is
  ≤ 180 s and the bucket caps the size at 50 MB. A transcoding provider would measure it (W1.1 §5).
- Waveforms are computed on the device and are decorative: the server checks only their shape
  (≤ 64 values, 0–100).
- « Visite guidée » cues are taps during the recording. Removing a photo afterwards drops the cues
  that pointed to it; reordering photos is not supported (the strip has no reordering).
- Explorer is unchanged (product-first). Publications appear in Accueil and on profiles; articles
  tagged in them open their live page with the same visibility rules.
