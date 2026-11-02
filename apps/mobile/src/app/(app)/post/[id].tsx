import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FileX, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { Avatar, Button, colors, EmptyState, Field, fonts, Header, Screen, Sheet, SheetAction, Skeleton, spacing, Text, useToast } from '@/design';
import { addComment, deleteComment, editPost, fetchComments, fetchPost } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import type { CommentRow } from '@/lib/types';
import { Flag, Trash2 } from 'lucide-react-native';

export default function PostScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [selected, setSelected] = useState<CommentRow | null>(null);
  const [editing, setEditing] = useState(edit === '1');
  const [editBody, setEditBody] = useState('');
  const [sending, setSending] = useState(false);

  const post = useQuery({ queryKey: ['post', id], queryFn: () => fetchPost(userId, id ?? '') });
  const comments = useQuery({ queryKey: ['comments', id], queryFn: () => fetchComments(id ?? '') });

  useEffect(() => {
    if (post.data && editing && !editBody) setEditBody(post.data.body);
  }, [post.data, editing, editBody]);

  async function send() {
    const body = text.trim();
    if (!body || !userId) return;
    setSending(true);
    try {
      await addComment(userId, id ?? '', body, replyTo ? (replyTo.parent_id ?? replyTo.id) : null);
      setText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', id] });
      qc.invalidateQueries({ queryKey: ['post', id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSending(false);
    }
  }

  if (post.isPending) {
    return (
      <Screen>
        <Header title="Publication" />
        <Skeleton height={320} radius={0} />
      </Screen>
    );
  }
  if (!post.data) {
    return (
      <Screen>
        <Header title="Publication" />
        <EmptyState icon={FileX} title="Publication indisponible" body="Elle a été supprimée, masquée, ou n’est pas visible pour vous." />
      </Screen>
    );
  }

  const all = comments.data ?? [];
  const roots = all.filter((c) => !c.parent_id);
  const ordered: CommentRow[] = roots.flatMap((r) => [r, ...all.filter((c) => c.parent_id === r.id)]);
  const isAuthor = post.data.author_id === userId;

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Publication" />
        <FlatList
          data={ordered}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            <View>
              {editing && isAuthor ? (
                <View style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface }}>
                  <Field label="Modifier le texte" value={editBody} onChangeText={setEditBody} multiline maxLength={2200} counter />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button label="Annuler" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(false)} />
                    <Button
                      label="Enregistrer"
                      variant="cta"
                      style={{ flex: 1 }}
                      onPress={async () => {
                        try {
                          await editPost(post.data!.id, editBody.trim());
                          setEditing(false);
                          qc.invalidateQueries({ queryKey: ['post', id] });
                          toast('Publication modifiée', 'success');
                        } catch (e) {
                          toast(toFrenchError(e), 'error');
                        }
                      }}
                    />
                  </View>
                </View>
              ) : null}
              <PostCard key={`${post.data.id}-${post.data.updated_at}`} post={post.data} showReason={false} onOpenComments={() => {}} />
              <Text variant="headline" style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                Commentaires
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onLongPress={() => setSelected(item)} style={[styles.comment, item.parent_id && styles.reply]} accessibilityHint="Appui long pour plus d’options">
              <Avatar path={item.author?.avatar_path} name={item.author?.display_name ?? '?'} size={item.parent_id ? 28 : 34} />
              <View style={{ flex: 1 }}>
                <Text variant="callout">
                  <Text variant="callout" weight="700" onPress={() => item.author && router.push(`/u/${item.author.handle}`)}>
                    {item.author?.display_name}{' '}
                  </Text>
                  {item.body}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 2 }}>
                  <Text variant="caption" tone="secondary">
                    {timeAgo(item.created_at)}
                  </Text>
                  <Text variant="caption" weight="700" tone="secondary" onPress={() => setReplyTo(item)}>
                    Répondre
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            comments.isPending ? (
              <Skeleton height={40} style={{ marginHorizontal: spacing.lg }} />
            ) : (
              <Text tone="secondary" style={{ paddingHorizontal: spacing.lg }}>
                Soyez le premier à commenter.
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {replyTo ? (
            <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.sm, paddingBottom: 4 }}>
              Réponse à {replyTo.author?.display_name} ·{' '}
              <Text variant="caption" weight="700" onPress={() => setReplyTo(null)}>
                Annuler
              </Text>
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ajouter un commentaire…"
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={1000}
              style={styles.input}
              accessibilityLabel="Commentaire"
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Publier le commentaire">
              <Send size={18} color={colors.action} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Sheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (selected.author_id === userId || isAuthor) ? (
          <SheetAction
            icon={Trash2}
            label="Supprimer le commentaire"
            destructive
            onPress={async () => {
              const c = selected;
              setSelected(null);
              try {
                await deleteComment(c.id);
                qc.invalidateQueries({ queryKey: ['comments', id] });
                qc.invalidateQueries({ queryKey: ['post', id] });
              } catch (e) {
                toast(toFrenchError(e), 'error');
              }
            }}
          />
        ) : null}
        {selected && selected.author_id !== userId ? (
          <SheetAction
            icon={Flag}
            label="Signaler le commentaire"
            onPress={() => {
              const c = selected;
              setSelected(null);
              router.push({ pathname: '/report', params: { type: 'comment', id: c.id } });
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  comment: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  reply: { paddingLeft: spacing.lg + 40 },
  composer: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 16, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
