# Jëfëli — Atlantic Sand design system

## Authority
Owner explicitly selected **Palette 4: Atlantic Sand**. This file overrides all alternative palette explorations. Brand is **Jëfëli**; correct two diaereses matter. ASCII `jefeli` is only a technical fallback.

## Design tokens

| Token | Hex | Purpose |
|---|---|---|
| `color.canvas` | `#F6F5F1` | light-mode app canvas |
| `color.ink` | `#10252C` | main text, primary dark surfaces, graphic identity |
| `color.mint` | `#A3E4D7` | follow, CTA, selected state, interactive highlights |
| `color.slate` | `#607071` | secondary metadata, locations, time |
| `color.surface` | `#FFFFFF` | cards, sheets and readable media framing |
| `color.night` | `#0D1B2A` | optional dark mode foundation |
| `color.live` | accessible red | streaming status ONLY; don't use mint as LIVE status |

Implement semantic tokens: background, surface, subtle surface, ink, secondary text, border, action, action text, danger, disabled, skeleton. Account for contrast ratios in light/dark modes; don't assume every mint-on-white combination is legible. Disable dark mode until all surfaces support it rather than shipping broken mixed themes.

## Component vocabulary
App header, search input, feed tabs, story rings, social post, video preview, listing card, price label, verified state, follow button, icon row, profile header, shop strip, product tile, category chip, message bubble, barter proposal card, live host/control panel, share sheet trigger, modal bottom sheet, toast, validation, upload progress, contextual action menu, report flow, skeleton and empty state.

## Interaction hierarchy
1. Social content is primary. Product shopping is optional per post.
2. Primary CTA generally single and visually clear: `Message`, `Suivre`, `Contacter`, `Faire une offre`, `Proposer un échange`.
3. Secondary actions are low-noise outlines or icons. Do not scatter multiple mint buttons on each card.
4. Avoid giant rectangular e-commerce banners on home; show story circles and social-media-first content.
5. New/used/troc metadata belongs near product price but should not drown image.
6. Friend and follower are distinct: `Ajouter en ami` for mutual connection, `Suivre` for public audience.

## Layout
- Minimal top app bar with strong wordmark and useful navigation.
- Safe-area-aware, keyboard-avoiding, thumb-friendly bottom tabs.
- Use 8-point-ish layout system (4/8/12/16/24/32), thoughtful content-width/padding; not hard-coded pixel-perfect assumptions.
- Editorial photography, genuine aspect ratio, correct poster video treatment, no stretching or over-filtering.
- Profile: name/handle/location first; statuses/highlights; then **boutique preview**; content tabs (`Fil`, `Statuts`, `Live`, `Boutique`, `Avis`) without making a merchant template.
- Product: media first, price clear, seller details and condition, location and realistic contact/offer CTA.
- Messages: calm spacious thread with pinned linked product context; actual composer with attachments and voice input states.
- Live: full-frame media, unobtrusive comments overlay, visible true `EN DIRECT`, current pinned item, safety control.

## Patterns from the owner's UI references (post-playtest refinement)
The owner shared two references, a travel app and a banking app. They guide composition,
spacing and interaction patterns. They are **not** copied: colours stay Atlantic Sand.

| Pattern | Where | Rule |
|---|---|---|
| Floating pill navigation | Tab bar (`(tabs)/_layout.tsx`) | A white pill on the canvas. The active tab is a mint-soft pill with its label; the others show icons only and keep their French accessibility label. « Publier » is a separate round ink button with a mint `+` |
| Round icon buttons | Header bell (`IconButton variant="surface"`) | White circle with a hairline border. Counters sit outside the circle |
| Pill search | `SearchBar` | White, fully rounded, hairline border, on the sand canvas |
| Location pill | Explorer header | Small mint icon disc, the city (or « Toutes les villes »), and a chevron. Opens the city sheet |
| Segmented control | Explorer type, `OptionRow` without hints | White rounded container. The selected option is ink with white text, the others are secondary text. Two-line labels are allowed at 375 pt |
| Icon tiles | Explorer categories (`lib/categoryIcons.ts`) | 4 columns, a lucide line icon and a short label, with the full category name as the accessibility label. Selected = mint-soft fill with a mint border. « Voir tout » / « Réduire » in the section header |
| Quiet section headers | Explorer, lists | `headline` at weight 600. The secondary action (« Voir tout », « Effacer les filtres ») is secondary text, never a button |
| Inset-image cards | `ListingCard` | A white card (radius 19) with the photo inset by 5 pt (radius 12). Below: title, a pin + location line, the price and the DÉMO seller label |
| Quiet currency | `PriceLabel` (app), `PriceText` (web) | Strong digits with a secondary « F CFA ». « · à discuter » is secondary too. Labels such as « Prix sur demande » replace the number; never « 0 F » |
| Grouped detail list | Product page | One rounded white container. Each row has a round mint-soft icon bubble, the value and a hint, with hairline dividers |

Field edges keep `borderStrong` so they stay visible on the sand canvas (non-text contrast).
On web, the browser's own focus ring inside fields is removed because the field border
already turns ink on focus.

## UX writing
French, short, plain and locally natural. Examples: `Pour toi`, `À proximité`, `Occasions`, `Troc`, `Faire une offre`, `Envoyer un message`, `Vendu`, `Réservé`, `Proposer un échange`, `Votre statut`, `En direct`. Prices: `25 000 F CFA` (or compact `25 000 F` with clear currency context). Never show invented activity stats as actual.

## Design QA checklist
- At least 5 actually rendered screens: feed, social-first profile/boutique, product, messaging, publish/status, plus live and explore.
- Capture at small/large iPhone and typical Android dimensions; verify safe areas, keyboards, long Wolof/French names, price digit widths and limited connectivity.
- Check text hierarchy, contrast, empty/loading/error states, tappable targets, motion/accessibility, media rendering, disabled states.
- Include screenshot comparisons and make iterative changes, not a one-pass skin.
- Reference HTML/PNG in `reference/` documents intended visual quality; it is **not** app source code or a substitute for running native app screenshots.
