# Jëfëli — identité produit, lexique, économie Jëf et moments signature

> Statut : **proposition** (14 nov. 2026), à valider par l'owner. Rien dans ce document n'est
> encore implémenté sauf ce qui est explicitement marqué **« existe »** avec son chemin.
> Les spécifications fonctionnelles détaillées (parcours, SQL, tests) sont dans
> `docs/SPEC_PILLARS.md`. Les règles de `CLAUDE.md`, `docs/PRODUCT_SPEC.md` et
> `docs/DESIGN_SYSTEM.md` (« Dakar after dark ») priment en cas de conflit.

**Promesse :** « Montre ce que tu as, trouve ce que tu cherches, échange ce que tu n'utilises plus. »

**Quatre piliers :**

| Pilier | En une phrase | Ce qui existe déjà |
|---|---|---|
| **Wecci** | Petites annonces entre particuliers : Vendre, Troquer (avec ou sans différence en argent), Je cherche, Donner ; plus la mise en relation « J'ai / Je veux ». | `products.listing_mode` `sale \| trade \| sale_or_trade` ; libellé « Wecci · Troc » dans Explorer (`(tabs)/explore.tsx`) ; `posts.intent = 'seek'` = « Je cherche » (`labels.ts`) |
| **Waxaale** | La négociation dans la conversation : offre → contre-offre → accord → réservation → remise → double confirmation → avis. | `make_offer`, `counter_offer`, `respond_offer`, `withdraw_offer`, `agreements`, `confirm_agreement_completed`, `leave_review` (migration `20261102000500`) ; `OfferCard`, `ChatView` |
| **Boutique** | L'espace pro construit automatiquement à partir des annonces : lien partageable, carte de statut WhatsApp, statistiques, catalogue. | `boutiques`, `collections`, onglet Boutique du profil (`ProfileView`), `boutique-edit.tsx`, pages publiques web `/[handle]` et `/p/[id]`, `whatsappLinks` (`lib/share.ts`) |
| **Jëf** | La monnaie de réputation et de visibilité : gagnée seulement par de la vraie valeur, dépensée en visibilité, jamais vendue ni transférable. | Rien. Tout est proposition. |

---

## 1. Lexique

Règles : le français d'abord, tutoiement léger dans les invitations (« Montre », « Trouve »),
vouvoiement neutre conservé dans les messages d'erreur et juridiques déjà en place
(`packages/shared/src/errors.ts`) jusqu'à décision de l'owner (voir §2). Les mots wolof sont
rares, toujours accompagnés d'un mot français à proximité, et **chacun est marqué
« à valider par locuteurs natifs »** (abrégé ⚑ dans les tableaux ci-dessous). Graphie wolof :
orthographe officielle (CLAD) à confirmer par les mêmes relecteurs.

⚑ = **à valider par locuteurs natifs** (orthographe, sens et registre).

### 1.1 Piliers et espaces

| Clé technique | Libellé UI | Sous-titre / aide | Note |
|---|---|---|---|
| `wecci` | **Wecci** ⚑ | « Vends, troque, cherche ou donne. » | Déjà affiché dans Explorer (« Wecci · Troc ») |
| `waxaale` | **Waxaale** ⚑ | « Discute le prix, propose un échange. » | Nom de la section des offres dans la conversation |
| `boutique` | **Boutique** | « Ta vitrine, faite de tes annonces. » | Existe |
| `jef` | **Jëf** ⚑ | « Gagnés en faisant de vraies affaires. » | Pluriel invariable : « 120 Jëf » |
| `market` | **Explorer** (onglet) / **Le marché** (titre) | « Le marché de Dakar, allée par allée. » | Onglet existant, inchangé |
| `aisles` | **Allées** | « Choisis une allée. » | |
| `nearby` | **Près de moi** | « Les annonces de ton quartier. » | Remplace « À proximité » dans Explorer uniquement ; le chip du fil d'Accueil reste « À proximité » |

### 1.2 Modes Wecci (création d'annonce)

| Clé | Libellé bouton (`CreateMenu`) | Badge carte (`ListingCard`) | Aide |
|---|---|---|---|
| `sale` (existe) | **Vendre** | « À vendre » (existe : `LISTING_MODE_LABELS.sale`) | « Fixe ton prix ou laisse discuter. » |
| `trade` (existe) | **Troquer** | « Wecci » ⚑ | « Échange contre un autre objet, avec ou sans différence. » |
| `sale_or_trade` (existe) | **Vendre ou troquer** | « Vente ou troc » (existe) | « Les deux te vont ? Dis-le. » |
| `seek` (existe, `posts.intent`) | **Je cherche** | « Je cherche » (existe : `INTENT_LABELS.seek`) | « Dis ce que tu cherches, le marché te répond. » |
| `give` (proposé) | **Donner** | « À donner » | « Offre ce qui ne te sert plus. Gratuit, sans contrepartie. » |
| `swap_match` (proposé) | **J'ai / Je veux** | « Échange trouvé » | « Dis ce que tu as et ce que tu veux : on te prévient quand ça colle. » |

### 1.3 Prix (existe, `formatListingPrice()` / `PriceLabel`)

| `price_mode` | Libellé | Note |
|---|---|---|
| `fixed` | « 25 000 F CFA » | |
| `negotiable` | « 25 000 F CFA · à discuter » | |
| `on_request` | « Prix sur demande » | Jamais « 0 F » |
| (Donner, proposé) | « Gratuit » | Jamais « 0 F CFA » |

### 1.4 Waxaale — offres et accords

États d'offre : libellés existants dans `packages/shared/src/offers.ts`. États de réservation et
de remise : **proposés** (`docs/SPEC_PILLARS.md` §2).

| Clé | Libellé carte (`OfferCard`) | Bouton(s) | Notification (push + in-app) |
|---|---|---|---|
| offre `pending` | « En attente » (existe) · « Expire dans 2 j » | Destinataire : **Accepter** · **Contre-proposer** · **Refuser** ; auteur : **Retirer** | `offer_received` : « Mamadou te propose 18 000 F pour « iPhone 11 » » |
| offre `countered` | « Contre-proposition faite » (existe) | — | `offer_countered` : « Awa te répond : 21 000 F » |
| offre `accepted` | « Acceptée » (existe) ; surcouche « Marché conclu ! » (`DealSealed`, prototype P1) | **Voir l'accord** | `offer_accepted` : « Marché conclu : Awa a accepté ton offre » |
| offre `rejected` | « Refusée » (existe) | — | `offer_rejected` : « Awa n'a pas retenu ton offre. Tu peux en faire une autre. » |
| offre `withdrawn` | « Retirée » (existe) | — | `offer_withdrawn` |
| offre `expired` | « Expirée » (existe) | **Refaire une offre** | `offer_expired` (proposé ; aujourd'hui aucune notification à l'expiration) : « Ton offre pour « iPhone 11 » a expiré. » |
| offre vocale (prototype P1 : `attach_offer_voice`, local uniquement) | « Écoute ma proposition » · 0:12 | ▶ (lecture `VoiceMessage` dans `OfferCard`) | idem `offer_received` |
| accord `agreed` | « Accord conclu » (existe) | **Réserver pour Mamadou** (vendeur) · **Annuler** · **Signaler un problème** | — |
| accord réservé (proposé) | « Réservé pour toi jusqu'au 16 nov. » | **Fixer la remise** | `agreement_reserved` : « Awa t'a réservé « iPhone 11 » » |
| remise fixée (proposé) | « Remise : sam. 16 nov., 17 h · Station Total Liberté 6 » | **C'est fait, j'ai remis / reçu** | `handover_scheduled`, rappel `handover_reminder` 2 h avant |
| un seul a confirmé | « En attente de la confirmation de Mamadou » (texte proche du `waiting_other_party` existant) | **Confirmer** | — |
| accord `completed` | Surcouche « Échange fait ! » (`DealSealed` dans `agreement/[id].tsx`, prototype P1) ; libellé de statut actuel « Échange déclaré terminé » (`offers.ts`) | **Laisser un avis** | `agreement_completed` : « Échange fait avec Awa. Laisse-lui un avis ? » |
| accord `canceled` | « Accord annulé » (existe) | — | `agreement_canceled` |
| accord `disputed` | « Litige signalé » (existe) | **Contacter la modération** | `agreement_disputed` |
| avis | « Ton avis sur Awa » · 1 à 5 étoiles | **Publier l'avis** | `review_received` : « Mamadou t'a laissé 5 étoiles » |
| après l'avis | « Jërëjëf ⚑ — merci pour ton avis. » | — | — |

Disclaimer existant (`offers.ts`) inchangé et toujours visible sur la carte d'accord : « Jëfëli ne
détient aucun fonds et ne garantit ni le paiement, ni la livraison, ni l'état des articles… »

### 1.5 Jëf (UI)

| Endroit | Texte |
|---|---|
| Solde (profil, visible par soi seul) | « 120 Jëf » · lien « Comment on gagne des Jëf ? » |
| Gain (toast in-app, jamais en push) | « +20 Jëf · Deal confirmé avec Awa » |
| Gain en attente | « +20 Jëf disponibles le 17 nov. » (délai de garde, §3.5) |
| Plafond atteint | « Tu as atteint la limite du jour. Tes prochains Jëf comptent dès demain. » |
| Dépense | « Booster 24 h · 50 Jëf » → confirmation « Annonce boostée jusqu'à demain 18 h 40. » |
| Solde insuffisant (`jef_insufficient`) | « Il te manque 15 Jëf. Conclus un deal pour en gagner. » |
| Reprise (clawback) | « −20 Jëf · Deal annulé après signalement » |
| Explication | « Les Jëf récompensent les vraies affaires. Ils ne s'achètent pas, ne se donnent pas et ne valent pas d'argent. » |
| Visibilité payante (plus tard) | « Boost » et « Pro » — toujours en F CFA, jamais en Jëf, jamais présentés comme « achat de Jëf ». |

### 1.6 Niveaux vendeur (publics) — voir §3.7

« Nouveau » / « Nouvelle » · « Fiable » · « Confirmé » / « Confirmée » · « Jambaar » ⚑.

### 1.7 Allées, quartiers, rituels

| Clé | Libellé | Note |
|---|---|---|
| `aisle_telephones` | **Téléphones** | Lancement |
| `aisle_mode` | **Mode** | Lancement |
| `nearby` | **Près de moi** · « Choisis ton quartier » | Liste §4.2 |
| `ritual_marche_nuit` | **Le marché de 20 h** · « Ce soir au marché » | |
| `ritual_wecci_day` | **Wecci Day** ⚑ (alternative : « Jour du Wecci ») | |
| `ritual_marche_saison` | **Marché de Tabaski** · **Marché de Korité** · **Marché de la rentrée** | Tabaski, Korité : noms d'usage, graphie ⚑ |
| `garant` | **Garant** · « 4 garants » · bouton **Je me porte garant** | Jamais « vérifié » |

### 1.8 États vides (règle : jamais un écran vide sans action)

| Où | Titre | Action |
|---|---|---|
| Allée sans assez d'annonces | « Pas encore de Téléphones ici. » | **Publier un « Je cherche »** (pré-rempli avec l'allée) |
| Près de moi vide | « Rien à Mermoz pour l'instant. » | **Voir tout Dakar** · **Je cherche** |
| Recherche sans résultat | « Personne ne vend « PS5 » pour l'instant. » | **Dis que tu cherches une PS5** |
| J'ai / Je veux sans match | « Pas encore d'échange qui colle. On te prévient. » | **Ajouter un « Je veux »** |
| Boutique sans annonce (propriétaire) | « Ta boutique se remplit toute seule avec tes annonces. » | **Publier une annonce** |
| Boutique sans annonce (visiteur) | « Awa n'a pas encore d'annonce. » | **Suivre** |
| Aucune offre (conversation) | « Une idée de prix ? Fais une offre. » | **Faire une offre** |
| Aucun avis | « Pas encore d'avis : ils arrivent après un deal confirmé des deux côtés. » | — |
| Jëf à 0 | « Ton premier deal confirmé te rapporte 20 Jëf. » | **Comment ça marche** |

### 1.9 Glossaire wolof (sens littéraux à valider)

Toutes les entrées : **sens et graphie à valider par locuteurs natifs** avant toute mise en
production. L'app n'affiche jamais de traduction tant que la validation n'est pas faite.

| Terme | Où il apparaît | Sens littéral proposé (à valider) |
|---|---|---|
| Jëfëli | Marque | Nom de marque ; **ne pas en publier de traduction** tant que l'owner ne l'a pas fixée |
| Jëf | Monnaie de réputation | « acte, action, ce que l'on fait » (à valider) |
| Wecci | Pilier petites annonces / troc | « échanger ; changer (de la monnaie) » (à valider) |
| Waxaale | Pilier négociation | « marchander, discuter le prix » (à valider) |
| Jambaar | Niveau vendeur le plus haut | « brave, vaillant, digne de confiance » (à valider ; connotation sportive « les Jambaars ») |
| Jërëjëf | Après un avis | « merci » (à valider) |
| Tabaski / Korité | Marchés saisonniers | Noms d'usage au Sénégal de l'Aïd el-Kébir / l'Aïd el-Fitr (graphie à valider) |

Process de validation proposé : trois locuteurs natifs de Dakar parmi les 30 vendeurs pilotes +
une personne de l'équipe ; chaque terme est accepté s'il obtient 3 « oui » sur 4 sur le sens, la
graphie et le registre (pas vulgaire, pas religieux à contresens, pas marque déposée par un
tiers). Résultat consigné dans ce fichier.

---

## 2. Ton de voix

Principes :

1. **Le marché, pas la banque.** On parle comme un vendeur sympa de Sandaga, pas comme un
   contrat. Phrases courtes, verbes d'action.
2. **Vrai avant tout.** Aucun chiffre inventé, aucune urgence fabriquée, aucune promesse de
   paiement ou de livraison (règle « no false signals » de `PRODUCT_SPEC.md`).
3. **Respect et chaleur.** Tutoiement dans les invitations et l'animation ; vouvoiement
   conservé pour la sécurité, la modération et le juridique (décision owner à confirmer —
   aujourd'hui l'app vouvoie partout).
4. **Wolof avec parcimonie.** Un mot wolof par écran au plus, jamais seul porteur du sens.
5. **On célèbre les actes, pas l'activité.** On félicite un deal confirmé, jamais une publication
   ou un nombre de vues.
6. **Sécurité sans peur.** Conseils concrets (« lieu public », « vérifie avant de payer »), sans
   dramatiser.

| Situation | À faire | À éviter |
|---|---|---|
| Bouton d'offre | « Faire une offre » | « Soumettre une proposition commerciale » |
| Offre acceptée | « Marché conclu ! Awa a accepté ton offre. » | « Félicitations !!! Transaction réussie 🎉🎉 » |
| Accord | « Accord conclu. Payez et remettez-vous l'article directement. » | « Paiement sécurisé par Jëfëli » (faux : aucun séquestre) |
| Garant | « 4 garants la connaissent en vrai. » | « Vendeuse vérifiée ✓ » |
| Jëf | « +20 Jëf · deal confirmé » | « Tu as gagné 20 Jëf ≈ 200 F ! » (aucune valeur monétaire) |
| Boost payant | « Boost 24 h · 500 F CFA » | « Achète 100 Jëf » (les Jëf ne s'achètent jamais) |
| Allée vide | « Pas encore de Téléphones ici. Dis ce que tu cherches. » | « Aucun résultat. » |
| Rituel | « Le marché de 20 h est ouvert. » | « 2 345 personnes regardent en ce moment ! » (chiffre inventé) |
| Expiration | « Ton offre a expiré. Tu peux en refaire une. » | « Offre rejetée automatiquement par le système. » |
| Erreur réseau | « Pas de réseau. On réessaie dès que ça revient. » | « Erreur 503 : service indisponible. » |
| Litige | « Dis-nous ce qui s'est passé. Un modérateur regarde sous 48 h. » | « Votre plainte sera traitée. » |
| Rappel remise | « Rendez-vous à 17 h. Choisis un lieu public et vérifie l'article. » | « N'oubliez pas votre RDV !!! » |
| Mot wolof | « Waxaale — discute le prix » | « Waxaale » seul, sans aide |
| Notification d'incitation | « Mamadou cherche un iPhone 11 dans ton quartier. » | « Reviens ! Tu nous manques 😢 » |
| Niveau vendeur | « Confirmée · 12 deals · 4,8 ★ » | « Top vendeuse n°1 de Dakar » |

---

## 3. Économie Jëf (proposition)

### 3.1 Principes

- **Gagnés uniquement par de la vraie valeur** confirmée par une autre personne réelle ou par
  le temps (réponse rapide). **Jamais pour publier**, liker, suivre, se connecter ou inviter.
- **Dépensés uniquement en visibilité** à l'intérieur de Jëfëli.
- **Jamais vendus, jamais transférables, jamais convertibles, aucune valeur monétaire.**
- La visibilité payante existe séparément, **en F CFA**, sous les noms « Boost » et « Pro »
  (agrégateur agréé, plus tard — `SPEC_PILLARS.md` §5). Payer ne crédite jamais de Jëf.
- Grand livre **en ajout seul** ; le solde est une vue calculée.

### 3.2 Gagner

| Événement (`jef_reason`) | Jëf | Condition | Plafond |
|---|---|---|---|
| `deal_confirmed` | +20 chacun | Accord `kind = 'price'` passé à `completed` (les deux `*_completed_at` remplis) ; ≥ 30 min entre acceptation et 2e confirmation ; comptes non liés (§3.4) | 3 deals rémunérés / jour ; 1 deal rémunéré / 30 j avec le même partenaire |
| `swap_completed` | +30 chacun | Accord `kind = 'barter'` passé à `completed`, mêmes conditions | Partage le plafond des deals (3 / jour) |
| `fast_reply` | +2 | Première réponse en moins de 30 min dans une conversation **ouverte par un autre membre** non lié, qui a lui-même écrit ≥ 1 message ; calcul nocturne (pas de trigger sur chaque message) | 5 / jour |
| `review_received` | +5 (4–5 ★) · +2 (3 ★) · 0 (1–2 ★) | Avis `active` existant (`reviews`, un par accord et par auteur) ; jamais négatif : les mauvaises notes pèsent sur la note moyenne, pas sur les Jëf | Implicite (1 par accord) |
| `seek_answer_deal` | +15 bonus | Tu as répondu (commentaire ou message) à un post `intent = 'seek'` dans les 7 j de sa publication **et** un accord entre toi et son auteur est `completed` dans les 14 j suivant ta réponse | 2 / jour |

**Plafonds globaux :** 60 Jëf / jour et 250 Jëf / semaine (lundi 00:00, heure de Dakar = UTC,
sans heure d'été) par membre. Au-delà, l'événement est enregistré avec `amount` réduit au reste du
plafond (jamais rejeté en silence) et une ligne « plafond atteint » apparaît dans l'historique.

### 3.3 Dépenser

| Article | Coût | Durée | Règles |
|---|---|---|---|
| **Booster 24 h** (une annonce) | 50 Jëf | 24 h | 1 boost actif par membre ; 3 / semaine ; annonce `active` et `moderation_status = 'active'` ; placé dans « Pour toi » et l'allée avec l'étiquette « Mis en avant » (transparence) |
| **À la une** dans une allée | 120 Jëf | 24 h | 3 emplacements par allée et par jour, premier arrivé ; 1 / membre / semaine ; étiquette « À la une » |
| **Priorité Wecci** (J'ai / Je veux) | 30 Jëf | 7 j | L'annonce passe en tête des correspondances J'ai / Je veux ; n'invente aucune correspondance |

Une dépense est remboursée automatiquement (`refund_spend`) si l'annonce est masquée par la
modération ou vendue dans la première heure. Les boosts payants en F CFA (plus tard) utilisent
les mêmes emplacements mais un compteur séparé.

### 3.4 Anti-abus

1. **Grand livre en ajout seul** : aucune permission `update` / `delete`, trigger qui refuse
   toute modification même au `service_role` ; corrections = nouvelle ligne `clawback` ou
   `admin_adjustment` qui référence la ligne d'origine.
2. **Double confirmation** : rien n'est gagné sur un accord tant que les deux parties n'ont pas
   confirmé (`confirm_agreement_completed`, existe).
3. **Clé d'idempotence unique** par gain (`deal:<agreement_id>:<user_id>`), donc un événement ne
   paie qu'une fois, même rejoué.
4. **Plafonds** journaliers / hebdomadaires (§3.2) et par partenaire (1 deal payé / 30 j).
5. **Délai de garde** : les gains sur accord sont `available_at = now() + 72 h`, le temps qu'un
   signalement arrive avant qu'on puisse les dépenser.
6. **Pas de Jëf entre comptes liés.** Ce qui est faisable sur l'offre gratuite Supabase, sans
   nouveau SDK de traçage :

| Signal | Faisable ? | Usage |
|---|---|---|
| Même jeton push Expo enregistré par deux comptes | **Oui, partiellement.** `push_tokens.token` est clé primaire : aujourd'hui un jeton passe au dernier compte qui l'enregistre, l'historique est perdu. Proposé : `private.push_token_history (token_hash, user_id, first_seen_at)` alimentée par `register_push_token`. Limites : pas de jeton sur le web, jeton changé à la réinstallation, absent si les notifications sont refusées | Lien fort → gains bloqués entre les deux comptes |
| Même numéro de téléphone | Impossible par construction (`auth.users.phone` unique) | — |
| Motif de préfixe téléphonique | **Non utilisable** : 77 / 78 / 76 / 70 / 75 sont des préfixes d'opérateurs partagés par des millions de lignes | Ne pas utiliser |
| Adresse IP | **Non utilisable** : le CGNAT des réseaux mobiles fait partager une IP à des milliers d'abonnés ; Postgres ne la voit pas de façon fiable ; stockage contraire à la minimisation | Ne pas utiliser |
| Identifiant d'appareil (Android ID) | Pas sans nouvelle dépendance (`expo-application` n'est pas installé ; `expo-device` l'est mais ne donne que modèle / marque, trop grossier) et revue de confidentialité | Hors pilote |
| Graphe : concentration des deals | **Oui** (SQL nocturne) : ≥ 3 accords entre A et B représentant > 50 % des accords de l'un des deux | Lien probable → gains en attente + file modération |
| Graphe : comptes jumeaux | **Oui** : comptes créés à < 48 h d'intervalle dont le premier accord commun survient < 7 j après | Lien probable |
| Vitesse suspecte | **Oui** : 2e confirmation < 30 min après acceptation ; avis 5 ★ croisés < 10 min | Gain non versé |
| Lien déclaré par un modérateur | **Oui** : `private.account_links` écrit via RPC staff | Lien fort |

   Honnêteté : une personne avec deux téléphones et deux puces passera ces filtres. Les plafonds,
   le délai de garde, l'absence de valeur monétaire et la reprise sur signalement limitent le
   gain d'une telle fraude à quelques boosts.

7. **Reprise (clawback)** : quand un signalement visant un accord, un avis ou un profil passe à
   `actioned` (`reports.status`, existe) avec une action de modération, toutes les lignes de gain
   liées à l'objet sont annulées par une ligne négative `clawback` (clé `clawback:<ligne>`). Le
   solde peut devenir négatif ; les dépenses sont alors bloquées. Une décision infirmée en appel
   (`appeals`, existe) recrédite par `admin_adjustment`.

### 3.5 Schéma du grand livre (esquisse SQL, proposition)

```sql
create type public.jef_reason as enum (
  'deal_confirmed', 'swap_completed', 'fast_reply', 'review_received', 'seek_answer_deal',
  'spend_boost', 'spend_a_la_une', 'spend_swap_priority',
  'refund_spend', 'clawback', 'admin_adjustment'
);

create table public.jef_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0 and amount between -1000 and 1000),
  reason public.jef_reason not null,
  ref_type text not null check (ref_type in
    ('agreement', 'review', 'conversation', 'post', 'boost', 'ledger', 'moderation_action')),
  ref_id text not null,                       -- uuid ou id de ligne, en texte
  reverses_id bigint references public.jef_ledger (id),
  idempotency_key text not null unique,       -- ex. 'deal:<agreement_id>:<user_id>'
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (reason in ('deal_confirmed', 'swap_completed', 'fast_reply', 'review_received',
                'seek_answer_deal', 'refund_spend') and amount > 0)
    or (reason in ('spend_boost', 'spend_a_la_une', 'spend_swap_priority', 'clawback') and amount < 0)
    or reason = 'admin_adjustment'
  ),
  check ((reason in ('clawback', 'refund_spend')) = (reverses_id is not null))
);
alter table public.jef_ledger enable row level security;
create index jef_ledger_user_idx on public.jef_ledger (user_id, created_at desc);

create policy jef_ledger_select_own on public.jef_ledger
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.jef_ledger from anon, authenticated;
grant select on public.jef_ledger to authenticated;      -- aucune écriture client

create or replace function private.jef_ledger_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'jef_ledger_append_only' using errcode = 'P0001';
end; $$;
create trigger jef_ledger_no_update before update or delete on public.jef_ledger
  for each row execute function private.jef_ledger_append_only();
create trigger jef_ledger_no_truncate before truncate on public.jef_ledger
  for each statement execute function private.jef_ledger_append_only();

-- Solde = vue, jamais une colonne modifiable.
create view public.my_jef_balance with (security_invoker = true) as
select user_id,
       coalesce(sum(amount) filter (where available_at <= now()), 0)               as available,
       coalesce(sum(amount) filter (where available_at > now() and amount > 0), 0) as pending,
       coalesce(sum(amount) filter (where reason not in
         ('spend_boost', 'spend_a_la_une', 'spend_swap_priority', 'refund_spend')), 0) as lifetime_net_earned
from public.jef_ledger group by user_id;
grant select on public.my_jef_balance to authenticated;
```

Écritures : uniquement `private.jef_award(...)` (appelée par triggers sur `agreements` /
`reviews` et par le job nocturne) et `public.jef_spend(p_item, p_product_id, p_aisle)` (SECURITY
DEFINER, `private.require_user()`, `pg_advisory_xact_lock(hashtext(uid::text))` contre la double
dépense, contrôle du solde disponible, des plafonds et du flag `jef_spend`). Toutes les fonctions
`private.jef_*` : `revoke execute … from public, anon, authenticated`.

### 3.6 Affichage sur le profil — décision proposée

- **Solde Jëf : visible par le propriétaire seulement.** Raisons : (1) un solde public devient un
  chiffre à exhiber puis à « vendre avec le compte », ce qui crée un marché noir et une valeur
  perçue en argent ; (2) le solde baisse quand on dépense — afficher publiquement un nombre qui
  baisse quand on se met en avant punirait l'usage normal ; (3) minimisation des données.
- **Public :** niveau vendeur, nombre de deals confirmés, nombre d'échanges Wecci confirmés,
  note moyenne et nombre d'avis (`profiles.rating_sum / rating_count`, existe), nombre de garants,
  ancienneté (« Sur Jëfëli depuis oct. 2026 »). Tous dérivés d'événements réels confirmés par
  deux personnes.

### 3.7 Niveaux vendeur (proposition)

Calculés chaque nuit à partir de `lifetime_net_earned` (après reprises) **et** de compteurs réels,
pour qu'on ne puisse pas monter de niveau avec des réponses rapides seules. Un niveau ne baisse
pas avec les dépenses ; il baisse après une reprise ou un signalement retenu.

| Niveau | Libellé | Seuils (tous requis) |
|---|---|---|
| 1 | **Nouveau / Nouvelle** | Défaut |
| 2 | **Fiable** | ≥ 3 accords `completed` avec ≥ 2 partenaires différents ; ≥ 60 Jëf gagnés nets ; note ≥ 4,0 si ≥ 3 avis |
| 3 | **Confirmé / Confirmée** | ≥ 10 accords `completed`, ≥ 6 partenaires ; ≥ 250 Jëf nets ; aucun signalement retenu depuis 90 j |
| 4 | **Jambaar** ⚑ (à valider par locuteurs natifs ; repli français : « Référence ») | ≥ 30 accords `completed`, ≥ 15 partenaires ; ≥ 800 Jëf nets ; note ≥ 4,5 sur ≥ 10 avis ; aucun signalement retenu depuis 180 j |

Affichage : texte + petite icône neutre, **jamais** une coche ni le mot « vérifié »
(`verification_level` `merchant_verified` reste le seul badge de vérification, existant).

---

## 4. Structure du marché (Explorer)

### 4.1 Allées

Une allée = un regroupement de catégories existantes (`public.categories`). Proposé : table
`public.market_aisles (slug, name, category_slugs text[], position, launched_at, min_listings)`,
lecture publique, écriture admin.

| Ordre | Allée | Catégories (`category_slug`, existent) | Statut |
|---|---|---|---|
| 1 | **Téléphones** | `telephones` | Lancement |
| 2 | **Mode** | `mode-femme`, `mode-homme`, `tissus-wax`, `chaussures`, `sacs-accessoires` | Lancement |
| 3 | Maison | `maison`, `electromenager` | Plus tard |
| 4 | Beauté | `beaute` | Plus tard |
| 5 | Électronique | `electronique` | Plus tard |
| 6 | Enfants | `enfants` | Plus tard |
| 7 | Sport | `sport` | Plus tard |
| 8 | Artisanat | `artisanat` | Plus tard |
| 9 | Épicerie | `epicerie` | Plus tard |

Une allée n'apparaît que quand `launched_at` est passé **et** qu'elle a au moins `min_listings`
annonces visibles. Les catégories restent accessibles par la recherche et les filtres existants
(`explore_products`, `browse_products`).

### 4.2 Près de moi

Liste actuelle **existante** : `DAKAR_AREAS` dans `packages/shared/src/labels.ts` (24 zones) :
Plateau, Médina, Fann, Point E, Mermoz, Sacré-Cœur, Liberté, HLM, Grand Dakar, Ouakam, Ngor, Yoff,
Almadies, Parcelles Assainies, Grand Yoff, Sicap, Castors, Colobane, Hann, Pikine, Guédiawaye,
Thiaroye, Keur Massar, Rufisque. **À confirmer avec les vendeurs pilotes** (manques possibles :
Sacré-Cœur 1/2/3, Liberté 1–6, Yeumbeul, Cambérène, Patte d'Oie, Sicap Baobab… ; regroupements
pour l'affichage : « Dakar Plateau », « Dakar Centre », « Banlieue »).

Limite actuelle : `products.neighborhood` est un texte libre (≤ 60 caractères) ; « Près de moi »
filtre sur la valeur exacte choisie dans `LocationPicker`. Proposé : normaliser à l'écriture vers
la liste (sans GPS, conforme à SOC-03), et ne jamais afficher de position précise.

### 4.3 Plan d'amorçage (avant lancement)

- **30 vendeurs pilotes recrutés** (≈ 15 Téléphones, 15 Mode ; dont ≈ 8 « pros » type Fatou), au
  moins 6 quartiers différents.
- **Minimum avant ouverture d'une allée :** 40 annonces visibles (`active` / `reserved`,
  `moderation_status = 'active'`) de ≥ 12 vendeurs distincts, ≥ 3 quartiers, ≥ 25 % en Wecci
  (`listing_mode <> 'sale'`). Mesuré par la requête « Current stock » de `PILOT_METRICS.md` §2
  (qui fixe aujourd'hui un objectif de ≈ 30 annonces de 8–10 vendeurs : ce plan le relève par
  allée).
- **Annonces réelles uniquement** dans le projet pilote : vraies photos, vrais prix, publiées par
  les vendeurs eux-mêmes (aide en personne autorisée, jamais au nom du vendeur sans son accord).
- **Règle DÉMO :** les données de test (`profiles.is_demo`, `pnpm seed`) ne vivent qu'en local /
  staging, portent toujours l'étiquette « DÉMO » à l'écran, et **le projet pilote n'en contient
  aucune** (`docs/SETUP_PRODUCTION.md`). Une allée pilote ne peut jamais être « remplie » avec
  du DÉMO.

### 4.4 Règles d'état vide

1. Allée sous le seuil → elle n'est pas listée ; si on y arrive par lien, on montre l'état vide
   §1.8 avec **Publier un « Je cherche »** pré-rempli (`posts.intent = 'seek'`, catégorie).
2. Filtre trop strict → proposer d'élargir (« Voir tout Dakar », « Retirer le prix max »).
3. Jamais de faux contenu, de « bientôt ici » avec des photos d'exemple, ni de compteur inventé.
4. Les rangées « Tendances cette semaine » et « Vendeurs à suivre » (existent) restent masquées
   quand elles sont vides.

---

## 5. Rituels (propositions, derrière des feature flags)

Flags dans `public.feature_flags` (existe ; clé `^[a-z0-9_]+$`, bascule via
`admin_set_feature_flag`, existe). Tous désactivés par défaut. Heure de Dakar = UTC (pas d'heure
d'été), donc les crons `pg_cron` (déjà utilisé : `jefeli-expire-offers`) s'écrivent en UTC sans
conversion.

| Flag | Rituel | Déclencheur | UX | Coût (tout en offre gratuite) | Métrique |
|---|---|---|---|---|---|
| `ritual_marche_nuit` | **Le marché de 20 h** (quotidien, 20 h–22 h) | `pg_cron` `0 20 * * *` remplit `ritual_windows` ; 1 push max / jour aux membres ayant activé « Rappels du marché » | Bandeau or dans Explorer « Le marché de 20 h est ouvert » → annonces publiées ou rebaissées depuis 18 h, puis boosts ; compteur réel d'annonces (jamais de « personnes en ligne ») | Infra : pg_cron + Expo push (gratuits) ; ops : 15 min / soir de modération active pendant le créneau | Conversations ouvertes 20–22 h vs moyenne des autres créneaux de 2 h ; offres faites dans le créneau |
| `ritual_wecci_day` | **Wecci Day** ⚑ (hebdo, samedi proposé) | `pg_cron` `0 7 * * 6` lance le calcul J'ai / Je veux et ouvre la fenêtre de 24 h | Allée « Wecci » en tête d'Explorer (annonces `trade` / `sale_or_trade` et « À donner ») ; notifications de correspondances groupées (max 3) | Infra : un job SQL hebdo ; ops : 1 h le samedi (modération, animation WhatsApp des pilotes) | Offres `kind = 'barter'` créées le jour J vs autres jours ; accords barter `completed` sous 7 j |
| `ritual_marche_saison` | **Marchés saisonniers** : Tabaski, Korité, rentrée | Dates saisies chaque année par l'owner dans `ritual_windows` (dates lunaires : jamais codées en dur) | Allée thématique temporaire (Tabaski : Mode, Tissus & wax, Épicerie ; rentrée : Enfants, Téléphones) ; carte de statut WhatsApp dédiée | Infra : 0 ; ops : ≈ 1 j de préparation (recrutement de vendeurs thématiques) + modération renforcée | Annonces publiées dans l'allée thématique, conversations et accords pendant la fenêtre vs 4 semaines précédentes |

Table proposée : `public.ritual_windows (id, flag_key, title, starts_at, ends_at, aisle_slug)`,
lecture publique, écriture admin. Le rituel n'est visible que si le flag est actif **et** qu'une
fenêtre est en cours.

---

## 6. Moments signature

### 6.1 Deal confirmé (le moment de marque)

**État au 14 nov. 2026 :** un composant `apps/mobile/src/components/DealSealed.tsx` et un son
`apps/mobile/assets/sounds/deal-sealed.wav` (≈ 30 Ko) sont **prototypés sur `feature/p1-identity`**
(local, pas en staging). Ils montrent « Marché conclu ! » à l'acceptation d'une offre (`OfferCard`) et
« Échange fait ! » à la double confirmation (`agreement/[id].tsx`), avec l'API `Animated` de
React Native : voile 0–180 ms (`Easing.out(quad)`), sceau 0,4 → 1,08 → 1 et −12° → 0° de 60 à
480 ms (`Easing.out(back(1.8))`), haptique « success » et carillon à 240 ms, éclat de 12 points
or / menthe 240–900 ms (`Easing.out(cubic)`), titre 300–560 ms, fermeture à 2 400 ms ou au tap,
mouvement réduit via `AccessibilityInfo.isReduceMotionEnabled()`, `playsInSilentMode: false`,
volume 0,7. **Ce comportement fait foi** ; la spécification ci-dessous est la **cible proposée**
pour la version complète (deux avatars + signature tracée) et n'est à appliquer qu'avec accord
de l'owner. Écarts à trancher : format du son (WAV ≈ 30 Ko en cours vs AAC ≤ 20 Ko proposé),
déclenchement sur le 2e appareil (temps réel, non couvert aujourd'hui), réglage « Sons » Android.

Déclenchement cible : sur l'appareil qui fait passer l'accord à `completed`
(`confirm_agreement_completed` renvoie `'completed'`), et sur l'autre appareil à la réception
temps réel du message système `agreement_completed` si la conversation ou l'accord est ouvert
(sinon une seule fois à la prochaine ouverture). Jamais rejoué ensuite. Version légère
(« Marché conclu ! », sceau seul) quand une offre est acceptée.

Outils : l'API `Animated` suffit (choix du composant en cours) ; `react-native-reanimated` 4.7.1
et `react-native-svg` 15.16.0 sont installés si la signature tracée est retenue ; couleurs
uniquement via les tokens (`colors.gold`, `colors.mintAccent`, `colors.background`).

| t (ms) | Élément | Animation | Courbe |
|---|---|---|---|
| 0–120 | Carte d'accord | échelle 1 → 0,97, voile `background` 0 → 0,85 | `Easing.out(Easing.quad)` |
| 120–420 | Deux avatars | glissent de ±48 pt vers le centre, opacité 0 → 1 | `Easing.bezier(0.22, 1, 0.36, 1)` |
| 300–900 | Trait de signature or (chemin SVG, 2,5 pt) | `strokeDashoffset` longueur → 0 | `Easing.bezier(0.65, 0, 0.35, 1)` |
| 900–1120 | Sceau (cercle or + coche `onPrimary`) | échelle 0 → 1,12 → 1 | ressort `damping: 14, stiffness: 180` |
| 900 | Son + haptique | voir 6.2 / 6.3 | — |
| 1000–1250 | Titre DM Serif Display « Deal confirmé » + « Avec Awa · iPhone 11 » | opacité 0 → 1, translateY 8 → 0 | `Easing.out(Easing.cubic)` |
| 1250–1500 | Bouton **Laisser un avis** | opacité 0 → 1 | linéaire |
| 2800 ou tap | Sortie | opacité 1 → 0 en 200 ms | `Easing.in(Easing.quad)` |

Durée active ≤ 1,5 s ; l'écran reste jusqu'au tap ou 2,8 s. 60 i/s visé sur Android milieu de
gamme : animations sur le thread UI (worklets), pas de particules.

### 6.2 Son

- Durée ≤ 800 ms (limite 1 s), deux notes ascendantes + léger « clap » ; **composition
  originale** commandée ou produite en interne, cession de droits écrite conservée dans
  `brand/` ; aucun échantillon de banque de sons, même gratuit.
- Format : en cours `deal-sealed.wav` (≈ 30 Ko, 0,7 s selon le composant). Proposé : AAC
  `.m4a`, 44,1 kHz, mono, ~64 kb/s, ≤ 20 Ko, embarqué dans l'app (pas de téléchargement) ; lu
  avec `expo-audio` (installé, ~58.0.11 ; `createAudioPlayer`, `setAudioModeAsync`). La preuve
  d'originalité (auteur, date, cession) doit être consignée avant toute mise en pilote.
- Volume : crête −6 dBFS, ≈ −18 LUFS ; lecture à 0,6 du volume média.
- Mode silencieux : iOS — mode audio avec `playsInSilentMode: false` (le bouton silence coupe le
  son ; nom d'option à vérifier dans les types installés d'`expo-audio`). Android — aucune API
  installée ne lit le mode sonnerie : on joue sur le flux média seulement si le réglage
  **Paramètres › Sons de Jëfëli** est actif (par défaut : actif pour ce son uniquement), sans
  interrompre une musique en cours (atténuation). Web : jamais de son automatique.
- Un seul son de marque dans toute l'app. Aucun son pour les likes, messages, gains de Jëf.

### 6.3 Haptique

`expo-haptics` **est installé** (`~58.0.7` dans `apps/mobile/package.json`) et déjà utilisé
(`VoiceRecorder.tsx` : `impactAsync(Light)` ; `CreateMenu.tsx` : `selectionAsync()`), toujours
derrière `Platform.OS !== 'web'` et `.catch(() => {})`. Même garde pour tout ce qui suit.

| Moment | iOS | Android |
|---|---|---|
| Offre envoyée | `impactAsync(ImpactFeedbackStyle.Light)` | idem (vibreur court) |
| Offre acceptée (« Accord conclu ») | `impactAsync(ImpactFeedbackStyle.Medium)` | idem |
| Deal confirmé, au sceau (t = 900 ms) | `notificationAsync(NotificationFeedbackType.Success)` | idem ; si les types installés exposent une API Android dédiée (`performAndroidHapticsAsync`), l'utiliser avec un type « confirm » — à vérifier, sinon `notificationAsync` |
| Choix dans une liste (modes, allées) | `selectionAsync()` | idem |

Jamais d'haptique en boucle ni sur réception de notification.

### 6.4 Mouvement réduit

Si `useReducedMotion()` (Reanimated) ou `AccessibilityInfo.isReduceMotionEnabled()` est vrai :
pas de glissement, de tracé ni de ressort ; l'image finale (avatars, signature tracée, sceau,
titre) apparaît en fondu de 150 ms. Le son (selon réglage) et l'haptique restent. Lecteurs
d'écran : annonce `accessibilityLiveRegion` / `announceForAccessibility` « Deal confirmé avec
Awa. Laisser un avis ? ».

### 6.5 Garant

Un abonné qui connaît le vendeur **dans la vraie vie** se porte garant. Affiché comme un nombre
(« 4 garants ») dans l'en-tête du profil et la carte vendeur de l'annonce ; la liste des garants
est visible (noms et avatars, selon leurs réglages de confidentialité). **Jamais** de badge
« vérifié », de coche ni de couleur de vérification. Conditions et sanctions :
`SPEC_PILLARS.md` §1.

---

## 7. Modèles vidéo et voix guidés (propositions)

Faits actuels (`docs/W1_1_MEDIA.md`) : vidéos **jusqu'à 180 s inclus** dans les publications,
articles **et statuts** (l'ancien plafond de 60 s des statuts a été retiré en W1.1) ; 50 Mo par
fichier ; durée déclarée par le client (pas de transcodage). Voix d'article **existe** (W1.3,
« Présenter en voix », `product_media.kind = 'audio'`, ≤ 180 s, `language` dont `wo` et `fr`,
repères `cues`). Les modèles ne changent aucune limite : ils guident.

Comme il n'y a pas de transcodage sur l'offre gratuite, **aucun texte n'est incrusté dans la
vidéo** : les indications s'affichent pendant le tournage, et les surimpressions (prix, titre)
sont dessinées à la lecture à partir des données de l'annonce.

| Modèle (`template`) | Durée visée / max | Déroulé et indications à l'écran (FR) | Notes |
|---|---|---|---|
| `essayage` — **Essayage** | 15–45 s / 60 s | 0 s « Montre la tenue de face, en entier. » · 8 s « Tourne-toi lentement. » · 18 s « Un détail de près : tissu, couture, étiquette. » · 30 s « Dis ta taille et celle de la tenue. » | Allée Mode ; caméra arrière par défaut, lumière du jour conseillée |
| `deballage` — **Déballage** | 20–60 s / 90 s | « Montre la boîte fermée. » · « Ouvre devant la caméra. » · « Montre chaque accessoire. » · « Allume l'appareil — cache ton numéro et ton code. » | Allée Téléphones ; rappel : ne jamais filmer IMEI complet, code, ni conversation |
| `avant_apres` — **Avant / Après** | 2 clips de 3–15 s, total ≤ 30 s | Clip 1 « Avant : montre l'état d'origine. » · Clip 2 « Après : même angle, même lumière. » | Publié comme **deux médias** dans l'ordre (pas de montage serveur) ; étiquettes « Avant » / « Après » dessinées à la lecture |
| `prix_3s` — **Prix en 3 secondes** | 3–8 s / 10 s | « Montre l'article en gros plan. » · « Dis le prix à voix haute. » | Le prix affiché vient de `price_xof` / `price_mode` via `PriceLabel` ; si le prix change, la surimpression suit, et la vidéo affiche « Prix dit dans la vidéo : peut avoir changé » |
| `voix_annonce` — **Présenter en voix** (existe, W1.3) | 20–60 s conseillé / 180 s | « Dis ce que c'est. » · « Son état, honnêtement. » · « Pourquoi tu le vends. » · « Où on peut se voir. » | Choix de langue existant : Wolof ou Français (`language`) |

Données (proposition) : colonne `template text check (template in ('essayage', 'deballage',
'avant_apres', 'prix_3s'))` sur `post_media` et `product_media`, purement informative (filtre,
statistiques) ; flag `video_templates`. Le serveur continue d'appliquer les seules limites
réelles (180 s, 50 Mo) ; les durées « max » des modèles sont appliquées dans l'app (arrêt
automatique de l'enregistrement).
