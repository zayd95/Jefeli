import { timeAgo, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FileX, Flag, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/PostCard';
import { Avatar, Button, colors, dark, EmptyState, Field, fieldFontSize, fonts, Header, Screen, Sheet, SheetAction, Skeleton, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { addComment, deleteComment, editPost, fetchComments, fetchPost } from '@/lib/api/posts';
import { useAuth } from '@/lib/auth';
import { patchPost } from '@/lib/postCache';
import { useDarkStatusBar } from '@/lib/statusBar';
import type { CommentRow } from '@/lib/types';

/** Publication + its comments, on Atlantic night like the feed card it opens from. */
export default function PostScreen() {
  useDarkStatusBar();
  const { id, edit, comment } = useLocalSearchParams<{ id: string; edit?: string; comment?: string }>();
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [selected, setSelected] = useState<CommentRow | null>(null);
  const [editing, setEditing] = useState(edit === '1');
  const [editDraft, setEditDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const post = useQuery({ queryKey: ['post', id], queryFn: () => fetchPost(userId, id ?? '') });
  const comments = useQuery({ queryKey: ['comments', id], queryFn: () => fetchComments(id ?? '') });

  const editBody = editDraft ?? post.data?.body ?? '';
  const setEditBody = setEditDraft;

  async function send() {
    const body = text.trim();
    if (!body || !userId) return;
    setSending(true);
    try {
      const parentId = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
      await addComment(userId, id ?? '', body, parentId);
      setText('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['comments', id] });
      qc.invalidateQueries({ queryKey: ['post', id] });
      // Keep the feed card in step without re-ranking the whole feed.
      patchPost(qc, id ?? '', (p) => ({
        comment_count: p.comment_count + 1,
        comments_preview:
          parentId || !profile
            ? p.comments_preview
            : [
                {
                  post_id: p.id,
                  comment_id: `local-${Date.now()}`,
                  body,
                  created_at: new Date().toISOString(),
                  by_post_author: p.author_id === userId,
                  author: profile,
                },
                ...(p.comments_preview ?? []),
              ].slice(0, 2),
      }));
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSending(false);
    }
  }

  if (post.isPending) {
    return (
      <Screen background={dark.background}>
        <Header title="Publication" tone="dark" />
        <Skeleton tone="dark" height={320} radius={0} />
      </Screen>
    );
  }
  if (!post.data) {
    return (
      <Screen background={dark.background}>
        <Header title="Publication" tone="dark" />
        <EmptyState tone="dark" icon={FileX} title="Publication indisponible" body="Elle a été supprimée, masquée, ou n’est pas visible pour vous." />
      </Screen>
    );
  }

  const all = comments.data ?? [];
  const roots = all.filter((c) => !c.parent_id);
  const ordered: CommentRow[] = roots.flatMap((r) => [r, ...all.filter((c) => c.parent_id === r.id)]);
  const isAuthor = post.data.author_id === userId;

  return (
    <Screen edges={['top']} background={dark.background}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Publication" tone="dark" />
        <FlatList
          data={ordered}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            <View>
              {editing && isAuthor ? (
                <View style={{ margin: spacing.lg, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderRadius: 20 }}>
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
              <Text serif variant="title" tone="fog" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, fontSize: 20 }}>
                Commentaires
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onLongPress={() => setSelected(item)} style={[styles.comment, item.parent_id && styles.reply]} accessibilityHint="Appui long pour plus d’options">
              <Avatar path={item.author?.avatar_path} name={item.author?.display_name ?? '?'} size={item.parent_id ? 28 : 34} />
              <View style={{ flex: 1 }}>
                <Text variant="callout" color={dark.textStrong}>
                  <Text variant="callout" weight="700" tone="fog" onPress={() => item.author && router.push(`/u/${item.author.handle}`)}>
                    {item.author?.display_name}{' '}
                  </Text>
                  {item.body}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 2 }}>
                  <Text variant="caption" tone="fogTertiary">
                    {timeAgo(item.created_at)}
                  </Text>
                  <Text variant="caption" weight="700" tone="fogSecondary" onPress={() => setReplyTo(item)}>
                    Répondre
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            comments.isPending ? (
              <Skeleton tone="dark" height={40} style={{ marginHorizontal: spacing.lg }} />
            ) : (
              <Text tone="fogSecondary" style={{ paddingHorizontal: spacing.lg }}>
                Soyez le premier à commenter.
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {replyTo ? (
            <Text variant="caption" tone="fogSecondary" style={{ paddingHorizontal: spacing.sm, paddingBottom: 4 }}>
              Réponse à {replyTo.author?.display_name} ·{' '}
              <Text variant="caption" weight="700" tone="fog" onPress={() => setReplyTo(null)}>
                Annuler
              </Text>
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={post.data.intent === 'opinion' ? 'Donnez votre avis…' : post.data.intent === 'seek' ? 'Une piste, une adresse, un conseil…' : 'Ajouter un commentaire…'}
              placeholderTextColor={dark.textTertiary}
              selectionColor={dark.mint}
              multiline
              maxLength={1000}
              autoFocus={comment === '1'}
              style={[styles.input, WEB_NO_OUTLINE]}
              accessibilityLabel="Commentaire"
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Publier le commentaire">
              <Send size={18} color={colors.night} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Sheet visible={!!selected} onClose={() => setSelected(null)} tone="dark">
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
  // Lovable comment field: fog-tinted pill on night, mint send.
  composer: { borderTopWidth: 1, borderColor: dark.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: dark.header },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, borderWidth: 1, borderColor: dark.border, backgroundColor: dark.subtle, paddingHorizontal: spacing.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: fieldFontSize(15), color: dark.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
});
