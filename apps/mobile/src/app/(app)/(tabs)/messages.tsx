/**
 * Messages tab. Phones: the conversation list (Lovable inbox on Atlantic night). Desktop web
 * (W1.4): the Messages workspace (list · thread · context), no conversation open yet.
 */
import { ConversationList } from '@/components/chat/ConversationList';
import { MessagesWorkspace } from '@/components/chat/MessagesWorkspace';
import { useLayout } from '@/lib/layout';
import { useDarkStatusBar } from '@/lib/statusBar';

export default function Messages() {
  useDarkStatusBar();
  const { desktop } = useLayout();
  if (desktop) return <MessagesWorkspace activeId={null} />;
  return <ConversationList />;
}
