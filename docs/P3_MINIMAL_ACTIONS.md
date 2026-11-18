# P3 — Actions minimalistes et « coller depuis WhatsApp » (17 nov. 2026)

Branche `feature/p3-minimal-actions` (depuis `feature/p2-studio`, **non fusionnée**, sans effet sur `jefeli.vercel.app`).
Demande du propriétaire : « trop de boutons d'action à l'écran : les redessiner de façon minimaliste, intuitive au toucher,
sans prendre de place », et ajouter « coller un message WhatsApp ».

## Principes

1. **Une seule action principale par écran** (la pastille dorée). Le reste est une icône de 44 pt, ou un geste.
2. **Les actions sur un objet vivent sur l'objet** : cœur, partage et « … » sont sur la photo, pas dans une barre en bas.
3. **Un choix ne devient pas un bouton** : offre ou échange est un interrupteur dans l'écran d'offre, pas deux boutons.
4. **Ce qui existe déjà dans un menu n'est pas répété** : le partage d'une carte du fil est dans son « … », pas en plus dans la rangée.
5. **Rien de permanent pour une aide ponctuelle** : le collage WhatsApp n'ajoute aucun bouton, juste une ligne qui apparaît puis disparaît.

## Ce qui change (avant → après, captures dans `docs/evidence/p3/`)

| Écran | Avant | Après |
|---|---|---|
| Fiche article (acheteur) | barre flottante de **5** contrôles (offre, message, échange, partager, cœur) + un 2e partage dans la page | barre de **2** (pastille « Faire une offre » + message) ; **cœur, partage, « … » sur la photo** ; échange = onglet « Échange » de l'écran d'offre ; le partage WhatsApp du vendeur reste réservé au vendeur |
| Écran d'offre | deux entrées séparées (offre / échange) | interrupteur « **Offre \| Échange** » en tête (seulement pour un article « Vendre ou troquer ») |
| Reels | **4** icônes (J'aime, message, partager, enregistrer) | **3** (J'aime, message, « plus ») ; partager et enregistrer dans une petite feuille |
| Carte du fil | vote, commentaire, **partager**, enregistrer, écrire + texte d'aide sous « Je peux aider » | vote, commentaire, enregistrer, écrire ; le partage reste dans le « … » ; texte d'aide retiré (toujours lu par les lecteurs d'écran) |

Aucune couleur nouvelle ; l'interrupteur utilise le motif des sélections (fond relevé + bordure or + texte clair). Budget d'or inchangé
(`zz-gold-budget` vert sur tous les écrans de l'application).

## Coller depuis WhatsApp (sans nouveau bouton)

Dans la légende du Studio, **coller** une annonce comme celles des groupes WhatsApp suffit :

```
Dior b30 full White
40-41-42-43-44-45
*Prix 35.000f
```
→ le nom devient la première ligne, le prix est mis dans la puce « Prix » (35 000 F), les pointures passent dans la description
(« Pointures : 40 à 45. »), l'interrupteur « Vendre ou troquer » s'allume. Une ligne indique ce qui a été reconnu avec **Annuler**
(qui remet exactement l'état d'avant). Reconnu : prix (`30.000f`, `12 500 F CFA`, `30k`), pointures et tailles, « Disponible »,
« à donner » (mode Donner), « troc / échange » (mode Vendre ou troquer), préfixe d'export WhatsApp (`[17:42, 09/11/2026] Nom :`).
Un texte ordinaire ou une frappe lettre à lettre ne déclenche rien. Si plusieurs articles sont collés, le premier est repris et la ligne
le dit. Code : `packages/shared/src/whatsapp.ts` (16 tests, dont les messages vus dans un vrai groupe), branchement :
`apps/mobile/src/app/(app)/studio.tsx`.

## Suite possible (hors de cette PR)
- Importer **plusieurs** annonces d'un coup (un message WhatsApp = N articles).
- « Partager vers Jëfëli » depuis WhatsApp (cible de partage Android) pour récupérer les photos directement.
- Même minimalisme sur les pages web publiques (`apps/web`), laissées telles quelles ici.
