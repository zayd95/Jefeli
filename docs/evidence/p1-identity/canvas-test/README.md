# Canvas test — owner addendum 15 Nov 2026 (decision 1a, before applying it)

Same five 390 px screens, three canvas values, only `palette.canvas` changed (local stack, viewer = DÉMO Fatou):

| Variant | Canvas | |
|---|---|---|
| A | `#000000` | pure black |
| B | `#0B1311` | near-black, slight green (proposed in 1a) |
| C | `#061D18` | current forest green |

Sheets: `1-accueil-A-B-C.png`, `2-explorer-A-B-C.png`, `3-article-robe-beige-A-B-C.png`,
`4-article-telephone-blanc-A-B-C.png`, `5-boutique-A-B-C.png` (raw captures in `raw/`).

- **Photos are synthetic test images** (`tests/e2e/fixtures/make-canvas-photos.mjs`: beige linen dress on a
  warm studio backdrop, white phone on a light table). The session's network policy blocks image libraries,
  so no real photo was used; send two real photos and the sheets can be re-rendered in a few minutes.
- Only the canvas changes here. Cards and media containers still use `surface` `#0B2922` (green):
  applying 1a will also move photo backdrops/media containers to the neutral tone.
- Contrast on each canvas (WCAG): ink 19.2 / 17.2 / 16.1 · slate 8.9 / 8.0 / 7.5 · stone 8.1 / 7.3 / 6.8 ·
  gold 12.0 / 10.8 / 10.0 · mint 12.4 / 11.2 / 10.4 · red (icons, ≥ 3) 5.0 / 4.5 / 4.2 — all pass.
- Reproduce: `CANVAS=setup` then `CANVAS=A|B|C npx playwright test specs/zz-canvas.spec.ts` (after editing the canvas token).
