import { supabase, unwrap } from '../supabase';
import type { AgreementRow, OfferRow } from '../types';

export async function makeOffer(args: {
  productId: string;
  kind: 'price' | 'barter';
  amount: number;
  offeredProductId?: string | null;
  cashPayer?: 'buyer' | 'seller' | null;
  message?: string;
}): Promise<string> {
  return unwrap(
    await supabase.rpc('make_offer', {
      p_product_id: args.productId,
      p_kind: args.kind,
      p_amount_xof: args.amount,
      p_offered_product_id: args.offeredProductId ?? undefined,
      p_cash_payer: args.cashPayer ?? undefined,
      p_message: args.message ?? '',
    }),
  ) as string;
}

export async function counterOffer(args: {
  offerId: string;
  amount: number;
  offeredProductId?: string | null;
  cashPayer?: 'buyer' | 'seller' | null;
  message?: string;
}): Promise<string> {
  return unwrap(
    await supabase.rpc('counter_offer', {
      p_offer_id: args.offerId,
      p_amount_xof: args.amount,
      p_offered_product_id: args.offeredProductId ?? undefined,
      p_cash_payer: args.cashPayer ?? undefined,
      p_message: args.message ?? '',
    }),
  ) as string;
}

export async function respondOffer(offerId: string, accept: boolean): Promise<string | null> {
  return unwrap(await supabase.rpc('respond_offer', { p_offer_id: offerId, p_accept: accept })) as string | null;
}

export async function withdrawOffer(offerId: string) {
  unwrap(await supabase.rpc('withdraw_offer', { p_offer_id: offerId }));
}

export async function fetchOffer(id: string): Promise<OfferRow | null> {
  return unwrap(await supabase.from('offers').select('*').eq('id', id).maybeSingle());
}

export async function fetchAgreement(id: string): Promise<AgreementRow | null> {
  return unwrap(await supabase.from('agreements').select('*').eq('id', id).maybeSingle());
}

export async function fetchMyAgreements(userId: string): Promise<AgreementRow[]> {
  return unwrap(
    await supabase.from('agreements').select('*').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),
  );
}

export async function confirmAgreementCompleted(id: string): Promise<string> {
  return unwrap(await supabase.rpc('confirm_agreement_completed', { p_agreement_id: id })) as string;
}

export async function closeAgreement(id: string, outcome: 'canceled' | 'disputed', reason: string) {
  unwrap(await supabase.rpc('close_agreement', { p_agreement_id: id, p_outcome: outcome, p_reason: reason }));
}

export async function leaveReview(agreementId: string, rating: number, body: string) {
  return unwrap(await supabase.rpc('leave_review', { p_agreement_id: agreementId, p_rating: rating, p_body: body }));
}

export async function myReviewFor(agreementId: string, userId: string) {
  return unwrap(await supabase.from('reviews').select('id, rating, body').eq('agreement_id', agreementId).eq('reviewer_id', userId).maybeSingle());
}

export async function fetchReviews(revieweeId: string) {
  return unwrap(
    await supabase
      .from('reviews')
      .select('id, rating, body, created_at, reviewer:profiles!reviews_reviewer_id_fkey(id, handle, display_name, avatar_path, verification_level, is_demo, city)')
      .eq('reviewee_id', revieweeId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
}
