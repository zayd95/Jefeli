# JËFËLI — ONE-SHOT END-TO-END CLAUDE CODE BUILD MANDATE

> Copy this entire prompt into Claude Code after opening the provided Jefeli_Claude_Code_Build_Package directory as the workspace. All named companion specifications are in this package. It is an execution mandate, not a request to make another plan.

You are acting as founding CTO, principal product designer, senior mobile engineer, backend architect, security engineer, QA lead, and release engineer for **Jëfëli**. You have the owner's permission to create code, local files, database migrations, tests, documentation, design assets made by us, and development builds; you do NOT have permission to start paid subscriptions, expose secrets, deploy publicly, publish to app stores, or overwrite unrelated work without approval.

**Mission:** Build the real Jëfëli product from a blank repository into a working, production-minded **testable pilot** for Senegal. Do not stop at a pitch, mockup, landing page, or scaffold. Design and implement the complete connected product in vertical slices, test every slice, and continue until the acceptance criteria are met or a genuine external blocker remains. Work autonomously using reasonable defaults instead of repeatedly asking for aesthetic or minor decisions. If you hit an external requirement (credentials, paid service, signing, domain or store account), implement and test everything possible, document exactly what is blocked, and continue on independent work. Never claim that something untested is working.

## 0. First 10 minutes: inspect, preserve, start

1. Inspect the workspace and git status. If this is an existing repository, preserve its work; do not clobber commits or unrelated files. If blank, initialize the monorepo and Git. Prefer a new `jefeli` repo or ask once only if a remote identity is essential. Maintain meaningful commits as you proceed.
2. Read `CLAUDE.md`, `docs/PRODUCT_SPEC.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/MILESTONES.md`, and the Atlantic Sand visual reference in `reference/`. The approved color system overrides the colors in any earlier exploratory mockups.
3. Verify **current** official Expo, React Native, Supabase, Live SDK, Apple/Google UGC policy, and OAuth documentation before locking versions. Install compatible stable versions via the framework's recommended package manager. Do not hardcode SDK versions from old examples.
4. Create a concise `docs/IMPLEMENTATION_LOG.md` and maintain an honest checklist: implemented, tested, blocked, deferred. Start building immediately. Do not endlessly elaborate plans.
5. Set up repeatable lint, type-check, unit, integration, UI/visual, security, and end-to-end checks. Add a single `README.md` explaining exact local setup and first launch.

## 1. What Jëfëli is

The **brand name is Jëfëli** (diaeresis over both ë vowels), ASCII fallback **Jefeli** for filenames, URLs, usernames and app identifiers. Tagline: **« Découvre. Partage. Vends. »** Positioning: **« Le réseau social du commerce sénégalais. »** Final trademark/domain/legal clearance is pending; do not describe the name as legally cleared.

**Product:** a **social-first Senegalese discovery and commerce network**. It is **NOT** a Shopify competitor, not a standalone ecommerce storefront builder, not an inventory-owning retailer, and not a classified-ad clone. It primarily supports **B2C merchant-to-consumer discovery**, and also **C2C used-goods selling and barter**. Sellers already active on TikTok, Facebook, WhatsApp, AdaFrik or physical markets should post content here and reach new Senegalese buyers. The platform's unique value is **attention, local discovery, trust and conversations that convert**, not providing checkout templates.

**Social identity first:** every account gets a human social profile with posts, followers/friends, 24h status, live sessions, and a **prominent automatically generated boutique** derived from the user's listings. The boutique is part of the profile, not a separate wizard or SaaS product. Not every post needs to contain a product. The home experience must feel like a lively, tasteful consumer social network rather than a retail dashboard.

**Primary geography:** Senegal, starting with Dakar (including local neighborhoods), then other cities. **Language:** French-first interface with natural Senegalese context, a localization-ready structure and optional Wolof-friendly voice communication. **Money:** FCFA/XOF with sane display conventions. **Connectivity:** mobile-first, moderate bandwidth, image/video compression, graceful failed uploads and retries. **Audience:** launch with adult accounts and age-appropriate onboarding; do not silently collect minors' data.

## 2. Non-negotiable UX and visual system

Use the APPROVED **Palette 4: Atlantic Sand**:

- Background canvas: `#F6F5F1` (warm off-white)
- Primary text, structural dark, logos: `#10252C` (Atlantic Ink)
- Interactive highlight: `#A3E4D7` (Frosted Mint)
- Secondary text and metadata: `#607071` (Slate)
- Surface/card: `#FFFFFF`
- Danger/true LIVE indicator: accessible red, distinct from brand mint
- Optional later dark-mode base: `#0D1B2A`, with mint and ice-white. **Light mode is the signature.**

Use a refined, editorial, warm, content-first layout. Media from real sellers supplies color; backgrounds should not compete. Good typography with correct `ë` glyph rendering, generous rhythm, clear hierarchy, carefully designed interactive states, quality image crops, restrained radius, subtle hairline borders, 44px-equivalent touch targets, accessible contrast, comfortable safe areas, screen-reader labels, and skeleton/loading/empty/error states. Design **in French**, not English. No generic gradients, template-dashboard layouts, noisy feature badges, decorative emojis, random fonts, fake activity counters or filler Lorem Ipsum.

Mandatory workflow: create the reusable design system before full screen development; implement every screen; capture real screenshots at common iPhone and Android sizes; compare to visual references; improve spacing, typography, density, color contrast and affordances. Do not accept a screenshot merely because it resembles the sample visually—test the entire interaction. Use local reference images as inspiration for structure and Senegalese product context, **not** as screenshots to paste into the app. Use properly licensed/sample media in a clearly labeled seed environment; all real content must be user-generated or legally sourced.

**Five bottom tabs:** `Accueil`, `Explorer`, `Publier`, `Messages`, `Profil`. On home, 24-hour status circles at the top and categories such as `Pour toi`, `Abonnements`, `À proximité`, `Live`, `Occasions`, `Troc` as contextual filters—not six extra bottom tabs. Publish is the prominent center action. A social profile has `Fil`, `Statuts`, `Live`, `Boutique`, optionally `Avis`. A product card opens a real detail and allows messaging/offers. The UI for live streams displays real live state, never fake counters. Use the native share sheet, with web links that actually resolve.

## 3. Complete feature scope to implement

### A. Accounts, onboarding, privacy, relationships
- Secure Supabase Auth. Prefer phone-first onboarding for Senegal, but prevent SMS credentials/costs from blocking local development: build a working email/password development/test path and implement phone OTP integration with proper configuration and abuse protection. Add supported social login only with genuine OAuth credentials; configure Apple sign-in where applicable to platform rules. Never pretend demo email login equals finished OTP.
- Choose display name, unique ASCII handle, profile photo, bio, city/neighborhood, interests; optional merchant identity. Verify email/phone according to selected auth path. Session persistence, logout, account recovery, account deletion/export requests.
- Follow/unfollow, follower/following lists, friend requests and mutually accepted friends. Respect private/public visibility and allow users to restrict status audience (public/followers/friends). Block and mute. Follow counts must be real, not hardcoded.
- Facebook linking and friend discovery only within actually authorized Meta API permissions: never claim to import all Facebook friends. Provide normal invites, contacts matching only with explicit opt-in and safe hashing/consent, shareable profile link/QR as alternative. Feature-flag unavailable integrations.

### B. Social feed and engagement
- Create/edit/delete a text/photo/video post. Optional tag of one or more existing products; distinguish personal posts from product promotions. Media selection, compression, background upload progress, retry, and cancellation. Persist real uploads and stable media URLs.
- Paginated personalized home feed: initially a deterministic, explainable mixture of follows, recency, local/city/category relevance, content quality signals and new-seller exploration; avoid fake ML claims. Server-side data filtering and blocked-account enforcement. Pull-to-refresh and infinite pagination with efficient queries.
- Reactions/likes, nested or one-level comments, save/bookmark, repost/share when appropriate, reporting, delete/edit rights. Never leak private posts via direct URLs or cached results.
- Search for people, products, categories, stores and neighborhoods; handle empty results and typo-friendly search as feasible. Separate `À proximité` with approximate voluntarily supplied city/neighborhood rather than precise location tracking by default.

### C. Statuses and highlights — core, not optional
- Native-style 24h photo/video statuses, multi-segment viewer, tap navigation, progress, mute/unmute and close. Status mentions/product stickers, private reply that opens DM, reactions, privacy, viewer visibility consistent with settings.
- A status must disappear from normal view after 24 hours even if the deletion job is late; implement timestamps and server-side policy; cleanup background jobs. Owner can intentionally save a status as a highlight on profile.
- Report/block from the viewer and no access to private statuses of unauthorized users.

### D. Social profile + integrated boutique
- Profile header, avatar/cover, bio, verification state, city, followers/friends, statuses, posts, live tab, product grids, optional reviews. The look is a social profile FIRST, with a compelling boutique card and shop tab.
- Every account gets a boutique automatically upon first listing—no separate setup wizard. Merchants may optionally add short shop description, collections and pickup/delivery notes. No monthly fee to create a boutique.
- Public web profile with canonical URL `/{handle}` (or appropriate route), basic SEO/OpenGraph and optional `open in app` deep link. Private fields are never exposed. User can share an appealing shop link to WhatsApp/Facebook/TikTok bios.

### E. Marketplace, listings, C2C used items
- Create/update/archive listing: name, description, XOF price, category, new/used/refurbished condition, photos/videos, stock or one-off quantity, region/city/neighborhood, pickup/delivery information, visibility, seller ownership.
- Distinguish `À vendre`, `À échanger`, `Vente ou troc`. Support used items fully—not a second-class feature. Product details, swipe media, seller card, follow, share, save, message seller, ask offer, flag suspicious content, mark sold/reserved. Browse by category and locality.
- For shops with inventory, only simple inventory counts, no warehouse management. No platform-owned stock. No platform-run checkout/payment/escrow for V1. Discuss cash/Wave/Orange Money as seller-arranged options without falsely presenting payment protection. Avoid prohibited/restricted item categories and enforce configurable prohibited-goods policy.

### F. Commerce inside DMs + barter
- Realtime, persisted 1:1 messaging, authorized conversation participants only, sent/read/delivered state as actually observable, image attachments, voice notes if possible, product cards, push notifications and unread counts. Basic spam protection, delete/mute/block/report. Messages must load correctly after restart and on a second device.
- Buyer can start a chat from an exact product and propose a monetary offer; seller can accept/reject/counter. Offers have server-validated amounts and explicit lifecycle.
- Barter: link one of the buyer's actual owned product listings to an exchange request; optionally specify an XOF cash difference and direction of payment. Both parties can counter, accept or decline. Snapshot terms on acceptance and create a transaction/meetup agreement record, with no claim of guaranteed payment or delivery. Prevent self-trades, duplicate acceptance and unauthorized modifications. Allow cancellation/dispute and clear user safety advice for meetup.
- Reviews may only be attached to a verified in-app interaction/confirmed transaction process, not arbitrary anonymous ratings. Show accurate labels: `Échange déclaré terminé`, not guaranteed by the platform. Don't display unverifiable trust badges as official verification.

### G. Real live commerce
- Live is central to the product. Implement a genuinely functional `Go Live` and `Watch Live` flow, live discovery, viewer counts from the provider, live comments/report/mute/block, ability to pin active products, seller profile and buy/message CTA, and clean ending states.
- Use a **managed React Native livestream provider** compatible with current Expo development builds (evaluate Stream Video and alternatives with actual docs and cost). Backend must mint short-lived provider tokens server-side; never ship provider secrets in mobile code. Use provider webhooks where available for session state. Real-device camera and audio tests are mandatory.
- If the service requires paid credentials or an owner's subscription, implement an isolated adapter, UI, data models, security and automated tests; disable `Go Live` via an honest feature flag with explanatory internal status. DO NOT display a fake active livestream or label a prerecorded video as live. Record the exact remaining external action to enable it. Continue building the rest of the product.

### H. Notifications and sharing
- In-app notification center for follows, comments, story replies, messages, offers, accepted trades, live-start notifications and relevant moderation actions. Push notifications with permission gating, token registration and deep links; degrade gracefully in simulator/Expo Go where needed.
- Native share menu for product/post/profile/status/live URLs; copy link; OpenGraph previews from public web routes; exporting owned photos/videos with attribution is optional. No scraping/reposting other platforms' media without rights and authorization. Facebook friend discoverability and social posting only if available in official platform APIs.

### I. Trust, safety, admin, legal readiness
- Mandatory report flows for users, posts, comments, listings, statuses, chats and lives; block/mute; content filters/moderation queues and user appeals; admin action log, rate limits, anti-spam and abuse controls. Triage statuses and seller-verification requests from a real restricted admin UI (web is fine). Maintain evidence minimization and retention principles.
- Terms/community standards, privacy policy draft reviewed/approved by owner before launch, reporting contact, consent and account deletion. Correct age/eligibility handling. No fake seller verification or review counts. Enforce prohibited items and privacy by design.
- Do not use payment escrow or promise authenticity/safety that the operator cannot substantiate. No unapproved public deployment. Review current Apple/Google UGC and privacy rules at release gate.

## 4. Architecture (use the companion technical document as minimum)

Use a low-cost, maintainable TypeScript monorepo:
- `apps/mobile`: current stable Expo + React Native + Expo Router; iOS/Android; Expo development builds for unsupported native SDKs.
- `apps/web`: lightweight Next.js (or a comparably proven framework) for **public profile/product links** plus **authenticated admin**. Do not build a Shopify-like storefront editor.
- `packages/shared`: validated schemas, TS types, formatters, permissions, design tokens where practical.
- `supabase/migrations`, `supabase/functions`, optional `supabase/seed`: reproducible SQL, RLS, storage policies, secure functions and sample data.
- `docs`, `reference`, CI workflows and EAS build profiles.

Backend: Supabase Postgres + Auth + Storage + Realtime + Edge Functions or server-side functions as appropriate. Design typed repository/services with schema validation. All authenticated write operations must validate identity AND resource ownership. Never rely solely on the UI. Enable **RLS on every relevant table** and test authenticated/anonymous/blocked-role access. Keep auth sessions secure on device, private secrets on server, public Expo variables limited to non-secret values. Avoid overcomplicated infrastructure and paid dependencies where no practical need exists.

Expected domain model (adapt as needed): accounts/profiles, follows, friend requests/connections, blocks/mutes, interests, posts/post media/post products, likes/comments/bookmarks, stories/story media/views/highlights, boutiques/store collections, products/product media/categories, conversations/participants/messages/message attachments, offers/barter items, trade agreements/transactions/reviews, live sessions/live comments/pins, notifications/device tokens, reports/moderation actions/verification requests, feature flags, audit events. Use indexes, pagination, timestamps, unique constraints and soft-deletion/retention policies where appropriate. No overly permissive `USING(true)` RLS for private data.

Quality requirements: structured app navigation, reliable offline/poor-network behavior, retryable mutations, consistent errors, realistic seeded preview data that is clearly demo-only, proper loading states, access controls, tests, telemetry with privacy protections, observability and environment separation (`local`, `staging`, `production`). Keep core API/domain modules reusable and isolated from UI. Use a provider adapter for live streaming and notification services.

## 5. Execution order: autonomously ship complete vertical slices

**Phase 0 — Foundation:** Initialize git, workspace, Expo app, web shell, Supabase migrations, design tokens, environments, CI, project docs and auth. Provide first installable app, not just screenshots. No new paid services.

**Phase 1 — Social nucleus:** Two-user login test, social profile, follow/unfollow, real post composer, photo/video upload, responsive feed, comments/likes, social sharing, search, basic admin/report/block. Verify persistence with device restart and account switching.

**Phase 2 — Market nucleus:** Auto boutique, products and categories, new/used listings, local discovery, detail pages, public profile/product links, product-linked 1:1 messaging, saves, sold/reserved state. Verify two-account discovery-to-chat journey.

**Phase 3 — Community commerce:** Friend requests, status viewer 24h/visibility/highlights, notifications, voice messages, price offers, barter and counteroffer agreements, in-app review flow, contact sharing/invites with consent.

**Phase 4 — Live:** Integrate and test chosen provider on real devices, pinned products, moderation, comments, real live state, tokens and webhooks. If blocked by credentials or payment, clearly mark `BLOCKED_EXTERNAL` in acceptance table; do not pretend complete.

**Phase 5 — Harden and distribute:** Run visual QA, performance tests, media reliability tests, RLS matrix, admin/moderation tests, E2E two-user flows, offline and low-bandwidth tests, iOS/Android builds, staging environment, staging public links and deploy preview only where credentials/permissions allow. Prepare owner handoff, runbook, release checklist and honest acceptance report. No public app-store submission without explicit owner permission.

Do not let architecture planning, UI decoration, or an optional integration postpone the core vertical slices. Conversely, **don't declare “done” because the build compiles**. Continue until real end-to-end tests pass.

## 6. Detailed acceptance tests (must be witnessed)

1. **Identity:** account A and B can create independent accounts and profiles; session survives restart; logout prevents private access; private email/phone isn't publicly exposed.
2. **Social:** A follows B, sees the correct real count and B's public post; A can like/comment/save; changes persist after refresh. B can delete own post; A cannot delete B's post.
3. **Media:** upload a photo and a short actual video, display them after cold restart, handle permission denial, cancel and failed upload without losing draft. Test at lower bandwidth.
4. **Discovery:** buyer A in Dakar finds seller B's new listing despite not following B; opening product leads to B's profile/boutique and private chat. Location remains approximate unless explicitly shared.
5. **Boutique:** seller B's products automatically appear under `Boutique` tab and on a public share URL; non-logged-in visitor sees only public data.
6. **Chat:** A sends a product-linked message; B receives it on another logged-in device/account and replies; unseen/restart state behaves correctly; third party C cannot access conversation data (SQL/RLS test).
7. **Used sale:** buyer views an `occasion` listing, proposes price, seller counters, state persists and makes sense to both sides.
8. **Barter:** A offers an A-owned item for B's B-owned item plus optional XOF difference; B counters or accepts; terms are persisted; an unauthorized user cannot accept; no money is falsely claimed to be held.
9. **Status:** B posts a 24h status, A sees it only if allowed, reply opens B chat; status expires correctly and a saved highlight remains, where authorized.
10. **Live:** B really broadcasts video/audio and A really views and comments, B pins a product, A can navigate to chat; test camera/mic permissions, host end, moderator actions, token security. If provider credentials unavailable, report explicitly as blocked rather than passing.
11. **Safety:** report content and block B; no blocked content or unwanted DMs leak; admin can view and act on report; verified badges are not granted accidentally; RLS negative tests pass.
12. **Share:** product and profile share sheet URLs open a real public page, provide useful preview title/image and optional deep link.
13. **Mobile experience:** usable small iPhone, large iPhone and Android screen, safe area, keyboard, accessibility basics, pagination, loading/empty/error states. No dead taps or confusing placeholders.
14. **Release:** `lint`, `typecheck`, tests, Expo doctor, production/preproduction builds and smoke tests pass as supported. Record exact SHA, test device/environment, test evidence and remaining blockers. Never claim iOS device-tested when only a simulator/browser was used.

## 7. Explicit decisions and boundaries

- Brand: **Jëfëli** / ASCII **Jefeli**, Atlantic Sand selected. Owner selected this direction; no additional palette debate. Name/domain/trademark still requires clearance.
- **Social-first, commerce built in**, not e-commerce-first or merchant SaaS. Do not create platform-owned products or pretend Jëfëli is merchant of record.
- French first, FCFA. Senegalese local context without stereotypes. No pretense that all features are available nationwide until tested.
- Primary experience must be beautiful and efficient, not a generic Claude/AI template. Reference matching + actual screenshot review is required.
- Phone OTP is a product goal but may cost SMS; build integration safely, allow low-cost dev/testing without claiming production phone auth. Do not purchase SMS services without permission.
- Streaming, app signing and push may require third-party setup; build responsible integrations and label blockers. Do not use Lovable unless the owner explicitly decides to, and do not pay for it.
- Public UGC safety and privacy are release blockers. Disallow fake social proof, fake orders, pretend payments, fabricated viewers, broken UI controls and mock business data represented as real.
- No unsolicited large redesigns after acceptance. Make changes in coherent commits and prove regressions have not been introduced.
- Optimize for inexpensive first pilot. Before any recurring cost, present provider, why required, no-cost alternative, price assumptions and a specific approval ask.

## 8. Reporting and handoff protocol

Give concise milestone updates **with evidence**, not optimistic promises. Every time a phase closes, state exactly: `SHIPPED`, `TESTED`, `FAILED`, `BLOCKED_EXTERNAL` and `NOT_STARTED`, plus commit SHA and screenshots/tests if available. If the session or tool limit interrupts work, ensure all completed code is committed, leave `docs/IMPLEMENTATION_LOG.md` and `docs/NEXT_ACTIONS.md` up-to-date, and include a one-paragraph resume instruction. Do not lose the next step in an unpushed worktree.

Deliver, at completion:
1. Source code committed and versioned; exact repo and commit/branch references, no secrets.
2. Reproducible migration and setup instructions with `.env.example` and no committed real keys.
3. Working Expo development build links or precise installation steps, plus web preview URLs where actually deployed.
4. Visual evidence from actual rendered screens, with before/after UI QA as useful.
5. Automated and manual test results covering the complete two-account social commerce journey.
6. Admin/reporting system and initial UGC policy drafts for owner/legal review.
7. `docs/RELEASE_STATUS.md`: truthful final readiness table, external credentials still required, cost estimates, and exact remaining owner actions.
8. A tiny actionable test script the owner can follow on an iPhone in French.

**Begin now. Inspect the provided package, create the actual project, and build Jëfëli end to end. Do not respond with another proposal or ask for approval to start coding. If truly blocked by external credentials, continue on independent modules and report the exact blocker.**
