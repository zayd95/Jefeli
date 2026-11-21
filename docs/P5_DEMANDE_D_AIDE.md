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
