# Jëfëli — autonomous build plan

This is an **execution order**, not a suggestion to return only a project plan. Complete and test each vertical slice before declaring success; continue working to the next slice when possible.

## M0 — repo and environment
- Inspect existing work, initialize safe version control and branch strategy.
- Bootstrap Expo/TypeScript app and public web/admin shell, Supabase migrations, RLS, config and design tokens.
- Confirm startup in development build / Expo Go where appropriate, Supabase connection, auth session and lint/typecheck baseline.
- Output: first reproducible installable app and credible architectural foundation.

## M1 — the living social network
- Actual signup/login, profile edit, follow/friend requests, home feed, rich post composer with image/video, reactions/comments/bookmarks, share, discovery/search.
- Small admin/report/block first pass. Real two-account tests and screenshot review.
- Exit: user A can discover B, follow, see published photo/video and interact after restart.

## M2 — commerce that works
- Every profile has boutique and product catalogs automatically. New/used/refurbished products, XOF price, condition, locale, availability, product-linked DM, offers and public share pages.
- Exit: a stranger discovers seller B's listing, views shop, contacts seller, negotiates.

## M3 — living community
- 24h status, highlights, private replies, push and in-app notifications, voice attachments, barter/counteroffers, reviews and merchant verification workflow.
- Exit: social-commerce flows work between two users, with permission and persistence checks.

## M4 — live commerce
- Evaluate streaming provider and Expo dev client, implement real host/watch, live comments, pinned product, viewer states, security and moderation. Use sandbox/trial credentials when provided; obtain owner approval before recurring charges.
- Exit: two physical devices can participate in a **real** live video session. If blocked, report and feature-flag, never fake a demo as passed.

## M5 — hardening/handoff
- RLS negative tests, media failures, performance under modest network quality, privacy flows, admin moderation, polished design visual comparisons, signed staging builds and web previews where permitted.
- Exit: evidence matrix, README, exact SHA, known bugs, external requirements, owner test script and release checklist.

## Prioritization under session/tool limits
1. Preserve working code in commits and update `IMPLEMENTATION_LOG.md`/`NEXT_ACTIONS.md` before context ends.
2. Prefer one fully working vertical slice over six half-built impressive UI screens.
3. Never silently downgrade live streaming to static prerecorded imagery; never claim an unconfigured provider is functional.
4. Honest status states: SHIPPED, TESTED, FAILED, BLOCKED_EXTERNAL, NOT_STARTED.
5. No secret credentials or paid service signups without user permission.
