# Merge the approved Lovable Jëfëli experience into native Expo

You are working on zayd95/Jefeli, based on the existing Claude pilot. The user explicitly approved Lovable's visual quality, dark Home/Profile, clean near-white commerce and faster onboarding/publishing. Finish this integration in **real Expo/React Native code**, preserving the working Supabase functionality.

FIRST read docs/LOVABLE_NATIVE_HANDOFF.md. Treat the pinned Lovable commit and source links there as the visual authority, and this repository's native API/RLS/auth as the functional authority. Read docs/DESIGN_SYSTEM.md after its updated owner direction. Check the current Git branch and PR status before edits.

IMPORTANT: A work-in-progress native integration branch already has:
- near-white/dark Atlantic design tokens in packages/shared/src/tokens.ts;
- a discover-first, one-screen native onboarding in apps/mobile/src/app/onboarding.tsx;
- one 5-tab dock and Plus-to-post-composer route in (tabs)/_layout.tsx.

Do NOT discard or reimplement these from scratch without reviewing them. Do not copy Lovable's browser React/CSS/DOM backend into native Expo. Do NOT merge two unrelated repositories. Work on the native bridge branch, commit small bounded changes, and keep it as a draft PR.

EXECUTE, don't merely write a plan:
1. Verify the baseline bridge typecheck, lint and existing tests; fix any integration regressions.
2. Inspect pinned Lovable Home, Explorer, Profile, Product, Publish and Message UI and obtain actual screen references.
3. Port Home and post cards to dark Atlantic #091B19; preserve feed queries and post/story interactions.
4. Port Explorer/product to near-white #FAFBFA; preserve categories, offers, Wecci, navigation and chat.
5. Port profile to short cover, overlapping avatar, prominent bio, <=3 business-interest chips, two main tabs Publications/Boutique; remove duplicate boutique preview and giant pinned hero; keep privacy, stories, reviews, live and safety reachable.
6. Port publishing to direct Publication/Article/Statut switcher and a ONE-scroll listing form with progressive advanced details; retain existing drafts, upload progress, back-end RPCs and failed-write recovery.
7. Polish all five dock states, native status bars/safe areas, sheets and keyboard behavior; match Lovable rather than inventing generic UI.
8. Preserve email login; keep Senegal-only +221 SMS visibly gated until a provider is configured; never silently activate billing.
9. Run typecheck, lint, tests, mobile screenshot tests and two-user journey. Use screenshots at 360px, 390px and a larger Android width; review both light/dark and real empty/loading states. Fix regressions with evidence.
10. Summarize exact commit SHA, screenshot artifacts, checklist of verified vs pending functionality, and present an iPhone-ready review; do not merge/deploy without owner approval.

Product guardrails: Member/social first, boutique optional after onboarding, posts without prices, flexible pricing, Wecci, messaging/offer/counter-offer, no Jëfëli-held payment, 24-hour private statuses, block/report. Native already has stronger backend functionality; do not remove it to chase screenshot parity. Wallou bookings are a future module, not part of this merge.

Do not claim success until visually comparing genuine native renders against the pinned Lovable reference. If screenshots or devices are unavailable, state that limitation and leave PR draft.
