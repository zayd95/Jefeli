/**
 * Desktop Messages workspace (W1.4, web ≥ 768 px): conversations · thread · context.
 * The context pane (article, offers, safety) appears only when there is room for it
 * (≥ 1100 px of workspace) and collapses otherwise. Everything inside is the same
 * conversation code the phone uses.
 */
import { MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dark, EmptyState } from '@/design';

import { ChatContext } from './ChatContext';
import { ChatView } from './ChatView';
import { ConversationList } from './ConversationList';

export function MessagesWorkspace({ activeId, about }: { activeId: string | null; about?: string }) {
  const [width, setWidth] = useState(1200);
  const showContext = !!activeId && width >= 1100;
  const listWidth = width >= 1000 ? 340 : 300;
  return (
    <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.list, { width: listWidth }]}>
        <ConversationList activeId={activeId} pane />
      </View>
      <View style={styles.thread}>
        {activeId ? (
          <ChatView key={activeId} id={activeId} aboutParam={about} embedded />
        ) : (
          <View style={styles.placeholder}>
            <EmptyState tone="dark" icon={MessageCircle} title="Choisissez une conversation" body="Vos discussions avec les vendeurs et les acheteurs s’ouvrent ici." />
          </View>
        )}
      </View>
      {showContext ? (
        <View style={styles.context}>
          <ChatContext key={activeId} conversationId={activeId} aboutId={about ?? null} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: dark.background },
  list: { borderRightWidth: 1, borderRightColor: dark.border },
  thread: { flex: 1, minWidth: 0 },
  placeholder: { flex: 1, justifyContent: 'center' },
  context: { width: 300, borderLeftWidth: 1, borderLeftColor: dark.border },
});
