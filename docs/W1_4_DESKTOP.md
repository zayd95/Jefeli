# W1.4 — desktop web (one app, two experiences)

Approved on 11 Nov from the design canvas, with ten refinements. One Expo application serves both experiences. Desktop gets its own layout, and the phone stays exactly as it was. Both share the same screens' logic, Supabase backend, auth, media, privacy rules and business logic. No new backend system was added; only one read-only query helper was added for the discovery rail.

## 1. Breakpoints (`apps/mobile/src/lib/layout.ts`)

| Mode | When | What changes |
|---|---|---|
| phone | native apps, or web narrower than 768 px | nothing: dock, smart + menu, full-width screens |
| compact | web 768–1099 px | 76 px icon sidebar, no discovery rail, Messages in two panes |
| wide | web ≥ 1100 px | 248 px sidebar with labels, discovery rail on Accueil, Messages in three panes |

Browser zoom is covered by the same rule, because zoom changes the CSS width. A 1440 px window at 125 % is 1152 px wide (wide layout). At 150 % it is 960 px (compact). At 200 % it is 720 px (phone layout, dock).

## 2. What desktop shows

- **Shell** (`components/desktop/DesktopShell.tsx`)
  - An Atlantic-night sidebar with Accueil, Explorer, Rechercher, Messages (unread badge), Notifications (badge), Enregistrés, Mon profil, Réglages and « Créer ».
  - « Créer » opens the same three-card menu as the phone's +.
  - Every item is a real link. Tab walks them in order, Enter follows them, and they can be opened in a new tab.
  - Messages always keeps the icon rail.
  - Screens without a desktop layout of their own (forms, settings, lists, offer and Wecci composers, publication detail) read in a centred 720 px column. Sign-in, sign-up, onboarding and password reset keep their 520 px phone column.
- **Accueil**
  - The dark social feed sits in a centred 640 px column.
  - On wide screens it has a contextual rail (`components/desktop/DiscoveryRail.tsx`). Its content is real only:
    1. « On cherche »: the latest « Je cherche » publications. These are real buyer requests, not filtered by city, and the title does not claim they are.
    2. Articles linked to the publications currently in the feed.
    3. « Près de chez vous · <city> »: recent articles in the member's city.
    4. The boutiques selling those nearby articles.
  - A section with nothing real to show is not rendered. There are no invented recommendations and no filler.
  - The verified badge appears only for `merchant_verified`.
- **Explorer**
  - A light commerce grid of 3–5 columns (230 px target, up to 1240 px wide). Categories wrap on two lines and the existing filters are unchanged.
  - Cards show the price, condition, location and seller, plus the verified badge only when it is backed by real verification.
- **Article**
  - Two columns from 940 px: the media (with its narration) on the left, and a sticky 380 px panel on the right with the title, price, actions (message, offer, Wecci) and seller.
  - One column below 940 px.
- **Social boutique**: the same profile, with a 4-column grid (3 below 860 px) in a 960 px column.
- **Messages workspace** (`components/chat/MessagesWorkspace.tsx`)
  - Panes: the conversation list, the active thread (the same `ChatView` as the phone), and, from 1100 px, a context pane (`ChatContext.tsx`).
  - The context pane shows the member, the article discussed, and the proposals (offers and Wecci) with their real status, safety notes, and the profile and report links.
  - Below 1100 px the third pane folds away.
- **Publishing**
  - The W1.3 adaptive Publication editor is unchanged. On wide screens the exact feed card renders beside it as you write (« APERÇU DANS LE FIL · TEL QU'IL APPARAÎTRA »). It is the same `PostCard`, with photos, narration, voice and the linked article.
  - The Article editor and the Statut editor keep their phone proportions in the column.
- **Statuses**: the viewer plays at phone proportions, as a 9:16 stage of up to 520 px on the night background. A wide window no longer stretches a portrait photo or video.

## 3. What did not change

- The phone experience is unchanged: at 390 px and 360 px every captured screen is pixel-identical before and after. The only exceptions are a relative timestamp and an avatar still loading (§ 4).
- No new tables, RPCs or functions were added. Desktop uses the same APIs and RLS.
- `fetchRecentRequests` and `fetchLatestConversationProductId` are read-only queries over existing tables.
- Visual identity: Atlantic Sand tokens, a dark social feed, light commerce surfaces, Fraunces and Hanken Grotesk. No Expat-Dakar or X styling was copied.

## 4. Validation (local stack)

- **Widths**: 1440, 1280, 1024 and 768 px, plus 390 and 360 px. There is no horizontal overflow on any captured screen (`document.scrollWidth − innerWidth ≤ 0`). E2E DT-01 also checks zoom equivalents of 1152, 960 and 720 px.
- **Phone unchanged**: before/after pixel comparison at 390 and 360 px over 8 screens: 14 identical. The two remaining differences are 14 px and 0 px over the threshold (a relative time and an avatar still loading).
- **Keyboard**: E2E DT-02. Tab order is Jëfëli → Accueil → … → Réglages → Créer, and Enter follows the focused link.
- **Media on desktop** (`tests/e2e/specs/desktop.spec.ts`, 8 tests, all passed):
  - DT-03: an article, then photos + narration + article in the editor beside the live feed preview, published.
  - DT-04: a 40 s video publication and a 12 s video status published from desktop.
  - DT-05: the buyer's feed plays the video muted, one at a time, at full column width (> 500 px). The narration moves the photos and pauses the video.
  - DT-06: the video status plays at phone proportions (380–520 px wide) to its end, past the 5.5 s image timer.
  - DT-07: the Explorer grid has 4 cards on a row at 1440 px, and the article panel sits beside the media.
  - DT-08: a price offer, accepted by the seller from their desktop workspace, then a Wecci. Both appear in the context pane with their real status. At 1024 px the pane folds away and nothing overflows.

## 5. Defects found and fixed during validation

- Sign-up at desktop width: the « Lire les conditions » link spanned the whole row, so a click on the row opened the conditions instead of ticking the box. The link is now as wide as its words.
- Sidebar items were not followed with Enter. They are now real `<a href>` links.
- Explorer category tiles stacked in one column. They now wrap in rows.
- The status viewer stretched across the window. It is now a 9:16 stage.

## 6. Out of scope (by decision)

There is no further visual expansion after this pass. The focus returns to activating phone and e-mail authentication and to the public beta (`docs/PHONE_AUTH.md`, `docs/WEB_BETA_GO_NO_GO.md`).

Evidence: `docs/evidence/desktop/` (before/after at each width, plus the E2E shots under `docs/evidence/e2e/desktop/`).
