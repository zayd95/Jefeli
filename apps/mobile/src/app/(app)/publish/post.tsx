/**
 * Publication composer, the Plus in the dock opens it directly (Lovable PublishPage):
 * Publication · Article · Statut switcher, the author, the optional intent as pills, a large
 * text area, photos/videos, an optional tagged article and the audience. Drafts, upload progress
 * with retry/cancel and the create_post rules are the existing native ones. Live stays honestly
 * disabled until the video provider is configured.
 */
import { isPostIntent, POST_INTENTS, toFrenchError, type Audience, type PostIntent } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Radio } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChoicePills, MediaPickerStrip, UploadOverlay } from '@/components/Composer';
import { Thumb } from '@/components/Media';
import { PublishHeader } from '@/components/PublishSwitcher';
import { Avatar, Button, colors, fonts, radius, Screen, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { liveFunction, type LiveProviderStatus } from '@/lib/api/live';
import { useFlag } from '@/lib/flags';
import { createPost } from '@/lib/api/posts';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { useDraft } from '@/lib/drafts';
import { uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';

const AUDIENCES: { key: Audience; label: string; a11y: string }[] = [
  { key: 'public', label: 'Tout le monde', a11y: 'Tout le monde' },
  { key: 'followers', label: 'Abonnés', a11y: 'Mes abonnés' },
  { key: 'friends', label: 'Amis', a11y: 'Mes amis' },
];

export default function NewPost() {
  const { userId, profile } = useAuth();
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
  const [focused, setFocused] = useState(false);
  const liveFlag = useFlag('live_streaming');
  const provider = useQuery({ queryKey: ['live-provider-status'], queryFn: () => liveFunction<LiveProviderStatus>('status'), retry: 0, staleTime: 60_000, enabled: liveFlag });
  const liveReady = liveFlag && provider.data?.configured === true;
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
      <PublishHeader
        mode="post"
        right={<Button label="Publier" size="sm" variant="cta" pill disabled={!canPublish} onPress={publish} style={{ height: 40, paddingHorizontal: 16 }} />}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {draft.restored ? (
          <Text variant="caption" tone="secondary">
            Brouillon restauré.{' '}
            <Text variant="caption" tone="accent" weight="700" onPress={() => draft.clear()}>
              Effacer
            </Text>
          </Text>
        ) : null}
        <View style={styles.author}>
          <Avatar path={profile?.avatar_path} name={profile?.display_name ?? 'Moi'} size={48} />
          <View>
            <Text variant="bodyStrong">{profile?.display_name}</Text>
            <Text variant="caption" tone="secondary">
              Membre de Jëfëli
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <ChoicePills<PostIntent> value={intent} onChange={(k) => set({ intent: k })} options={POST_INTENTS.map((i) => ({ key: i.key, label: i.label }))} />
          {intent !== 'share' ? (
            <Text variant="caption" tone="secondary">
              {intentInfo.hint}
            </Text>
          ) : null}
        </View>

        <TextInput
          value={body}
          onChangeText={(t) => set({ body: t })}
          placeholder={intentInfo.placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentDeep}
          multiline
          maxLength={2200}
          accessibilityLabel="Texte"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.text, focused && styles.textFocused, WEB_NO_OUTLINE]}
          autoFocus={!draft.restored}
        />
        {needsText && media.length > 0 && body.trim().length === 0 ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: -spacing.md }}>
            Ajoutez quelques mots : une photo seule ne dit pas ce que vous cherchez.
          </Text>
        ) : null}
        <MediaPickerStrip media={media} onChange={(m) => set({ media: m })} label="Photo ou vidéo" />

        {(myProducts.data ?? []).length > 0 ? (
          <View style={styles.section}>
            <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
              Identifier un article
              <Text variant="callout" tone="secondary" weight="400" style={{ fontSize: 13 }}>
                {productIds.length > 0 ? ` · ${productIds.length} sélectionné${productIds.length > 1 ? 's' : ''}` : ' · facultatif'}
              </Text>
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
                    aria-checked={on}
                    accessibilityLabel={p.title}
                  >
                    <Thumb media={p.media[0]} style={{ width: 92, height: 92, borderRadius: 12 }} />
                    <Text variant="caption" weight="600" numberOfLines={1} style={{ width: 92, fontSize: 12 }}>
                      {p.title}
                    </Text>
                    {on ? (
                      <View style={styles.check}>
                        <Check size={14} color={colors.night} strokeWidth={3} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="callout" weight="600" style={{ fontSize: 13 }}>
            Qui peut voir ?
          </Text>
          <ChoicePills<Audience> value={visibility} onChange={(v) => set({ visibility: v })} options={AUDIENCES} />
          <Text variant="caption" tone="secondary">
            {visibility !== 'public' ? 'Les médias restent privés. L’audience ne pourra pas être changée après publication.' : 'Cette audience est appliquée par Jëfëli.'}
          </Text>
        </View>

        <Pressable
          disabled={!liveReady}
          onPress={() => router.push('/live/host')}
          style={[styles.live, !liveReady && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !liveReady }}
          aria-disabled={!liveReady}
          accessibilityLabel={`Live. ${liveReady ? 'Présentez vos articles en direct.' : 'Arrive avec l’activation du direct vidéo.'}`}
        >
          <Radio size={18} color={liveReady ? colors.ink : colors.textSecondary} />
          <Text variant="caption" weight="600" tone={liveReady ? 'default' : 'secondary'} style={{ flex: 1 }}>
            {liveReady ? 'Lancer un live vidéo' : 'Live vidéo · bientôt, avec l’activation du direct'}
          </Text>
        </Pressable>
      </ScrollView>
      <UploadOverlay visible={uploading} progress={progress} label="Publication en cours…" onCancel={() => abort.current?.abort()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Lovable: a large white rounded text area with no visible border until focus.
  text: { minHeight: 128, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, padding: spacing.lg, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink, textAlignVertical: 'top' },
  // Lovable `focus:ring-2 ring-lab-mint`
  textFocused: { borderColor: colors.mint },
  section: { gap: spacing.sm },
  product: { padding: 6, borderRadius: 16, backgroundColor: colors.surface, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  productOn: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
});
