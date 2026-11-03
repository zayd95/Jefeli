# Jëfëli — script de test pour la propriétaire (iPhone)

Durée : environ 30 minutes. Il vous faut **deux téléphones**, ou un téléphone et un ordinateur,
pour avoir deux comptes A (acheteuse) et B (vendeuse).

## Avant de commencer

- **Option la plus rapide (Safari sur l’iPhone)** : sur l’ordinateur, lancez `pnpm install` puis
  `pnpm preview:lan` (Docker doit être lancé). Ouvrez ensuite dans Safari l’adresse affichée,
  `http://<adresse-de-l’ordinateur>:8081`. Le téléphone et l’ordinateur doivent être sur le même
  Wi-Fi privé (maison ou partage de connexion), pas un Wi-Fi public. Dans Safari, « Partager →
  Sur l’écran d’accueil » donne un raccourci plein écran. Les photos fonctionnent (Safari propose
  l’appareil photo ou la photothèque). En revanche, Safari refuse le micro sur une adresse http :
  l’enregistrement de messages vocaux se teste avec un build de développement.
- **Option application native (Expo Go)** : installez « Expo Go » depuis l’App Store. Sur
  l’ordinateur, lancez `pnpm preview:expo-go` (Docker doit être lancé), puis scannez le QR code
  avec l’appareil photo de l’iPhone. Autorisez « Réseau local » quand Expo Go le demande. Dans
  Expo Go, le micro (messages vocaux), l’appareil photo et les vidéos fonctionnent comme dans
  une vraie application. Seuls le direct (Live) et les notifications push demandent un build
  de développement : ils affichent « indisponible ». Si le QR code ne fonctionne pas, ouvrez
  Expo Go, puis « Enter URL manually » et saisissez l’adresse `exp://…:8081` affichée.
- **Option complète (build de développement)** : nécessaire pour le **live vidéo** et les
  **notifications push**. Elle demande un compte Apple Developer et un compte Expo (voir
  `docs/SETUP_PRODUCTION.md`).
- **Roue d’outils flottante dans Expo Go** : ce bouton appartient à Expo Go, pas à Jëfëli.
  Pour le masquer pendant le test, secouez l’iPhone pour ouvrir le menu développeur d’Expo Go,
  puis désactivez l’option du bouton d’outils flottant (« Tools button »). Le réglage reste
  dans Expo Go. Secouer à nouveau rouvre le menu si besoin.
- Le bandeau « PILOTE » et les badges « DÉMO » signalent un environnement de test.

## 1. Comptes (5 min)

1. Sur le téléphone B : « Créer un compte » → nom, e-mail, mot de passe, cochez 18 ans et les
   conditions → onboarding : nom d’utilisateur, ville « Dakar », un quartier, quelques intérêts.
2. Faites de même sur le téléphone A.
3. Fermez complètement l’application, puis rouvrez-la : vous devez rester connectée.

## 2. Publier comme vendeuse (B) (5 min)

1. Bouton central **Publier** : quatre choix (Publication, Statut, Article, Live « Bientôt »).
   Touchez **Article**.
2. **Étape 1 sur 3 · L’essentiel** : une photo (appareil photo ou galerie), un titre,
   « Vente ou troc », puis le prix : **Prix affiché** (par exemple 35 000), **Prix sur
   demande** (aucun prix) ou **À discuter** (prix de départ facultatif) → **Continuer**.
3. **Étape 2 · Détails** : catégorie (« Voir tout » pour les autres), état « Très bon état ».
   Description et quantité sont facultatives → **Continuer**.
4. **Étape 3 · Remise** : ville et quartier, retrait ou livraison → **Publier l’article**.
   Fermez l’app au milieu du formulaire et rouvrez-le : le brouillon est conservé.
5. Ouvrez **Profil** : la boutique est apparue toute seule, sans configuration.
6. **Publier** → **Statut** → une photo, légende, visible par « Mes abonnés » → **Publier le statut**.
7. **Publier** → **Publication** → une vidéo courte de moins de 60 s. Vérifiez la barre de
   progression, puis la lecture dans le fil.

## 3. Découvrir et discuter (A) (8 min)

1. Sur A, **Explorer** ou la recherche : trouvez l’article de B **sans la suivre**.
   Essayez aussi une faute de frappe ou un mot sans accent.
2. Ouvrez l’article → **Envoyer un message** : la conversation s’ouvre avec la carte de l’article.
3. Sur B : l’onglet **Messages** affiche un badge non lu. Répondez.
4. Sur A : la réponse apparaît sans recharger. Fermez l’app et rouvrez-la : l’historique est
   toujours là.
5. Essayez une **photo** (+) et un **message vocal** (micro), puis écoutez-le sur l’autre
   téléphone.

## 4. Négocier et troquer (7 min)

1. A : sur l’article → **Faire une offre** (par exemple 28 000).
2. B : dans la conversation → **Contre-proposer** (par exemple 32 000).
3. A : **Accepter** → **Voir l’accord**. Vérifiez les termes et l’avertissement
   « Jëfëli ne détient aucun fonds ».
4. A : publiez un objet à vous, puis sur l’article de B → **Proposer un troc** → choisissez votre
   objet, une différence de 15 000, payée par « Moi ».
5. B : vérifiez « Vous recevez 15 000 F CFA » → **Accepter**. L’accord liste les deux articles.
6. Chacun : **Déclarer l’échange terminé** → laissez un avis (seulement après les deux
   confirmations).

## 5. Statut et liens sociaux (3 min)

1. A : profil de B → **Suivre**. Le nombre d’abonnés passe à 1.
2. A : accueil → touchez le cercle de B → regardez le statut → écrivez une réponse : elle arrive
   dans les messages privés de B.
3. A : **Partager** sur l’article → WhatsApp. Ouvrez le lien sur un autre téléphone qui n’a
   **pas** l’application : la page publique s’affiche avec le titre, la photo et le prix.

## 5 bis. Communauté (5 min)

1. A : **Publier** → **Publication**. Écrivez une demande (par exemple un tailleur ou un
   réparateur), choisissez le type facultatif **Je cherche**, puis **Publier**. (L’ancien
   encadré « Demandez à la communauté » en haut du fil a été retiré : tout passe par
   Publication.)
2. B : retrouvez la demande dans **Pour toi**. Elle porte l’étiquette « Je cherche » et la mention
   « Attend vos réponses ». Touchez **Je peux aider** : une conversation privée s’ouvre.
3. B : votez **▲** sur la demande, puis passez à **▼**. Le compteur public n’affiche jamais de
   nombre négatif. A ne voit pas les votes « contre ».
4. B : touchez **Commenter** et répondez. A voit l’aperçu du commentaire sous la publication,
   directement dans le fil.
5. Comptes DÉMO à essayer : `khadija@`, `mariama@` et `ousmane@` (même mot de passe). Ils montrent
   des services proposés, une demande d’ordinateur et un tout nouveau vendeur.

## 5 ter. Prix flexibles, boutique et commerce en conversation (8 min)

1. Connectez-vous avec `khadija@demo.jefeli.test` : son article « Boubou brodé sur mesure »
   affiche **Prix sur demande**. Nulle part « 0 F ». Avec `ousmane@…` : « Lot de 5 cabas »
   affiche **30 000 F · à discuter**.
2. Avec un autre compte, sur l’article « Prix sur demande » → **Faire une offre** : l’offre
   chiffrée, la contre-proposition et l’accord fonctionnent comme avant.
3. Dans cette conversation → **+** → **Envoyer des articles** → onglet « Articles de … » →
   cochez deux articles → **Envoyer 2 articles** : deux fiches arrivent dans le fil. Rien n’est
   réservé ni payé : c’est une base pour discuter de plusieurs articles.
4. `awa@` : profil avec photo de couverture, « Membre depuis… », publication et article
   **Épinglés**. Sur une de vos publications ou un de vos articles → « ··· » → **Épingler sur
   mon profil** (3 au maximum par type).
5. **Profil** → icône partager → **Envoyer sur WhatsApp**. Sur un article : boutons
   **WhatsApp** et **Partager**. Ouvrez le lien hors de l’app : la page publique montre le bon
   prix (ou « Prix sur demande »).
6. **Modifier le profil** → **Photo de couverture** → ajoutez une image.
7. Dans le fil, sur une publication qui identifie un article d’un autre membre → **Écrire** :
   la conversation s’ouvre avec la fiche de l’article.
8. **Explorer** : « Tout / Neuf / Occasion / Troc », catégories avec **Tous** par défaut et
   **Voir tout**, bouton ville (« Près de moi »), **Effacer les filtres**.

## 6. Live (si activé)

- Sans fournisseur vidéo configuré, **Publier → Live** indique clairement que le direct n’est pas
  disponible. Aucun faux direct n’est affiché. C’est le comportement attendu tant que le
  fournisseur n’est pas activé.
- Une fois Stream configuré (build de développement) : B lance un live, A le rejoint et commente,
  B épingle un article, A ouvre l’article puis écrit à B.

## 7. Sécurité (4 min)

1. A : sur l’article de B → « ··· » → **Signaler** → raison → envoyer.
2. Sur un ordinateur : ouvrez `/admin` sur l’application web et connectez-vous avec un compte
   modérateur. Le signalement apparaît. Masquez le contenu avec un motif.
3. A : l’article affiche « Article indisponible ».
4. A : profil de B → « ··· » → **Bloquer**. B ne voit plus le profil de A et ne peut plus lui
   écrire.
5. Réglages → **Mes données** : exportez vos données. Testez la suppression du compte sur un
   compte de test uniquement.

## À noter pendant le test

Pour chaque étape : ce qui vous a gênée, ce qui était lent, les textes peu clairs, les
écrans mal adaptés à votre iPhone. Envoyez des captures d’écran si possible.
