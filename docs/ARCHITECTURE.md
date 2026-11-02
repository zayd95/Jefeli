# Jëfëli — Engineering architecture and constraints

## Proposed deployable units

```text
jefeli/
  apps/mobile/             # Expo Router / React Native / TypeScript
  apps/web/                # public profile/product routes + secure moderation console
  packages/shared/         # Zod schemas, shared types, price/date formatting, access rules
  supabase/migrations/     # SQL DDL + RLS + indexes + storage policies
  supabase/functions/      # validated trusted server APIs, live tokens, notifications
  supabase/seed/           # clearly labeled staging-only demo accounts/content
  docs/                    # implementation log, setup, security, runbook, release status
  reference/               # Atlantic Sand brand reference, not app's runtime images
  .github/workflows/       # tests, lint, typecheck, Expo doctor
  CLAUDE.md
  README.md
  .env.example
```

Keep monorepo tooling simple and current; don't introduce unnecessary services. `apps/web` can host public marketing/share links and admin behind auth; separate trusted routes from publicly rendered data. Supabase is system of record, with specialized third-party video provider behind a service adapter.

## Data model proposal

| Area | Minimum tables or equivalents | Requirements |
|---|---|---|
| Identity | profiles, account_settings, interests | auth.users FK, handles unique normalized, phone/email private |
| Social graph | follows, friend_requests, friendships, blocks, mutes | avoid duplicates/self-links, block cancels/limits interactions |
| Feed | posts, post_media, post_products, likes, comments, saves | visibility, ownership, moderation states, cursor pagination |
| Status | stories, story_media, story_views, highlights, highlight_items | 24h server timestamps, audience/expiry policy |
| Commerce | boutiques, collections, categories, products, product_media | listing owner, XOF amount, item condition, availability, location |
| Conversations | conversations, members, messages, message_media | only members can read/write, muted/blocked checks |
| Negotiation | offers, trade_offer_items, agreements, reviews | immutable accepted-terms snapshots, valid transitions, reviews constrained |
| Live | live_sessions, live_product_pins, live_comments | provider session state synchronized by trusted server webhook |
| Safety | reports, moderation_actions, verification_requests | restricted admin roles, audit logs, no spoofed verified badge |
| App infra | push_tokens, notifications, feature_flags, event_analytics | token ownership, opt-out, minimal event data |

Minimum fields across entities: UUID identity, created_at, updated_at; `created_by` where applicable, explicit visibility and moderation status, constraints and indexes on foreign keys/sort fields. Decide soft vs hard deletion by compliance and ownership lifecycle. Keep JSONB only where appropriate; prefer normalized, validated data for core flows.

## Transaction and barter state machines

Money offer: `pending -> accepted | rejected | countered | withdrawn | expired` with immutable audit record. Barter extends offer with `offered_product_id`, `requested_product_id`, `cash_difference_xof` and `cash_payer` validated. On mutual acceptance, create a single agreement snapshot. Agreement: `agreed -> completed | canceled | disputed`. A transaction status is user-reported and never a statement that Jëfëli processed money or guaranteed delivery. Server handles idempotency/race conditions and validates owned listing IDs.

## Auth and RLS checklist

- `profiles`: safe public fields viewable per visibility, private contact/settings accessible only to owner and authorized admin functions; do not simply expose `auth.users`.
- `posts, stories, messages`: visibility and block checks enforced in database or trusted server, not only in client.
- `conversations/messages`: membership required for select/insert/update; no leakage through realtime subscriptions or storage object URLs.
- `products`: seller ownership for writes; only active public listings for public readers; report/suspended listings excluded.
- `offers`: only eligible counterparties, accept/reject only correct recipient; double-accept prevented by DB transitions.
- `admin`: roles server-verified, auditable; no self-assigned admin by client or public API.
- `storage`: per-owner upload paths, file-size/type checks, private bucket policies or short-lived signed URL strategy as appropriate. Validate uploads server-side where necessary.
- `live provider`: token signing server-side; role/expiry scoped, webhook signatures checked, no secrets in `EXPO_PUBLIC_*`.
- `notifications`: receiver-only read, guarded delivery to blocked/privacy-restricted recipients.
- `analytics`: anonymous/consented minimal event collection; no tracking sensitive content unnecessarily.

Provide automated negative access tests: anonymous reading private DM/story, user A mutating B's product, non-member subscribing to chat, blocked user sending message, spoofed seller verification, unauthorized moderator action, tampering with offer acceptance.

## Technical product quality

- Network: retries/backoff, queued drafts if offline, predictable status banners; media uploads resumable where available; avoid data-loss on back navigation.
- Mobile performance: FlatList/FlashList-style virtualization where supported, memory limits, compressed thumbnails, lazy video autoload, pagination, cache invalidation and eventual consistency.
- App state: typed view models, stable query/cache solution, shared validators, strict forms with good errors.
- Locale: French strings in a translation dictionary, XOF as integer smallest currency unit (XOF no fractional centimes), date/time in Dakar timezone for presentation where relevant, storage timestamps UTC.
- Safety: rate limits for signup, uploads, messaging, report spam; content moderation hooks. Do not claim AI moderation exists if no service configured; at least implement rules, reporting queue, throttling and admin review.
- Observability: errors, provider request IDs, audit/health checks, no secret logging. Limit personal data in logs.
- Test environments: isolate local/staging/production, feature flags for unavailable services. Seed content must never be mislabeled as real accounts/verification/transactions.

## External integration strategy

| External feature | Default approach | Cost/safety control |
|---|---|---|
| Phone OTP | Supabase Auth + supported SMS vendor | rate limiting, provider credentials and SMS cost owner approval |
| Live | Evaluate Stream Video RN Expo integration (or compatible managed live provider) | Expo dev client, real stream tests, backend-signed token, no pretend stream |
| Sharing | OS native share + public web routes | never auto-post to closed platforms or scrape friends |
| Facebook | Official OAuth and permitted `user_friends` subset | not all Facebook friends; app-review/permissions needed |
| Push | Expo notifications with EAS/development build as appropriate | device permissions, per-user tokens, no confidential detail on lockscreen |
| Analytics | simple consent-aware event counts | no expensive behavior-tracking service required |

## Build environment

Create `.env.example`, validate environment values and provide an unambiguous setup script. For local work use an email-based test auth path and clearly mark it as test-only if phone sign-in isn't configured. Expo's current SDK selection and install commands must come from the documentation at build time; don't freeze versions based on this brief. Public Supabase publishable keys are acceptable in client only with correct RLS; never ship `service_role` or any vendor signing secret.
