import { AUDIENCE_LABELS, formatListingPrice, isPostIntent, POST_INTENTS, toFrenchError, type Audience, type PostIntent } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, ChevronUp, HandHelping, Megaphone, MessageCircleQuestionMark, Search, ShoppingBag, type LucideIcon } from 'lucide-react-native';
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
  const [showProducts, setShowProducts] = useState(false);
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
        <Field
          value={body}
          onChangeText={(t) => set({ body: t })}
          placeholder={intentInfo.placeholder}
          multiline
          maxLength={2200}
          accessibilityLabel="Texte"
          style={styles.text}
          autoFocus={!draft.restored}
        />
        {needsText && media.length > 0 && body.trim().length === 0 ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: -spacing.md }}>
            Ajoutez quelques mots : une photo seule ne dit pas ce que vous cherchez.
          </Text>
        ) : null}
        <MediaPickerStrip media={media} onChange={(m) => set({ media: m })} />

        <View style={styles.section}>
          <Text variant="caption" weight="700" tone="secondary">
            Type de publication · facultatif
          </Text>
          <View style={styles.intents} accessibilityRole="radiogroup">
            {POST_INTENTS.map((i) => {
              const on = i.key === intent;
              const Icon = INTENT_ICONS[i.key];
              return (
                <Pressable
                  key={i.key}
                  onPress={() => set({ intent: i.key })}
                  style={({ pressed }) => [styles.intent, on && styles.intentOn, pressed && !on && { backgroundColor: colors.surfaceMuted }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }}
                  aria-checked={on}
                  accessibilityLabel={i.label}
                >
                  <Icon size={15} color={on ? colors.white : colors.ink} strokeWidth={2.2} />
                  <Text variant="caption" weight="700" color={on ? colors.white : colors.ink} numberOfLines={1}>
                    {i.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {intent !== 'share' ? (
            <Text variant="caption" tone="secondary">
              {intentInfo.hint}
            </Text>
          ) : null}
        </View>

        {(myProducts.data ?? []).length > 0 ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => setShowProducts((x) => !x)}
              style={styles.disclosure}
              accessibilityRole="button"
              aria-expanded={showProducts || productIds.length > 0}
              accessibilityLabel="Identifier un de vos articles (facultatif)"
            >
              <ShoppingBag size={18} color={colors.ink} />
              <Text variant="callout" weight="600" style={{ flex: 1 }}>
                Identifier un article{productIds.length > 0 ? ` · ${productIds.length}` : ''}
              </Text>
              <Text variant="caption" tone="secondary">
                Facultatif
              </Text>
              {showProducts || productIds.length > 0 ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
            </Pressable>
            {showProducts || productIds.length > 0 ? (
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
                      aria-checked={on}
                      accessibilityLabel={p.title}
                    >
                      <Thumb media={p.media[0]} style={{ width: 104, height: 80, borderRadius: radius.sm }} />
                      <Text variant="caption" weight="600" numberOfLines={1} style={{ width: 104 }}>
                        {p.title}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ width: 104 }}>
                        {formatListingPrice(p, { compact: true })}
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
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="caption" weight="700" tone="secondary">
            Qui peut voir ?
          </Text>
          <OptionRow<Audience>
            value={visibility}
            onChange={(v) => set({ visibility: v })}
            options={(['public', 'followers', 'friends'] as Audience[]).map((k) => ({ key: k, label: AUDIENCE_LABELS[k] }))}
          />
          {visibility !== 'public' ? (
            <Text variant="caption" tone="secondary">
              Les médias restent privés. L’audience ne pourra pas être changée après publication.
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <UploadOverlay visible={uploading} progress={progress} label="Publication en cours…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  text: { fontSize: 17, lineHeight: 24, minHeight: 96 },
  section: { gap: spacing.sm },
  intents: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  intent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  intentOn: { backgroundColor: colors.ink },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  product: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 },
  productOn: { borderColor: colors.ink, borderWidth: 2 },
  check: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.action, alignItems: 'center', justifyContent: 'center' },
});
