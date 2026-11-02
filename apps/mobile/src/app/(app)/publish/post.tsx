import { AUDIENCE_LABELS, formatXOF, toFrenchError, type Audience } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MediaPickerStrip, OptionRow, UploadOverlay } from '@/components/Composer';
import { Thumb } from '@/components/Media';
import { Button, colors, Field, Header, radius, Screen, spacing, Text, useToast } from '@/design';
import { createPost } from '@/lib/api/posts';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/drafts';
import { uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';

export default function NewPost() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const draft = useDraft('post', { body: '', visibility: 'public' as Audience, media: [] as LocalMedia[], productIds: [] as string[] });
  const { body, visibility, media, productIds } = draft.value;
  const set = (patch: Partial<typeof draft.value>) => draft.setValue((v) => ({ ...v, ...patch }));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const myProducts = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });

  const canPublish = body.trim().length > 0 || media.length > 0;

  async function publish() {
    if (!userId) return;
    abort.current = new AbortController();
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await uploadMediaBatch(userId, media.map((m) => ({ ...m, file: null })), {
        bucket: visibility === 'public' ? 'public-media' : 'private-media',
        folder: 'posts',
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      const id = await createPost({ body: body.trim(), visibility, media: uploaded, productIds });
      await draft.clear();
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['user-posts', userId] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('Publication partagée', 'success');
      router.replace(`/post/${id}`);
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Nouvelle publication" right={<Button label="Publier" size="sm" variant="cta" disabled={!canPublish} onPress={publish} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {draft.restored ? (
          <Text variant="caption" tone="secondary">
            Brouillon restauré.{' '}
            <Text variant="caption" tone="accent" weight="700" onPress={() => draft.clear()}>
              Effacer
            </Text>
          </Text>
        ) : null}
        <Field value={body} onChangeText={(t) => set({ body: t })} placeholder="Quoi de neuf ? Un arrivage, une bonne affaire, une pensée…" multiline maxLength={2200} counter label="Texte" />
        <MediaPickerStrip media={media} onChange={(m) => set({ media: m })} />

        {(myProducts.data ?? []).length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" weight="600">
              Identifier un de vos articles (facultatif)
            </Text>
            <Text variant="caption" tone="secondary">
              Une publication n’a pas besoin d’être une vente. Identifiez un article seulement si vous en parlez.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {(myProducts.data ?? []).map((p) => {
                const on = productIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => set({ productIds: on ? productIds.filter((x) => x !== p.id) : [...productIds, p.id].slice(0, 5) })}
                    style={[styles.product, on && styles.productOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={p.title}
                  >
                    <Thumb media={p.media[0]} style={{ width: 120, height: 90, borderRadius: radius.sm }} />
                    <Text variant="caption" weight="600" numberOfLines={1} style={{ width: 120 }}>
                      {p.title}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {p.price_xof !== null ? formatXOF(p.price_xof, { compact: true }) : 'Troc'}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Check size={14} color={colors.ink} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Qui peut voir ?
          </Text>
          <OptionRow<Audience>
            value={visibility}
            onChange={(v) => set({ visibility: v })}
            options={(['public', 'followers', 'friends'] as Audience[]).map((k) => ({ key: k, label: AUDIENCE_LABELS[k] }))}
          />
          <Text variant="caption" tone="secondary">
            {visibility === 'public'
              ? 'Visible par tous, y compris via un lien de partage.'
              : 'Les médias restent privés : seules les personnes autorisées peuvent les ouvrir. L’audience ne pourra pas être changée après publication.'}
          </Text>
        </View>
      </ScrollView>
      <UploadOverlay visible={uploading} progress={progress} label="Publication en cours…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  product: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 },
  productOn: { borderColor: colors.ink, borderWidth: 2 },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
});
