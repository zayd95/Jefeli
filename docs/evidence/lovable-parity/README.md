# Lovable → native Expo parity evidence (Nov 4, 2026)

All images are **browser renders** (Chromium via Playwright, `isMobile`, 1× pixels). No iPhone,
Android device, iOS simulator or Android emulator was available in the cloud container, so real
safe areas, keyboards, haptics and native status bars are **not** shown here.

| Folder | What it is |
|---|---|
| `lovable-reference/` | The pinned Lovable lab (`zayd95/galsen-visual-playground@806a26f`, route `/`, its own fictional DÉMO data) rendered locally with its own Vite build, at 390 and 360 pt |
| `native-before/` | The native app on this branch **before** this pass (bridge commit `a9f918f`), 390 pt |
| `native/` | The native Expo app (Expo web build of the React Native code) **after** this pass at 360, 390 and 412 pt, on the local Supabase stack with `pnpm seed` DÉMO data. Signed in as DÉMO Awa; inbox/chat as DÉMO Fatou (Awa has no conversation in the seed) |
| `compare/` | Side-by-side « Lovable | native » at 390 and 360 pt for each screen |
| `states/` | A fresh account at 360 and 412 pt: real loading skeletons (feed and Explorer requests held), empty « Abonnements », empty inbox, empty profile tabs, the one-scroll form's inline validation, and the welcome screen with `prefers-color-scheme: dark` (the app keeps its own surfaces) |

The DÉMO people and photos differ between the two apps (each uses its own seed); compare
layout, hierarchy, colour, type and states, not content.

## Deliberate differences from the Lovable reference

| Lovable | Native | Why |
|---|---|---|
| Photo category tiles | Paper tiles with category icons (« Tous » on night + motif) | There is no category photography; no imagery is invented |
| Price-mode pills in Explorer | Tout · Neuf · Occasion · Wecci · Troc pills | `browse_products` filters by mode/condition/category/city; a price-mode filter does not exist server-side and is not faked client-side |
| « Mains d'ici » / « Près de vous » feed interludes, Artisans/Services chips | Not ported; chips are my city (nearby feed), Wecci, Occasions, En direct (only when live is enabled) | They need curated or invented data |
| No follower counts on profile | One quiet line of real counts (tappable lists) | Follow/friends are core social features; counts are real, not invented statistics |
| Inline comment field under each card | « Voir les commentaires » opens the post screen (dark) | Keeps threaded replies, deletion and reporting of comments |
| « Écrire au vendeur » | « Envoyer un message » | Existing wording used across the app and tests |
| Glass blur (`backdrop-filter`) | Higher-opacity solid glass | No blur view is installed in the native app |
| Product page minimal | Also keeps the details list (place, hand-over, Wecci), WhatsApp share and the full safety disclaimer | Native functionality kept |
| Chat has no offer cards | Offer / counter-offer / agreement cards stay light paper on the dark thread | Binding terms stay maximally legible |
