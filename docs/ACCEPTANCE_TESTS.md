# Jëfëli — acceptance matrix and evidence requirements

## Evidence standard
Each item must end with `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, or `NOT_TESTED` and links or paths to test output/screenshot. Identify device/environment, branch, commit SHA, and *actual observed result*. A browser-sized screenshot does not count as an iPhone physical-device test. A compiler pass does not prove a feature functions.

| ID | Journey | Required evidence |
|---|---|---|
| ID-01 | A/B accounts | Real signup/signin and refresh/restart; A cannot access B private data |
| SOC-01 | Profiles/follows | B's count changes when A follows; persists and unfollow reverses |
| SOC-02 | Feed & UGC | A publishes photo/video, B sees, reacts/comments; B cannot edit A's post |
| SOC-03 | Search & nearby | Buyers can find a non-followed seller by category/city without precise GPS |
| SOC-04 | Sharing | Public product/profile links work logged-out; OS share sheet opens |
| PROF-01 | Social boutique | B's first listing creates populated boutique tab automatically, no builder wizard |
| MKT-01 | Used listing | Photo/condition/XOF/location visible; seller can reserve/sell and buyer sees state |
| MKT-02 | Price negotiation | A offers, B counters, A accepts/rejects; state and permissions valid |
| MKT-03 | Barter | A offers A-owned item for B-owned item + XOF difference; agreed terms survive restart |
| MSG-01 | Realtime chat | two separate accounts/devices exchange product-linked and ordinary messages |
| MSG-02 | Attachment | photo and voice note if enabled; permission errors and replay work |
| STA-01 | 24h status | author publishes, authorized follower sees/replies, nonauthorized user blocked, expires |
| STA-02 | Highlights | owner explicitly pins highlight; follower sees per privacy rules |
| LIVE-01 | Real live stream | stream from B real device to A real device with camera/mic and pinning |
| LIVE-02 | Provider auth/moderation | invalid/expired stream token fails; comments/blocks/reports work |
| SAF-01 | Report & block | block stops interaction and feed leakage; report visible in admin |
| SAF-02 | Review & verified | no fake badge; review requires controlled completed interaction |
| SEC-01 | RLS matrix | automated negative permission cases for posts, DMs, offers, profiles, admin |
| DEV-01 | App reliability | restart, denied permissions, poor network, upload failure/retry, empty states |
| DEV-02 | UI quality | real iOS/Android captures, safe areas, keyboard, responsive, legible and consistent |
| REL-01 | Reproducibility | exact clean install/build/migration/test commands succeed |
| REL-02 | Handoff | README, env names, staging link or blocked reason, deploy checklist, owner test script |

## End-to-end owner pilot script (French)

1. Créez deux comptes test A et B sur deux appareils ou sessions isolées.
2. Sur B, publiez une photo, un statut et un article « Occasion », avec un prix en FCFA et une localisation Dakar.
3. Sur A, trouvez B sans l'avoir suivi, ouvrez l'article, visitez sa boutique et suivez B.
4. Envoyez un message depuis l'article et vérifiez que B le reçoit, répond et que l'historique revient après fermeture de l'application.
5. Proposez un prix inférieur puis faites accepter ou refuser l'offre par B.
6. Publiez un objet depuis A et proposez un troc avec l'objet de B; négociez une différence et vérifiez la fiche récapitulative.
7. Répondez au statut de B et vérifiez l'ouverture correcte du message privé.
8. Sur B, démarrez un vrai live; A rejoint, commente et ouvre le produit épinglé. Si non configuré, exigez un état bloqué expliqué et jamais une démonstration prétendue « en direct ».
9. Depuis A, bloquez ou signalez B; vérifiez le comportement et la file de modération sur l'administration.
10. Partagez un lien produit par WhatsApp, ouvrez-le sur un appareil sans application et contrôlez le titre, la photo et le lien vers l'application.

## Release gates

- **Gate A: developer preview**: local real auth/data, core UI, internal seed. Can have feature flags, must label demo environment.
- **Gate B: invited pilot**: social, marketplace, 24h status, messaging, barter, moderation working and multi-device tested; live either genuinely configured/tested or **explicitly excluded from that pilot** with owner approval. No pretending the full live feature is ready.
- **Gate C: public app store**: legal policies reviewed, production auth/streaming costs approved, content response operations staffed, production builds, privacy compliance, real devices, app-store access, explicit owner release approval.
