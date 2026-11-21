# P5 — La Demande d’aide, sans carte (21 nov. 2026)

Première version : une carte sable (`#F1E3CD`). **Refusée par le propriétaire** (« pourquoi ne pas se fondre comme sur X, pas besoin de cartes pour contenir
le texte »). Version retenue : le texte d’une demande se pose directement sur le fond, comme toute publication.

```
 ● DEMANDE D’AIDE                         (puce argile #B66B50, libellé sable #F1E3CD)
 Je cherche des pots en verre de 100 à 250 ml…    (texte normal, sur le fond)
 [ Je peux aider ]                        (pilule à contour doré, sans fond)
```
- Aucune carte, aucun fond clair : le thème reste entièrement sombre. La demande se reconnaît à son libellé sable et à sa puce argile.
- Couleurs en tokens (`colors.requestLabel`, `requestDot`) ; contrastes dans `contrast.test.ts` : sable/fond 12:1, argile/fond ≥ 3:1 (puce, jamais du texte).
- Le contour doré du bouton est un filet, pas un aplat : le budget d’or reste respecté.

## Tirer pour actualiser sur le web (appli ajoutée à l’écran d’accueil)
`RefreshControl` n’existe pas sur le web et une appli installée n’a pas le geste du navigateur. `components/PullToRefresh.tsx` écoute le toucher
(depuis le haut de la liste, relâcher au-delà de 72 px) et recharge : fil, Explorer, Messages, Notifications, Profil. Sur natif il ne fait rien
(le `RefreshControl` natif reste). Vérifié avec un toucher émulé à 390 px (`docs/evidence/p5/pull-to-refresh-*.png`). Pas de geste sur les Reels web.

## Libellés du fil : plus courts, dans le vocabulaire de la marque (21 nov.)
Retour du propriétaire : les libellés peuvent être plus courts et faire partie de la marque. Règle : **un libellé seulement quand il dit quelque chose**
(comme X, où une publication ordinaire n’en porte pas), et avec les quatre verbes de Wecci.

| Avant | Après |
|---|---|
| DEMANDE D’AIDE | **JE CHERCHE** (sable, puce argile) |
| JE PROPOSE | **JE PROPOSE** |
| VITRINE (article lié) | **À VENDRE** · **À TROQUER** · **VENTE · TROC** · **À DONNER** (selon le mode de l’article, puce menthe) |
| VOTRE AVIS ? | **AVIS** |
| MOMENT, VIDÉO, PHOTOS RACONTÉES, PUBLICATION VOCALE, PUBLICATION | *(aucun : le contenu le dit)* |

Le texte lu par les lecteurs d’écran reste « Type de publication : Je cherche » (test `community.spec.ts` inchangé).

### Pistes wolof ⚑ (à valider avec les vendeurs pilotes, règle de `IDENTITY.md`)
Recherche dans des glossaires publics (Boston University, Afrifolk, Cambridge, Munro & Gaye) : **wut** = chercher, **jox** = donner et **dimbali** (« dimbali ma » = aide-moi)
sont attestés ; « xalaat » (avis), « xibaar » (nouvelles) et « seetlu » n’ont pas pu être confirmés. Rien de wolof n’est donc affiché pour l’instant : candidats
**WUT** (Je cherche), **JOX** (À donner), bouton **Dimbali** (Je peux aider), à faire valider par des locuteurs avant tout usage.
