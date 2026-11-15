# Budget d'or — audit et corrections (addendum owner 15 nov. 2026, point 1b)

Règle : **un seul élément rempli d'or par écran** (l'action principale). Tout autre usage de l'or est un
petit marqueur : onglet actif, Jëf, étiquette Waxaale, filet.

## Méthode (mesurée, pas à l'œil)
`tests/e2e/specs/gold-budget.spec.ts` parcourt **31 écrans de l'app à 390 px** (visiteur, membre DÉMO,
acheteur d'un accord ouvert ; feuilles « + » et « Filtres » ouvertes) et **5 pages web publiques**.
Un « élément rempli d'or » = un fond à la valeur du token `gold` (ou `goldPressed`), dont le petit côté
mesure **≥ 28 px** (boutons, chips sélectionnées, bandeaux, « + »). Les pastilles, points et filets
< 28 px sont des marqueurs et ne comptent pas. Un élément masqué par une feuille ou hors écran ne compte pas.
Le test est dans la suite E2E : il échoue si un écran dépasse 1.

- Avant : `before.json` — 10 écrans sur 31 dépassaient (de 2 à 9 éléments).
- Après : `after.json` (app) et `after-web.json` — **0 écran sur 36 ne dépasse**.
- Pages web : avant, seul le pill « page courante » de la navigation légale (`/legal`) était un second or.

## Écrans en infraction (avant) et correction
| Écran | Or rempli avant | Correction |
|---|---|---|
| Accueil | « Écrire à … », « Je peux aider » + « + » | CTA des cartes : contour or, fond transparent |
| Explorer | « Tout le marché », « Tout », 3 × « Suivre », icône ville + « + » | Chips : fond relevé + bordure or ; « Suivre » : contour ; icône ville : fond relevé |
| Explorer › Filtres | 9 éléments (chips, choix, « Suivre » sous la feuille) | idem ; seul « Voir les articles » reste plein |
| Profil (le mien) | « Publier » + « + » | « Publier », « Ajouter un article » : contour |
| Accord (acheteur) | « Demain », « 18 h », « Proposer la remise », « Déclarer l'échange terminé » | Chips : sélection relevée ; « Proposer la remise » : contour ; reste plein : « Déclarer l'échange terminé » |
| Discussion (offres) | 2 bandeaux Waxaale pleins + « Voir l'accord » | Bandeau : fond relevé + filet or + petite étiquette or « WAXAALE » ; « Voir l'accord » : contour ; « Accepter » reste plein |
| Réglages › Confidentialité | 2 options sélectionnées | Option sélectionnée : fond relevé + bordure or |
| Modifier le profil | « Enregistrer » + 5 chips + badge appareil photo | Chips relevées ; badge appareil photo : fond relevé + icône or |
| Publier un article | icône « voix » 44 px + sélecteur de mode + interrupteur | Icône : fond relevé + icône or ; sélecteur et interrupteur : fond relevé + or en marqueur |
| Menu « + » | carte centrale + bouton « Fermer » plein + icônes de lignes | Seule la carte « Publication » reste pleine ; « Fermer » et icônes : fond relevé + or en marqueur |

Composants partagés corrigés une fois pour tous : `Chip` (design), `Toggle` (thumb or sur piste relevée),
`OptionRow` / pills / segments du `Composer`, `PublishSwitcher`, `AuthMethodSwitch`, `ProductPicker`,
`VoiceStudio` (langue), sélecteur de statut, `AvatarPicker`, `OfferCard`, `PostCard`.

## Fonds neutres sous les photos (addendum 1a)
Canvas `#0B1311` (variante B). Nouveau token `palette.media` / `colors.mediaBackdrop` = `#0B1311` :
tout conteneur de photo, miniature, vignette, galerie et fond de chargement l'utilise (app : `Thumb`,
`ListingCard`, `Media`, `ReorderStrip`, `VoiceStudio`, `Composer`, `DiscoveryRail`, page article ;
web : cartes article, galerie, miniatures, publications, couverture). Les surfaces vertes
(`#0B2922`, `#12382F`) restent pour en-têtes, feuilles, panneaux relevés et moments de marque.

## Avant / après à 390 px
`avant-apres-1-accueil.png`, `…-2-explorer.png`, `…-3-article-robe-beige.png`,
`…-4-article-telephone-blanc.png`, `…-5-boutique.png`. Photos de test synthétiques (robe beige sur fond
studio chaud, téléphone blanc sur table claire) : le réseau de la session bloque les banques d'images.
