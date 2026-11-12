/**
 * A conversation. Phones: the full-screen thread. Desktop web (W1.4): the Messages workspace
 * with this conversation open (list · thread · context).
 */
import { useLocalSearchParams } from 'expo-router';

import { ChatView } from '@/components/chat/ChatView';
import { MessagesWorkspace } from '@/components/chat/MessagesWorkspace';
import { useLayout } from '@/lib/layout';

export default function ChatScreen() {
  const { id, about } = useLocalSearchParams<{ id: string; about?: string }>();
  const { desktop } = useLayout();
  if (desktop) return <MessagesWorkspace activeId={id ?? null} about={about} />;
  return <ChatView id={id ?? ''} aboutParam={about} />;
}
