# Jëfëli brand assets

Owner-approved on 12 Nov 2026: the « Jëfëli. » rounded logo (mint `#A3E4D7`, gold period
`#E3B777`, on night `#091B19`) and the « J. » app-icon mark taken from the same letters.
Every letter is constructed geometrically (monoline strokes with round ends, one weight, shared
x-height and ascender, optical overshoot), with no third-party font or artwork.

| File | Use |
|---|---|
| `jefeli-logo.svg` | logo on dark (mint + gold) |
| `jefeli-logo-ink.svg` | logo on light (ink + gold) |
| `jefeli-mark.svg` | « J. » mark |
| `jefeli-app-icon.svg` | 1024 app icon master (night square, the platform masks it) |
| `source/wordmark.py` | the geometry: regenerate everything from here (`pip install shapely`) |

Derived assets: `apps/mobile/assets/images/` (iOS icon, Android adaptive foreground, background
and monochrome, favicon, splash), `apps/mobile/public/` (apple-touch-icon, og.png),
`apps/web/src/app/` (icon.svg, favicon.ico 16/32/48), `apps/web/public/og-default.png`, and
`apps/mobile/src/design/brandPaths.ts` (the in-app `BrandLogo` / `BrandMark`).

Checks done before integration: real sizes on iOS (1024, 60/40/29 pt), Android adaptive masks
(circle, squircle, rounded, teardrop) with 0 px outside the 66 dp safe zone, Android 13 themed
monochrome, the browser tab at 16 px, the desktop sidebar, the splash and both social previews.
