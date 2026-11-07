# Jëfëli — merge Lovable experience into Claude Code's native Expo app

## Architecture and immutable references

**Lovable is the approved visual source. Claude's existing Expo/Supabase code is the functional source. Do not merge these Git repositories or copy browser components into React Native. Translate the experience in native code while preserving all real functionality.**

- Approved Lovable source: https://github.com/zayd95/galsen-visual-playground/tree/806a26f0852646ba885cd6e1c6fa181d208bc0bd/src/lab
- Main web design: src/lab/LabApp.tsx (Home, Explorer, Profile, Product, dock and sheets); src/lab/LabPages.tsx (post, product, status publishing and messages); src/index.css (precise color/material treatment).
- Web visual contract: https://github.com/zayd95/galsen-visual-playground/blob/806a26f0852646ba885cd6e1c6fa181d208bc0bd/docs/LOVABLE_PARITY.md
- Interactive reference: https://id-preview--5bcb4e09-94f4-42bd-937d-44666c8d368e.lovable.app/pilot
- Native baseline: zayd95/Jefeli branch claude/jefeli-pilot (existing draft PR #1).
- This integration branch: feature/lovable-native-parity-20261104. Do not merge to main automatically.
- Real Jëfëli staging Supabase: gbsoifwllbacwsknydkq. Separate from original Galsen. Preserve existing native RLS, RPC, storage, auth and migration history. No service-role keys in apps.

**Priority:** the owner already tried Lovable and explicitly chose its visual quality over the original Claude design. This is a high-fidelity port, not a new aesthetic exploration.

## Exact visual contract

| Element | Requirement |
|---|---|
| Home | Deep Atlantic #091B19 background, no white card backgrounds; original restrained patterned text post cards; editorial media and story rail; clean header with round search/notifications, Pour toi and Abonnements |
| Explorer | Near-white #FAFBFA body, pure #FFFFFF cards, neutral borders, dark editorial intro/header; working location/category/Wecci filters |
| Member profile | Deep Atlantic background; short cover about 136 points; avatar overlap; name, location and prominent BIO immediately; 3 business interests chips max plus +N; no hobbies, dating prompts, repetitive boutique carousel or giant pinned hero |
| Profile actions | Owner: Edit/Publish. Visitor: Message/Follow. Only Publications and Boutique as primary tabs. Up to 3 compact post previews or 4 product tiles before More; keep existing Live, Highlights, Reviews and safety controls accessible via secondary routes |
| Product | Near-white image-led content, accurate price mode, seller identity, compact information, sticky Message/Offer/Wecci CTA; keep external payments disclaimer |
| Navigation | One five-tab floating Tinder-like dock: Accueil, Explorer, Publier, Messages, Profil. No separate giant plus button. Active mint and understated inactive icons. Respects iOS safe areas. Plus opens the post composer DIRECTLY |
| Onboarding | ONE compact screen: display name, auto-suggested editable handle, city, adult confirmation; optional avatar. No business questionnaire, three-step wizard or forced interests before entering the feed. Boutique name + category requested only when creating a boutique later |
| Publishing | Plus opens Publication composer; compact adjacent Article/Statut modes. One-page listing (media, title, sale/Wecci, price mode, category; description optional, extra location/condition/delivery collapsed); no three-step wizard |
| SMS | Only Senegal +221; actual OTP only if the provider is configured. Keep email auth. No simulated codes |
| Wallou | Future services/booking within Jëfëli, shared profile and inbox; no separate old Wallou backend or unapproved booking tables |

Color specification: Atlantic night #091B19; dark secondary #122B26; near-white #FAFBFA; white #FFFFFF; ink #10252C; mint #A3E4D7; fog #F7F6F3; slate #607071; gold #E3B777 used sparingly; border #E2E6E4. Use native composition/animation and editorial serif display text while body copy stays comfortably readable. Do not turn the whole app dark and do not bring back cream/salmon backgrounds.

## Native file map and behavior source

- Shared visual tokens: packages/shared/src/tokens.ts and apps/mobile/src/design/*
- One-screen onboarding: apps/mobile/src/app/onboarding.tsx; native useAuth, isHandleAvailable, updateMyProfile and AvatarPicker must remain
- Five-tab dock: apps/mobile/src/app/(app)/(tabs)/_layout.tsx; unread counts and routing must remain
- Home/Feed: apps/mobile/src/app/(app)/(tabs)/index.tsx, components/PostCard.tsx, components/StoryRail.tsx; retain fetchFeed, vote, comment, status and pagination
- Explorer: apps/mobile/src/app/(app)/(tabs)/explore.tsx, components/ListingCard.tsx, lib/api/products.ts
- Compact Profile: apps/mobile/src/components/ProfileView.tsx; retain follow, friends, highlights, review access, boutique, story and privacy
- Product: apps/mobile/src/app/(app)/p/[id].tsx; retain price offers, barter, multi-item conversation and agreement
- Compose: apps/mobile/src/app/(app)/publish/{index,post,status,listing}.tsx, components/Composer.tsx; retain offline drafts, upload retries, media and server constraints
- Messaging: apps/mobile/src/app/(app)/chat/[id].tsx and components/chat/*; preserve actual conversations, offers, voice, up to 5 product cards
- Profile Settings: apps/mobile/src/app/(app)/edit-profile.tsx and settings/*; merchant identity may be created after first entry, with name/category required by SQL
- Public share/admin: apps/web; do not overwrite its Next.js routes or moderation panel

The original native DESIGN_SYSTEM.md is older than the approved Lovable feedback. In conflicts, this handoff + pinned Lovable reference have authority for appearance; the native backend and security have authority for data behavior.

## Already implemented on this bridge branch

- Shared canvas/Atlantic-night/mint/fog/gold tokens aligned with Lovable.
- One-screen native onboarding (no seller or interests gate) using existing native profile, avatar, validation and age rules.
- Unified five-tab dock, with center Plus opening the existing native post composer directly.

These are an INITIAL PORT, not complete visual parity. Claude Code must complete Home/Explorer/Profile/Product/Composer and produce native screenshots before this PR is merged.

### Native port pass (Nov 4, 2026) — done on this branch, still a draft

Ported in Expo/React Native code from the pinned Lovable files (no browser code, no Lovable
backend imported): Lovable type (Fraunces + Hanken Grotesk), `dark` tokens, floating dock,
dark Home + post cards + story rail, near-white Explorer + product cards + product page,
compact dark profile, direct publishing switcher + one-scroll article form, dark inbox and
thread, glass action sheets. Every screen keeps its native queries, RPCs and RLS. Details,
commit list and evidence: `docs/IMPLEMENTATION_LOG.md` › « Lovable native parity pass » and
`docs/evidence/lovable-parity/README.md`.

Still required before merge: the owner reviews the native screenshots (side-by-side with the
Lovable reference) and runs the app on an iPhone; no device or simulator was available here.

## Claude Code workflow — do this end to end

1. Start from this branch and inspect Lovable's exact pinned files, including composition, CSS and real screenshots. First take baseline Expo screenshots at small iPhone, large iPhone and Android size.
2. Implement authentic dark Home, PostCard and StoryRail; near-white Explorer and ListingCard; compact dark bio-first Profile; near-white Product with CTA; genuine chat styling; then one-scroll article publishing and compact post/status selector. Commit in coherent small sets, do not replace native API calls with web demo state.
3. Keep existing RLS, native auth, messages, offers, agreements, blocking, reporting, media, progress, account deletion, comments, status privacy, rankings and offline drafts. Do not import Lovable's src/lab/live/backend.ts, browser Supabase client or original Galsen data.
4. Keep feature gates honest: Stream live and SMS disabled until providers are configured; no invented payments, listings, seller statistics or reservations.
5. Run TypeScript, lint, integration and Playwright browser tests, plus Expo iOS/Android native screenshot review. Compare before/after against Lovable, with small and large screen safe areas and keyboard. Do not weaken tests just to make CI green.
6. Report the commit SHA, files, screenshot links, visual mismatches, verified real two-account flows and remaining limitations. Leave PR draft until owner approves actual native screenshots; no production deployment.

## Acceptance criteria

- Phone-width screenshots match the pinned Lovable's visual hierarchy and states. Home/Profile dark without unwanted white cards; Explorer/Product/Form near-white.
- One-screen onboarding and optional later boutique work with same UID and server validations; interests editable later.
- Bottom dock has five tabs; Plus opens post composer, article/status nearby, and navigation remains functional on iOS and Android.
- Listing author can upload, choose price on request/negotiable/fixed, sell, Wecci or mixed, and publish from one screen; files persist and optional feed-share reports partial failure correctly.
- Visitor can discover, follow, read, comment, vote, message, offer and see statuses through native existing APIs; no regression in privacy, reporting and blocking.
- Build/CI and actual on-device UI checks are green; screenshots reviewed by owner before any merge.

This bridge intentionally does NOT perform a cross-repository code merge or claim that Lovable's visual parity is already complete.
