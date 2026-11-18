# Aperçu famille (17 nov. 2026) — `https://jefeli.vercel.app`

> **Mise à jour (17 nov., décision du propriétaire) :** la **confirmation d'e-mail est désactivée sur staging** (`mailer_autoconfirm = true`) :
> l'inscription ouvre la session tout de suite, sans mail ni quota (vérifié : le parcours à 390 px passe, inscription directe jusqu'à
> l'onboarding). Pour la rétablir avant tout usage réel : `PATCH /config/auth {"mailer_autoconfirm": false}` (configuration d'avant sauvegardée
> hors dépôt) **et** brancher un service d'e-mail (SMTP). L'ancien contenu de test (articles, publications et statuts de `zayd.jr` et
> `test_vendeuse_w13`) est **masqué** (articles archivés, publications et statuts retirés), sauvegarde des lignes hors dépôt ; les comptes sont conservés.
> Les imitations de marques : décision du propriétaire, pas de filtre par marque ; le signalement et le retrait sur demande restent.

Branche `feature/p2-studio`, base **jefeli-staging**. Deux proches ouvrent l'application dans leur navigateur.
`jefeli.vercel.app` est le domaine de branche du projet Vercel `jefeli-app` ; la protection par connexion Vercel y est
désactivée (une personne sans compte Vercel peut l'ouvrir).

## 1. Inscription d'une nouvelle personne

Vérifié sur l'aperçu réel, téléphone 390 px (`tests/e2e/specs/family-journey.spec.ts`, FJ-1).

| Étape | Résultat |
|---|---|
| Formulaire « Créer un compte » (nom, e-mail, mot de passe, 18 ans, conditions) | fonctionne |
| Écran « Vérifiez votre e-mail » + message clair si on essaie de se connecter avant de confirmer | fonctionne |
| Confirmation de l'adresse, puis onboarding (nom, pseudo, ville, 18 ans) et arrivée dans Accueil | fonctionne (adresse confirmée par l'API admin dans le test, la boîte mail d'une adresse de test n'étant pas lisible) |
| **Réception réelle du mail de confirmation** | **non vérifiable d'ici, et limitée par construction (voir ci-dessous)** |

**Ce qui bloque ou peut bloquer l'inscription par e-mail :**

1. **Quota d'envoi : 2 e-mails par heure pour tout le projet.** Staging n'a pas de serveur d'e-mail à lui
   (`smtp_host` vide) : Supabase utilise son service intégré, plafonné à 2 e-mails/heure (`rate_limit_email_sent = 2`).
   Deux proches qui s'inscrivent dans la même heure, ou une troisième tentative, reçoivent « Trop de tentatives.
   Réessayez dans quelques minutes. » Observé pendant les tests (la capture de ce message a été remplacée par celles du parcours sans confirmation).
2. **Délivrabilité** : l'expéditeur par défaut de Supabase finit souvent en courrier indésirable. Je n'ai pas pu lire
   une boîte réelle pour le confirmer.
3. **Lien de confirmation** : l'adresse `https://jefeli.vercel.app/**` n'était pas dans la liste des redirections
   autorisées ; le lien aurait ramené la personne vers `jefeli-app-habibjallow95-9380.vercel.app` (autre
   déploiement). **Corrigé le 17 nov.** : l'adresse a été ajoutée à la liste (seule modification de la
   configuration Auth de staging ; la configuration d'avant est sauvegardée hors dépôt).

**Pour que l'inscription ne dépende plus du quota** (au choix, c'est votre décision) :
- *Recommandé* : brancher un vrai service d'e-mail (SMTP) sur Supabase — Resend, Brevo ou Mailjet ont une offre
  gratuite suffisante. Je fais le réglage dès que vous avez le compte et la clé (la clé se saisit via le formulaire
  sécurisé, jamais dans le chat).
- Provisoire : désactiver la confirmation d'e-mail sur staging pendant l'aperçu (inscription immédiate, adresses non
  vérifiées). Réversible en une commande.
- En attendant : **deux comptes de test confirmés** ont été créés (identifiants dans le rapport, jamais dans le dépôt) ;
  si un proche s'inscrit quand même et que le mail n'arrive pas, je confirme son adresse à la main.

## 2. Vitrine DÉMO — `scripts/demo-showcase.ts`

Un seul script, réversible. Chaque boutique se connecte avec son propre compte et utilise les mêmes fonctions que
l'application (`create_listing`, `create_post`, `create_story`, `set_post_surfaces`).

```
# depuis la racine du dépôt (Node 22), avec la clé service-role de staging dans l'environnement
export SUPABASE_URL=https://gbsoifwllbacwsknydkq.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=…            # jamais commitée
export SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
export ALLOW_DEMO_SHOWCASE=jefeli-staging
node scripts/demo-showcase.ts              # crée ; si déjà là, ne recrée que les statuts expirés
node scripts/demo-showcase.ts --status     # compte, ne change rien
node scripts/demo-showcase.ts --remove     # supprime comptes, articles, statuts, Reels et fichiers
```

À créer : **8 boutiques de Dakar** (Mode : Wax & Tendance, Fann Chic Friperie ; Téléphones : Allo Mobile Plateau,
Tech Liberté ; Maison : Déco Teranga, Chez Mame Maison ; Beauté : Karité & Co, Beauté Almadies), chacune avec nom,
quartier et bio ; **40 articles** (20 Vendre, 9 Vendre ou troquer, 4 Troquer, 7 Donner) ; **10 statuts** avec sticker
article ; **6 Reels** (vidéos générées de 6 s, étiquetées sur un article) ; **5 publications « Je cherche »**.

Règles tenues :
- Chaque compte est `is_demo = true` (étiquette « DÉMO » sur le nom et les cartes). Adresses `@showcase.jefeli.test`,
  mots de passe aléatoires non conservés.
- **Aucune** vue, aucun abonné, J'aime, commentaire, avis, message, offre, accord conclu ni badge de vérification.
- Images : pictogrammes vectoriels générés sur le fond de la marque, avec la mention « DÉMO · PHOTO À VENIR » ; vidéos
  générées par ffmpeg. Pas de scraping, aucun visage. À remplacer par vos vraies photos.
- Statuts : ils vivent 24 h. **Relancez le script le jour de la visite** (≈ 30 s) : il ne recrée que ceux qui ont expiré.
- Protection : le script refuse tout autre projet que le staging ou le local, et ne supprime que des comptes `@showcase…`
  marqués DÉMO. (`scripts/seed-demo.mjs` continue de refuser staging.)

**Réversibilité prouvée sur staging** (17 nov.) : avant la vitrine 5 articles, 16 publications, 3 statuts, 3 comptes,
39 fichiers ; après `--remove` : **identique, au fichier près** ; puis recréation et relance (idempotente, et
recréation d'un statut expiré vérifiée).

## 3. Parcours complet à 390 px sur `jefeli.vercel.app`

`tests/e2e/specs/family-journey.spec.ts` (config `playwright.family.config.ts`), captures dans
`docs/evidence/e2e/family/`. **Vert**, y compris le nettoyage (la personne du parcours, son article, son offre et son
troc sont supprimés ; fichiers orphelins : 0).

| Étape | Résultat |
|---|---|
| FJ-1 Inscription | avec la confirmation active : écran « Vérifiez votre e-mail », message avant confirmation, confirmation, onboarding et Accueil validés (premier passage) ; puis quota horaire atteint (« Trop de tentatives ») ; **depuis la désactivation de la confirmation : inscription directe jusqu'à l'onboarding et l'Accueil** (passage final, captures `03`–`05`) |
| FJ-2 Allées Téléphones, Mode, Maison, Beauté | chaque allée liste ses articles DÉMO |
| FJ-3 Ouvrir un Reel | la vidéo se lit, étiquette article et « Faire une offre » visibles |
| FJ-3 Faire une offre | offre envoyée sur un smartphone DÉMO |
| FJ-4 Publier via le Studio | article publié, visible sur sa page |
| FJ-5 Proposer un troc | troc proposé (baskets DÉMO contre l'article publié) |

L'ordre diffère du brief : un troc demande un article à soi, le Studio passe donc avant.
