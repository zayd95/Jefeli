# P2 — Studio, Statuts → Reels, navigation, actions en icônes

Branche `feature/p2-studio` (depuis `main` `35def95`). Retour d'usage du propriétaire, 16 nov. 2026.
Tokens, Nunito, thème sombre unique et budget d'or inchangés ; aucune nouvelle couleur.
**Rien n'est fusionné dans `main` sans le « go » du propriétaire.**

## 1. Barre d'onglets
- Se masque en défilant vers le bas (> 10 px, après 80 px), revient au moindre défilement vers le haut,
  en haut de liste et en fin de liste. Ressort `react-native-reanimated` de 220 ms
  (`withSpring`, `duration: 220`). **Statique** si « réduire les animations » est actif.
- Décision pure et testée : `packages/shared/src/dock.ts` (`nextDockHidden`, 7 tests).
  Magasin : `apps/mobile/src/lib/dockVisibility.ts` ; branché sur Accueil, Explorer, Messages, Profil.
- Jamais affichée dans le chat, le Studio, le statut et les Reels : ce sont des écrans de pile, hors des
  onglets. Même comportement dans la mise en page web mobile ; la barre latérale du bureau est inchangée.
- Test : `tests/e2e/specs/p2-tabbar.spec.ts` (TB-1…3).

## 2. Studio (un seul « + »)
Remplace le menu à cartes et les éditeurs Publication / Statut / Article (code supprimé :
`CreateMenu`, `PublishSwitcher`, `DraftChoice`, `ReorderStrip`, `app/(app)/publish/*`).

| Étape | Contenu |
|---|---|
| Capture | Caméra plein écran (`expo-camera`). Barre de modes **Photo · Vidéo · Voix · Texte**. Vignette galerie en bas à gauche, flash et retournement en haut à droite, bande numérotée jusqu'à 8 photos. Vidéo ≤ 3 min. Voix = l'enregistreur existant (`VoiceStudio`), seul ou en narration sur des photos. Texte = carte colorée + amorces « Je cherche… », « Qui a… ? », « Recommandez-moi… » ; un texte n'est jamais un article. |
| Composeur | Aperçu, légende, **un interrupteur « Vendre ou troquer cet article »** (activé par défaut pour un compte avec Boutique ; absent pour un texte). Activé : pastilles prix, mode (Vendre / Troquer / Donner), catégorie, état, quartier. |
| Destinations | Cases : **Fil** · **Statut 24 h** · **Reel** (vidéo, public) · **Boutique** (seulement avec l'interrupteur). Une destination indisponible dit pourquoi. Fil porte une pastille d'audience (Tout le monde / Abonnés / Amis). |
| Brouillon | Enregistré à chaque étape (`useDraft`, fichiers web dans IndexedDB) ; « Brouillon repris · Recommencer ». |

Règles (`packages/shared/src/studio.ts`, 10 tests) : voir le commentaire d'en-tête du fichier.
Un seul pipeline média (`apps/mobile/src/lib/studio.ts`) : envoi unique (envoi, reprise, quota, annulation
existants), puis chaque destination utilise le chemin de données **existant** :
Boutique → `create_listing` · Fil/Reel → `create_post` (+ `set_post_surfaces`) ·
Statut → `create_story` (1 photo, 1 vidéo ou 1 voix) ou `share_to_status` (narration ou plusieurs photos :
le statut pointe sur la publication, il faut donc aussi cocher Fil). Un fichier utilisé par un statut et par
une destination publique est **copié côté serveur** d'un bucket à l'autre, jamais renvoyé.

Entrées : `+` (onglet), profil (« Publier », « Ajouter un article », « Publier un statut »), anneau de statut,
Explorer (« Je cherche »), « Présenter cet article » (`/studio?product=`), `/studio?mode=voice|text`,
`?dest=status`, `?sell=1`. Les anciennes routes `/publish/*` n'existent plus.

## 3. Meilleurs statuts
- **Sticker produit** (photo, prix, badge Wecci mint) : ouvre l'article (`ProductSticker`).
- **Réactions rapides** (❤️ 🔥 😍 👏) et **« Faire une offre »** : ouvrent la conversation avec la carte de
  l'article jointe (une seule fois). L'offre ouvre ensuite le formulaire d'offre.
- **Ordre du rail** (base) : le vôtre, non vus d'abord, puis personnes suivies, puis vendeurs de **la même
  ville** (localisation approximative uniquement), puis récents.
- **Carte de fin** « Voir les Reels ».
- **« Le garder en Reel ? »** : quand un statut **vidéo** expire avec ≥ `reel_keep_min_views` vues
  (table `app_config`, **100**), le propriétaire reçoit une notification avec le bouton **Garder en Reel**
  (un tap) ; la vidéo est conservée 48 h pour cela. Expiration et « à la une » : logique inchangée. Le
  propriétaire peut aussi garder en Reel depuis son propre statut (icône).

## 4. Reels
Flux vertical plein écran de **vidéos permanentes publiques**. Ouverts par « Fil · Reels » (haut d'Accueil),
la carte de fin des statuts, l'icône « Ouvrir en Reels » sur toute vidéo du fil. Classement pilote,
explicable (`get_reels`) : `3·suivi + 1,5·même ville + 1·article tagué + 2·fraîcheur (7 jours)`.
Une vidéo d'avance préchargée (en pause), pause hors écran, économie de données / 2G / mouvement réduit =
pas de lecture automatique. Chaque Reel : sticker produit + pilule or « Faire une offre » + icônes rondes.
Cinq onglets conservés.

## 5. Actions en icônes
Une pilule or + des boutons ronds ≥ 44 pt (`RoundAction`), `accessibilityLabel` + libellé affiché à l'appui
long (infobulle au survol sur le web). Boutons longs convertis :

| Écran | Avant | Après |
|---|---|---|
| Article | « Envoyer un message » (or, long) | pilule or **« Faire une offre »** (ou « Proposer un troc » si troc seul, « Écrire au donneur » si don) + icône message |
| Article | « Faire une offre » / « Proposer un troc » (contours) | pilule or + icône « Proposer un échange (troc) » |
| Article | « Envoyer un message au vendeur » (article indisponible) | icône message |
| Article | pastille « Partager », pastille « WhatsApp » | icônes Partager et WhatsApp |
| Article | partager / favori dans l'en-tête | déplacés dans la ligne d'actions (propriétaire : partager reste en en-tête) |
| Profil | « Publier » (contour) | icône `+` ; icône « Partager le profil » ajoutée ; boutons d'ami → mêmes icônes avec libellé à l'appui long |
| Statut | « Vues », « Garder sur mon profil » (pilules) | icônes œil et marque-page ; icône « Garder en Reel » ajoutée |
| Statut | bouton or « Voir » du sticker | supprimé (le sticker est le lien) ; la pilule or est « Faire une offre » |
| Reels | — | icônes J'aime / message / partager / enregistrer ; pilule or « Faire une offre » |
| Page web article | « Faire une offre », « Proposer un troc », « Écrire au vendeur » | pilule or + icônes message, troc, partager, enregistrer (44 px, `title` + appui long) |

## 6. Changement de schéma (migration locale, **non appliquée à staging**)
`supabase/migrations/20261116000100_studio_reels.sql` — expliqué dans `docs/STAGING_MIGRATION_PLAN.md`.
- `posts.in_feed` / `posts.in_reels` (+ `set_post_surfaces`, `get_reels`) ; les vidéos publiques existantes
  deviennent des Reels.
- `app_config` (seuil 100), type de notification `reel_candidate`, `purge_expired_stories` (retient 48 h le
  fichier d'un statut vidéo candidat), ordre de `get_story_rail`.
- Les colonnes ne sont pas écrivables par les clients (test d'intégration).

## 7. Vérifications
Voir `docs/IMPLEMENTATION_LOG.md` (entrée du 16 nov.) pour les nombres exacts et le SHA.

## 8. Questions ouvertes
1. **Voix sur une vidéo** : demandée (« narration sur photos/vidéo »), mais le serveur la refuse (`audio_with_video`).
   Aujourd'hui : narration sur photos uniquement, une vidéo garde son son. Autoriser = une petite migration + règle de lecture.
2. **Boutique** : la vitrine liste tous les articles ; la case est donc cochée et verrouillée tant que l'interrupteur est actif.
3. **Miniature galerie** : montre la dernière prise/choisie ; la vraie dernière photo de la galerie demande `expo-media-library`.
4. **Statut 24 h** : audience = réglage par défaut du compte (pas de sélecteur dans le Studio). Fil a son sélecteur.
5. **Reel depuis un statut** : publié en Reels seulement (pas dans le fil). À confirmer.
6. **Caméra native** : `expo-camera` (plugin ajouté à `app.json`) non essayé sur appareil ; sur le web, enregistrement via MediaRecorder.
7. **Seuil 100 vues** : dans `app_config` (SQL) ; pas d'écran d'administration.
8. **Rail** : « vendeurs proches » = même ville (pas de distance). Filtre « Reels seuls hors fil » côté client.

## 9. Estimations
Validation sur téléphone (EAS APK, caméra/flash/vidéo/Reels, perf du préchargement) : ~1 jour ; staging (sauvegarde + migration +
sondes + aperçus) : ~½ jour ; voix sur vidéo : ~½ jour ; sélecteur d'audience de statut + écran admin du seuil : ~1 jour.
