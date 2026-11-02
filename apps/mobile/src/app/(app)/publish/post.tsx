import { AUDIENCE_LABELS, formatXOF, isPostIntent, POST_INTENTS, toFrenchError, type Audience, type PostIntent } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, HandHelping, Megaphone, MessageCircleQuestionMark, Search, type LucideIcon } from 'lucide-react-native';
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

const INTENT_ICONS: Record<PostIntent, LucideIcon> = { share: Megaphone, seek: Search, offer: HandHelping, opinion: MessageCircleQuestionMark };

export default function NewPost() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ intent?: string }>();
  const startIntent: PostIntent = isPostIntent(params.intent) ? params.intent : 'share';
  // « Demander à la communauté » shortcuts keep their own draft, so a restored photo post never
  // replaces the request the member just chose to write.
  const draft = useDraft(startIntent === 'share' ? 'post' : `post-${startIntent}`, {
    body: '',
    visibility: 'public' as Audience,
    media: [] as LocalMedia[],
    productIds: [] as string[],
    intent: startIntent,
  });
  const { body, visibility, media, productIds } = draft.value;
  const intent: PostIntent = isPostIntent(draft.value.intent) ? draft.value.intent : 'share';
  const intentInfo = POST_INTENTS.find((i) => i.key === intent) ?? POST_INTENTS[0]!;
  const needsText = intent === 'seek' || intent === 'opinion';
  const set = (patch: Partial<typeof draft.value>) => draft.setValue((v) => ({ ...v, ...patch }));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const myProducts = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });

  const canPublish = needsText ? body.trim().length > 0 : body.trim().length > 0 || media.length > 0;

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
      const id = await createPost({ body: body.trim(), visibility, media: uploaded, productIds, intent });
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
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Type de publication
          </Text>
          <View style={styles.intents} accessibilityRole="radiogroup">
            {POST_INTENTS.map((i) => {
              const on = i.key === intent;
              const Icon = INTENT_ICONS[i.key];
              return (
                <Pressable
                  key={i.key}
                  onPress={() => set({ intent: i.key })}
                  style={({ pressed }) => [styles.intent, on && styles.intentOn, pressed && !on && { backgroundColor: colors.surfaceSubtle }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }} aria-checked={on}
                  accessibilityLabel={i.label}
                >
                  <Icon size={18} color={on ? colors.white : colors.ink} strokeWidth={2.2} />
                  <Text variant="callout" weight="700" color={on ? colors.white : colors.ink} numberOfLines={1}>
                    {i.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="caption" tone="secondary">
            {intentInfo.hint}
          </Text>
        </View>
        <Field value={body} onChangeText={(t) => set({ body: t })} placeholder={intentInfo.placeholder} multiline maxLength={2200} counter label="Texte" />
        {needsText && media.length > 0 && body.trim().length === 0 ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: -spacing.md }}>
            Ajoutez quelques mots : une photo seule ne dit pas ce que vous cherchez.
          </Text>
        ) : null}
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
                    accessibilityState={{ checked: on }} aria-checked={on}
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
  intents: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  intent: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  intentOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  product: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 },
  productOn: { borderColor: colors.ink, borderWidth: 2 },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
});
