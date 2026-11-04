import { REPORT_REASONS, toFrenchError } from '@jefeli/shared';

export type StaffRole = 'admin' | 'moderator';

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrateur',
  moderator: 'Modérateur',
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  profile: 'Profil',
  post: 'Publication',
  comment: 'Commentaire',
  product: 'Article',
  story: 'Statut',
  message: 'Message privé',
  live_session: 'Live',
  live_comment: 'Commentaire de live',
  agreement: 'Accord',
  review: 'Avis',
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  ...Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label])),
  dispute: 'Litige sur un accord',
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Nouveau',
  in_review: 'En cours',
  actioned: 'Traité',
  dismissed: 'Classé sans suite',
};

export const MODERATION_ACTION_LABELS: Record<string, string> = {
  hide_content: 'Masquer le contenu',
  remove_content: 'Supprimer le contenu',
  restore_content: 'Rétablir le contenu',
  suspend_user: 'Suspendre le compte',
  unsuspend_user: 'Réactiver le compte',
  warn_user: 'Avertir le membre',
  dismiss_report: 'Classer sans suite',
  grant_verification: 'Accorder la vérification',
  revoke_verification: 'Retirer la vérification',
  reverse_on_appeal: 'Décision annulée (contestation)',
};

export const MODERATION_STATE_LABELS: Record<string, string> = {
  active: 'Visible',
  hidden: 'Masqué',
  removed: 'Supprimé',
};

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  boutique: 'Boutique',
  marche: 'Commerçant de marché',
  artisan: 'Artisan',
  entreprise: 'Entreprise',
  autre: 'Autre',
};

export const APPEAL_STATUS_LABELS: Record<string, string> = {
  open: 'À examiner',
  upheld: 'Décision maintenue',
  reversed: 'Décision annulée',
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Acceptée',
  rejected: 'Refusée',
};

/** Content types whose visibility can be changed by hide/remove/restore. */
export const CONTENT_TYPES = new Set(['post', 'comment', 'product', 'story', 'live_session', 'live_comment', 'review', 'message']);

/** Table + state column for reading the current moderation state of a target (staff RLS). */
export const TARGET_TABLES: Record<string, { table: string; column: string }> = {
  post: { table: 'posts', column: 'moderation_status' },
  comment: { table: 'comments', column: 'moderation_status' },
  product: { table: 'products', column: 'moderation_status' },
  story: { table: 'stories', column: 'moderation_status' },
  live_session: { table: 'live_sessions', column: 'moderation_status' },
  live_comment: { table: 'live_comments', column: 'moderation_status' },
  review: { table: 'reviews', column: 'moderation_status' },
};

/** Public page for a target, when one exists. */
export function publicPath(targetType: string, targetId: string, ownerHandle?: string | null): string | null {
  switch (targetType) {
    case 'product':
      return `/p/${targetId}`;
    case 'post':
      return `/post/${targetId}`;
    case 'live_session':
      return `/live/${targetId}`;
    case 'profile':
      return ownerHandle ? `/${ownerHandle}` : null;
    default:
      return null;
  }
}

const ADMIN_ERRORS: Record<string, string> = {
  invalid_action: 'Action inconnue.',
  invalid_target: 'Cette action n’est pas possible sur ce type de contenu.',
};

/** toFrenchError + a few staff-only keys. */
export function adminError(err: unknown): string {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  const key = msg.trim().split(/\s/)[0] ?? '';
  if (key in ADMIN_ERRORS) return ADMIN_ERRORS[key]!;
  return toFrenchError(err);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-SN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Dakar',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}
