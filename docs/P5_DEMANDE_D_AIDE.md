# P5 — La Demande d’aide en papier sable (21 nov. 2026)

Demande du propriétaire : les publications « Je cherche… » se distinguent des publications ordinaires par une carte **sable chaud**,
« comme du papier de qualité », ni jaune vif ni un autre vert. Branche `feature/p5-demande-d-aide`.

```
 ● DEMANDE D’AIDE                        (puce argile, texte encre atténuée)
 Je cherche des pots en verre de 100 à 250 ml…   (encre profonde, Nunito 18)
 [ Je peux aider ]                       (pilule encre profonde, texte sable)
```
- Couleurs (tokens uniquement) : sable `#F1E3CD`, encre `#10252C`, argile `#B66B50`, plus l’encre atténuée `#4A5B5C` pour le texte secondaire.
- Contrastes WCAG vérifiés (`contrast.test.ts`) : encre/sable 12,6:1, atténuée/sable 5,6:1, sable/encre (bouton) 12,6:1, argile/sable 3,2:1 (point
  et filet seulement, jamais du texte : l’argile pur ferait 3,2:1, insuffisant pour du texte).
- Réservé aux demandes (`intent = seek`) : c’est la seule surface claire de l’application ; la règle est inscrite dans `docs/DESIGN_SYSTEM.md` et `CLAUDE.md`.
- Pas de motif, d’illustration ni d’ombre. Le bouton « Je peux aider » : fond encre profonde, **contour doré** de 2 px (un filet, pas un aplat : le budget d’or est inchangé).
- Une demande avec photos ou voix garde la carte sable au-dessus du média ; la ligne auteur, les votes et les commentaires restent sur le fond sombre.

Évidence : `docs/evidence/p5/demande-d-aide-feed.png` (390 px, staging, compte famille).

## Tirer pour actualiser sur le web (appli ajoutée à l’écran d’accueil)
`RefreshControl` n’existe pas sur le web et une appli installée n’a pas le geste du navigateur. `components/PullToRefresh.tsx` écoute le toucher
(depuis le haut de la liste, relâcher au-delà de 72 px) et recharge : fil (Pour toi, Abonnements), Explorer, Messages, Notifications, Profil.
Sur les applis natives le composant ne fait rien (le `RefreshControl` natif reste). Vérifié avec un toucher émulé à 390 px : un petit tirage ne
recharge pas, un tirage long relance les requêtes (`docs/evidence/p5/pull-to-refresh-*.png`). Les Reels (pagination plein écran) n’ont pas ce geste sur le web.
