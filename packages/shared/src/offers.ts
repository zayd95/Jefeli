/**
 * Pure helpers describing offers/agreements for UI (mirrors DB rules; DB is authoritative).
 */
import { formatXOF } from './format';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';
export type CashPayer = 'buyer' | 'seller' | null;

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  countered: 'Contre-proposition faite',
  withdrawn: 'Retirée',
  expired: 'Expirée',
};

export const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  agreed: 'Accord conclu',
  completed: 'Échange déclaré terminé',
  canceled: 'Accord annulé',
  disputed: 'Litige signalé',
};

/**
 * Describe the cash difference of a barter from the viewer's perspective.
 * cash_payer = 'buyer' means the member who proposed the trade for the listing pays.
 */
export function describeCashDifference(
  amount: number | null | undefined,
  cashPayer: CashPayer,
  viewerIsBuyer: boolean,
): string {
  if (!amount || !cashPayer) return 'Échange sans différence';
  const viewerPays = (cashPayer === 'buyer') === viewerIsBuyer;
  return viewerPays ? `Vous ajoutez ${formatXOF(amount)}` : `Vous recevez ${formatXOF(amount)}`;
}

export function signedDifferenceLabel(amount: number | null | undefined, cashPayer: CashPayer): string {
  if (!amount || !cashPayer) return 'Différence : aucune';
  return `Différence : ${cashPayer === 'buyer' ? '+' : '−'}${formatXOF(amount)}`;
}

export function canRespond(offer: { status: string; recipient_id: string; expires_at: string }, viewerId: string, now = new Date()): boolean {
  return offer.status === 'pending' && offer.recipient_id === viewerId && new Date(offer.expires_at) > now;
}

export function canWithdraw(offer: { status: string; proposer_id: string }, viewerId: string): boolean {
  return offer.status === 'pending' && offer.proposer_id === viewerId;
}

export const PLATFORM_DISCLAIMER =
  'Jëfëli ne détient aucun fonds et ne garantit ni le paiement, ni la livraison, ni l’état des articles. Rencontrez-vous dans un lieu public et vérifiez l’article avant de payer.';
