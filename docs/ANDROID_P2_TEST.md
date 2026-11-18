# Test Android du P2 (APK de test, profil `pilot-apk`)

Branche : `feature/p2-studio` (non fusionnée). L'APK parle à **jefeli-staging** (déjà migré pour le P2) et affiche la bannière « Environnement de test ».
Ce qui est prêt côté dépôt : `eas.json` (profil `pilot-apk`, APK, distribution interne), plugins `expo-camera` et `expo-media-library` dans `app.json`,
prébuild Android local réussi, permissions limitées à : caméra, micro, photos et vidéos (pas d'accès à l'audio du téléphone).
Ce que seul votre compte Expo peut faire : lier le projet, déclarer les variables, lancer le build.

## 1. Une fois (≈ 10 min)
1. Compte gratuit sur expo.dev. Dans un terminal : `cd apps/mobile`, puis `npx eas-cli@latest login`.
2. `npx eas-cli@latest init` → écrit `expo.extra.eas.projectId` dans `app.json`. **Commitez ce changement** sur `feature/p2-studio` (ou envoyez-le-moi).
3. Sur expo.dev › votre projet › Environment variables › environnement **preview**, créez (visibilité « Plain text » ou « Sensitive », jamais de clé service-role) :
   - `EXPO_PUBLIC_SUPABASE_URL` = `https://gbsoifwllbacwsknydkq.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = la clé publishable de staging (je vous la donne dans le message)
   - `EXPO_PUBLIC_WEB_BASE_URL` = `https://jefeli-web-habibjallow95-9380.vercel.app`
   - `EXPO_PUBLIC_EAS_PROJECT_ID` = l'identifiant du projet (même valeur que `projectId`)

## 2. Lancer le build
`npx eas-cli build -p android --profile pilot-apk`
- À la question sur le keystore : répondre « oui » (EAS le génère et le garde).
- Compter 10 à 25 minutes dans la file gratuite. À la fin, le terminal affiche un **lien** et un **QR code** (aussi sous expo.dev › Builds).

## 3. Installer sur le téléphone Android
1. Ouvrez le lien (ou scannez le QR code) **depuis le téléphone**, téléchargez le fichier `.apk`.
2. Android demande d'autoriser l'installation depuis ce navigateur : Paramètres › « Installer des applis inconnues » › autorisez Chrome (ou le navigateur utilisé). Retournez au fichier téléchargé et touchez « Installer ». (Si Play Protect avertit : « Installer quand même ».)
3. Ouvrez **Jëfëli**, connectez-vous avec un compte de test (ou créez-en un).

## 4. Ce que je vous propose de valider
| Zone | À vérifier |
|---|---|
| Studio | « + » ouvre la caméra directement ; la vignette galerie demande l'autorisation **une fois** (une phrase d'explication), icône simple si vous refusez |
| Caméra | photo, flash (haut droite), retournement, bande de 8 photos numérotées |
| Vidéo | enregistrement jusqu'à 3 min, minuteur, arrêt, aperçu dans le composeur |
| Voix | enregistrement seul ; narration sur ≥ 2 photos (toucher la photo dont on parle) ; pas de voix sur une vidéo |
| Composeur | interrupteur « Vendre ou troquer », pastilles, cases Fil / Statut / Reel / Boutique, brouillon repris après fermeture |
| Statuts | sticker produit, réactions, « Faire une offre », carte de fin « Voir les Reels » |
| Reels | défilement vertical, **préchargement** (la vidéo suivante démarre sans attente), pause hors écran, économie de données |
| Barre d'onglets | se masque en défilant, revient en remontant |

## 5. Si quelque chose ne marche pas
Notez l'écran, l'heure et le modèle du téléphone (Android + version), et envoyez une capture ; pour un plantage : `npx eas-cli build:list` puis le lien du build, ou `adb logcat` si vous avez un câble.
Le rapport de bug le plus utile : ce que vous avez fait, ce que vous attendiez, ce qui s'est passé.
