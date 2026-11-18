# P4 — Publier comme sur X, adapté au commerce (17 nov. 2026)

Branche `feature/p4-compose-first` (depuis `feature/p3-minimal-actions`, **non fusionnée**, sans effet sur `jefeli.vercel.app`).
Retour du propriétaire après essai sur téléphone : publier une vidéo et une image ensemble ne marchait pas ; la publication
peut être plus simple, « comme X : la boîte de texte, la caméra d'un côté, l'audio de l'autre » ; l'écran **Wecci** et l'écran
**offre** peuvent être plus intelligents.

## 1. Une photo ET une vidéo dans la même publication (le bogue)
Cause : la galerie ne gardait que la vidéo quand on choisissait les deux, et les règles du Studio disaient « photos OU vidéo ».
Maintenant : **jusqu'à 8 photos et 1 vidéo** dans une même publication (photos d'abord, vidéo en dernière diapositive).
La voix reste impossible sur une vidéo (règle serveur `audio_with_video`) : le Studio le dit et retire la voix. Un statut de
plusieurs éléments passe par le Fil, comme pour plusieurs photos. Vérifié de bout en bout : la base contient bien `image,video`.

## 2. Le Studio « texte d'abord »
« + » ouvre **la boîte de texte** (clavier déjà ouvert), plus la caméra :

```
✕                                   [ Publier ]      ← le seul bouton doré
(avatar) [Tout le monde ▾]
Quoi de neuf ? Vendez, troquez, cherchez…
[Je cherche…] [Qui a… ?] [Recommandez-moi…]
[vignettes : photos + vidéo, chacune retirable]
[carte article, si « Vendre » est actif]
[Fil] [Statut 24 h] [Reel] [Boutique]               ← une rangée compacte
─────────────────────────────────────────────
 🖼 galerie   📷 caméra   🎙 voix   🏷 vendre
```
- Barre d'outils au-dessus du clavier : **galerie** (photos et vidéo ensemble), **caméra** (s'ouvre par-dessus, avec ses modes
  Photo · Vidéo · Voix), **voix** (enregistreur direct), **vendre** (interrupteur « Vendre ou troquer cet article » : sans photo,
  il ouvre la galerie et s'allume dès qu'une photo arrive).
- « Publier » attend du contenu ; un texte seul se publie tel quel (ex. « Je cherche… »), jamais comme un article.
- Coller une annonce WhatsApp remplit toujours l'article (P3) ; destinations et audience gardent leurs règles.

## 3. Wecci et offre plus intelligents
- **Carte article** : les quatre modes dans **une seule rangée à choix unique** (Vendre · Troquer · Vendre ou troquer · Donner,
  fini les deux interrupteurs qui se combinent), le **prix tapé directement** en grand (plus de fenêtre à ouvrir), le mode de
  prix (« Prix fixe » / « À discuter » / « Sur demande ») dans une petite puce. « Donner » masque le prix.
- **Écran d'offre** : **montants rapides** sous le champ (« Prix demandé », −10 %, −15 %, −20 %, arrondis à 50/100/500 F), une phrase qui
  dit où l'on se situe (« 15 % sous le prix affiché »), le message vocal ramené à une ligne, la **différence d'argent d'un échange derrière
  « + Ajouter une différence d'argent »** ; l'état vide de l'échange n'ajoute plus un second bouton doré (action en contour).

## 4. Retour du propriétaire (18 nov.) : pas d'écran à part pour la voix, moins de cartes
- **La voix s'enregistre sur place.** Le micro de la barre d'outils fait apparaître une barre à la place de la barre d'outils :
  🗑 · ● 0:07 · niveaux en direct · ⏸ · ✓. Plus d'écran plein écran ni d'onglet « Voix » dans la caméra. Avec deux photos ou plus,
  on touche **la vignette de la photo dont on parle** pendant que l'on parle (visite guidée, comme avant) ; le texte reste visible.
  Même enregistreur qu'avant (3 min max, moins d'une seconde refusé, pause si l'appli passe en arrière-plan, micro refusé expliqué).
  `?mode=voice` démarre l'enregistrement tout de suite. La langue parlée reste celle mémorisée (le sélecteur de langue n'est plus affiché).
- **Moins de boîtes.** La carte article du Studio n'est plus un encadré (une ligne de séparation) ; sur l'écran d'offre, l'article, le message
  vocal et la mention légale ne sont plus des cartes ; sur la fiche article, le vendeur est une ligne entre deux filets, les détails des lignes
  à filets, la mention de sécurité du simple texte. Restent encadrés uniquement ce qui se touche : champs de saisie, puces, articles à choisir pour un échange.

## Évidence
`docs/evidence/p4/` : avant (Studio caméra d'abord, jefeli.vercel.app) et après (texte d'abord, photos + vidéo, carte article).

## À décider / suite
- Déplacer `jefeli.vercel.app` sur P3/P4 ou attendre la fin de la visite.
- Glisser pour réordonner les vignettes ; plusieurs vidéos par publication (aujourd'hui une, pour le coût de traitement).
- Même carte « texte d'abord » sur le web (`apps/web`).
