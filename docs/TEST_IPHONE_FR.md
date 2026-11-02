# Jëfëli — script de test pour la propriétaire (iPhone)

Durée : environ 30 minutes. Il vous faut **deux téléphones**, ou un téléphone et un ordinateur,
pour avoir deux comptes A (acheteuse) et B (vendeuse).

## Avant de commencer

- **Option rapide (Expo Go)** : installez « Expo Go » depuis l’App Store. Sur l’ordinateur où le
  projet tourne, lancez `pnpm mobile`, puis scannez le QR code avec l’appareil photo de l’iPhone.
  Le téléphone et l’ordinateur doivent être sur le même Wi-Fi (voir le README).
- **Option complète (build de développement)** : nécessaire pour le **live vidéo** et les
  **notifications push**. Elle demande un compte Apple Developer et un compte Expo (voir
  `docs/SETUP_PRODUCTION.md`).
- Le bandeau « PILOTE » et les badges « DÉMO » signalent un environnement de test.

## 1. Comptes (5 min)

1. Sur le téléphone B : « Créer un compte » → nom, e-mail, mot de passe, cochez 18 ans et les
   conditions → onboarding : nom d’utilisateur, ville « Dakar », un quartier, quelques intérêts.
2. Faites de même sur le téléphone A.
3. Fermez complètement l’application, puis rouvrez-la : vous devez rester connectée.

## 2. Publier comme vendeuse (B) (5 min)

1. Bouton central **Publier** → **Article** → prenez une photo avec l’appareil photo.
2. Titre, « Vente ou troc », prix (par exemple 35 000), catégorie, état « Très bon état », puis
   **Publier**.
3. Ouvrez **Profil** : la boutique est apparue toute seule, sans configuration.
4. **Publier** → **Statut** → une photo, légende, visible par « Mes abonnés » → **Publier le statut**.
5. **Publier** → **Publication** → une vidéo courte de moins de 60 s. Vérifiez la barre de
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
