import { fetchLatestConversationProductId, messageAboutProduct, sendProductCard } from './api/messages';
import { replyToStory } from './api/stories';

/** Quick reactions of the status viewer (P2). Each one is a private reply to the status. */
export const QUICK_REACTIONS = ['❤️', '🔥', '😍', '👏'] as const;

/**
 * Opens the conversation about an article with the item card attached (once: the card is not sent
 * again when the latest article of the conversation is already this one). A reaction goes through
 * the status reply, so it arrives in the same private conversation as any reply to that status.
 */
export async function openProductChat(userId: string, productId: string, opts: { storyId?: string; text?: string } = {}): Promise<string> {
  const cid = opts.storyId && opts.text ? await replyToStory(opts.storyId, opts.text) : await messageAboutProduct(productId);
  const latest = await fetchLatestConversationProductId(cid).catch(() => null);
  if (latest !== productId) await sendProductCard(userId, cid, productId);
  return cid;
}
