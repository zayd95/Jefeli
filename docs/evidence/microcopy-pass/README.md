# Microcopy cleanup and mobile polish (Nov 6, 2026)

Owner feedback after testing on an iPhone in Expo Go: the design is approved; there were too
many explanatory subtexts. Principle: **show more, explain less**, without losing trust, payment,
privacy, validation or barter/offer guidance. No redesign, no new screen, dependency or schema.

Browser renders (Chromium, `isMobile`, 1×) at **360×640** (a small Android phone, the worst case
for the fixed CTA), **390×844** and **412×915**: `before/`, `after/`, and `compare/` (« Avant |
Après »). The same local database was used for both, so content matches; « … test … » items are
leftovers from earlier E2E runs.

## Removed

| Screen | Text |
|---|---|
| Onboarding | « Un nom, un pseudo, et vous êtes dedans. Le reste peut attendre. » |
| Onboarding | « Vous pourrez publier, découvrir et ouvrir une boutique quand vous le voudrez. » |
| Onboarding | « Votre premier pas » (header filler; « Se déconnecter » takes its place) |
| Onboarding | Idle handle hint « Suggéré automatiquement, modifiable. » |
| Explorer | Tagline « Ce que font les gens d’ici : ateliers, boutiques, occasions et troc entre voisins. » |
| Messages | Tagline « Les belles affaires commencent par une conversation. » and the « DISCUSSIONS » overline (repeated the header) |
| Publication | « Membre de Jëfëli » under the author's name; the intent hint under the pills (the text-area placeholder already changes with the intent); « Cette audience est appliquée par Jëfëli. » |
| Article | « Les essentiels, puis on publie. Le reste est facultatif. »; « Indiquez un prix de départ si vous le souhaitez. » (the field says « facultatif »); « 1 pour un article unique. »; the feed-share toggle description |
| Product | « voir le profil et la boutique » on the seller card (the chevron says it) |
| Profile | « Ce profil reste accessible sans boutique. »; « Rien n’est simulé. » in the lives sheet |
| Edit profile | « Jusqu’à 5 secteurs, affichés sur votre profil (3 visibles d’emblée). Ils aident aussi votre fil. » → the limit moved into the label « Intérêts business · jusqu’à 5 »; the cover-photo suggestion line |
| Boutique details | « Quelques informations pratiques pour vos clients. Pas de thème, pas d’abonnement… » |

## Shortened

| Screen | Before → after |
|---|---|
| Onboarding | « Disponible · modifiable quand vous voulez » → « Disponible » — shown only after the server confirmed the handle is free (« Vérification… » while checking) |
| Onboarding, edit profile, article options | « Localisation approximative, choisie par vous. Jëfëli n’utilise pas votre position GPS. » → « Ville choisie par vous, sans GPS. » |
| Accueil empty states | « Aucune publication pour l’instant. Partagez la première, ou suivez des membres depuis Explorer. » → « Partagez la première publication ou suivez des membres. »; following / nearby / live empty states likewise |
| Explorer · Wecci | « Wecci, c’est échanger : ces membres acceptent de discuter d’un troc, avec ou sans différence en argent. » → « Wecci : échange possible, avec ou sans complément en argent. » (barter guidance kept) |
| Messages empty | → « Écrivez à un vendeur depuis un article : vos discussions apparaîtront ici. » |
| Publication audience | → « Médias privés. L’audience ne pourra plus être changée après publication. » (privacy kept); Live → « Live vidéo · bientôt » (still disabled) |
| Article prices | « Échange uniquement (Wecci) : aucun prix nécessaire. » → « Wecci : pas de prix à indiquer. »; « Les acheteurs vous écrivent pour connaître le prix. Aucun prix n’est affiché. » → « Aucun prix affiché : les acheteurs vous écrivent. » |
| Statut | « Une photo ou une vidéo (60 s max), avec une légende… sélection. » → « Photo ou vidéo, 60 s max. »; the audience note keeps « Les réponses arrivent en message privé. » (the title already says 24 heures) |
| Profile | Own empty boutique → « Votre boutique apparaît avec votre premier article. Gratuite, sans abonnement. »; own lives → « Le direct vidéo arrive bientôt. » |
| Statuts (highlight sheet) | → « Il restera sur votre profil, visible par le même public. » (audience fact kept) |

## Preserved on purpose

- Payment and transaction terms: product disclaimer (Wave/Orange Money, Jëfëli holds no funds),
  the article form's payment line, the profile « Paiements et remises… » line, the boutique
  payment hint, the chat safety card (incl. never share SMS codes), agreements' wording.
- Barter and offers: offer / counter-offer / barter screens and cards unchanged; Wecci line kept.
- Privacy and consent: 18+ confirmation, sign-up terms, « Compte privé » and email/phone privacy
  notes, « Localisation approximative » on products, audience notes, the review rule, « Ce n’est
  pas une vérification de votre activité » (boutique identity), the SMS (+221) gate.
- Validation, errors and success toasts: unchanged (handle errors, price required, media
  required, failed feed share, upload errors).
- Accessibility labels: unchanged, including the long Live label.

## Layout fixes

- Onboarding footer is now one CTA (≈ 88 pt instead of ≈ 175 pt at 360×640): « Se déconnecter »
  moved to the header, the caption removed. The footer sits outside the scroll view, so it never
  covers the age confirmation; at 360×640 the age card scrolls fully above it, and at 390 and 412
  the whole form fits without scrolling.
- Age card: single-line checkboxes are now centred in their 44-pt target (no empty band under
  the label); multi-line checkboxes with a link or description keep top alignment.
- `keyboardDismissMode="interactive"` on the onboarding scroll view (iOS: drag down to dismiss).
- Touch targets: 40-pt Lovable pills (Home chips, Explorer filters, composer choices) keep their
  size and get a 48-pt hit area; profile counts, « +N » interests and « Plus d’infos » get larger
  hit areas.

Not verifiable here (no device): real keyboard height and safe areas on the owner's iPhone.
