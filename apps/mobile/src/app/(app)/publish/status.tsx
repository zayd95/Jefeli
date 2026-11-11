/**
 * Statut editor (W1.3): full screen, in portrait, like the status itself.
 *
 * - « 5a » choose: the gallery, the camera (phones), or « Ma voix »; the audience is a pill.
 * - « 5b » a photo or video fills the screen; Texte and Article on the side, the audience at the
 *   top, « Publier le statut » at the bottom. A status keeps one content: no voice over a photo.
 * - « 5c » a voice: its own visual state (the member's portrait, the length, the words in
 *   Fraunces), listen and redo before publishing.
 * × goes back to the choice; a second × leaves. Publishing keeps the server's rules: 24 hours,
 * audience, private replies, reports, the private bucket.
 *
 * A photo + voice status is made by sharing a narrated publication (« Partager en statut »): it
 * points to the publication's files, so nothing is uploaded twice.
 */
import { AUDIENCE_LABELS, formatListingPrice, formatDuration, toFrenchError, type Audience } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ArrowLeft, Camera, Check, ChevronDown, ImagePlus, Mic, RotateCcw, Send, ShoppingBag, Type, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { VoicePreview } from '@/components/audio/Voice';
import { VoiceStudio } from '@/components/audio/VoiceStudio';
import { UploadOverlay } from '@/components/Composer';
import { Thumb, VideoPlayerInline } from '@/components/Media';
import { Avatar, Button, colors, dark, fonts, IconButton, Screen, Sheet, spacing, Text, useToast, WEB_NO_OUTLINE } from '@/design';
import { fetchSellerProducts } from '@/lib/api/products';
import { getSettings } from '@/lib/api/profiles';
import { createStory } from '@/lib/api/stories';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/nav';
import { pickMedia, uploadErrorMessage, uploadMediaBatch, UploadError, type LocalMedia } from '@/lib/upload';
import { uploadVoice, type RecordedClip } from '@/lib/voice';

const AUDIENCES: Audience[] = ['public', 'followers', 'friends'];
const AUDIENCE_SHORT: Record<Audience, string> = { public: 'Tout le monde', followers: 'Abonnés', friends: 'Amis' };

export default function NewStatus() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [voice, setVoice] = useState<RecordedClip | null>(null);
  const [studio, setStudio] = useState(false);
  const [caption, setCaption] = useState('');
  const [writing, setWriting] = useState(false);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'audience' | 'product'>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const settings = useQuery({ queryKey: ['settings', userId], queryFn: () => getSettings(userId ?? ''), enabled: !!userId });
  const products = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: !!userId });
  const effectiveAudience = (audience ?? (settings.data?.default_status_audience as Audience | undefined) ?? 'followers') as Audience;
  const linked = (products.data ?? []).find((p) => p.id === productId) ?? null;
  const hasContent = !!media || !!voice;

  async function choose(camera: boolean) {
    try {
      const picked = await pickMedia({ allowVideo: true, camera });
      if (picked?.[0]) setMedia(picked[0]);
    } catch (e) {
      toast(uploadErrorMessage(e), 'error');
    }
  }

  function backToChoice() {
    setMedia(null);
    setVoice(null);
    setWriting(false);
  }

  async function publish() {
    if (!userId || !hasContent) return;
    abort.current = new AbortController();
    setUploading(true);
    try {
      if (voice) {
        // A voice status (private bucket, audience rules and 24-hour expiry like any status).
        const up = await uploadVoice(userId, { ...voice, language }, { bucket: 'private-media', folder: 'stories', onProgress: setProgress, signal: abort.current.signal });
        await createStory({ media_kind: 'audio', path: up.path, width: null, height: null, duration_ms: up.duration_ms, caption: caption.trim(), audience: effectiveAudience, product_id: productId });
      } else if (media) {
        const [up] = await uploadMediaBatch(userId, [{ ...media, file: media.file ?? null }], { bucket: 'private-media', folder: 'stories', onProgress: setProgress, signal: abort.current.signal });
        if (!up) throw new Error('upload');
        await createStory({
          media_kind: up.kind,
          path: up.path,
          poster_path: up.poster_path,
          width: up.width,
          height: up.height,
          duration_ms: up.duration_ms,
          caption: caption.trim(),
          audience: effectiveAudience,
          product_id: productId,
        });
      }
      qc.invalidateQueries({ queryKey: ['story-rail'] });
      qc.invalidateQueries({ queryKey: ['active-stories', userId] });
      toast('Statut publié pour 24 h', 'success');
      goBack();
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    } finally {
      setUploading(false);
    }
  }

  const audiencePill = (
    <Pressable onPress={() => setSheet('audience')} style={styles.audience} accessibilityRole="button" accessibilityLabel={`Visible par : ${AUDIENCE_LABELS[effectiveAudience].toLowerCase()}. Changer`}>
      <Text variant="caption" weight="700" color={colors.white}>
        {hasContent ? AUDIENCE_SHORT[effectiveAudience] : `Visible par ${AUDIENCE_LABELS[effectiveAudience].toLowerCase()}`}
      </Text>
      <ChevronDown size={14} color={colors.white} />
    </Pressable>
  );

  const sheets = (
    <>
      <VoiceStudio
        visible={studio}
        title="Votre statut vocal"
        language={language}
        onLanguage={setLanguage}
        onDone={(clip) => (setVoice(clip), setMedia(null), setStudio(false))}
        onClose={() => setStudio(false)}
        avatar={{ path: profile?.avatar_path, name: profile?.display_name ?? 'Moi' }}
      />
      <Sheet visible={sheet === 'audience'} onClose={() => setSheet(null)} title="Qui peut voir votre statut ?" tone="dark">
        {AUDIENCES.map((a) => {
          const on = effectiveAudience === a;
          return (
            <Pressable key={a} onPress={() => (setAudience(a), setSheet(null))} style={[styles.row, on && styles.rowOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={AUDIENCE_LABELS[a]}>
              <Text variant="bodyStrong" tone="fog" style={{ flex: 1 }}>
                {AUDIENCE_LABELS[a]}
              </Text>
              {on ? <Check size={18} color={dark.mint} /> : null}
            </Pressable>
          );
        })}
        <Text variant="caption" tone="fogSecondary" style={{ marginTop: spacing.sm }}>
          Les réponses arrivent en message privé.
        </Text>
      </Sheet>
      <Sheet visible={sheet === 'product'} onClose={() => setSheet(null)} title="Lier un article" tone="dark" scroll>
        {(products.data ?? []).map((p) => {
          const on = productId === p.id;
          return (
            <Pressable key={p.id} onPress={() => (setProductId(on ? null : p.id), setSheet(null))} style={[styles.row, on && styles.rowOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={p.title}>
              <Thumb media={p.media[0]} style={{ width: 48, height: 48, borderRadius: 10 }} />
              <Text variant="bodyStrong" tone="fog" numberOfLines={1} style={{ flex: 1 }}>
                {p.title}
              </Text>
              {on ? <Check size={18} color={dark.mint} /> : null}
            </Pressable>
          );
        })}
      </Sheet>
      <UploadOverlay visible={uploading} progress={progress} label="Envoi du statut…" onCancel={() => abort.current?.abort()} />
    </>
  );

  if (!hasContent) {
    // « 5a »: choose what to share.
    return (
      <Screen edges={['top', 'bottom']} background={dark.background}>
        <View style={styles.chooseTop}>
          <IconButton icon={X} label="Fermer" variant="glass" color={dark.text} onPress={() => goBack()} />
        </View>
        <View style={styles.choose}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="micro" weight="800" tone="mint" style={{ letterSpacing: 1.2 }}>
              24 HEURES
            </Text>
            <Text serif weight="600" tone="fog" style={{ fontSize: 28, lineHeight: 34 }} accessibilityRole="header">
              Qu’est-ce qui se passe chez vous aujourd’hui ?
            </Text>
          </View>
          <View style={{ gap: spacing.md }}>
            <ChooseRow icon={ImagePlus} label="Photo ou vidéo de la galerie" onPress={() => choose(false)} />
            {Platform.OS !== 'web' ? <ChooseRow icon={Camera} label="Prendre une photo" hint="Sur téléphone" onPress={() => choose(true)} /> : null}
            <ChooseRow icon={Mic} label="Ma voix" hint="Jusqu’à 3 minutes" onPress={() => setStudio(true)} />
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-start', gap: spacing.sm }}>
            {audiencePill}
            <Text variant="caption" tone="fogSecondary">
              Une photo avec votre voix ? Publiez-la, puis « Partager en statut » : les mêmes fichiers, rien n’est envoyé deux fois.
            </Text>
          </View>
        </View>
        {sheets}
      </Screen>
    );
  }

  // « 5b » photo/video full screen, or « 5c » voice.
  return (
    <Screen edges={['top', 'bottom']} background={colors.night} keyboard>
      <View style={styles.stage}>
        {voice ? (
          <View style={[StyleSheet.absoluteFill, styles.voiceStage]}>
            <Avatar path={profile?.avatar_path} name={profile?.display_name ?? 'Moi'} size={112} />
            <View style={styles.voiceBadge}>
              <Mic size={16} color={colors.night} />
              <Text variant="callout" weight="700" color={colors.night}>
                {`Message vocal · ${formatDuration(voice.durationMs)}`}
              </Text>
            </View>
            {caption.trim() && !writing ? (
              <Text serif weight="400" tone="fog" align="center" style={{ fontSize: 24, lineHeight: 31, paddingHorizontal: spacing.xl }}>
                {caption.trim()}
              </Text>
            ) : null}
            <View style={styles.listen} accessibilityLabel="Écouter avant de publier">
              <VoicePreview uri={voice.uri} durationMs={voice.durationMs} waveform={voice.waveform} tone="dark" />
            </View>
            <Button label="Refaire" variant="outlineDark" pill icon={RotateCcw} onPress={() => setStudio(true)} />
          </View>
        ) : media?.kind === 'image' ? (
          <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Votre photo" />
        ) : media ? (
          <VideoPlayerInline uri={media.uri} posterUri={media.posterUri} active />
        ) : null}

        <View style={styles.stageTop} pointerEvents="box-none">
          <IconButton icon={ArrowLeft} label="Revenir au choix du contenu" variant="glass" color={colors.white} onPress={backToChoice} />
          <View style={{ flex: 1 }} />
          {audiencePill}
        </View>

        <View style={styles.side} pointerEvents="box-none">
          <SideTool icon={Type} label="Texte" a11y="Écrire sur le statut" on={writing || !!caption.trim()} onPress={() => setWriting((w) => !w)} />
          {(products.data ?? []).length > 0 ? <SideTool icon={ShoppingBag} label="Article" a11y="Lier un article" on={!!productId} onPress={() => setSheet('product')} /> : null}
        </View>

        {writing || (caption.trim() && !voice) ? (
          <View style={styles.captionWrap} pointerEvents="box-none">
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Écrivez quelque chose…"
              placeholderTextColor={dark.textSecondary}
              maxLength={200}
              autoFocus={writing}
              onBlur={() => setWriting(false)}
              style={[styles.caption, WEB_NO_OUTLINE]}
              accessibilityLabel="Texte du statut"
            />
          </View>
        ) : null}

        {linked ? (
          <View style={styles.sticker} accessibilityLabel={`Article lié : ${linked.title}, ${formatListingPrice(linked)}`}>
            <Thumb media={linked.media[0]} style={{ width: 44, height: 44, borderRadius: 8 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="callout" weight="700" numberOfLines={1}>
                {linked.title}
              </Text>
              <Text variant="caption" weight="800">
                {formatListingPrice(linked)}
              </Text>
            </View>
            <IconButton icon={X} label="Retirer l’article" size={16} onPress={() => setProductId(null)} />
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Avatar path={profile?.avatar_path} name={profile?.display_name ?? 'Moi'} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="callout" weight="700" tone="fog">
            Votre statut
          </Text>
          <Text variant="caption" tone="fogSecondary">
            24 heures · réponses en privé
          </Text>
        </View>
        <Pressable onPress={publish} disabled={uploading} style={({ pressed }) => [styles.publish, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityLabel="Publier le statut">
          <Send size={22} color={colors.night} />
        </Pressable>
      </View>
      {sheets}
    </Screen>
  );
}

function ChooseRow({ icon: Icon, label, hint, onPress }: { icon: typeof Mic; label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chooseRow, pressed && { backgroundColor: dark.raised }]} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}>
      <View style={styles.chooseIcon}>
        <Icon size={22} color={colors.night} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" tone="fog">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="fogSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SideTool({ icon: Icon, label, a11y, on, onPress }: { icon: typeof Mic; label: string; a11y: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.sideTool} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: on }}>
      <View style={[styles.sideIcon, on && { backgroundColor: colors.mint }]}>
        <Icon size={20} color={on ? colors.night : colors.white} />
      </View>
      <Text variant="micro" weight="700" color={colors.white}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chooseTop: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  choose: { flex: 1, padding: spacing.lg, gap: spacing.xl },
  chooseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.md, borderRadius: 20, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border },
  chooseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: dark.glass, borderWidth: 1, borderColor: dark.glassBorder },
  stage: { flex: 1, margin: spacing.xs, borderRadius: 22, overflow: 'hidden', backgroundColor: dark.surface },
  stageTop: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center' },
  side: { position: 'absolute', right: spacing.md, top: 84, gap: spacing.lg, alignItems: 'center' },
  sideTool: { alignItems: 'center', gap: 4, minWidth: 48 },
  sideIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: dark.glass, alignItems: 'center', justifyContent: 'center' },
  voiceStage: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: dark.surface },
  listen: { alignSelf: 'stretch', padding: spacing.md, borderRadius: 20, backgroundColor: dark.background, borderWidth: 1, borderColor: dark.mintLine },
  voiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: colors.mint },
  captionWrap: { position: 'absolute', left: spacing.lg, right: 76, bottom: 96 },
  caption: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 31, color: colors.white, backgroundColor: dark.glass, borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 10, textAlign: 'center' },
  sticker: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.surface },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  publish: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.sm, borderRadius: 12 },
  rowOn: { backgroundColor: dark.mintSelected },
});
