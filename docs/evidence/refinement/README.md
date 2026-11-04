# Post-playtest refinement — before / after screenshots

Browser renders of the Expo SDK 58 app (react-native-web, Chromium) and of the Next.js public
pages, captured by `tests/e2e/scripts/refinement-shots.cjs`. Signed in as the DÉMO seller
`awa@demo.jefeli.test` at three phone sizes: `iphone-se` (375×667), `iphone-15` (393×852),
`pixel-7` (412×915). **These are not device screenshots.** Safe areas, the keyboard and the
photo library still need a real Expo Go session.

The after set includes the reference-driven visual pass (floating pill navigation with a round
« Publier » button, pill search, Explorer icon tiles, inset-image cards, quiet currency, grouped
product details). See `docs/DESIGN_SYSTEM.md` › « Patterns from the owner's UI references ».

| # | Screen | What changed |
|---|---|---|
| 01 | Home *Pour toi* | The « Demandez à la communauté » box and its intent shortcuts are gone. Statuses and feed tabs are unchanged. Round bell, pill search, floating tab bar |
| 02 | Publier | One 2×2 grid of icon-led choices: Publication, Statut, Article and Live (« Bientôt », disabled). « Demande à la communauté » is removed |
| 03 | Publication composer | The text comes first. The type (Je partage / Je cherche / Je propose / Votre avis ?) is marked « facultatif ». Product tagging is folded away |
| 04–05 | Nouvel article | 3 steps (L’essentiel → Détails → Remise) with a progress bar. Price choice: Prix affiché / Prix sur demande / À discuter |
| 06–07 | Explorer | Location pill beside the title. Tout / Neuf / Occasion / Troc. Icon tiles (« Tous » + 3, « Voir tout » expands to the 4-column grid). White cards with inset photos; never « 0 F » |
| 08–09 | Own profile | Cover photo, « Membre depuis… », boutique preview with article count and pin markers, pinned publication first |
| 10 | Product (BaolMode baskets) | « Épinglé par le vendeur ». Price with quiet « F CFA ». Details in a grouped list with icon bubbles. WhatsApp and Partager buttons |
| 11 | Messages | Unchanged list. In a conversation, « + » now offers « Envoyer des articles » (see `docs/evidence/e2e/pricing`) |
| 12 | Public product page | The price label comes from the shared formatter. The sticky contact bar is kept to one line |
| 13–16 | *after only* | « Prix sur demande » article in the app and on the web, public storefront with cover and pins, a seller profile as a visitor |

The before set was captured on the previous DÉMO data. The DÉMO data was then re-seeded
(`pnpm seed --reset`) to add the price-mode examples, pins and a cover, so product ids differ.
Both sets show the same BaolMode baskets article for screen 10.
