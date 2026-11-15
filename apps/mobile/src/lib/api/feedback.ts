import { supabase } from '../supabase';

export type FeedbackKind = 'problem' | 'idea' | 'unclear' | 'other';

/** Sends a feedback message to the team. Nothing is read back: only staff can read feedback. */
export async function sendFeedback(input: { kind: FeedbackKind; message: string; platform: 'web' | 'ios' | 'android' }): Promise<void> {
  const { error } = await supabase.from('feedback').insert({ kind: input.kind, message: input.message, platform: input.platform });
  if (error) throw error;
}
