/**
 * French UI vocabulary for domain enums. Keep copy short and locally natural.
 */
import type { Database } from './database.types';

type Enums = Database['public']['Enums'];
export type ItemCondition = Enums['item_condition'];
export type ListingMode = Enums['listing_mode'];
export type ProductStatus = Enums['product_status'];
export type ModerationState = Enums['moderation_state'];
export type Audience = 'public' | 'followers' | 'friends';

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'Neuf',
  like_new: 'Comme neuf',
  very_good: 'Très bon état',
  good: 'Bon état',
  fair: 'État correct',
  refurbished: 'Reconditionné',
};

export const CONDITION_OPTIONS: ItemCondition[] = ['new', 'like_new', 'very_good', 'good', 'fair', 'refurbished'];

export const LISTING_MODE_LABELS: Record<ListingMode, string> = {
  sale: 'À vendre',
  trade: 'À échanger',
  sale_or_trade: 'Vente ou troc',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Disponible',
  reserved: 'Réservé',
  sold: 'Vendu',
  archived: 'Archivé',
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  public: 'Tout le monde',
  followers: 'Mes abonnés',
  friends: 'Mes amis',
};

export const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Remise en main propre',
  delivery: 'Livraison locale',
  shipping: 'Envoi (autre ville)',
};

export const FEED_TABS = [
  { key: 'for_you', label: 'Pour toi' },
  { key: 'following', label: 'Abonnements' },
  { key: 'nearby', label: 'À proximité' },
  { key: 'live', label: 'Live' },
  { key: 'occasions', label: 'Occasions' },
  { key: 'troc', label: 'Troc' },
] as const;
export type FeedTab = (typeof FEED_TABS)[number]['key'];

/** Why a post is in "Pour toi" — explainable ranking, shown discreetly. */
export const FEED_REASON_LABELS: Record<string, string | null> = {
  self: null,
  friend: 'Ami',
  following: null,
  nearby: 'Près de toi',
  interest: 'Selon tes centres d’intérêt',
  needs_answers: 'Attend vos réponses',
  popular: 'Apprécié par la communauté',
  new_seller: 'Nouveau sur Jëfëli',
  discover: 'À découvrir',
};

/**
 * Publication intents: labels on ordinary posts (same media, comments and messages), not
 * separate marketplaces. `share` is the default and is not labelled on cards.
 */
export type PostIntent = 'share' | 'seek' | 'offer' | 'opinion';
export const POST_INTENTS: { key: PostIntent; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'share',
    label: 'Je partage',
    hint: 'Un arrivage, une photo, une nouvelle de votre boutique.',
    placeholder: 'Quoi de neuf ? Un arrivage, une bonne affaire, une pensée…',
  },
  {
    key: 'seek',
    label: 'Je cherche',
    hint: 'Un article, un service, une adresse : la communauté peut vous aider.',
    placeholder: 'Que cherchez-vous ? Ex. : je cherche un tailleur vers Mermoz pour un boubou de fête.',
  },
  {
    key: 'offer',
    label: 'Je propose',
    hint: 'Un service, un savoir-faire ou un article à proposer.',
    placeholder: 'Que proposez-vous ? Ex. : retouches à domicile à Dakar, devis gratuit.',
  },
  {
    key: 'opinion',
    label: 'Votre avis ?',
    hint: 'Une question, une recommandation, un conseil à demander.',
    placeholder: 'Votre question ? Ex. : quel téléphone choisir à moins de 100 000 F ?',
  },
];
export const INTENT_LABELS: Record<PostIntent, string> = {
  share: 'Je partage',
  seek: 'Je cherche',
  offer: 'Je propose',
  opinion: 'Votre avis ?',
};
export function isPostIntent(v: unknown): v is PostIntent {
  return v === 'share' || v === 'seek' || v === 'offer' || v === 'opinion';
}

export const REPORT_REASONS = [
  { key: 'scam', label: 'Arnaque ou fraude' },
  { key: 'prohibited_item', label: 'Article interdit' },
  { key: 'counterfeit', label: 'Contrefaçon' },
  { key: 'spam', label: 'Spam ou publicité abusive' },
  { key: 'harassment', label: 'Harcèlement ou intimidation' },
  { key: 'hate', label: 'Propos haineux' },
  { key: 'nudity', label: 'Nudité ou contenu sexuel' },
  { key: 'violence', label: 'Violence ou menace' },
  { key: 'minor_safety', label: 'Sécurité d’un mineur' },
  { key: 'impersonation', label: 'Usurpation d’identité' },
  { key: 'other', label: 'Autre raison' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

export const DAKAR_AREAS = [
  'Plateau', 'Médina', 'Fann', 'Point E', 'Mermoz', 'Sacré-Cœur', 'Liberté', 'HLM', 'Grand Dakar',
  'Ouakam', 'Ngor', 'Yoff', 'Almadies', 'Parcelles Assainies', 'Grand Yoff', 'Sicap', 'Castors',
  'Colobane', 'Hann', 'Pikine', 'Guédiawaye', 'Thiaroye', 'Keur Massar', 'Rufisque',
];

export const SENEGAL_CITIES = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Touba', 'Mbour', 'Kaolack', 'Ziguinchor', 'Rufisque',
  'Diourbel', 'Louga', 'Tambacounda', 'Kolda', 'Fatick', 'Kaffrine', 'Matam', 'Sédhiou', 'Kédougou',
];

export const NOTIFICATION_COPY: Record<string, (actor: string, data: Record<string, unknown>) => string> = {
  follow: (a) => `${a} s’est abonné(e) à vous`,
  follow_request: (a) => `${a} souhaite vous suivre`,
  follow_accepted: (a) => `${a} a accepté votre demande d’abonnement`,
  friend_request: (a) => `${a} vous a envoyé une demande d’ami`,
  friend_accepted: (a) => `${a} et vous êtes maintenant amis`,
  post_upvote: (a) => `${a} a voté pour votre publication`,
  post_comment: (a, d) => `${a} a commenté : « ${String(d.excerpt ?? '')} »`,
  comment_reply: (a, d) => `${a} a répondu : « ${String(d.excerpt ?? '')} »`,
  message: (a) => `Nouveau message de ${a}`,
  story_reply: (a) => `${a} a répondu à votre statut`,
  story_like: (a) => `${a} a aimé votre statut`,
  offer_received: (a, d) => `${a} vous fait une proposition pour « ${String(d.product_title ?? 'votre article')} »`,
  offer_countered: (a) => `${a} a fait une contre-proposition`,
  offer_accepted: (a) => `${a} a accepté votre proposition`,
  offer_rejected: (a) => `${a} a refusé votre proposition`,
  offer_withdrawn: (a) => `${a} a retiré sa proposition`,
  agreement_completed: (a) => `Échange déclaré terminé avec ${a}`,
  agreement_canceled: (a) => `${a} a annulé l’accord`,
  agreement_disputed: (a) => `${a} a signalé un litige sur votre accord`,
  review_received: (a, d) => `${a} vous a laissé un avis (${String(d.rating ?? '')}/5)`,
  live_started: (a) => `${a} est en direct maintenant`,
  moderation_action: () => `L’équipe de modération a pris une mesure sur votre contenu`,
  report_resolved: () => `Votre signalement a été traité. Merci.`,
  verification_result: (_a, d) =>
    d.approved ? 'Votre demande de vérification vendeur a été acceptée' : 'Votre demande de vérification vendeur a été refusée',
  appeal_result: (_a, d) =>
    d.outcome === 'reversed' ? 'Votre contestation a été acceptée' : 'Votre contestation a été examinée : la décision est maintenue',
};

/** How a seller chooses to show the price of a listing. Ordinary posts never have a price. */
export const PRICE_MODES: { key: 'fixed' | 'on_request' | 'negotiable'; label: string; hint: string }[] = [
  { key: 'fixed', label: 'Prix affiché', hint: 'Le prix est visible sur l’annonce.' },
  { key: 'on_request', label: 'Prix sur demande', hint: 'Les acheteurs vous écrivent pour connaître le prix.' },
  { key: 'negotiable', label: 'À discuter', hint: 'Indiquez un prix de départ si vous le souhaitez.' },
];
