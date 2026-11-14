# « v1 baseline » pull request — prepared, NOT opened

The P1 identity brief (14 Nov 2026) asks for this PR to be prepared and not opened (or opened only
as a draft). It is kept here until the owner says « go ». Opening it changes nothing in `main`
until it is merged, and **merging is the owner's decision alone**.

## Consolidation check (14 Nov 2026)

`git merge-base --is-ancestor <branch> origin/feature/design-direction-v2` returned **true** for
every remote branch, so `feature/design-direction-v2` (HEAD `2008b6d`) already contains all of them:

| Branch | Contained in `feature/design-direction-v2` |
|---|---|
| `main` | yes |
| `claude/jefeli-pilot` | yes |
| `feature/lovable-native-parity-20261104` | yes |
| `feature/w1-web-beta` | yes |
| `feature/w1.1-media-first` | yes |
| `feature/w1.2-smart-create` | yes |
| `feature/w1.3-create` | yes |
| `feature/w1.4-phone-auth` | yes |
| `feature/w1.4-desktop-web` | yes |
| `feature/brand-logo` | yes |

`feature/p1-identity` (this sprint) is cut from `feature/design-direction-v2` and is **not** part
of the baseline: it stays a separate sprint branch.

## Proposed PR

- **Head:** `feature/design-direction-v2` → **base:** `main`, draft.
- **Title:** v1 baseline — Jëfëli pilot, W1.1–W1.4, brand, design direction v2
- **Body (to paste):**

> One PR that brings `main` to the tested v1 baseline. It replaces the stacked drafts below, which
> can be closed after this merges (each is already contained in this branch):
>
> | Draft | Branch | Scope |
> |---|---|---|
> | #1 | `claude/jefeli-pilot` | Pilot: social marketplace (mobile, web, Supabase) |
> | #2 | `feature/lovable-native-parity-20261104` | Approved Lovable design in native Expo |
> | #3 | `feature/w1-web-beta` | Mobile-first web beta on Vercel |
> | #4 | `feature/w1.1-media-first` | 3-minute videos, Live hidden |
> | #5 | `feature/w1.2-smart-create` | Smart create and connected media |
> | #6 | `feature/w1.3-create` | Three-card +, drafts, adaptive editors |
> | #7 | `feature/w1.4-phone-auth` | Phone sign-up (+221), guarded SMS hook (flag off) |
> | #8 | `feature/w1.4-desktop-web` | Desktop web layout |
> | #9 | `feature/brand-logo` | « Jëfëli. » logo and « J. » icon |
> | #10 | `feature/design-direction-v2` | « Dakar after dark », white Explorer |
>
> Evidence: `docs/RELEASE_STATUS.md` (latest: hosted Explorer validation 13 Nov — probes 40/40,
> hosted UI 16/16, local E2E 69 passed / 0 failed / 10 skipped). Staging (`jefeli-staging`) is at
> the same schema. `phone_auth` stays off. Nothing is deployed publicly.

## What the owner decides

1. Open this PR as a draft? (yes / no)
2. After review, merge it into `main`, then close drafts #1–#10? (yes / no — owner only)
