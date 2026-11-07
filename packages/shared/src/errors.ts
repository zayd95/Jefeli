/**
 * Maps machine error keys raised by the database (RAISE EXCEPTION '<key>') and common
 * Supabase Auth errors to French, user-facing copy.
 */
const DB_ERRORS: Record<string, string> = {
  not_authenticated: 'Connectez-vous pour continuer.',
  account_suspended: 'Votre compte est suspendu. Vous pouvez contester la décision depuis vos réglages.',
  rate_limited: 'Vous allez un peu vite. Réessayez dans quelques instants.',
  blocked: 'Action impossible : un blocage existe entre vous et ce membre.',
  not_found: 'Ce contenu n’est plus disponible.',
  not_allowed: 'Vous n’avez pas l’autorisation de faire cela.',
  invalid_target: 'Action impossible sur ce contenu.',
  invalid_transition: 'Cette action n’est plus possible : la situation a changé.',
  handle_reserved: 'Ce nom d’utilisateur est réservé.',
  prohibited_item: 'Cet article fait partie des produits interdits sur Jëfëli.',
  media_required: 'Ajoutez au moins une photo ou une vidéo.',
  media_not_found: 'Un fichier n’a pas été envoyé correctement. Réessayez l’envoi.',
  too_many_media: 'Maximum 10 photos ou vidéos.',
  invalid_media: 'Format de fichier non pris en charge.',
  video_too_long: 'Vidéo trop longue : 3 minutes maximum.',
  video_duration_required: 'Durée de la vidéo illisible. Essayez avec une autre vidéo.',
  audio_too_long: 'Enregistrement trop long : 3 minutes maximum.',
  too_many_audio: 'Une seule voix par publication.',
  audio_with_video: 'La vidéo garde son propre son : retirez la voix ou la vidéo.',
  invalid_cues: 'La visite guidée ne correspond plus aux photos. Réenregistrez la voix.',
  invalid_reference: 'Cette publication n’est plus disponible.',
  audience_wider_than_post: 'Ce statut ne peut pas être plus visible que la publication partagée.',
  caption_too_long: 'Légende trop longue : 200 caractères maximum.',
  empty_post: 'Écrivez quelque chose ou ajoutez une photo.',
  empty_message: 'Le message est vide.',
  invalid_visibility: 'Choisissez qui peut voir ce contenu.',
  invalid_product: 'Cet article ne peut pas être utilisé ici.',
  invalid_collection: 'Collection introuvable.',
  own_product: 'C’est votre propre article.',
  product_unavailable: 'Cet article n’est plus disponible.',
  not_for_sale: 'Cet article est proposé uniquement à l’échange.',
  not_for_trade: 'Ce vendeur n’accepte pas le troc pour cet article.',
  invalid_amount: 'Montant invalide.',
  invalid_offered_product: 'Choisissez un de vos articles disponibles à proposer.',
  invalid_cash_payer: 'Indiquez qui paie la différence.',
  offer_pending: 'Vous avez déjà une proposition en attente pour cet article.',
  offer_expired: 'Cette proposition a expiré.',
  messages_restricted: 'Ce membre n’accepte pas les messages de tout le monde.',
  attachment_required: 'Pièce jointe manquante.',
  agreement_terms_immutable: 'Les termes d’un accord ne peuvent pas être modifiés.',
  review_not_allowed: 'Un avis n’est possible qu’après un échange déclaré terminé par les deux membres.',
  already_reviewed: 'Vous avez déjà laissé un avis pour cet échange.',
  invalid_rating: 'Choisissez une note entre 1 et 5.',
  invalid_parent: 'Impossible de répondre à ce commentaire.',
  live_not_active: 'Ce live n’est pas en cours.',
  muted_in_live: 'L’hôte a désactivé vos commentaires pour ce live.',
  already_appealed: 'Vous avez déjà contesté cette décision.',
  already_friends: 'Vous êtes déjà amis.',
  provider_not_configured: 'Le direct n’est pas encore activé sur Jëfëli.',
  invalid_vote: 'Vote invalide.',
  own_post_vote: 'Vous ne pouvez pas voter pour votre propre publication.',
  invalid_intent: 'Choisissez le type de publication.',
  empty_request: 'Décrivez en quelques mots ce que vous cherchez ou votre question.',
  price_required: 'Indiquez un prix, ou choisissez « Prix sur demande » ou « À discuter ».',
  invalid_price_mode: 'Choisissez comment afficher le prix.',
  pin_limit: 'Vous pouvez épingler 3 éléments au maximum. Retirez-en un d’abord.',
};

const AUTH_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/user already registered/i, 'Un compte existe déjà avec cet e-mail.'],
  [/password should be at least/i, 'Le mot de passe doit contenir au moins 8 caractères.'],
  [/should be different from the old password/i, 'Choisissez un mot de passe différent de l’ancien.'],
  [/email not confirmed/i, 'Confirmez votre e-mail avant de vous connecter.'],
  [/rate limit|too many requests/i, 'Trop de tentatives. Réessayez dans quelques minutes.'],
  [/invalid.*(otp|token)|token has expired/i, 'Code invalide ou expiré.'],
  [/unable to validate email|invalid email/i, 'Adresse e-mail invalide.'],
  [/duplicate key value.*handle|profiles_handle_key/i, 'Ce nom d’utilisateur est déjà pris.'],
  [/network request failed|failed to fetch|fetch failed|network error/i, 'Connexion impossible. Vérifiez votre réseau et réessayez.'],
];

export function errorKey(err: unknown): string | null {
  const msg = errorMessageRaw(err);
  if (!msg) return null;
  const key = msg.trim().split(/\s/)[0] ?? '';
  return key in DB_ERRORS ? key : null;
}

function errorMessageRaw(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message ?? '');
  }
  return String(err);
}

/** French message for any error coming from Supabase / fetch / our RPCs. */
/** Table checks whose violation deserves a precise message (matched on the constraint name). */
const CONSTRAINT_ERRORS: [string, string][] = [
  // Two taps in the same instant: the unique index (not the RPC check) rejects the second one.
  ['offers_one_pending_per_pair', 'Vous avez déjà une proposition en attente pour cet article.'],
  ['feedback_message_length', 'Écrivez entre 3 et 1 000 caractères.'],
  ['profiles_boutique_identity_required', 'Pour être affiché comme vendeur, indiquez le nom et la catégorie de votre boutique.'],
  ['profiles_boutique_name_length', 'Le nom de la boutique doit compter entre 2 et 60 caractères.'],
];

export function toFrenchError(err: unknown, fallback = 'Une erreur est survenue. Réessayez.'): string {
  const msg = errorMessageRaw(err);
  if (!msg) return fallback;
  const key = errorKey(err);
  if (key) return DB_ERRORS[key] ?? fallback;
  for (const [re, fr] of AUTH_ERRORS) if (re.test(msg)) return fr;
  for (const [name, fr] of CONSTRAINT_ERRORS) if (msg.includes(name)) return fr;
  if (/check constraint|violates/i.test(msg)) return 'Certaines informations sont invalides. Vérifiez le formulaire.';
  return fallback;
}
