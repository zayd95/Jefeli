# Jëfëli — ready-to-give-Claude-Code build package

## How to use

1. Extract this folder to a new working directory (or copy its contents to the intended clean Git repository).
2. Open a terminal **inside the extracted folder** and run `claude` (Claude Code). If this is an already initialized project, back it up and inspect git status first.
3. Paste the **entire contents** of `PASTE_INTO_CLAUDE_CODE.md` into Claude Code. That's the one end-to-end execution prompt; you do not need to paste the other files separately.
4. Grant only necessary development permissions. Connect GitHub, Expo and Supabase when prompted. Never paste secret keys into chat or commit them to Git.
5. Review the agent's actual test evidence and `docs/RELEASE_STATUS.md`, not just its claims that it finished. Begin testing on your iPhone when a development build is available.

## Included

- `PASTE_INTO_CLAUDE_CODE.md`: complete single-shot execution instruction.
- `CLAUDE.md`: persistent coding-agent requirements.
- `docs/PRODUCT_SPEC.md`: user journeys, features, definitions and product boundaries.
- `docs/DESIGN_SYSTEM.md`: Atlantic Sand visual tokens, UI patterns and screen checklist.
- `docs/ARCHITECTURE.md`: suggested monorepo, service and data design.
- `docs/ACCEPTANCE_TESTS.md`: independent and testable acceptance matrix.
- `docs/MILESTONES.md`: build order and release gates.
- `docs/OFFICIAL_DOCS.md`: trusted technical-policy references and caveats.
- `reference/Atlantic_Sand_Reference.html` and `.png`: visual reference of the approved direction, not functioning app code.
- `.env.example`: example variable *names* only, never production credentials.

## What is NOT already included

This handoff is the **build specification and reference package**, not a pre-built Jëfëli mobile application. Claude Code is instructed to create the actual source code, infrastructure, integrations and tests. Provider accounts, phone OTP, live-video streaming, deployment/signing credentials and official brand/domain clearance may require owner action.

## Approved product definition

Jëfëli is a Senegalese social-first B2C marketplace with C2C secondhand and barter: feed, friends/follows, statuses, livestreams, messaging, every-profile boutique, real local product discovery and external social sharing. It is NOT a Shopify-style store builder and does not own inventory. French first, XOF/FCFA, Dakar pilot.
