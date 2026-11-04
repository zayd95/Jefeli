# Jëfëli — end-to-end tests (Playwright)

Real UI, real backend: two isolated browser contexts act as two members (A buyer, B seller)
on a phone-sized viewport, plus the moderation console.

```bash
pnpm exec supabase start
pnpm exec supabase functions serve --env-file supabase/functions/.env   # other terminal
pnpm seed                                  # demo admin + content (screens tour)
pnpm mobile:web                            # :8081
pnpm web                                   # :3000
pnpm test:e2e                              # journey (11 stages) + screens (3 sizes)
```

- `specs/journey.spec.ts`: sign-up/onboarding, photo listing, search without following,
  realtime chat, reload persistence, price offer → counter → accept, barter with cash
  difference, follow count, 24 h status + private reply, report → moderator hides it → listing
  unavailable, block, logout. Screenshots go to `docs/evidence/e2e/journey/`.
- `specs/screens.spec.ts`: 16 screens at iPhone SE, iPhone 15 Pro Max and Pixel 7 sizes →
  `docs/evidence/e2e/screens/`.
- These are **browser renders of the React Native app**, not physical-device tests.
- Uses the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH`); `@playwright/test` is pinned to 1.63.0.
- `fixtures/make-images.mjs` generates the synthetic product photos that the tests upload.
