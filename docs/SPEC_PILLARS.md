# Jëfëli — spécification des quatre piliers (Wecci, Waxaale, Boutique, Jëf)

> Statut : **proposition** (14 nov. 2026), non implémentée sauf mention **« existe »**. Lexique,
> ton, économie Jëf détaillée, rituels et moments signature : `docs/IDENTITY.md`.
> Contraintes reprises de `CLAUDE.md` : chaque changement de schéma = nouvelle migration, puis
> `pnpm db:types`, puis tests RLS dans `tests/integration/src/` ; écritures client par
> permissions de colonnes ou RPC SECURITY DEFINER appelant `private.require_user()` ; clés
> d'erreur courtes traduites dans `packages/shared/src/errors.ts` ; toute fonction `private.*`
> nouvelle : `revoke execute … from public, anon, authenticated` ; offre gratuite uniquement ;
> aucun séquestre, aucun solde monétaire.

Personas (reprises de `PRODUCT_SPEC.md`, rôles précisés) :
- **Awa** — vendeuse de vêtements (WhatsApp / TikTok), veut de la demande locale.
- **Mamadou** — acheteur et troqueur : vend un téléphone d'occasion, échange des objets.
- **Fatou** — boutique pro pilote (accessoires de téléphone, Liberté 6), publie 20+ articles.

Estimations : **S** ≤ 2 j·dev · **M** 3–5 j · **L** 6–10 j (tests d'intégration et E2E inclus).

Clés d'erreur nouvelles (toutes proposées, à ajouter à `errors.ts`) : `flag_disabled`,
`give_not_allowed`, `want_limit`, `already_requested`, `reservation_exists`, `not_reserved`,
`handover_not_allowed`, `jef_insufficient`, `jef_cap_reached`, `boost_active`, `slot_full`,
`linked_accounts`, `garant_not_eligible`, `garant_limit`, `already_garant`, `pro_not_allowed`.

Types de notifications nouveaux (proposés) — la contrainte `notifications_type_check` doit être
remplacée par une nouvelle migration, avec le même schéma `drop / add … not valid / validate`
que `20261103000100_feed_engagement.sql` : `offer_expired`, `agreement_reserved`,
`handover_scheduled`, `handover_reminder`, `swap_match`, `seek_answered`, `give_requested`,
`garant_received`, `jef_clawback`, `ritual_reminder`. Les gains de Jëf ne génèrent **jamais**
de push (toast in-app seulement).

---

## 0. Coupe pilote (15 nov. 2026) — ce qui est construit, ce qui est différé

Construit sur `feature/pilot-cut` (PR #13). **Les migrations restent locales** jusqu'au « go » de l'owner pour staging.

| Pilier | Construit (pilote) | Différé |
|---|---|---|
| Wecci | Mode « Donner » (0 F permis dans ce seul mode, aucune offre possible) ; mode troc renommé « Troquer » ; « Je cherche » dans l'état vide des allées (P1) | Filtre « Dons » dans Explorer ; correspondances J'ai / Je veux ; Wecci Day (flag `ritual_wecci_day`, non construit) |
| Waxaale | L'acceptation réserve l'article (les deux en troc) et clôt les offres concurrentes (acheteurs prévenus) ; étape « Remise » (lieu + heure) ; chaque notification d'offre ou d'accord ouvre la bonne discussion ; annulation → remis en vente ; échange terminé → vendu | Rappels de remise, expiration automatique d'un accord non conclu |
| Boutique | Moment « Partage ta boutique » après la 1re annonce ; carte statut WhatsApp 9:16 en un geste ; pages web publiques (Vercel Hobby) avec « Faire une offre » | Boutique Pro, statistiques |
| Jëf | « Jëf lite » : niveaux publics Nouveau → Fiable → Confirmé → Jambaar, en lecture seule, calculés sur les échanges conclus ; 24 h d'exposition « Nouveau » pour la 1re annonce | **Registre (ledger), solde, gains, dépenses, Boost : non construits** (§ 4 reste une spécification) |

## 1. Wecci — petites annonces entre particuliers

### 1.1 User stories

| ID | Story |
|---|---|
| WEC-US1 | En tant que Mamadou, je **vends** mon iPhone 11 d'occasion avec photos, état, prix et quartier, en moins de 2 minutes. |
| WEC-US2 | En tant que Mamadou, je **troque** ma console contre un téléphone, en précisant si j'accepte de donner ou recevoir une différence en F CFA. |
| WEC-US3 | En tant qu'Awa, je publie **« Je cherche »** un tissu bazin bleu à Médina, et les vendeurs me répondent. |
| WEC-US4 | En tant que Mamadou, je **donne** un lit bébé ; je choisis à qui parmi les demandes reçues. |
| WEC-US5 | En tant que Mamadou, je déclare **« J'ai »** une PS4 et **« Je veux »** un téléphone Android ; je suis prévenu quand quelqu'un a l'inverse. |
| WEC-US6 | En tant qu'acheteur, je parcours les **Allées** (Téléphones, Mode) et **Près de moi** sans jamais tomber sur un écran vide sans action. |
| WEC-US7 | En tant que vendeur, je peux recevoir des **garants** : des abonnés qui me connaissent en vrai. |

### 1.2 Parcours écran par écran

1. **Publier** (`(tabs)/publish.tsx` → `CreateMenu`, existe) : le menu propose
   **Vendre · Troquer · Je cherche · Donner** (+ Publication, Statut, Live existants). Vendre /
   Troquer / Donner ouvrent `publish/listing.tsx` (existe) avec `listing_mode` pré-choisi ;
   Je cherche ouvre `publish/post.tsx` (existe) avec `intent = 'seek'`.
2. **Formulaire d'annonce** (`publish/listing.tsx`, existe) : un seul défilement ; sélecteur de
   mode (ChoicePills) ; en Troquer, case « J'accepte une différence en argent » ; en Donner, le
   champ prix disparaît et `PriceLabel` affiche « Gratuit » ; « Présenter en voix » (existe,
   `VoiceStudio`) ; « Modèle vidéo » (proposé, `IDENTITY.md` §7).
3. **Explorer** (`(tabs)/explore.tsx`, existe) : bande nuit + **Allées** (tuiles) +
   **Près de moi** (`LocationPicker`, existe) + rangées existantes (Tendances, Vendeurs à
   suivre) ; grille `ListingCard surface="paper"`. Allée sous le seuil → état vide qui ouvre
   `publish/post.tsx?intent=seek&category=…`.
4. **Fiche annonce** (`p/[id].tsx`, existe) : bouton principal selon le mode — « Faire une
   offre » (vente), « Proposer un échange » (troc, existe via `offer/[productId].tsx`),
   « Je le veux » (Donner, proposé). Carte vendeur : niveau, deals, note, **garants**.
5. **Je cherche** (`PostCard` avec intent seek, existe) : action « J'ai ça » → `ProductPicker`
   (existe) pour envoyer une de ses annonces en carte produit dans la conversation avec l'auteur
   (`message_about_product`, existe) ; notification `seek_answered` à l'auteur.
6. **J'ai / Je veux** (nouvel écran `app/(app)/wecci/matches.tsx`) : liste « Je veux »
   (catégorie, mots-clés, budget max, quartier ; 5 au plus, 30 j) ; liste « J'ai » = mes annonces
   `trade` / `sale_or_trade` ; onglet « Échanges trouvés » : chaque correspondance montre les
   deux `ListingCard` et un bouton **Proposer l'échange** qui ouvre `offer/[productId].tsx` avec
   mon objet pré-sélectionné.
7. **Donner — demandes** : le donneur voit les demandes « Je le veux » sur sa fiche (ou dans la
   conversation) et choisit ; l'acceptation crée un accord (`kind = 'gift'`, montant 0) qui suit
   le même cycle réservation → remise → confirmation que Waxaale (§2).
8. **Garant** (profil `u/[handle].tsx`, existe) : bouton **Je me porte garant** dans « Plus
   d'infos » si éligible ; feuille de confirmation « Tu connais Awa en vrai ? Si elle trompe
   quelqu'un, ton nom est associé. » ; retrait possible à tout moment.

### 1.3 Delta du modèle de données + RLS (esquisse)

```sql
-- Donner : nouveau mode. price_xof reste null (règle existante « jamais 0 »).
alter type public.listing_mode add value 'give';
-- products_price_rules et la contrainte « listing_mode = 'trade' or price_xof is not null »
-- deviennent « listing_mode in ('trade','give') or price_xof is not null » (nouvelle migration).
-- validate_offer_terms : kind 'price' et 'barter' refusés sur 'give' (give_not_allowed).

-- Demande de don : un offre de kind 'gift' (montant 0, pas de cash_payer).
alter table public.offers drop constraint offers_kind_check;   -- nom réel à relever
alter table public.offers add constraint offers_kind_check check (kind in ('price', 'barter', 'gift'));
-- + adapter la contrainte de montant : kind = 'gift' => amount_xof = 0 and cash_payer is null
-- agreements.kind idem. RPC : public.request_gift(p_product_id, p_message) => make_offer interne.

-- Je veux
create table public.wants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_slug text not null references public.categories (slug),
  keywords text not null default '' check (char_length(keywords) <= 80),
  max_price_xof integer check (max_price_xof is null or max_price_xof between 1 and 100000000),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.wants enable row level security;
create policy wants_own on public.wants for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.wants from anon, authenticated;
grant select, delete on public.wants to authenticated;
-- Écriture : public.upsert_want(...) SECURITY DEFINER, require_user, 5 actifs max (want_limit),
-- rate limit 'want' 20 / jour. Les « Je veux » ne sont jamais publics.

create table public.swap_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  product_a uuid not null references public.products (id) on delete cascade,  -- ce que A a
  user_b uuid not null references public.profiles (id) on delete cascade,
  product_b uuid not null references public.products (id) on delete cascade,  -- ce que B a
  score smallint not null,             -- même quartier, budget, priorité Jëf
  created_at timestamptz not null default now(),
  dismissed_by uuid[] not null default '{}',
  unique (product_a, product_b), check (user_a <> user_b)
);
alter table public.swap_matches enable row level security;
create policy swap_matches_party on public.swap_matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b)
         and not private.is_blocked_between(user_a, user_b));
revoke all on public.swap_matches from anon, authenticated;
grant select on public.swap_matches to authenticated;
-- Calcul : private.compute_swap_matches() (pg_cron toutes les 6 h + quotidien Wecci Day) :
-- A a une annonce trade/sale_or_trade dans une catégorie voulue par B ET inversement,
-- même ville, annonces visibles (can_view_product côté de chacun), ni bloqués ni liés.
-- Notification swap_match : 3 / jour / membre au plus. RPC dismiss_swap_match(id).

-- Garants
create table public.garants (
  seller_id uuid not null references public.profiles (id) on delete cascade,
  garant_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seller_id, garant_id), check (seller_id <> garant_id)
);
alter table public.garants enable row level security;
create policy garants_select on public.garants for select to anon, authenticated
  using (private.can_view_profile_content((select auth.uid()), seller_id));
revoke all on public.garants from anon, authenticated;
grant select on public.garants to anon, authenticated;
alter table public.profiles add column garants_count integer not null default 0;  -- trigger
-- public.vouch(p_seller) / public.unvouch(p_seller) SECURITY DEFINER :
--   require_user ; follow accepté depuis ≥ 14 j ; compte du garant ≥ 30 j et status 'active' ;
--   ni bloqués ni liés (linked_accounts) ; 10 garanties données au plus (garant_limit) ;
--   flag 'garant' ; rate limit 'vouch' 5 / jour. Aucun Jëf pour une garantie.
```

Allées et rituels : `market_aisles`, `ritual_windows` (lecture publique, écriture admin par RPC
staff) — `IDENTITY.md` §4–5.

### 1.4 Notifications

`seek_answered` (« Fatou a peut-être ce que tu cherches »), `swap_match` (« Échange trouvé :
ta PS4 contre un Galaxy A14 à Liberté »), `give_requested` (« Awa voudrait ton lit bébé »),
`garant_received` (« Mamadou se porte garant pour toi »). Push seulement si le flag
`push_notifications` (existe) est actif et selon `account_settings`.

### 1.5 Abus et parades

| Abus | Parade |
|---|---|
| « Donner » utilisé comme appât (demande d'argent ensuite) | Bouton « Signaler » sur l'accord (`reports.target_type = 'agreement'`, existe) ; rappel « Un don ne demande aucun paiement » sur la carte ; reprise de Jëf si retenu |
| Spam de « Je cherche » ou de « J'ai ça » | Rate limits existants des posts / messages ; « J'ai ça » limité à 10 / jour |
| Faux garants (comptes jumeaux) | Conditions d'ancienneté et de follow, comptes liés exclus, plafond de garanties ; quand un vendeur a un signalement retenu pour arnaque, ses garants sont notifiés et leurs garanties suspendues 90 j |
| Garantie achetée / échangée | Interdite par les règles (`legal/regles`) ; garantie retirable ; aucune récompense |
| Articles interdits en troc | `private.check_prohibited_terms` existe déjà sur les annonces |
| Matches utilisés pour harceler | Correspondances jamais calculées entre comptes bloqués ; `dismiss_swap_match` ; signalement |

### 1.6 Tests d'acceptation

| ID | Parcours | Preuve requise |
|---|---|---|
| WEC-01 | Vendre | Mamadou publie une annonce `sale` avec photo, état, F CFA et quartier ; elle apparaît dans l'allée Téléphones et Près de moi « Liberté » pour un autre compte non abonné |
| WEC-02 | Troquer avec différence | Annonce `trade` ; un autre compte propose son objet + 5 000 F payés par lui ; la fiche récapitulative affiche « Différence : +5 000 F CFA » des deux côtés après redémarrage |
| WEC-03 | Je cherche | Awa publie « Je cherche » ; Fatou répond « J'ai ça » avec une annonce ; Awa reçoit `seek_answered` et une carte produit dans la conversation |
| WEC-04 | Donner | Annonce `give` affiche « Gratuit », jamais « 0 F » ; `make_offer` kind price sur cette annonce → `give_not_allowed` ; deux demandes, le donneur en accepte une, l'autre passe `rejected` |
| WEC-05 | J'ai / Je veux | Deux comptes aux souhaits inverses dans la même ville obtiennent une correspondance après le job ; un 3e compte ne la voit pas (RLS) ; comptes bloqués → aucune correspondance |
| WEC-06 | Allée vide | Allée sous le seuil non listée ; ouverte par lien → état vide avec « Publier un « Je cherche » » pré-rempli |
| WEC-07 | Garant | Compte de < 30 j ou non abonné depuis 14 j → `garant_not_eligible` ; compte éligible → compteur +1 visible déconnecté sur `/[handle]` ; aucun texte « vérifié » nulle part (grep E2E) |
| WEC-08 | RLS | `wants` d'autrui illisibles ; insert direct sur `garants`, `swap_matches`, `wants` refusé (pas de permission) |

### 1.7 Estimations

| Élément | Taille |
|---|---|
| Menu 4 modes + pré-sélection formulaire | S |
| Mode Donner (enum, contraintes, offre `gift`, UI) | M |
| « J'ai ça » sur Je cherche + notification | S |
| J'ai / Je veux (tables, job, écran, notifications) | L |
| Allées + Près de moi normalisé + états vides | M |
| Garants (table, RPC, UI profil / annonce, sanctions) | M |
| **Sous-total Wecci** | **≈ 25–37 j** |

---

## 2. Waxaale — la négociation jusqu'à l'avis

### 2.1 User stories

| ID | Story |
|---|---|
| WAX-US1 | En tant que Mamadou, je fais une offre à Awa (montant + mot, ou **message vocal**), elle peut accepter, refuser ou contre-proposer. |
| WAX-US2 | En tant qu'Awa, je contre-propose ; la chaîne d'offres reste lisible dans la conversation. |
| WAX-US3 | En tant que Mamadou, je sais quand mon offre expire (72 h) et je suis prévenu quand elle expire. |
| WAX-US4 | En tant qu'Awa, après l'accord, je **réserve** l'article pour Mamadou, ce qui bloque les autres offres. |
| WAX-US5 | En tant que tous deux, nous fixons une **remise** (jour, heure, lieu public suggéré) et recevons un rappel. |
| WAX-US6 | En tant que tous deux, nous **confirmons** le deal ; la célébration « Deal confirmé » s'affiche ; chacun peut laisser un **avis**. |

### 2.2 Machine à états

Existant : offres (`pending → accepted | rejected | countered | withdrawn | expired`) et accords
(`agreed → completed | canceled | disputed`). **Proposé :** réservation et remise comme
**colonnes d'étape** sur `agreements` (pas de nouveaux statuts, pour ne pas casser
`confirm_agreement_completed` et `close_agreement` qui testent `status = 'agreed'`).

| # | De | Vers | Acteur | RPC | Effets | Notification |
|---|---|---|---|---|---|---|
| 1 | — | offre `pending` | Acheteur / troqueur | `make_offer` (existe) ; puis `attach_offer_voice` (en cours, non commité, §2.4) | Snapshot produit ; message `kind = 'offer'` ; une seule offre en attente par (annonce, acheteur) ; rate limit 30 / h | `offer_received` (existe) |
| 2 | `pending` | `countered` + nouvelle `pending` (`parent_offer_id`) | Destinataire | `counter_offer` (existe) | Nouvelle offre, nouveau délai de 72 h ; seul l'acheteur change l'objet proposé en troc | `offer_countered` (existe) |
| 3 | `pending` | `rejected` | Destinataire | `respond_offer(false)` (existe) | Message système `offer_rejected` | `offer_rejected` (existe) |
| 4 | `pending` | `withdrawn` | Auteur | `withdraw_offer` (existe) | Message système | `offer_withdrawn` (existe) |
| 5 | `pending` | `expired` | Système | `expire_stale_offers` (existe, pg_cron toutes les 15 min) ; ou paresseusement au verrouillage | **Aujourd'hui : ni message système ni notification.** Proposé : message système `offer_expired` + notification aux deux | `offer_expired` (proposé) |
| 6 | `pending` | `accepted` → accord `agreed` | Destinataire | `respond_offer(true)` (existe) | Termes immuables (`agreements_protect_terms`), disclaimer ; animation légère « Accord conclu » | `offer_accepted` (existe) |
| 7 | `agreed` | `agreed` + `reserved_at` | Vendeur (le donneur pour `gift`) | `reserve_agreement(p_id, p_until)` (proposé) | `products.status = 'reserved'` (verrou `for update`) ; les autres offres en attente sur l'annonce passent `rejected` avec message `product_reserved` ; une seule réservation active par annonce (`reservation_exists`) ; `reserved_until` ≤ 7 j | `agreement_reserved` |
| 8 | `agreed` (réservé ou non) | `agreed` + `handover_at`, `handover_place` | L'un ou l'autre | `schedule_handover(p_id, p_at, p_place)` (proposé) | Lieu libre ≤ 120 car. + suggestions « lieu public » ; modifiable jusqu'à la remise ; rappel pg_cron 2 h avant | `handover_scheduled`, `handover_reminder` |
| 9 | `agreed` | `agreed` + `buyer_completed_at` ou `seller_completed_at` | Chaque partie | `confirm_agreement_completed` (existe) | Retour `waiting_other_party` (existe) ; libellé « C'est fait, j'ai remis / reçu » | — |
| 10 | `agreed` | `completed` | 2e partie | `confirm_agreement_completed` (existe) | **Proposé :** annonce `sold` (vente, don) ou les deux annonces `sold` (troc) ; gain de Jëf (`IDENTITY.md` §3) ; moment « Deal confirmé » | `agreement_completed` (existe) |
| 11 | `agreed` | `canceled` | L'un ou l'autre | `close_agreement('canceled')` (existe) | **Proposé :** si l'annonce était réservée par cet accord → retour `active` | `agreement_canceled` (existe) |
| 12 | `agreed` | `disputed` | L'un ou l'autre | `close_agreement('disputed')` (existe) | Proposé : ouvre automatiquement un `report` `target_type = 'agreement'` | `agreement_disputed` (existe) |
| 13 | réservation expirée | `agreed` sans réservation | Système | `private.release_expired_reservations()` (proposé, pg_cron horaire) | Annonce de nouveau `active` ; message système | `agreement_reserved` (variante « réservation terminée ») |
| 14 | `completed` | avis | Chaque partie | `leave_review` (existe) | 1–5 ★, un avis par partie et par accord ; note du profil (`refresh_rating`, existe) | `review_received` (existe) |

Fait actuel important : `respond_offer` ne réserve pas l'annonce ; c'est le vendeur qui change
`products.status` à la main (permission de colonne `status`, existe). Une fois `reserved`,
`validate_offer_terms` refuse déjà toute nouvelle acceptation (`product_unavailable`) — la
transition 7 s'appuie sur ce comportement.

### 2.3 Parcours écran par écran

1. **Fiche annonce** (`p/[id].tsx`) → **Faire une offre** → `offer/[productId].tsx` (existe) :
   montant (prix) ou objet + différence (troc), mot facultatif, **micro** pour une offre vocale
   (« Écoute ma proposition » ; en cours dans l'arbre de travail : `offer/[productId].tsx`,
   `lib/api/offers.ts` modifiés, non commités ; `VoiceRecorderPanel` existe).
2. **Conversation** (`chat/[id].tsx` → `ChatView`, `MessageBubble`, `OfferCard`, existent) :
   `OfferCard` montre montant / objets, statut, compte à rebours « Expire dans 1 j 20 h »,
   lecteur `VoiceMessage` si offre vocale, actions selon `canRespond` / `canWithdraw`
   (`offers.ts`, existe). Les contre-offres s'empilent avec un fil « en réponse à 18 000 F ».
   `Composer` (existe) garde « + » → `ProductPicker`.
3. **Accord** (`agreement/[id].tsx`, existe ; liste `agreements.tsx`, existe) : étapes en
   frise verticale **Accord → Réservé → Remise → Confirmé → Avis**, chacune avec son bouton ;
   disclaimer toujours visible ; « Signaler un problème » (`report.tsx`, existe).
4. **Deal confirmé** : surcouche plein écran (`IDENTITY.md` §6.1), puis feuille d'avis.

### 2.4 Delta du modèle de données + RLS (esquisse)

```sql
alter table public.agreements
  add column reserved_at timestamptz,
  add column reserved_until timestamptz,
  add column handover_at timestamptz,
  add column handover_place text check (handover_place is null or char_length(handover_place) <= 120),
  add column handover_updated_by uuid references public.profiles (id) on delete set null;
-- Aucune nouvelle permission client : écriture uniquement par RPC.
-- agreements_protect_terms reste inchangé (les nouvelles colonnes ne sont pas des termes).
create unique index agreements_one_reservation_per_product
  on public.agreements (product_id) where reserved_at is not null and status = 'agreed';

-- Offre vocale : EN COURS dans l'arbre de travail (non commité au 14 nov. 2026) —
-- supabase/migrations/20261114000100_waxaale_voice_offer.sql + tests/integration/src/21-waxaale-voice-offer.test.ts :
-- public.attach_offer_voice(p_offer_id, p_attachment_path, p_attachment_meta) insère un message
-- ordinaire kind = 'voice' lié par messages.offer_id (le client ne peut pas écrire offer_id) ;
-- seul le proposant, offre pending non expirée, une seule voix (offer_voice_exists) ; toutes les
-- règles de messages_before_insert s'appliquent (fichier à soi, audio, ≤ 180 s).
-- Aucune colonne ajoutée sur offers. La voix accompagne, elle ne remplace pas le montant.
-- Proposition complémentaire : limiter dans l'app l'enregistrement d'une offre vocale à 60 s.

create or replace function public.reserve_agreement(p_agreement_id uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); a public.agreements;
begin
  select * into a from public.agreements where id = p_agreement_id for update;
  if not found or uid not in (a.buyer_id, a.seller_id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if uid <> a.seller_id then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if a.status <> 'agreed' then raise exception 'invalid_transition' using errcode = 'P0001'; end if;
  if p_until <= now() or p_until > now() + interval '7 days' then raise exception 'invalid_date' using errcode = 'P0001'; end if;
  perform 1 from public.products where id = a.product_id and status = 'active' for update;
  if not found then raise exception 'reservation_exists' using errcode = 'P0001'; end if;
  update public.products set status = 'reserved' where id = a.product_id;
  update public.agreements set reserved_at = now(), reserved_until = p_until where id = a.id;
  -- rejeter les autres offres pending sur ce produit + messages système + notifications
  perform private.notify(a.buyer_id, uid, 'agreement_reserved', 'agreement', a.id);
end; $$;
-- schedule_handover(p_agreement_id, p_at, p_place) : partie de l'accord, status 'agreed',
-- p_at entre now() et now() + 14 j, rate limit 'handover' 10 / jour.
-- confirm_agreement_completed (remplacée par migration) : à 'completed', products -> 'sold',
-- puis perform private.jef_award_agreement(a.id).
```

### 2.5 Notifications

Existantes : `offer_received`, `offer_countered`, `offer_accepted`, `offer_rejected`,
`offer_withdrawn`, `agreement_completed`, `agreement_canceled`, `agreement_disputed`,
`review_received`. Proposées : `offer_expired`, `agreement_reserved`, `handover_scheduled`,
`handover_reminder` (au plus 1 par accord, 2 h avant).

### 2.6 Abus et parades

| Abus | Parade |
|---|---|
| Offres en rafale / harcèlement par contre-offres | Rate limit `offer` 30 / h (existe) ; une seule offre en attente par paire (existe) ; blocage coupe tout (`is_blocked_between`, existe) |
| Réservation « squat » pour bloquer un concurrent | Seul le vendeur réserve ; 7 j maximum ; libération automatique ; 3 réservations actives au plus par vendeur |
| Faux deals pour gagner des Jëf | Double confirmation, délai de garde, comptes liés, 30 min minimum, plafonds (`IDENTITY.md` §3.4) |
| Avis de représailles | Avis seulement après `completed` (existe) ; signalement d'avis (`reports.target_type = 'review'`, existe) ; modération masque (`moderation_status`) |
| Lieu de remise dangereux | Suggestions de lieux publics, rappel sécurité, pas d'adresse personnelle demandée |
| Voix offensante dans une offre vocale | Signalement de message (existe), modération écoute la pièce jointe ; 60 s maximum |
| Arnaque au paiement « avance Wave » | Disclaimer existant ; conseil « paie à la remise » sur l'étape Remise ; signalement `scam` |

### 2.7 Tests d'acceptation

| ID | Parcours | Preuve requise |
|---|---|---|
| WAX-01 | Offre → contre-offre → acceptation | Mamadou offre 18 000 F, Awa contre-propose 21 000 F, Mamadou accepte ; deux `OfferCard` lisibles, accord `agreed` aux termes de 21 000 F après redémarrage sur deux appareils |
| WAX-02 | Offre vocale | Offre + `attach_offer_voice` (12 s) ; Awa l'écoute dans `OfferCard` (`testID="waxaale-voice"`) ; 2e voix → `offer_voice_exists` ; voix par le destinataire → `not_allowed` ; un 3e compte ne lit ni l'offre ni le fichier (RLS + stockage) — couvert en partie par `21-waxaale-voice-offer.test.ts` (en cours) |
| WAX-03 | Expiration | Offre avec `expires_at` dans le passé ; après `expire_stale_offers`, statut `expired`, message système et notification `offer_expired` chez les deux ; `respond_offer` → `offer_expired` |
| WAX-04 | Réservation | Awa réserve ; annonce « Réservé » partout ; l'offre en attente d'un 3e compte passe `rejected` ; `reserve_agreement` par l'acheteur → `not_allowed` ; 2e réservation → `reservation_exists` |
| WAX-05 | Libération | Réservation dont `reserved_until` est passé → annonce `active` après le job |
| WAX-06 | Remise | Remise fixée, rappel `handover_reminder` reçu 2 h avant (horloge de test), un seul rappel |
| WAX-07 | Double confirmation | 1re confirmation → `waiting_other_party` ; 2e → `completed`, annonce `sold`, animation « Deal confirmé » vue sur l'appareil confirmant (capture) et sur l'autre via temps réel |
| WAX-08 | Annulation | Annuler un accord réservé remet l'annonce en `active` |
| WAX-09 | Avis | Avis impossible avant `completed` (`review_not_allowed`) ; un seul par partie (`already_reviewed`) |
| WAX-10 | Mouvement réduit | Avec « Réduire les animations » activé, la surcouche apparaît en fondu sans tracé ; son coupé en mode silencieux iOS |
| WAX-11 | RLS | Aucune écriture directe sur `agreements` ou `offers` ; les nouvelles colonnes ne sont modifiables que par RPC |

### 2.8 Estimations

| Élément | Taille |
|---|---|
| Notification + message d'expiration | S |
| Offre vocale — reste à faire après le travail en cours (E2E, limite 60 s dans l'app) | S |
| Réservation + libération automatique | M |
| Remise + rappel | M |
| Frise d'accord (`agreement/[id].tsx`) + annonce `sold` à la complétion | M |
| Moment « Deal confirmé » — reste à faire après `DealSealed.tsx` en cours (temps réel côté 2e appareil, réglage Sons, AAC, tests) | S |
| **Sous-total Waxaale** | **≈ 14–22 j** |

---

## 3. Boutique — l'espace pro auto-construit

### 3.1 User stories

| ID | Story |
|---|---|
| BTQ-US1 | En tant que Fatou, ma boutique se remplit seule avec mes annonces ; je n'ai rien à « construire ». (existe) |
| BTQ-US2 | En tant que Fatou, je partage le **lien** de ma boutique et d'un article sur WhatsApp ; il s'ouvre sans l'app. (existe : `/[handle]`, `/p/[id]`) |
| BTQ-US3 | En tant que Fatou, je crée une **carte de statut WhatsApp** (image verticale) d'un article ou d'une sélection, avec prix et lien. |
| BTQ-US4 | En tant que Fatou, je vois mes **statistiques** réelles : vues, enregistrements, conversations, offres, deals. |
| BTQ-US5 | En tant que Fatou (Pro), j'organise mon **catalogue** en collections, j'épingle, je mets plusieurs articles en avant et je réponds plus vite avec des réponses rapides. |

### 3.2 Parcours écran par écran

1. **Profil › onglet Boutique** (`ProfileView`, existe) : grille `ListingCard`, collections
   (`collections`, existe), notes de retrait / livraison / paiement (`boutiques`, existe).
2. **Partager** : `ShareActions` / `whatsappLinks` (existe) ; nouveau bouton **Carte de statut**.
3. **Carte de statut WhatsApp** (nouvel écran `app/(app)/boutique/card.tsx`) : choix de 1 à 4
   articles → aperçu 1080×1920 (fond nuit, photo, titre DM Serif Display, `PriceLabel`, lien
   court `jefeli…/p/<id>`, QR via `react-native-qrcode-svg`, installé) → **Partager** :
   - option A (proposée par défaut) : l'image est rendue par le web (`apps/web`, Next 16.4.3)
     avec `next/og` `ImageResponse` sur `/api/card/[id]` (pas encore utilisé dans le dépôt),
     téléchargée puis partagée avec `expo-sharing` (installé) ; l'utilisateur choisit
     WhatsApp › Statut. Coût : dépend de l'hébergeur web (offre gratuite à confirmer).
   - option B : capture côté app (`react-native-view-shot`, **non installé** : nouvelle
     dépendance à valider).
   Aucune API WhatsApp n'est utilisée ; rien n'est publié à la place de Fatou.
   Partage interne vers un statut Jëfëli : `ShareToStatusSheet` (existe).
4. **Statistiques** (nouvel écran `app/(app)/boutique/stats.tsx`) : 7 / 30 jours ; chiffres
   réels uniquement, cases « — » si < 3 (règle de `PILOT_METRICS.md`) ; pas de comparaison
   inventée.
5. **Pro** (`boutique-edit.tsx`, existe, + section Pro) : mise en avant de collection, 3 réponses
   rapides dans `Composer`, export catalogue (CSV / lien), statistiques par article. Payant
   plus tard (§5) ; pendant le pilote, activé gratuitement pour les 8 boutiques pilotes via le
   flag `boutique_pro` et une liste admin.

### 3.3 Delta du modèle de données + RLS (esquisse)

```sql
-- Vues : compteur agrégé par jour, jamais l'identité du visiteur.
create table public.product_view_daily (
  product_id uuid not null references public.products (id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (product_id, day)
);
alter table public.product_view_daily enable row level security;
create policy product_view_daily_owner on public.product_view_daily for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.seller_id = (select auth.uid())));
revoke all on public.product_view_daily from anon, authenticated;
grant select on public.product_view_daily to authenticated;
-- public.record_product_view(p_product_id) SECURITY DEFINER (anon + authenticated) :
-- ignore le vendeur lui-même, 1 vue / membre / annonce / jour via private.rate_limits,
-- upsert views = views + 1. Les vues web anonymes passent par une route serveur limitée.

-- Statistiques : une RPC lecture seule, agrégats uniquement.
-- public.my_boutique_stats(p_days int) returns table (views, saves, conversations, offers,
--   agreements_completed, median_first_reply_minutes) — calculés depuis product_view_daily,
--   product_saves, messages.product_id, offers, agreements (sans lire aucun contenu).

-- Pro (sans paiement au pilote).
create table public.pro_plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  source text not null check (source in ('pilot_grant', 'paid')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references auth.users (id)
);
alter table public.pro_plans enable row level security;
create policy pro_plans_own on public.pro_plans for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.pro_plans from anon, authenticated;
grant select on public.pro_plans to authenticated;
-- Écriture : admin_grant_pro(p_user, p_ends_at) (is_admin, audit) ; plus tard webhook de
-- l'agrégateur de paiement (Edge Function, signature vérifiée, jamais depuis l'app).

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  position smallint not null default 0
);
-- RLS : propriétaire seulement ; insert/update/delete via RPC qui vérifie private.is_pro(uid)
-- (pro_not_allowed) et 3 réponses max.
```

### 3.4 Notifications

Aucune notification nouvelle obligatoire. Proposé (opt-in, hebdomadaire, in-app) : « Ta semaine :
12 conversations, 2 deals ». Jamais de chiffre si < 3.

### 3.5 Abus et parades

| Abus | Parade |
|---|---|
| Carte de statut avec un prix trompeur | La carte lit `price_xof` / `price_mode` côté serveur au moment du rendu ; pas de saisie libre de prix |
| Gonflage des vues | 1 vue / membre / annonce / jour ; vues du vendeur ignorées ; les vues ne donnent **aucun** Jëf et n'influencent pas le niveau |
| Usurpation d'une marque (« boutique officielle X ») | Règles existantes (`impersonation`), `reserved_handles` (existe), modération |
| Pro perçu comme « vérifié » | Aucun badge Pro sur les cartes ; mention discrète « Boutique Pro » seulement sur la page boutique, jamais près de la note |
| Export catalogue utilisé pour scraper d'autres boutiques | L'export ne contient que ses propres annonces (RLS vendeur) |

### 3.6 Tests d'acceptation

| ID | Parcours | Preuve requise |
|---|---|---|
| BTQ-01 | Boutique automatique | (PROF-01 existant) la première annonce de Fatou remplit l'onglet Boutique sans assistant |
| BTQ-02 | Lien partagé | `/[handle]` et `/p/[id]` ouverts déconnectés : titre, photo, prix, lien vers l'app (SOC-04) |
| BTQ-03 | Carte de statut | Carte 1080×1920 générée pour un article ; prix identique à la fiche ; feuille de partage système ouverte sur Android réel (capture) ; annonce masquée par la modération → carte refusée |
| BTQ-04 | Statistiques | Après 2 vues d'un autre compte le même jour, `views = 1` ; vue du vendeur non comptée ; un autre compte ne lit pas `product_view_daily` (RLS) ; valeurs < 3 affichées « — » |
| BTQ-05 | Pro pilote | Sans `pro_plans`, création de réponse rapide → `pro_not_allowed` ; après `admin_grant_pro`, 3 réponses max utilisables dans `Composer` |
| BTQ-06 | Aucune promesse | Aucune page Pro ne mentionne paiement sécurisé, vérification ou livraison garantie (grep E2E) |

### 3.7 Estimations

| Élément | Taille |
|---|---|
| Carte de statut WhatsApp (rendu web `next/og` + partage) | M |
| Vues agrégées + RPC statistiques + écran | M |
| Pro pilote (table, grant admin, réponses rapides, export) | M |
| **Sous-total Boutique** | **≈ 9–15 j** |

---

## 4. Jëf — grand livre, gains, dépenses

Règles, montants, plafonds, comptes liés, niveaux et schéma SQL complet : `IDENTITY.md` §3.

### 4.1 User stories

| ID | Story |
|---|---|
| JEF-US1 | En tant que Mamadou, quand un deal est confirmé des deux côtés, je gagne des Jëf et je vois pourquoi. |
| JEF-US2 | En tant qu'Awa, je dépense 50 Jëf pour booster une annonce 24 h ; elle porte l'étiquette « Mis en avant ». |
| JEF-US3 | En tant qu'Awa, je ne peux ni acheter, ni donner, ni recevoir des Jëf d'un autre membre. |
| JEF-US4 | En tant que modération, quand un signalement est retenu, les Jëf gagnés sur l'objet sont repris, avec une ligne visible dans l'historique du membre. |
| JEF-US5 | En tant que visiteur, je vois le niveau du vendeur et ses compteurs réels, pas son solde. |

### 4.2 Parcours écran par écran

1. **Profil (propriétaire)** (`(tabs)/profile.tsx`, existe) : pastille « 120 Jëf » → nouvel écran
   `app/(app)/jef.tsx` : solde disponible, en attente, historique (lignes du grand livre avec
   motif lisible), « Comment on gagne des Jëf ? ».
2. **Dépenser** : depuis une annonce à soi (`p/[id].tsx` menu, `listing-edit/[id].tsx`) :
   **Booster 24 h · 50 Jëf**, **À la une (Téléphones) · 120 Jëf**, **Priorité Wecci · 30 Jëf** →
   feuille `Sheet` de confirmation → toast.
3. **Gain** : toast in-app après la surcouche « Deal confirmé » (« +20 Jëf, disponibles le
   17 nov. ») ; jamais de push.
4. **Profil public** (`u/[handle].tsx`, `/[handle]` web) : niveau + deals + échanges + note +
   garants ; jamais le solde.
5. **Admin** (`apps/web/src/app/admin`, existe) : historique Jëf d'un membre (staff), liens de
   comptes, reprise manuelle.

### 4.3 Delta du modèle de données + RLS

Grand livre `jef_ledger`, enum `jef_reason`, vue `my_jef_balance`, trigger append-only :
`IDENTITY.md` §3.5. En plus :

```sql
create table public.boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  kind text not null check (kind in ('boost_24h', 'a_la_une', 'swap_priority')),
  aisle_slug text,                              -- obligatoire pour a_la_une
  paid_with text not null check (paid_with in ('jef', 'fcfa')),
  ledger_id bigint references public.jef_ledger (id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  check ((paid_with = 'jef') = (ledger_id is not null))
);
alter table public.boosts enable row level security;
create policy boosts_own on public.boosts for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.boosts from anon, authenticated;
grant select on public.boosts to authenticated;
-- Les fils / Explorer lisent les boosts actifs via les RPC de classement existantes
-- (explore_products, browse_products, feed) en SECURITY DEFINER, avec étiquette « Mis en avant ».

create table private.account_links (                 -- jamais exposé au client
  user_a uuid not null, user_b uuid not null,
  source text not null check (source in ('push_token', 'graph_concentration', 'twin_accounts', 'staff')),
  strength text not null check (strength in ('strong', 'probable')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b, source), check (user_a < user_b)
);
create table private.push_token_history (
  token_hash text not null, user_id uuid not null, first_seen_at timestamptz not null default now(),
  primary key (token_hash, user_id)
);
-- register_push_token (remplacée) insère digest(token) dans l'historique.
-- private.accounts_linked(a, b) returns boolean ; revoke execute from public, anon, authenticated.

-- Gains : private.jef_award(p_user, p_reason, p_amount, p_ref_type, p_ref_id, p_key, p_available_at)
--   applique plafonds jour / semaine, insère avec on conflict (idempotency_key) do nothing.
-- Déclencheurs : after update of status on agreements (-> completed) ; after insert on reviews ;
--   pg_cron nocturne pour fast_reply et seek_answer_deal ; pg_cron nocturne pour les liens
--   de graphe et les niveaux (profiles.seller_level, deals_completed_count, swaps_completed_count).
-- Reprise : after update of status on reports (-> actioned) => private.jef_clawback_for(target).
-- Dépense : public.jef_spend(p_item text, p_product_id uuid, p_aisle text) returns uuid
--   require_user ; flag jef_spend ; annonce à soi, active, modération active ;
--   advisory lock ; solde disponible ≥ coût (jef_insufficient) ; règles (boost_active, slot_full) ;
--   insert ledger négatif puis boosts.
alter table public.profiles
  add column seller_level smallint not null default 1 check (seller_level between 1 and 4),
  add column deals_completed_count integer not null default 0,
  add column swaps_completed_count integer not null default 0;
-- Ces colonnes ne reçoivent aucune permission update client (comme rating_sum aujourd'hui).
```

Flags : `jef_ledger` (gains), `jef_spend` (dépenses), séparés pour pouvoir accumuler sans
encore dépenser.

### 4.4 Notifications

`jef_clawback` (in-app + push : « 20 Jëf ont été repris après un signalement. Voir
pourquoi. »). Aucune notification pour les gains, les dépenses ou les niveaux (toast / écran).

### 4.5 Abus et parades

| Abus | Parade |
|---|---|
| Deals fictifs entre deux comptes | Comptes liés, 1 deal payé / partenaire / 30 j, délai 30 min, plafonds, délai de garde 72 h, reprise |
| Double dépense par requêtes concurrentes | `pg_advisory_xact_lock` par membre dans `jef_spend` |
| Rejeu d'un événement | `idempotency_key` unique |
| Modification du grand livre par un admin | Trigger append-only (y compris `service_role`) ; corrections par lignes `admin_adjustment` auditées (`private.audit`, existe) |
| Revente de comptes « riches » | Solde privé, non transférable, niveau lié à des deals réels ; changement de numéro / reprise de compte → modération |
| Réponses « rapides » vides pour farmer | `fast_reply` exige que l'autre ait écrit en premier dans une conversation qu'il a ouverte ; 5 / jour ; calcul nocturne |
| Inonder les « Je cherche » pour le bonus | Le bonus exige un accord `completed` avec l'auteur |
| Boost d'un article interdit | Contrôle `moderation_status` ; masquage = remboursement automatique et fin du boost |

### 4.6 Tests d'acceptation

| ID | Parcours | Preuve requise |
|---|---|---|
| JEF-01 | Gain sur deal | Accord `completed` entre deux comptes non liés → +20 chacun, `available_at` = +72 h ; rejouer le trigger → aucune 2e ligne |
| JEF-02 | Pas de gain pour publier | Publier 10 posts et 10 annonces → aucune ligne dans `jef_ledger` |
| JEF-03 | Plafonds | 4 deals le même jour → le 4e enregistré sans gain (ou montant réduit) et message « limite du jour » ; 2e deal avec le même partenaire < 30 j → 0 |
| JEF-04 | Comptes liés | Deux comptes avec le même jeton push dans l'historique → aucun gain sur leur deal, entrée dans `account_links` |
| JEF-05 | Append-only | `update` / `delete` / `truncate` sur `jef_ledger` refusés pour `authenticated` **et** `service_role` (`jef_ledger_append_only`) ; insert client refusé |
| JEF-06 | Dépense | Boost à 50 Jëf avec 49 disponibles → `jef_insufficient` ; avec 50 → boost actif 24 h, étiquette « Mis en avant » visible pour un autre compte ; 2e boost simultané → `boost_active` ; 10 appels concurrents → un seul débit |
| JEF-07 | Reprise | Signalement d'accord passé à `actioned` → ligne `clawback` négative, solde éventuellement négatif, dépense bloquée, notification `jef_clawback` |
| JEF-08 | Visibilité | Un autre compte (et `anon`) ne lit ni `jef_ledger` ni `my_jef_balance` d'autrui ; le profil public montre niveau + compteurs, pas de solde |
| JEF-09 | Pas de transfert | Aucune RPC ni permission ne permet d'écrire des Jëf pour un autre membre (revue de la liste des fonctions exposées dans `01-identity.test.ts`) |

### 4.7 Estimations

| Élément | Taille |
|---|---|
| Grand livre, vue, triggers append-only, `jef_award`, plafonds | M |
| Déclencheurs de gains (accords, avis) + job nocturne (fast_reply, seek, niveaux) | M |
| Comptes liés (historique jetons, graphe, admin) | M |
| Dépenses + boosts dans le classement Explorer / fil | L |
| Reprise + intégration modération / appels | S |
| Écran Jëf + toasts + profil public | M |
| **Sous-total Jëf** | **≈ 23–37 j** |

### Total général

| Pilier | Estimation |
|---|---|
| Wecci | 25–37 j |
| Waxaale | 14–22 j |
| Boutique | 9–15 j |
| Jëf | 23–37 j |
| Rituels (3 flags, `ritual_windows`, bandeaux, crons) | 5–8 j |
| Modèles vidéo + validation des libellés wolof | 4–6 j |
| **Total** | **≈ 80–125 jours·dev** (≈ 4–6 mois pour une personne ; ordre conseillé : Waxaale → Wecci (Allées, Donner) → Jëf gains → Boutique → Jëf dépenses → J'ai / Je veux → rituels) |

---

## 5. Modèle économique

### 5.1 Gratuit pour toujours

Publier (posts, statuts, annonces), discuter, Waxaale (offres, contre-offres, accords,
réservation, remise, avis), Wecci pour les particuliers (vendre, troquer, chercher, donner,
J'ai / Je veux), boutique automatique, lien et carte de statut WhatsApp, Jëf et tout ce qu'ils
permettent. Aucun paiement pour publier (`PRODUCT_SPEC.md` : « not pay-to-post »).

### 5.2 Payant (plus tard) — prix **hypothèses à tester**

| Offre | Contenu | Prix proposé (F CFA) — **hypothèse à tester** |
|---|---|---|
| **Boost** 24 h | Même emplacement que le boost Jëf, compteur séparé, étiquette « Sponsorisé » | 300 – 500 F |
| **Boost** 7 jours | Idem, 7 j | 1 500 – 2 500 F |
| **Pro** mensuel | Statistiques détaillées, réponses rapides, collections mises en avant, export catalogue, 2 boosts 24 h inclus | 2 500 – 5 000 F / mois |
| **Pro** annuel | Idem | 25 000 – 45 000 F / an |

Paiement via un **agrégateur agréé** (Wave / Orange Money / carte) à choisir plus tard, avec
validation de l'owner (aucun service payant créé sans son accord) ; confirmation uniquement par
webhook signé côté serveur (Edge Function), jamais par l'app. Payer ne crédite **jamais** de Jëf
et ne change ni le niveau ni la note.

### 5.3 Déclencheur : pas de paiement avant une vraie activité

On n'ouvre la vente de Boost / Pro qu'après **4 semaines consécutives avec au moins 150
conversations qualifiées par semaine** sur le projet de production. Par vendeur, l'offre Pro
n'est montrée qu'à ceux qui ont eu **≥ 10 conversations qualifiées par semaine pendant 3
semaines**.

**Conversation qualifiée** (mesurable avec les tables existantes, sans lire aucun contenu,
comme `PILOT_METRICS.md` §3) : une `conversations` dont les deux membres sont actifs, non DÉMO,
non staff, non liés, non bloqués, et qui a reçu dans la semaine **au moins un message de chaque
membre** (`messages.sender_id`, `deleted_at is null`), et dont au moins un message porte un
`product_id` **ou** qui contient une `offers`.

```sql
begin read only;
with members as (
  select p.id from public.profiles p join auth.users u on u.id = p.id
  where not p.is_demo and p.status = 'active' and u.email not like '%.test'
    and not exists (select 1 from public.staff_roles s where s.user_id = p.id)
),
week_msgs as (
  select g.conversation_id, date_trunc('week', g.created_at)::date as week,
         count(distinct g.sender_id) as speakers, bool_or(g.product_id is not null) as about_product
  from public.messages g
  where g.deleted_at is null and g.sender_id in (select id from members)
  group by 1, 2
)
select w.week, count(*) as qualified_conversations
from week_msgs w
where w.speakers = 2
  and (w.about_product or exists (select 1 from public.offers o where o.conversation_id = w.conversation_id))
group by 1 order by 1;
commit;
```

(Exclusion des comptes liés à ajouter quand `private.account_links` existe.)

### 5.4 Événements de revenu à mesurer (proposés)

Table `private.revenue_events (id, user_id, event, ref_id, amount_xof, created_at)`, écrite
uniquement par les Edge Functions / RPC serveur, aucun SDK de traçage :

`paywall_viewed`, `boost_checkout_started`, `boost_payment_succeeded`, `boost_payment_failed`,
`boost_started`, `boost_ended`, `boost_contact` (conversation ouverte depuis une annonce
boostée), `pro_offer_shown`, `pro_checkout_started`, `pro_subscription_activated`,
`pro_subscription_renewed`, `pro_subscription_canceled`, `pro_subscription_expired`,
`payment_refunded`, `pilot_pro_granted`. Indicateurs : taux de conversion paywall → paiement,
revenu par vendeur actif, conversations par boost payant vs boost Jëf, churn Pro mensuel.

### 5.5 Pourquoi les Jëf restent hors de la réglementation de la monnaie électronique

Dans l'UEMOA, l'émission de monnaie électronique est encadrée par la BCEAO (régime des
établissements de monnaie électronique). Une valeur monétaire stockée y suppose en substance une
**remise de fonds** en contrepartie, une **acceptation comme moyen de paiement** par des tiers et
un **remboursement** possible. Les Jëf n'ont aucune de ces caractéristiques, par construction :

1. **Jamais achetés** : aucun flux d'argent ne crée de Jëf (le paiement de Boost / Pro ne crédite
   pas de Jëf ; deux compteurs séparés).
2. **Jamais remboursables ni convertibles** en F CFA, biens ou services hors Jëfëli.
3. **Jamais transférables** entre membres (aucune RPC, aucune permission).
4. **Utilisables uniquement** pour de la visibilité interne fournie par Jëfëli lui-même, jamais
   chez un tiers.
5. **Aucune valeur affichée en argent** ; les CGU (`legal/cgu`) devront le dire, et prévoir que
   Jëfëli peut modifier ou reprendre les Jëf.

Ce sont des points de fidélité / réputation, comparables à des points de jeu non monnayables.
**À faire confirmer par un juriste sénégalais avant le lancement du payant** ; toute évolution
(achat, transfert, cadeau entre membres, conversion) ferait sortir de ce cadre et est exclue.
