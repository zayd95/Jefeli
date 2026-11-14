# Jëfëli — pillars audit (Wecci · Waxaale · Boutique · Jëf · Social)

Audit of the code against the owner's new four-pillar direction (14 Nov 2026). Read-only: no code,
schema or branch was changed to write it.

- **Code audited:** branch `feature/p1-identity`, HEAD `2008b6d` (committed code only).
- **Baseline, before the P1 prototypes:** this audit describes the code as it was at `2008b6d`.
  The three P1 prototypes added afterwards on the same branch (Waxaale card + voice offers, « Marché
  conclu » moment, market aisles — `docs/IMPLEMENTATION_LOG.md`) are mentioned where relevant but the
  tap counts and the inventory below are **not** re-counted for them.
- **Sources:** `apps/mobile/src/app/**` (every route, listed with `find`), `apps/web/src/app/**`,
  `supabase/migrations/*.sql`, `supabase/functions/push-dispatch`, `packages/shared/src`.
- **What « working » means here:** the code path exists, and `docs/RELEASE_STATUS.md` reports it
  as verified by E2E or integration tests in **browser renders** of the app. No physical Android
  or iOS device was used, here or in earlier passes. Anything not traced to code or to a reported
  test is marked « non vérifié ».
- **Tap counts** come from reading the screens' code, not from a device session. OS dialogs
  (photo picker, WhatsApp) are counted as the fewest taps they usually need, and marked « OS ».

## 1. Feature and screen inventory

Feature flags are seeded in `20261102000100_foundation.sql`. Later migrations only change
`phone_auth`'s description.

| Flag | Value |
|---|---|
| `live_streaming` | false |
| `phone_auth` | false |
| `facebook_login` | false |
| `apple_login` | false |
| `contacts_matching` | false |
| `push_notifications` | true |
| `voice_messages` | true |

Admins can change them in `/admin/reglages`.

Pillar key: **W** Wecci · **X** Waxaale · **B** Boutique · **J** Jëf · **S** Social · — none.

### 1.1 Mobile app (`apps/mobile/src/app/`, Expo Router; the same build serves Expo web)

| Route (file) | What it does | Status | Pillar | Decision | Reason |
|---|---|---|---|---|---|
| `_layout.tsx` | Root: fonts, auth, Realtime inbox, push registration, `Stack.Protected` guards (auth → onboarding → app) | working | — | keep | The guards are where a « return-to » after sign-up must be added (friction F2) |
| `onboarding.tsx` | One screen: avatar, Votre nom, Votre pseudo, city, « Je confirme avoir 18 ans ou plus », « Entrer dans Jëfëli » | working | S | keep | The pseudo starts empty after e-mail sign-up (F8) |
| `reset-password.tsx` | Sets a new password from the recovery e-mail | working | — | keep | Account hygiene |
| `(auth)/_layout.tsx`, `(auth)/index.tsx` | Welcome: « Créer un compte » / « J’ai déjà un compte » | working | — | keep | — |
| `(auth)/sign-up.tsx` | E-mail sign-up with 18+ and CGU checkboxes and an optional Turnstile CAPTCHA. Phone tab only if `phone_auth` | working (e-mail) · hidden (phone) | — | keep | — |
| `(auth)/sign-in.tsx` | E-mail sign-in. Phone OTP tab only if `phone_auth` | working (e-mail) · hidden (phone) | — | keep | — |
| `(auth)/phone.tsx` | Redirects to `/sign-in?method=phone` | working (redirect) | — | cut later | Legacy route |
| `(auth)/forgot-password.tsx` | Sends the recovery e-mail | working | — | keep | — |
| `(app)/_layout.tsx` | App stack (modals: publish, offer, report, statuses, live) + desktop shell | working | — | keep | — |
| `(app)/(tabs)/_layout.tsx` | Five-item dock: Accueil · Explorer · Publier (+) · Messages · Profil. « + » opens `CreateMenu` (Statut · Publication · Article) | working | — | rename | Make the dock pillar-led (e.g. « Wecci » for Explorer; « + » offers the four Wecci modes) |
| `(app)/(tabs)/index.tsx` | Accueil feed (« Pour toi » / « Abonnements »), story rail, chips (city, « Wecci · Échange », « Occasions »; « En direct » only if live is on) | working | S | keep | Social core. The « Wecci · Échange » chip must be renamed (F10) |
| `(app)/(tabs)/explore.tsx` | Explorer: city, category, Tout · Neuf · Occasion · « Wecci · Troc », Filtres sheet, « Tendances cette semaine », « Vendeurs à suivre » | working | W | rename → Wecci home | It is already the classifieds browser. It lacks Donner and Je cherche |
| `(app)/(tabs)/publish.tsx` | Redirects to `/publish` (the tab button opens the menu instead) | working (redirect) | — | keep | Technical |
| `(app)/(tabs)/messages.tsx` | Conversation list (desktop: three-pane workspace) | working | X | keep | Waxaale happens in the thread |
| `(app)/(tabs)/profile.tsx` | Own profile through `ProfileView` (Publications / Boutique tabs, share sheet) | working | S + B | keep | — |
| `(app)/publish/_layout.tsx`, `publish/index.tsx` | Stack. `/publish` redirects to `/publish/post` | working | — | keep | — |
| `(app)/publish/post.tsx` | Publication editor: photos, video ≤ 3 min, voice narration, linked article, type pill (Je partage / Je cherche / Je propose / Votre avis ?), audience | working | S (+ W for « Je cherche ») | merge « Je cherche » into Wecci | A wanted request should be a structured Wecci mode, not a post type |
| `(app)/publish/listing.tsx` | Article editor: media, name, Vendre · Wecci (troc) · Les deux, Prix affiché / À discuter / Sur demande, details sheet, « Présenter en voix », « Partager aussi dans mon fil », « Mettre en vente » / « Proposer en troc » | working | W | rename | Becomes the Wecci composer with four modes. « Wecci (troc) » becomes « Troquer » |
| `(app)/publish/status.tsx` | Statut editor (photo / video / voice, 24 h, audience, tag an article) | working | S | keep | — |
| `(app)/p/[id].tsx` | Article page: media, price label, chips, seller, WhatsApp / share, « Envoyer un message », « Faire une offre », « Proposer un troc ». Owner: « Marquer réservé » / « Marquer vendu » / « Remettre en vente » | working | W + X | keep | Central to both pillars. Status is manual and not tied to deals (F4) |
| `(app)/listing-edit/[id].tsx` | Edit an owned article (fields and media) | working | W | keep | — |
| `(app)/offer/[productId].tsx` | Price offer, barter proposal (pick own article + optional cash difference + who pays), or counter-offer (`?counter=`), optional message | working | X | rename → Waxaale composer | No voice in the UI, no custom expiry. Barter needs an existing listing (F7) |
| `(app)/chat/[id].tsx` | Thread: text, photo, voice (flag `voice_messages`), article cards (« + » › « Envoyer des articles », up to 5), `OfferCard` (Accepter / Contre-proposer / Refuser / Retirer ma proposition / « Voir l’accord ») | working (photo / voice UI NOT_TESTED on device) | X | keep | The Waxaale timeline lives here |
| `(app)/agreement/[id].tsx` | Immutable terms, safety tips, « Déclarer l’échange terminé », « Annuler l’accord », « Signaler un litige », then a review (1–5 stars + text) once both confirm | working | X | keep → extend | Needs reservation / handover steps |
| `(app)/agreements.tsx` | « Mes accords » list. Only reachable from Réglages › « Mes accords et échanges » | working | X | merge into Messages / Profil | Buried (F6) |
| `(app)/u/[handle].tsx` | Another member's profile (`ProfileView`) | working | S + B | keep | — |
| `(app)/boutique-edit.tsx` | Boutique notes: Présentation, Retrait, Livraison, Paiement | working | B | keep → extend | Becomes the Boutique settings (link, catalogue, stats) |
| `(app)/edit-profile.tsx` | Profile fields; « Je vends régulièrement » toggle with shop name and category (`BoutiqueIdentityFields`) | working | S + B | keep | Pro seller entry point |
| `(app)/settings/verification.tsx` | Request « Vendeur vérifié » (an admin reviews it) | working | B | keep | Real verification only |
| `(app)/invite.tsx` | Profile link + QR code to share | working | B + S | merge into Boutique share | Same link as the profile share sheet |
| `(app)/search.tsx` | Text search: people, products, city / neighbourhood (typo-tolerant) | working | W + S | keep | — |
| `(app)/saved.tsx` | Favourite articles and saved publications | working | W + S | keep | — |
| `(app)/post/[id].tsx` | Publication with comments | working | S | keep | — |
| `(app)/statut/[userId].tsx` | Status viewer (reply goes to a private message) | working | S | keep | — |
| `(app)/highlight/[id].tsx` | Saved status selection (« Sélection ») | working (backend) · NOT_TESTED (UI) per `RELEASE_STATUS` STA-02 | S | keep | — |
| `(app)/connections/[userId].tsx` | Abonnés / abonnements / amis lists | working | S | keep | — |
| `(app)/friends.tsx` | « Demandes d’ami » + « Inviter » | working | S | keep | — |
| `(app)/notifications.tsx` | Notification list. Offer notifications have **no destination** (`case 'offer': return null`) | partial | S + X | keep → fix | F5 |
| `(app)/report.tsx` | Report content / account | working | — | keep | Safety |
| `(app)/settings/index.tsx` | Réglages hub (account, activity, privacy, legal links, logout) | working | — | keep | Holds « Mes accords » today |
| `(app)/settings/account.tsx` | « Mes données »: export and account deletion (`delete-account` function) | working (hosted deletion check pending per `RELEASE_STATUS`) | — | keep | Needed for Play |
| `(app)/settings/phone.tsx` | E-mail and mobile number; phone linking only if `phone_auth` | partial (phone hidden) | — | keep | — |
| `(app)/settings/privacy.tsx` | Private account, message permissions, notification preferences | working | S | keep | — |
| `(app)/settings/blocked.tsx` | Blocked accounts | working | — | keep | — |
| `(app)/settings/moderation.tsx` | Moderation decisions about me + appeals | working | — | keep | — |
| `(app)/settings/feedback.tsx` | « Donner mon avis » to the team (kind, message, platform) | working | — | keep | — |
| `(app)/live/[id].tsx` | Live viewer with pinned products | **hidden** (`live_streaming` false → redirect to `/`) | S + B | hide | No provider, no device test (LIVE-01 BLOCKED_EXTERNAL) |
| `(app)/live/host.tsx` | Start a live | **hidden** (same flag) | S + B | hide → cut later for Android v1 | Its Stream / WebRTC SDKs add Android permissions and foreground services (`ANDROID_RELEASE.md`) |

### 1.2 Public web (`apps/web/src/app/(public)/`, Next.js)

| Page | What it does | Status | Pillar | Decision | Reason |
|---|---|---|---|---|---|
| `/` (`page.tsx`) | Landing: Découvre / Partage / Vends / « Tu as reçu un lien ? » / Nos engagements | working | — | rename | Re-tell it with the four pillars |
| `/[handle]` | Public profile with a Boutique section (articles, Retrait / Livraison / Paiement notes, reviews), OG tags, `ShareActions` | working | B | keep → becomes the Boutique link | It is the only shop URL today |
| `/p/[id]` | Public article: gallery, price label, seller card, voice presentation, `ShareActions`. One sticky CTA « Écrire au vendeur » (web beta) or « Écrire au vendeur dans l’app » (`jefeli://p/…`) | working | W + X | keep → add Waxaale CTA | No direct « Faire une offre » (F3) |
| `/post/[id]` | Public publication | working | S | keep | — |
| `/live/[id]` | Public live page. Does not read the flag; no session can go live while the flag is off | hidden in practice | S | hide | — |
| `/legal`, `/legal/cgu`, `/legal/confidentialite`, `/legal/regles` | Legal pages. `confidentialite` has 12 `<Todo>` placeholders (controller identity, contact, retention) and `cgu` has 6 | partial | — | keep → complete | Needed for Play (`ANDROID_RELEASE.md`) |

**Reachability.** Both Vercel projects are protected by Vercel Authentication on every
deployment (`docs/W1_WEB_BETA.md` §1). Every public link is therefore closed to people outside the
team until a custom domain is attached or the protection is removed (F1).

### 1.3 Admin (`apps/web/src/app/admin/`, staff only)

| Page | What it does | Status | Pillar | Decision |
|---|---|---|---|---|
| `/admin/signalements` | Reports queue. Agreement disputes land here: a trigger in `…0700_safety.sql` opens a `dispute` report when an agreement turns `disputed` | working | X (disputes) | keep |
| `/admin/contestations` | Appeals against moderation decisions | working | — | keep |
| `/admin/verifications` | « Vendeur vérifié » requests | working | B | keep |
| `/admin/avis` | Member feedback inbox (the `feedback` table, not reviews) | working | — | rename (« Retours » would avoid confusion with reviews) |
| `/admin/journal` | Immutable moderation log | working | — | keep |
| `/admin/reglages` | Feature flags (`set_feature_flag`) | working | — | keep (future home for Jëf rules) |

### 1.4 Pillar coverage summary

| Pillar | What exists | What is missing |
|---|---|---|
| **Wecci** | Listings with `sale` / `trade` / `sale_or_trade`, three price modes, condition, city / neighbourhood, Explorer filters, search, favourites, trending (by saves) | Donner. Je cherche as a structured listing (it is only a post intent today). « J’ai / Je veux » matching. The name « Wecci » is already used for troc (F10) |
| **Waxaale** | Price and barter offers, counters, 72 h expiry (cron every 15 min plus a check on response), immutable agreement snapshots, double completion, cancel / dispute, two-sided reviews | Voice on offers: prototyped in the P1 sprint (`attach_offer_voice` + recorder in the offer screen + player in the Waxaale card), local only. Custom expiry. Reservation and handover states. Item status tied to the deal. Competing offers closed on acceptance |
| **Boutique** | Created automatically with the first listing. Notes (Présentation, Retrait, Livraison, Paiement). Optional merchant identity. Real « Vendeur vérifié ». Pinning (max 3). Public `/[handle]` page. WhatsApp and share-sheet links. QR invite | A dedicated Boutique link or slug. WhatsApp status cards (no image generation exists). Stats (no view analytics by design, FEED-11). Catalogue: the `collections` table exists but no UI reads or writes it |
| **Jëf** | Nothing. Only the inputs exist: completed agreements, reviews, « Je peux aider » chats | Ledger, earning rules, spending (boosts, « À la une », swap priority), ranking hooks, anti-abuse |
| **Social** | Feed with ranking and private downvotes, statuses + highlights, follows / friends, comments, intents, notifications, search, blocks / mutes / reports | — (complete for the pilot) |

## 2. Model mapping

### 2.1 Current definitions (exact)

- **`public.listing_mode`** (`…0300_commerce.sql`): enum `('sale', 'trade', 'sale_or_trade')`,
  default `'sale'`. UI labels: Vendre · « Wecci (troc) » · « Les deux ».
- **`products.price_mode`** (`…20261105000100_refinement.sql`): text
  `check (price_mode in ('fixed', 'on_request', 'negotiable'))`. `price_xof` is null or between
  1 and 100 000 000. `products_price_rules`: `fixed` needs a price unless the listing is `trade`;
  `on_request` never stores a price; `negotiable` is free. The migration says: « A 0 F listing
  never meant free ». UI labels: Prix affiché · À discuter · Sur demande.
- **`products.status`** (`public.product_status`): `('active', 'reserved', 'sold', 'archived')`.
  The seller changes it by hand on the article page; `sold_at` is set by trigger. Nothing in the
  offer or agreement RPCs changes it.
- **`posts.intent`** (`…20261103000100_feed_engagement.sql`): text
  `check (intent in ('share', 'seek', 'offer', 'opinion'))`. Labels: Je partage · Je cherche ·
  Je propose · Votre avis ?. `seek` and `opinion` need text. On a `seek` card, « Je peux aider »
  opens a private 1-to-1 chat (`contactAuthor`); nothing links that chat back to the post.
- **`offers`** (`…0500_messaging_offers.sql`):
  - `kind in ('price', 'barter')`.
  - `status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired')`.
  - `expires_at default now() + interval '72 hours'`, fixed: no RPC parameter changes it.
  - A price offer needs `amount_xof > 0` and no `cash_payer`. A barter has `amount_xof ≥ 0`, with
    `cash_payer in ('buyer', 'seller')` only when the amount is > 0.
  - One pending offer per `(product_id, buyer_id)`.
  - `snapshot` jsonb of both products, with `price_mode` added by the refinement migration.
  - `parent_offer_id` chains counter-offers.
- **`agreements`**:
  - `status in ('agreed', 'completed', 'canceled', 'disputed')`.
  - `buyer_completed_at` and `seller_completed_at`.
  - Immutable `terms` (trigger `agreements_protect_terms`) with a disclaimer that Jëfëli holds no
    funds.
  - Unique `offer_id`, but **no uniqueness per product**.
- **`reviews`**: one per `(agreement_id, reviewer_id)`, `rating 1–5`, body ≤ 500,
  `moderation_status`. Allowed only when the agreement is `completed`. They feed
  `profiles.rating_sum` and `rating_count`.
- **`messages`**:
  - `kind in ('text', 'image', 'voice', 'product', 'offer', 'story_reply', 'system')`.
  - The `offer_id` column exists, but it is **not** in the client insert grant
    (`conversation_id, sender_id, kind, body, attachment_path, attachment_meta, product_id`).
  - The insert policy allows only `text, image, voice, product`.
  - Offer and system messages are inserted by the RPCs.

**RPCs** (all SECURITY DEFINER, `private.require_user()`, granted to `authenticated` only):

| RPC | Behaviour |
|---|---|
| `make_offer(product, kind, amount, offered_product, cash_payer, message)` | Checks visibility, own product, blocks, terms (`validate_offer_terms`), `offer_pending`, rate limit (30 / h). Opens or reuses the conversation, inserts the `offer` message, notifies `offer_received` |
| `counter_offer(offer, amount, offered_product, cash_payer, message)` | Only the recipient. Marks the old offer `countered`, inserts a child offer. Only the buyer may change the offered item. Notifies `offer_countered` |
| `respond_offer(offer, accept)` | Recipient only, re-validates terms (the product must still be `active`). Reject → `rejected` + system message. Accept → `accepted` + an `agreements` row with snapshot terms + system message + `offer_accepted` notification. **Does not reserve the product and does not touch other pending offers** |
| `withdraw_offer(offer)` | Proposer only, while pending |
| `confirm_agreement_completed(agreement)` | Each party once. When both have confirmed → `completed` + system message + notification to the other party. **The first confirmation notifies nobody** (it returns `waiting_other_party`) |
| `close_agreement(agreement, 'canceled' \| 'disputed', reason)` | Either party while `agreed`. A dispute opens a report |
| `leave_review(agreement, rating, body)` | Only when `completed`. One per side |
| `expire_stale_offers()` | `service_role` only; scheduled by `pg_cron` every 15 min (`…0900_security_fixes.sql`, `jefeli-expire-offers`) |
| `attach_offer_voice(offer, path, meta)` | **P1 prototype, local only (not on staging).** The proposer attaches one voice message to a pending offer through `messages.offer_id`; called by the offer screen (`attachOfferVoice`) |

### 2.2 Wecci's four modes → current model

| Wecci mode | Current representation | Gap |
|---|---|---|
| **Vendre** | `listing_mode = 'sale'` (or `sale_or_trade`), with any `price_mode`. Offers of kind `price` | None in the model. Rename only |
| **Troquer** (with or without cash) | `listing_mode = 'trade'` or `sale_or_trade`. Offers of kind `barter`, `amount_xof = 0` (no cash) or > 0 with `cash_payer` | The offered item must already be an **active listing of the buyer** (`invalid_offered_product` otherwise). There is no « what I want in return » on the listing |
| **Je cherche** | Only `posts.intent = 'seek'`: free text + city, no category, budget, condition or expiry. Answered by « Je peux aider » → private chat | Not a listing: it does not appear in Explorer filters, cannot receive an offer, and nothing links it to the deal that follows |
| **Donner** | **Not representable.** `price_xof ≥ 1` when set; price offers need `amount_xof > 0`; the refinement migration converted 0 F listings to « Sur demande » | New mode, plus a « Je le veux » request without an amount |
| **« J’ai / Je veux »** | Nothing (no wanted-items field, no matching query) | New data + matching RPC |

### 2.3 Waxaale's states → current model

| Waxaale step | Current | Gap |
|---|---|---|
| Offer (text / amount / voice) | `offers` pending. Text = `message` (≤ 500). Amount = `amount_xof`. Voice: chat voice messages exist, but are not linked to an offer (`offer_id` cannot be set by clients; the P1 prototype `attach_offer_voice` adds a link) | Voice UI. A text-only offer (no amount) is impossible for `price` |
| Counter-offer | `counter_offer` → `countered` + child offer | — |
| Expiry | Fixed 72 h + cron | Proposer-chosen duration (e.g. 24 h / 72 h / 7 j) |
| Accepted deal | `respond_offer(true)` → `offers.accepted` + `agreements.agreed` | Competing pending offers stay open. A second buyer's offer can also be accepted (no per-product guard) |
| **Reservation** | No state. `products.status = 'reserved'` exists but only by hand, and `respond_offer` refuses offers on a `reserved` item (`product_unavailable`) | Automatic reservation on acceptance, with an end date |
| **Handover** | No state, place or time (only safety tips on the agreement screen) | Handover proposal (place, time) confirmed by both |
| Both confirm | `buyer_completed_at` + `seller_completed_at` → `completed` | Notify on the first confirmation. Mark the item(s) `sold` / swapped |
| Review | `leave_review` after `completed` | — |
| Cancel / dispute | `close_agreement` → `canceled` / `disputed` (→ report) | On cancel: put the item back to `active` |

### 2.4 Schema deltas needed (numbered, with effort)

S = under a day including tests · M = 1–3 days · L = a week or more (estimates, not measured).

1. **Donner mode** — add `'give'` to `public.listing_mode`. Price rules: no `price_xof`, no
   `price` offers, no barter. New offer kind `'request'` (amount null, message required). Update
   `validate_offer_terms`, the offers check constraint, `make_offer`, `formatListingPrice`, the
   labels and the Explorer filter. **M**
2. **Je cherche as a Wecci listing** — either `'wanted'` in `listing_mode` with `budget_min_xof`
   / `budget_max_xof` and `expires_at`, or a `wanted_requests` table (category, city, budget,
   condition, expiry, RLS like `products`). Plus `answer_wanted(request, my_product | message)`,
   which opens the conversation and records the link. **M**
3. **Origin link for « answering a Je cherche »** — `conversations.origin_post_id` (or
   `offers.source_request_id`), set only by the RPC behind « Je peux aider ». Jëf needs it to
   reward an answer that ends in a deal. **S**
4. **« J’ai / Je veux » matching** — `listing_wants` (product_id, category_slug, free-text want,
   optional value range) + `swap_matches(p_limit)` SECURITY DEFINER (reciprocal category / text
   match, city, visibility, blocks), plus indexes. **L**
5. **Text-only offers** — allow `kind = 'price'` with `amount_xof` null when the listing is
   `on_request` / `negotiable` (or a new kind `'question'`), so an offer can be words only. **S**
6. **Voice offers** — commit and review `20261114000100_waxaale_voice_offer.sql` (already drafted
   locally), regenerate types, then build the recorder in `offer/[productId].tsx` and playback in
   `OfferCard`. **S** (backend) + **M** (UI)
7. **Proposer-chosen expiry** — `p_expires_in interval` on `make_offer` / `counter_offer`, bounded
   (e.g. 6 h–7 days), validated server-side. **S**
8. **Reservation on acceptance** — in `respond_offer(true)`:
   - set the product (and, for a barter, the offered product) to `reserved`, with
     `agreements.reserved_until`;
   - expire or reject the other pending offers on those items, with a system message;
   - add a partial unique index `agreements(product_id) where status = 'agreed'`.

   **M**
9. **Handover step** — `agreements.handover_at`, `handover_place` (text, no GPS),
   `handover_proposed_by` and `handover_confirmed_at`, set through
   `propose_handover` / `confirm_handover` RPCs. Optionally a `'handover'` status between `agreed`
   and `completed`. **M**
10. **Item status follows the deal** — on `completed`: the sold item → `sold`, swapped items →
    `sold` (or `archived`). On `canceled`: reserved items → `active`. Done in
    `confirm_agreement_completed` / `close_agreement`. **S**
11. **Notify on the first completion** — `private.notify(other, uid, 'agreement_confirmed_by_other', …)`
    in the `waiting_other_party` branch. **S**
12. **Offer notification destination** — map `entity_type = 'offer'` to the offer's conversation
    in `notifications.tsx` and in `push-dispatch` `deepLink()`. No schema change (or store
    `conversation_id` in `notifications.data`). **S**
13. **Jëf ledger** — append-only `jef_ledger`:
    - columns: `user_id`, `delta`, `reason` enum, `source_type`, `source_id`, `created_at`;
    - `unique (user_id, reason, source_id)` so each source rewards once;
    - no client write grant; SELECT own rows only;
    - a cached `profiles.jef_balance`, writable only by triggers;
    - awards come from triggers on agreement `completed` (per side), review received,
      swap completed, and an answered Je cherche ending in a completed agreement;
    - caps per counterparty and per period (anti-collusion), reversal on `disputed`;
    - never transferable: no RPC moves points between users. **L**
14. **Jëf spending (visibility)** — `visibility_boosts` (`product_id`, `kind in ('boost_24h',
    'a_la_une', 'swap_priority')`, `category_slug` for « À la une », `starts_at`, `ends_at`,
    `cost`) + `spend_jef(kind, product, category)` (balance check, row lock, one active boost per
    product and kind). Read by `explore_products` / `get_feed` / `swap_matches` with a visible
    « Mis en avant » label. **L**
15. **Fast-reply signal** — per-seller median first-reply time. Either computed from `messages`
    in a nightly job into `private.response_stats`, or a `conversations.first_reply_at` column set
    by the message trigger. Owner decision first: `RELEASE_STATUS` FEED-11 records « no view/click
    analytics ». **M**
16. **Boutique link** — `boutiques.slug` (unique, reserved-word checked) or keep `/[handle]` and
    add a `/[handle]/boutique` web route. **S**
17. **Boutique stats** — needs counted events (article views, contacts, offers, deals). Offers
    and agreements can be counted today without new tracking. Views need a new
    `product_view_daily` aggregate and a privacy decision. **M**
18. **WhatsApp status cards** — a server-rendered 1080×1920 image per article / boutique
    (`apps/web` `opengraph-image`-style route). No schema change. **M**
19. **Catalogue** — UI for the existing `collections` table and `products.collection_id`.
    Schema already present. **M** (UI only)

## 3. Journeys (taps counted from the screens' code)

« Taps » counts presses. Typing in a field counts as 1 tap to focus it, plus the typing.
« OS » marks system screens (photo picker, mail app, WhatsApp).

### Journey 1 — a new seller gets their Boutique link

Starting point: welcome screen, no account. Local stack: e-mail confirmation off
(`supabase/config.toml` `[auth.email] enable_confirmations = false`). Staging: on, per
`docs/WEB_BETA_GO_NO_GO.md`.

| # | Step | Screen (file) | Taps | Friction note |
|---|---|---|---|---|
| 1 | « Créer un compte » | `(auth)/index.tsx` | 1 | — |
| 2 | Votre nom, E-mail, Mot de passe, « J’ai 18 ans ou plus », « J’accepte les conditions… », « Créer mon compte » | `(auth)/sign-up.tsx` | 6 + typing | Staging adds: open the mail app, tap the link (OS, ≥ 2), then « J’ai confirmé, me connecter » + e-mail + password + « Se connecter » (4 + typing). The link opens `/sign-in`, so the credentials are typed again |
| 3 | Fill « Votre pseudo », tick « Je confirme avoir 18 ans ou plus », « Entrer dans Jëfëli » | `onboarding.tsx` | 3 + typing | The name is prefilled from sign-up, but the pseudo is empty: sign-up sends no handle, so the trigger creates `membreXXXXXXXX`, which onboarding blanks. The suggestion only runs when the name is edited. 18+ is asked a second time. City defaults to Dakar |
| 4 | « Publier » (+) → « Article » | dock → `CreateMenu` | 2 | With an existing draft: +1 (« Continuer le brouillon » / « Nouvelle … ») |
| 5 | Pick photo(s) | OS picker, opened automatically on phones | 1–2 (OS) | Web: tap the « Ajouter des photos ou une vidéo » tile (+1) |
| 6 | Nom de l’article, Prix | `publish/listing.tsx` | 2 + typing | Mode defaults to Vendre, price mode to Prix affiché |
| 7 | Any detail pill → Catégorie chip → « Terminé » | details sheet | 3 | Catégorie is the only required field without a default (État = Neuf, Lieu = profile city, Remise = Retrait) |
| 8 | « Mettre en vente » | `publish/listing.tsx` | 1 | The boutique row is created by trigger. « Partager aussi dans mon fil » is on by default. The editor lands on `/p/{id}` with a toast |
| 9 | Back out of the article page, open Profil | `p/[id].tsx` → dock | 2 | No « share your boutique » prompt after the first article. The article page's share buttons share the **article**, not the boutique (non vérifié: whether one back press is enough after `router.replace` inside the modal publish stack) |
| 10 | Share icon (« Partager le profil ») → « Envoyer sur WhatsApp » | `ProfileView` share sheet | 2 | Opens `wa.me/?text=Découvrez la boutique de {name} sur Jëfëli\n{webBaseUrl}/{handle}` |
| 11 | Pick a chat or status, send | WhatsApp (OS) | ≥ 2 (OS) | The link is the profile URL; there is no separate boutique URL. On today's Vercel previews, recipients meet Vercel Authentication (F1) |

**Total after sign-up:** about 16 in-app taps (steps 3–10) + OS taps. Sign-up adds 7, or about
13 with e-mail confirmation on staging.

Alternatives found in the code:
- Réglages › « Inviter et partager mon profil » (`invite.tsx`) shows the same link with a QR code.
- The web `/[handle]` page has `ShareActions`.

### Journey 2 — WhatsApp link → Waxaale offer (new buyer)

Assumptions:
- The web beta setting, where `NEXT_PUBLIC_APP_URL` is set, so « Écrire au vendeur » opens the
  Expo web app in the browser.
- The link is reachable (it is not on today's protected previews).
- The listing has a price mode that allows a price offer.

| # | Step | Screen (file) | Taps | Friction note |
|---|---|---|---|---|
| 1 | Tap the link in WhatsApp | OS → `apps/web/(public)/p/[id]` | 1 (OS) | Public page, no login. Shows price, seller, gallery, voice |
| 2 | « Écrire au vendeur » | `/p/[id]` sticky CTA | 1 | The page has **no** « Faire une offre » or « Proposer un troc » button. Without `NEXT_PUBLIC_APP_URL` the button is `jefeli://p/{id}`: it opens the app only if installed; otherwise nothing happens (the page says so) |
| 3 | Signed out: the app's `Stack.Protected` guard shows the welcome screen | `(auth)/index.tsx` | 1 (« Créer un compte ») | **Sign-up wall loses the article.** No return-to path is stored anywhere (`grep returnTo/redirectTo` finds only password recovery) |
| 4 | Sign-up form | `(auth)/sign-up.tsx` | 6 + typing | E-mail confirmation on staging: +≥ 6 (see Journey 1) |
| 5 | Onboarding | `onboarding.tsx` | 3 + typing | Same pseudo / 18+ friction as Journey 1 |
| 6 | Lands on Accueil, not on the article | `(tabs)/index.tsx` | — | Expected from the guard structure; landing route **non vérifié** in a browser run |
| 7 | Go back to WhatsApp, tap the link again, « Écrire au vendeur » | OS → web → app `p/[id].tsx` | 2–3 (OS + 1) | Re-finding the article is the buyer's job |
| 8 | « Faire une offre » | `p/[id].tsx` | 1 | Shown only if the listing is not `trade` and is `active`. For `sale_or_trade` both buttons share the row |
| 9 | « Votre offre » amount, optional message, « Envoyer la proposition » | `offer/[productId].tsx` | 2 + typing (+1 for a message) | No voice, no expiry choice. The 72 h expiry is shown only after sending (« expire dans … h ») |
| 10 | Lands in the thread with the offer card | `chat/[id].tsx` | — | — |

**Total:** about 17 taps + typing for a new buyer, including about 3 taps spent re-finding the
article. An already signed-in buyer needs 5: link, « Écrire au vendeur », « Faire une offre »,
amount, send.

### Journey 3 — Troquer offer → « échange fait » → review

Starting point: buyer B is on seller S's `trade` / `sale_or_trade` article and **already has an
active listing**. Both are signed in.

| # | Who | Step | Screen (file) | Taps | Friction note |
|---|---|---|---|---|---|
| 1 | B | « Proposer un troc » | `p/[id].tsx` | 1 | If B has no active listing, the composer shows « Aucun article à proposer » → « Publier un article ». After publishing, B lands on their own new article, not back in the offer (≈ +10 taps, see Journey 1 steps 4–8) |
| 2 | B | Pick own article | `offer/[productId].tsx` (`TradeOption` grid) | 1 | Only B's **active listings** can be offered: there is no « offer something not listed » |
| 3 | B | Optional « Différence en argent », « Qui paie la différence ? » (Moi / Le vendeur) | same | 0–3 + typing | Default payer = buyer |
| 4 | B | « Envoyer la proposition » | same | 1 | Lands in the chat |
| 5 | S | Open the notification or Messages → the conversation | `notifications.tsx` / `(tabs)/messages.tsx` → `chat/[id].tsx` | 2 | **The `offer_received` notification has no destination in-app** (`case 'offer': return null`), and the push opens `/notifications` (`push-dispatch` `deepLink` default). S must go through Messages |
| 6 | S | « Accepter » | `OfferCard` | 1 | Creates the agreement. Both articles stay `active` and other buyers' offers stay open. S could accept a second offer on the same item |
| 7 | S | « Voir l’accord » → « Déclarer l’échange terminé » | `OfferCard` → `agreement/[id].tsx` | 2 | No step to fix a handover place / time. B is **not notified** of S's confirmation |
| 8 | B | Messages → the conversation → « Voir l’accord » → « Déclarer l’échange terminé » | `chat/[id].tsx` → `agreement/[id].tsx` | 4 | The `offer_accepted` notification does open `/agreement/{id}` (2 taps via the notification). Otherwise « Mes accords » sits only in Réglages |
| 9 | Both | Stars (1–5), optional text, « Publier l’avis » | `agreement/[id].tsx` | 2 + typing each | S must come back to the agreement on their own: the completion notification goes only to the party who did **not** press last |
| 10 | S (and B) | Mark the articles « Marquer vendu » by hand | `p/[id].tsx` | 1 each (+ navigation) | Nothing marks the swapped items automatically, so both stay listed as available |

**Total:** B ≈ 7 + typing, S ≈ 7, plus manual status changes. The flow takes about 6 extra taps
when the parties rely on navigation instead of notifications.

### Top frictions (ranked)

| Rank | Friction | Where | Proposed fix |
|---|---|---|---|
| F1 | **Shared links are closed to outsiders.** Both web projects sit behind Vercel Authentication (`W1_WEB_BETA.md` §1), so every WhatsApp boutique or article link opens a Vercel login for buyers | infrastructure | Owner: attach a custom domain to `jefeli-web` (and the app), or lift the protection on the public project only. Then set `EXPO_PUBLIC_WEB_BASE_URL` / `NEXT_PUBLIC_SITE_URL` to it |
| F2 | **Sign-up wall drops the article.** No return-to path. After sign-up and onboarding, the buyer lands on Accueil | `_layout.tsx` guards, `(auth)/*`, `onboarding.tsx` | Store the requested path (SecureStore / sessionStorage) before showing `(auth)`, and restore it after `onboarded_at` is set. Pass it through `emailRedirectTo` for the confirmation link |
| F3 | **No Waxaale CTA on the public page.** Only « Écrire au vendeur » | `apps/web/(public)/p/[id]/page.tsx` | Add « Faire une offre » / « Proposer un troc » deep links (`/offer/{id}?kind=…`), shown according to `listing_mode`, and preserved through F2 |
| F4 | **Accepting does not reserve.** Items stay « Disponible », competing offers stay open, a second acceptance is possible, and items are never auto-marked sold | `respond_offer`, `confirm_agreement_completed`, `close_agreement` | Schema deltas 8 and 10, plus a per-product unique index on open agreements |
| F5 | **Offer notifications lead nowhere.** In-app `case 'offer': return null`. Push falls back to `/notifications` | `notifications.tsx`, `push-dispatch/index.ts` | Resolve `offer` to its `conversation_id` (delta 12) |
| F6 | **Completion is a silent waiting game.** The first « terminé » notifies nobody. « Mes accords » is reachable only from Réglages | `confirm_agreement_completed`, `settings/index.tsx` | Delta 11. Add an « Accords en cours » entry on top of Messages and on the profile. Show a pending-confirmation banner in the thread |
| F7 | **Troquer needs a listed item first.** The empty state sends the buyer to the listing editor and drops the offer context | `offer/[productId].tsx` | Inline quick listing (photo + name) that returns to the offer with the new item selected, or allow describing an unlisted item (delta 2 / 4 thinking) |
| F8 | **Onboarding friction.** The pseudo is empty after e-mail sign-up (suggestion only on name edit), and 18+ is asked at sign-up and again at onboarding | `onboarding.tsx`, `sign-up.tsx` | Suggest the handle from the prefilled name on mount. Send `adult` consent in sign-up metadata and pre-tick it (still recorded in `adult_confirmed_at`) |
| F9 | **No Boutique moment.** After the first article the seller sees the article, not « Votre boutique est prête — partagez-la ». The shop link is the generic profile link | `publish/listing.tsx` (after `createListing`), `ProfileView` | On the first listing (`products_count` 0 → 1), show a share sheet with « Envoyer sur WhatsApp » and « Copier le lien ». Later: a boutique slug (delta 16) and status cards (delta 18) |
| F10 | **« Wecci » already means troc.** Used in the listing editor, Explorer pills, home chips, article page, chat context and desktop | `listing.tsx`, `explore.tsx`, `index.tsx`, `p/[id].tsx`, `ChatContext.tsx` | Rename the trade mode to « Troquer » everywhere. Reserve « Wecci » for the classifieds pillar (Explorer / + menu) |
| F11 | **E-mail confirmation round trip (staging).** The link opens `/sign-in` and asks for the password again | `recovery.ts` `confirmEmailRedirectUrl` | Use a confirmation callback that sets the session (as recovery does), or switch to phone OTP once `phone_auth` is ready |
| F12 | **Android opens links in the browser.** Only the `jefeli` scheme; no App Links (`autoVerify`) and no `assetlinks.json` | `app.json`, `apps/web/public/.well-known/` (absent) | See `docs/ANDROID_RELEASE.md` § Deep links |

**Top 5 for the owner:** F1 (links closed), F2 (sign-up wall loses context), F4 (acceptance
neither reserves nor closes competing offers), F5 (offer notifications go nowhere), F3 (no offer
CTA on the shared page).
