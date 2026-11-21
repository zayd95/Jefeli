# Système de notation des membres (21 nov. 2026) — décisions prises, première version construite

Demande du propriétaire : une **note des membres sur le profil, liée aux votes ▲/▼ de leurs publications**. Ce document précise comment le faire sans le rendre
triable par des comptes de complaisance ou des attaques groupées, en partant de ce qui existe déjà. **Décisions du propriétaire (21 nov.)** : voir « Décisions retenues et réalisé » en bas.

## 1. Ce qui existe déjà
| Brique | État | Où |
|---|---|---|
| Votes ▲/▼ sur les publications | Fait. Un vote par membre, modifiable ; **seul le compte des ▲ est public** ; un ▼ est privé et ne change que le fil du votant ; les ▲ de comptes inactifs ne comptent pas ; pas de vote sur ses propres publications | `post_votes`, `vote_post`, `docs/FEED_ENGAGEMENT.md` |
| Avis ★1–5 après un accord **terminé** des deux côtés | Fait (un avis par accord et par personne) | `reviews`, `agreements` |
| Niveaux « Jëf lite » : Nouveau → Fiable → Confirmé → Jambaar | Fait, calculés (échanges terminés, partenaires distincts, moyenne des avis, signalements retenus) | `member_level()` |
| Jëf (monnaie de réputation) | Différé volontairement (pas de registre) | `docs/IDENTITY.md` § 3.7 |

Décision antérieure à respecter ou à réviser **explicitement** : « les votes ne sont jamais additionnés en note de vendeur » (`FEED_ENGAGEMENT.md`), pour qu’un groupe ne puisse pas
détruire la réputation d’un vendeur en bloc avec des ▼.

## 2. Principe : deux signaux, deux noms, jamais mélangés
Une seule « note » qui mélange argent et popularité serait trompeuse. Le profil montre **deux choses distinctes** :

1. **Confiance** (commerce) : ★ moyenne + nombre d’avis + niveau Jëf lite. Vient **uniquement d’accords terminés** : on ne peut pas l’acheter avec des votes.
2. **Apprécié** (communauté) : ce que les membres pensent des publications. Vient des ▲ (et d’un ▼ filtré, voir § 4).

Le **lien avec les votes** passe par la *pondération* et le *niveau* : le poids d’un vote dépend de la Confiance du votant, et la Confiance ne dépend jamais des votes.

## 3. « Apprécié » : calcul proposé
- **Fenêtre glissante de 90 jours** (un membre qui s’améliore remonte, une ancienne gloire s’éteint).
- On compte des **votants distincts éligibles**, pas des votes bruts : 100 ▲ du même compte = 1 votant. Éligible = compte actif, onboarding fini, ancienneté ≥ 14 jours, ni bloqué ni suspendu.
- **Poids du votant** : Nouveau 0,5 · Fiable 1 · Confirmé 1,25 · Jambaar 1,5.
- **Plafond par paire** : un même votant compte au plus une fois par semaine pour un même auteur ; les ▲ réciproques répétés entre deux comptes sont écrasés.
- **Lissage** : avec peu de publications ou de votants, le niveau reste « en cours » (pas de chiffre trompeur d’après 2 votes).
- **Affichage honnête** : paliers (par ex. *Apprécié* à 10 / 50 / 200 votants distincts sur 90 jours) plutôt qu’un score à décimales ; état vide « Pas encore de votes ». Jamais de chiffre inventé ; comptes DÉMO marqués et exclus.

## 4. Les ▼ : que faire ?
Un ▼ public ou agrégé est l’outil d’harcèlement le plus simple. Recommandation (**à confirmer**) :
- **▼ reste privé** pour le votant (son fil), comme aujourd’hui ;
- et sert de **signal de modération** : au-delà d’un seuil de votants distincts éligibles sur une publication (ex. ≥ 5 en 7 jours avec un ratio élevé), elle part dans la file d’examen humaine, **sans baisse automatique d’une note publique** ;
- l’auteur voit son nombre de ▲, jamais le détail des ▼ ; recours possible si une publication est retirée.

## 5. Sur le profil
`★ 4,8 (23 avis) · Confirmé` puis `▲ Apprécié` (palier). Un nouveau membre voit « Nouveau » et « Pas encore d’avis » ; rien n’est affiché tant qu’il n’y a pas de données réelles. Un
membre peut ouvrir ses propres avis et voir comment monter de niveau.

## 6. Garde-fous
Comptes DÉMO exclus ; blocage = votes supprimés (déjà) ; limite de votes par heure (déjà : 200) ; suspension = votes ignorés (déjà) ; recalcul serveur (fonction `security definer`, pas d’écriture client) ;
journal des recalculs pour audit ; **jamais** de score exposé qui sorte du serveur sans RLS (comme `member_level`).

## 7. Décisions à prendre
1. **▼** : privé + signal de modération (recommandé) ou effet public agrégé ?
2. **Affichage** : paliers (recommandé) ou nombre ?
3. **Un avis sans accord terminé** : non (recommandé), pour garder la Confiance non achetable.
4. **Jëf** : un ▲ d’un membre Confirmé/Jambaar peut-il, plus tard, rapporter des Jëf (quand le registre existera) ?

Estimation : une migration (agrégats + fonction `member_appreciation(p_user)`), tests RLS/anti-abus, bloc profil ; environ une demi-journée de travail une fois les décisions prises.

## 8. Décisions retenues et réalisé (21 nov. 2026)
Le propriétaire a retenu toutes les recommandations et demandé une ligne d’actions « comme X », très épurée :
**⭐ Noter · 💬 Commentaire · 🖤 · 👁 Vues · 🔖 Enregistrer · ↗ Partager** (icônes avec compteur, sans cadre). Le vote ▼ disparaît de l’interface.

| Élément | Comportement |
|---|---|
| ⭐ Noter | 1 à 5, privé, modifiable et retirable. La **moyenne publique n’apparaît qu’à partir de 5 notes** de membres actifs ayant fini l’onboarding (sinon « Pas encore noté »). Personne ne peut lister qui a noté quoi (RLS : on ne voit que sa propre note). On ne note pas sa propre publication |
| 🖤 | C’est l’ancien vote ▲ (`vote_post(…, 1)`) : même compteur public, mêmes garde-fous. Il garde donc le petit poids de classement qu’avait le ▲ (à revoir si le propriétaire veut un 🖤 sans effet sur le fil) |
| 👁 Vues | **Vraies vues**, une par membre et par publication (après 1 s à l’écran), jamais celle de l’auteur ni d’un compte DÉMO. **Visibles par l’auteur seul** (`my_post_views`) ; aucune lecture directe de la table |
| « Apprécié » (profil) | `member_appreciation(p_user)` : membres **distincts** et authentiques (actifs, onboarding fini, compte de plus de 14 jours, ni DÉMO ni bloqués) qui ont noté ≥ 4 ou aimé ces publications sur 90 jours. Paliers **Apprécié** (10), **Très apprécié** (50), **Incontournable** (200) ; rien d’affiché en dessous. N’alimente jamais la « Confiance » (avis après un échange) |
| ▼ | Plus de bouton. Le signal de modération au-delà d’un seuil de ▼ n’a donc plus de source côté interface ; il reste à définir pour les notes basses (⭐ ≤ 2), **non construit** |

Migration `20261121000100_post_ratings_views.sql` (`post_ratings`, `post_views`, `posts.rating_count` / `rating_avg`, `rate_post`, `record_post_view`, `my_post_views`, `member_appreciation`),
tests `tests/integration/src/26-ratings-views.test.ts` (11), E2E `community.spec.ts`. **Non appliquée à staging** : elle attend l’accord du propriétaire (voir `docs/NEXT_ACTIONS.md`).
Pas encore fait : pondération du vote par le niveau du votant, signal de modération sur les notes basses, Jëf pour les ▲ de membres Confirmés.
