# W1.1 — Media-first commerce

Branch `feature/w1.1-media-first`, stacked on `feature/w1-web-beta` (draft PR #3), itself stacked
on PR #2. Nothing is merged or deployed publicly. Dates: 7 Nov 2026.

**In one paragraph.** Live is out of the visible product (data and code kept, screens redirect).
Videos up to **3 minutes (180 s, inclusive)** work in publications, articles and 24-hour statuses,
and the **database** now enforces that limit, the file type, per-member upload quotas and the
expiry of status files. Feed and status playback were rebuilt around real video events. What
still blocks "every seller can post a 3-minute phone video" is **file size**: without a transcoding
service, a raw 3-minute phone video is usually larger than the 50 MB per-file limit of the Free
Supabase plan. The recommended fix is Cloudflare Stream, **which needs your approval** (§5).

## 1. Audit: what already worked before W1.1

| Area | State found |
|---|---|
| Photos and videos in publications and articles | Worked: Supabase Storage, upload with progress, automatic retry, cancel, local drafts, cover image |
| Video posters | Native only (expo-video-thumbnails). **On the web, no poster**: a black tile until playback |
| 24-hour statuses | Worked: image or video, exact 24 h expiry (`expires_at = now() + 24 h`), several per member in order, private reply → conversation, article tag, audience, delete, report, block, highlights |
| Status viewer | **Video cut short**: one wall-clock timer for everything, so a video moved on after the image duration (5.5 s) whatever its length; statuses were capped at 60 s |
| Feed playback | **Every video card could play at once**, nothing paused off-screen, in the background or when leaving Accueil |
| Limits | **Inconsistent and client-only**: statuses 60 s, posts/listings 10 min in the database; the declared « video » or « image » was never compared with the stored file; no upload quota |
| Orphaned files | No cleanup: abandoned uploads stayed forever |
| Live | Visible: « Live » publish tile, profile lives, privacy toggle, copy on sign-in and notifications |

## 2. What changed

### Live removed from the visible product
Publish tile, profile « Lives » link and sheet, the live ring, the « Lives des comptes suivis »
privacy toggle and the copy that promised lives (welcome screen, notifications, web landing page)
are gone. `/live/…` screens redirect to Accueil while the `live_streaming` flag is off. Tables, data,
webhooks and the flag are untouched: no destructive migration. **For you:** the legal drafts
(`cgu`, `confidentialite`, `regles`) still mention lives; they are yours and your counsel's to edit.

### Server-side rules (migration `20261109000100_media_videos.sql`)
- **180 s everywhere**, exactly 180 s allowed: publications, articles and statuses. A video must
  declare a duration (`video_duration_required`), more than 180 000 ms is `video_too_long`.
- **Declared kind = stored file**: a « video » must be a `video/*` object and an « image » an
  `image/*` object, a poster must be an image (`invalid_media`). The MIME type comes from the
  storage server, not from the client.
- **Upload quota** in the storage insert policy: 300 files per member per rolling 24 h and 2 GB
  stored in total. Above that, the app says « Limite d’envoi atteinte pour aujourd’hui. Réessayez demain. »
- **Orphaned files**: `list_orphaned_media()` (service role only) lists files older than 48 h that
  no publication, article, live status, highlight, message, profile photo or reported evidence
  uses. A file shared by two rows stays while either exists. The new Edge Function
  `cleanup-media` deletes them through the Storage API (service key required, `{"dryRun": true}`
  to preview). It is not scheduled yet (§6).
- **Expired statuses** (already enforced by the existing storage read policy, now covered by a
  test): their files cannot be opened by followers once `expires_at` has passed (signed URL
  refused), not only hidden in the list.
- New constraints are `NOT VALID`: they apply to new rows and never fail on existing data. No
  rows are changed.

### Publishing
- Web: the browser reads the video's real duration and size as soon as it is chosen and captures
  a cover frame (JPEG, 720 px). Over 3 min → « Vidéo trop longue : 3 minutes maximum. »; over
  50 MB → « Vidéo trop lourde (50 Mo maximum). Filmez en qualité standard ou raccourcissez-la. »,
  before anything is sent. The composer shows the cover and the duration.
- Fixed: on the web, expo-image-picker reports a video's duration in **seconds** while its types
  (and iOS/Android) use milliseconds. A 10-minute file the browser could not decode was taken
  for 0.6 s and passed the check.
- Fixed: a phone clip recorded at the 3-minute cap is often 180.03 s long in its container; it is
  now declared as 180 s instead of being refused by the server.

### Statuses
The viewer follows the video itself: the progress bar is the playback position, the next status
starts when the video ends, it pauses while a menu or sheet is open, shows the poster then a
spinner while loading, and if the video fails it says « Vidéo indisponible » and falls back to the
timer so the viewer never hangs.

### Accueil
- One video plays at a time: the most visible card (≥ 60 % on screen for 250 ms), muted.
- Paused when its card scrolls away, when leaving Accueil, when the tab or app goes to the
  background. Tap to pause or resume, a sound button, « Lecture impossible · Réessayer » on error.
- No muted autoplay when the member asked for less data (`Save-Data`, 2G) or reduced motion:
  a poster and a play button instead. Outside the feed, nothing downloads before a tap.
- Fixed: on the web every video was drawn at its pixel size in the top-left corner instead of
  filling its frame (a 1080×1920 clip showed as a zoomed crop) — the `<video>` element needs an
  explicit size (`videoFill` in `@/design`).
- Fixed: the play button of a video post sat inside a disabled « Ouvrir la publication » button;
  screen readers announced it as dimmed.

### Not changed on purpose
« Pour toi » keeps its existing ranking (relationships, locality, interests, recency, fair chance
for new members, diversity); video posts now play in it. Explorer is unchanged. No video boost,
recommendation model or ads, as asked; to revisit with beta data.

## 3. Limits in force

| Limit | Value | Enforced by |
|---|---|---|
| Video length | 180 s (inclusive) | database (posts, articles, statuses) + app at selection |
| File size | 50 MB per file | storage bucket (Free plan maximum) + app at selection |
| Types | JPEG, PNG, WebP, MP4, MOV, WebM | storage bucket; kind/MIME match in the database |
| Uploads | 300 files / 24 h, 2 GB in total, per member | storage insert policy |
| Status visibility | 24 h after publication, files included | RLS + storage read policy |
| Orphans | removable after 48 h (never < 24 h) | `list_orphaned_media` + `cleanup-media` |

Known limitation: the **duration is declared by the client**. Without a transcoding service the
server cannot read it from the file; the 50 MB limit bounds the cost of a lie. With Cloudflare
Stream the duration would come from the provider (§5).

## 4. Tests

| Suite | Result |
|---|---|
| `pnpm check` (typecheck, lint, unit) | pass; unit 24/24 (new: French copy for the video error keys) |
| Integration (local Supabase) | **280/280**; new `17-media-videos` (15): 180 000 ms accepted, 180 001 refused, status 180 s / 180.5 s, kind/MIME mismatch, video poster, someone else's file, quota by count and by size, orphans (old vs recent, referenced, shared, service role only), `cleanup-media` (401 without key, deletes), expired status file. The private-function allowlist now includes `upload_quota_ok()` (called by the storage policy) |
| E2E `media.spec.ts` (Chromium, real backend, clips generated by ffmpeg) | **5/5**: 3 min 01 s refused at selection · exactly 3 min published with cover and article tag, stored file lasts 180 s · follower sees it muted in Abonnements, one at a time, full width, tap pause/resume, paused after leaving Accueil · article and conversation one tap away · 12 s video status plays to its end (past the 5.5 s image timer) and then closes |
| Full E2E (Expo web dev server) | **39 passed, 1 skipped** (e-mail confirmation, gated): journey, community, pricing, resilience, account-recovery, media, screen tour on 3 sizes. The screen tour used to check a disabled « Live » tile; it now checks that Live is absent and that `/live/host` leads to Accueil |
| Devices | **Not tested** on Safari iPhone or Chrome Android (none available) |
| Hosted journey (jefeli-staging + Vercel preview) | **Not run**: the migration is not applied to staging (read-only token) and this session cannot reach the hosted URLs |

Evidence: `docs/evidence/e2e/media/`.

## 5. Video provider: evaluation and approval request

### Why the current setup is not enough for 3-minute phone videos
- **Size.** A phone records 1080p at roughly 6 Mbit/s (HEVC) to 17 Mbit/s (H.264): a 3-minute clip
  is about 130–380 MB. The Free plan allows 50 MB per file. iPhone builds ask the picker for
  medium quality (iOS re-encodes), so they usually fit; **Android (`videoQuality` is iOS-only) and
  the web upload the original file** and will often be refused with « Vidéo trop lourde ».
- **Playback.** iPhones record HEVC `.mov`; Chrome on Android and desktop often cannot play it.
  Without transcoding, a buyer may see « Lecture impossible ».
- **Bandwidth in Senegal.** One progressive file at the recorded bitrate, no adaptive quality:
  slow starts and stalls on 3G/4G, and the full file is billed as egress.

### Options

| | Supabase Storage (today) | Supabase Pro | Cloudflare Stream (recommended) |
|---|---|---|---|
| 3-min phone video accepted | often not (50 MB) | yes (file limit can be raised) | yes |
| Plays on every phone/browser | no (HEVC) | no (HEVC) | yes (transcoded to H.264, adaptive HLS/DASH) |
| Adapts to weak connections | no | no | yes |
| Resumable direct upload from the phone | no (single PUT with retry) | partially (resumable uploads) | yes (tus, one-time upload URL) |
| Duration verified server-side | no | no | yes (provider metadata; `maxDurationSeconds` on the upload URL) |
| Cost | $0 | $25/month + usage | storage + delivered minutes (below) |

### Cost estimate (assumptions, to confirm on the vendors' pages)
Published rates found by web search (Cloudflare's and Supabase's own pages were not reachable from
this environment): Cloudflare Stream **$5 per 1,000 minutes stored** (prepaid, any size),
**$1 per 1,000 minutes delivered**, encoding free; Supabase Pro **$25/month** with 100 GB of files
and 250 GB of egress, then about $0.021/GB stored and $0.09/GB egress.

Beta assumptions: 150 active sellers posting 12 videos a month of 1.5 min (2,700 min/month;
expired statuses deleted from Stream after 24 h, so about 2,000 min/month kept).

| Viewing (all members) | Delivered min/month | Stream delivery | Stream storage (month 3, ~6,000 min) | Stream total |
|---|---|---|---|---|
| Low: 1,000 members × 2 min/day | 60,000 | $60 | $30 | **≈ $90/month** |
| Mid: 1,000 members × 5 min/day | 150,000 | $150 | $30 | **≈ $180/month** |
| High: 3,000 members × 5 min/day | 450,000 | $450 | $30 | **≈ $480/month** |

For comparison, the mid case on Supabase Pro (progressive files at ~1.5 Mbit/s ≈ 11 MB per minute)
is about 1.6 TB of egress: $25 + ≈ $126 ≈ **$150/month**, with none of the playback benefits.
Muted autoplay counts as delivered minutes; only the single most visible card plays and nothing
is preloaded off-screen, which already limits it. A monthly budget alert should be set at the
amount you approve.

### What Stream would add (not built; design ready)
1. Edge Function `video-upload-url` (the Cloudflare API token stays a Supabase secret, never in
   the app): checks the member and the quota, returns a one-time tus upload URL limited to 180 s.
   The file goes from the phone to Cloudflare directly, never through Vercel.
2. Table `media_assets` (owner, provider id, `uploading | processing | ready | error`, duration,
   size, poster) and a signed webhook that marks a video ready with the provider's real duration.
3. Publishing accepts only `ready` videos; the composer shows « En cours de traitement » and never
   claims success before.
4. Private statuses use signed playback URLs; `cleanup-media` also deletes provider videos of
   expired statuses and abandoned uploads.
5. Supabase stays the source of truth for who owns what and who may see it.

**Decision needed:** approve Cloudflare Stream with a monthly cap (suggested: $200 for the beta),
or keep Supabase Storage for the beta and accept that many Android and web 3-minute videos will
be refused as too heavy.

## 6. Operations
- Apply `20261109000100_media_videos.sql` to jefeli-staging with the three earlier migrations
  (`docs/W1_WEB_BETA.md` §3), then deploy `cleanup-media` with `verify_jwt = false`.
- Run `cleanup-media` with `{"dryRun": true}` first and read the list; then schedule it daily
  (Supabase cron calling the function with the service key, or by hand during the beta).
- Watch storage size and the number of « Limite d’envoi atteinte » errors in the first week.
