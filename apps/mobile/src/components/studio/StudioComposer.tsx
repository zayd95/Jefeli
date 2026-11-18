/**
 * Studio composer (P2): preview, caption, one switch, destinations.
 *
 *  - « Vendre ou troquer cet article » is one switch. On, it shows inline chips (price, mode
 *    Vendre / Troquer / Donner, category, condition, neighbourhood). It starts on for an account
 *    with a Boutique, and is not offered for a text post: a text post is never a priced item.
 *  - Destinations are checkboxes: Fil · Statut 24 h · Reel (a video) · Boutique (the switch).
 *    A destination the content cannot reach says why instead of disappearing.
 *  - One gold button, « Publier ».
 */
import {
  AUDIENCE_LABELS,
  type Audience,
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  DESTINATION_LABELS,
  DESTINATIONS,
  destinationStates,
  formatAmountInput,
  formatDuration,
  statusNeedsFeed,
  TEXT_STARTERS,
  type TextStarter,
  type Destination,
  type ItemCondition,
  type ListingMode,
  type PriceMode,
  type StudioInput,
} from '@jefeli/shared';
import { Camera, Check, ChevronDown, Image as ImageIcon, Mic, Play, Tag, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Image } from 'expo-image';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, colors, dark, Field, fonts, radius, Sheet, spacing, Text, WEB_NO_OUTLINE } from '@/design';
import type { LocalMedia } from '@/lib/upload';
import type { VoiceAttachment } from '@/lib/voice';

export interface ItemDraft {
  mode: ListingMode;
  priceMode: PriceMode;
  price: string;
  category: string;
  condition: ItemCondition;
  neighborhood: string;
}

// P4: one choice among four (a single-select row), not two toggles that combine.
const MODES: { key: ListingMode; label: string }[] = [
  { key: 'sale', label: 'Vendre' },
  { key: 'trade', label: 'Troquer' },
  { key: 'sale_or_trade', label: 'Vendre ou troquer' },
  { key: 'give', label: 'Donner' },
];
const PRICE_MODES: { key: PriceMode; label: string }[] = [
  { key: 'fixed', label: 'Prix affiché' },
  { key: 'negotiable', label: 'À discuter' },
  { key: 'on_request', label: 'Sur demande' },
];

export interface ComposerProps {
  input: StudioInput;
  media: LocalMedia[];
  voice: VoiceAttachment | null;
  caption: string;
  onCaption: (c: string) => void;
  /** P3: a pasted WhatsApp announcement was read; one transient line with « Annuler ». */
  pasteNote?: { text: string; onUndo: () => void } | null;
  sell: boolean;
  canSell: boolean;
  onSell: (on: boolean) => void;
  item: ItemDraft;
  onItem: (patch: Partial<ItemDraft>) => void;
  categories: { slug: string; name: string }[];
  selected: Destination[];
  onToggle: (d: Destination) => void;
  feedAudience: Audience;
  onFeedAudience: (a: Audience) => void;
  statusAudienceLabel: string;
  error: string | null;
  restored: boolean;
  onRestart: () => void;
  onPublish: () => void;
  publishing: boolean;
  linkedTitle?: string | null;
  onUnlink?: () => void;
  /** P4: compose-first. The toolbar adds media, opens the camera, records a voice, switches the article on. */
  displayName: string;
  avatarPath?: string | null;
  starter: TextStarter | null;
  onStarter: (s: TextStarter) => void;
  onClose: () => void;
  onGallery: () => void;
  onCamera: () => void;
  onVoice: () => void;
  onRemoveMedia: (index: number) => void;
  onRemoveVoice: () => void;
  autoFocus?: boolean;
}

export function StudioComposer(p: ComposerProps) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<null | 'price' | 'category' | 'condition' | 'place' | 'audience'>(null);
  const states = destinationStates(p.input);
  const hasMedia = p.media.length > 0;
  const category = p.categories.find((c) => c.slug === p.item.category);
  const sells = p.item.mode === 'sale' || p.item.mode === 'sale_or_trade';
  const empty = !p.caption && !hasMedia && !p.voice;
  const publishable = !empty;
  const len = p.caption.length;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="studio-composer">
      {/* Header: close on the left, the one gold button on the right (X-like) */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <Pressable onPress={p.onClose} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer" testID="studio-close">
          <X size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>
        {p.restored ? (
          <Pressable onPress={p.onRestart} accessibilityRole="button" accessibilityLabel="Brouillon repris. Recommencer" style={styles.restored}>
            <Text variant="caption" weight="700" tone="fog">
              Brouillon repris · Recommencer
            </Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Button label="Publier" variant="cta" pill loading={p.publishing} disabled={!publishable} onPress={p.onPublish} testID="studio-publish" />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {/* Who sees it (Fil) */}
        <View style={styles.who}>
          <Avatar path={p.avatarPath} name={p.displayName} size={40} />
          {p.selected.includes('feed') || empty ? (
            <Pressable onPress={() => setSheet('audience')} style={styles.audiencePill} accessibilityRole="button" accessibilityLabel={`Visible par : ${AUDIENCE_LABELS[p.feedAudience].toLowerCase()}. Changer`} testID="studio-feed-audience">
              <Text variant="callout" weight="700" color={colors.wecci}>
                {{ public: 'Tout le monde', followers: 'Abonnés', friends: 'Amis' }[p.feedAudience]}
              </Text>
              <ChevronDown size={16} color={colors.wecci} />
            </Pressable>
          ) : (
            <Text variant="callout" weight="600" tone="fogSecondary">
              Pas dans le Fil
            </Text>
          )}
        </View>

        {/* The text box: the first thing you see */}
        <TextInput
          value={p.caption}
          onChangeText={p.onCaption}
          placeholder={p.sell ? 'Nom de l’article, puis sa description…' : 'Quoi de neuf ? Vendez, troquez, cherchez…'}
          placeholderTextColor={dark.textSecondary}
          multiline
          autoFocus={p.autoFocus}
          maxLength={2200}
          style={[styles.caption, WEB_NO_OUTLINE]}
          accessibilityLabel={p.sell ? 'Nom et description de l’article' : 'Votre publication'}
          testID="studio-caption"
        />

        {empty ? (
          <View style={styles.starters} accessibilityLabel="Débuts de phrase">
            {TEXT_STARTERS.map((st) => (
              <Pressable key={st.key} onPress={() => p.onStarter(st.key)} style={[styles.starter, p.starter === st.key && styles.chipOn]} accessibilityRole="button" accessibilityLabel={st.label} testID={`studio-starter-${st.key}`}>
                <Text variant="callout" weight="600" color={colors.ink}>
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {p.pasteNote ? (
          <View style={styles.pasteNote} testID="studio-paste-note" accessibilityLiveRegion="polite">
            <Text variant="caption" weight="600" color={colors.ink} style={{ flex: 1 }}>
              {p.pasteNote.text}
            </Text>
            <Pressable onPress={p.pasteNote.onUndo} hitSlop={12} style={styles.pasteUndo} accessibilityRole="button" accessibilityLabel="Annuler la lecture du texte collé" testID="studio-paste-undo">
              <Text variant="callout" weight="800" color={colors.gold}>
                Annuler
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Media: photos and a video together, each removable */}
        {hasMedia ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} testID="studio-media" accessibilityLabel={`${p.media.length} élément${p.media.length > 1 ? 's' : ''} ajouté${p.media.length > 1 ? 's' : ''}`}>
            {p.media.map((m, i) => (
              <View key={`${m.uri}-${i}`} style={styles.thumb} testID={`studio-thumb-${m.kind}`} accessibilityLabel={m.kind === 'video' ? `Vidéo ${formatDuration(m.durationMs ?? 0)}` : `Photo ${i + 1}`}>
                {m.kind === 'video' && !m.posterUri ? (
                  <View style={[StyleSheet.absoluteFill, styles.thumbVideo]}>
                    <Play size={22} color={colors.white} fill={colors.white} />
                  </View>
                ) : (
                  <Image source={{ uri: m.kind === 'video' ? (m.posterUri as string) : m.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                )}
                {m.kind === 'video' ? (
                  <View style={styles.thumbBadge}>
                    <Play size={11} color={colors.white} fill={colors.white} />
                    <Text variant="micro" weight="800" color={colors.white}>
                      {formatDuration(m.durationMs ?? 0)}
                    </Text>
                  </View>
                ) : null}
                <Pressable onPress={() => p.onRemoveMedia(i)} hitSlop={12} style={styles.thumbRemove} accessibilityRole="button" accessibilityLabel={m.kind === 'video' ? 'Retirer la vidéo' : `Retirer la photo ${i + 1}`}>
                  <X size={12} color={colors.white} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {p.voice ? (
          <View style={styles.voiceChip}>
            <Mic size={18} color={colors.ink} />
            <Text variant="callout" weight="700" color={colors.ink} style={{ flex: 1 }}>
              {hasMedia ? `Votre voix accompagne ce contenu · ${Math.round(p.voice.durationMs / 1000)} s` : `Message vocal · ${Math.round(p.voice.durationMs / 1000)} s`}
            </Text>
            <Pressable onPress={p.onRemoveVoice} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retirer la voix">
              <X size={16} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : null}

        {p.linkedTitle ? (
          <Pressable onPress={p.onUnlink} style={styles.voiceChip} accessibilityRole="button" accessibilityLabel={`Article lié : ${p.linkedTitle}. Retirer`}>
            <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
              {`Article lié : ${p.linkedTitle}`}
            </Text>
          </Pressable>
        ) : null}

        {/* The article card: opens with the toolbar's « Vendre » */}
        {p.canSell && p.sell ? (
          <View style={styles.sellBox}>
            <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Vendre, troquer ou donner">
              {MODES.map((m) => {
                const on = p.item.mode === m.key;
                return (
                  <Pressable key={m.key} onPress={() => p.onItem({ mode: m.key, ...(m.key === 'give' ? { price: '' } : {}) })} style={[styles.modeChip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={m.label}>
                    <Text variant="callout" weight={on ? '800' : '600'} color={colors.ink}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {p.item.mode === 'give' ? (
              <Text variant="callout" tone="fogSecondary">
                Gratuit : vous offrez cet article, la personne vous écrit pour le récupérer.
              </Text>
            ) : sells && p.item.priceMode === 'on_request' ? (
              <Pressable onPress={() => setSheet('price')} style={styles.priceMode} accessibilityRole="button" accessibilityLabel="Mode de prix : Sur demande">
                <Text variant="callout" weight="700" color={colors.ink}>
                  Prix sur demande
                </Text>
                <ChevronDown size={16} color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.priceLine}>
                <TextInput
                  value={p.item.price}
                  onChangeText={(t) => p.onItem({ price: formatAmountInput(t) })}
                  keyboardType="number-pad"
                  placeholder={p.item.mode === 'trade' ? 'Valeur (facultatif)' : '0'}
                  placeholderTextColor={dark.textSecondary}
                  style={[styles.priceInput, WEB_NO_OUTLINE, sells && p.item.priceMode === 'fixed' && !p.item.price && styles.priceWarn]}
                  accessibilityLabel={p.item.mode === 'trade' ? 'Valeur estimée' : 'Prix'}
                  testID="studio-price"
                />
                <Text variant="bodyStrong" tone="fogSecondary">
                  F CFA
                </Text>
                {sells ? (
                  <Pressable onPress={() => setSheet('price')} style={styles.priceMode} accessibilityRole="button" accessibilityLabel={`Mode de prix : ${p.item.priceMode === 'negotiable' ? 'À discuter' : 'Prix affiché'}`}>
                    <Text variant="callout" weight="700" color={colors.ink}>
                      {p.item.priceMode === 'negotiable' ? 'À discuter' : 'Prix fixe'}
                    </Text>
                    <ChevronDown size={16} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>
            )}
            <View style={styles.chips} testID="studio-item-chips">
              <ChipButton label={category?.name ?? 'Catégorie'} caption="Catégorie" onPress={() => setSheet('category')} warn={!category} />
              <ChipButton label={CONDITION_LABELS[p.item.condition]} caption="État" onPress={() => setSheet('condition')} />
              <ChipButton label={p.item.neighborhood || 'Quartier'} caption="Quartier" onPress={() => setSheet('place')} />
            </View>
          </View>
        ) : null}

        {/* Destinations: one compact row of toggles */}
        {!empty ? (
          <View style={styles.destWrap}>
            <View style={styles.destRow} accessibilityRole="list" accessibilityLabel="Publier sur">
              {DESTINATIONS.map((d) => {
                const st = states.find((x) => x.key === d)!;
                if (d === 'boutique' && !p.sell) return null;
                const on = p.selected.includes(d);
                const locked = d === 'boutique';
                const needsFeed = d === 'status' && statusNeedsFeed(p.input) && !p.selected.includes('feed');
                const available = st.available && !needsFeed;
                return (
                  <Pressable
                    key={d}
                    onPress={() => available && !locked && p.onToggle(d)}
                    disabled={!available || locked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !available || locked }}
                    aria-checked={on}
                    aria-disabled={!available || locked}
                    accessibilityLabel={DESTINATION_LABELS[d]}
                    style={[styles.destChip, on && styles.chipOn, !available && { opacity: 0.45 }]}
                    testID={`studio-dest-${d}`}
                  >
                    {on ? <Check size={15} color={colors.ink} strokeWidth={3} /> : null}
                    <Text variant="callout" weight={on ? '800' : '600'} color={colors.ink}>
                      {DESTINATION_LABELS[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {(() => {
              const needs = statusNeedsFeed(p.input) && !p.selected.includes('feed') && states.find((x) => x.key === 'status')?.available;
              const hint = needs
                ? 'Un statut de plusieurs éléments passe par le Fil : cochez aussi Fil.'
                : p.selected.includes('status')
                  ? p.statusAudienceLabel
                  : p.selected.includes('reel') || !states.find((x) => x.key === 'reel')?.available
                    ? null
                    : null;
              return hint ? (
                <Text variant="caption" tone="fogSecondary">
                  {hint}
                </Text>
              ) : null;
            })()}
          </View>
        ) : null}

        {p.error ? (
          <View style={styles.error} accessibilityRole="alert">
            <Text variant="callout" tone="fog">
              {p.error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Toolbar, above the keyboard: add things, switch the article on */}
      <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <ToolButton icon={ImageIcon} label="Ajouter des photos ou une vidéo" onPress={p.onGallery} testID="studio-tool-gallery" />
        <ToolButton icon={Camera} label="Ouvrir la caméra" onPress={p.onCamera} testID="studio-tool-camera" />
        <ToolButton icon={Mic} label={p.voice ? 'Refaire ma voix' : 'Ajouter ma voix'} onPress={p.onVoice} active={!!p.voice} testID="studio-tool-voice" />
        <ToolButton icon={Tag} label="Vendre ou troquer cet article" onPress={() => p.onSell(!p.sell)} active={p.sell} wecci testID="studio-tool-sell" />
        <View style={{ flex: 1 }} />
        {len > 1800 ? (
          <Text variant="caption" weight="700" tone={len > 2100 ? 'gold' : 'fogSecondary'}>
            {2200 - len}
          </Text>
        ) : null}
      </View>

      {/* Sheets */}
      <Sheet visible={sheet === 'price'} onClose={() => setSheet(null)} title="Comment afficher le prix ?" tone="dark">
        <View style={{ gap: spacing.md }}>
          <View style={styles.modeRow} accessibilityRole="radiogroup">
            {PRICE_MODES.map((m) => {
              const on = p.item.priceMode === m.key;
              return (
                <Pressable key={m.key} onPress={() => p.onItem({ priceMode: m.key })} style={[styles.modeChip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={m.label}>
                  <Text variant="callout" weight={on ? '800' : '600'} color={colors.ink}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="callout" tone="fogSecondary">
            {p.item.priceMode === 'on_request' ? 'Aucun prix affiché : les acheteurs vous écrivent.' : p.item.priceMode === 'negotiable' ? 'Votre prix est un point de départ : les acheteurs proposent le leur.' : 'Le prix est affiché tel quel.'}
          </Text>
          <Button label="Terminé" variant="outlineDark" pill onPress={() => setSheet(null)} />
        </View>
      </Sheet>
      <Sheet visible={sheet === 'audience'} onClose={() => setSheet(null)} title="Qui voit votre publication ?" tone="dark">
        {(['public', 'followers', 'friends'] as const).map((a) => (
          <Choice key={a} label={AUDIENCE_LABELS[a]} on={p.feedAudience === a} onPress={() => (p.onFeedAudience(a), setSheet(null))} />
        ))}
        <Text variant="caption" tone="fogSecondary" style={{ marginTop: spacing.sm }}>
          Un Reel et un article sont toujours publics.
        </Text>
      </Sheet>
      <Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Catégorie" tone="dark" scroll>
        {p.categories.map((c) => (
          <Choice key={c.slug} label={c.name} on={p.item.category === c.slug} onPress={() => (p.onItem({ category: c.slug }), setSheet(null))} />
        ))}
      </Sheet>
      <Sheet visible={sheet === 'condition'} onClose={() => setSheet(null)} title="État" tone="dark" scroll>
        {CONDITION_OPTIONS.map((c) => (
          <Choice key={c} label={CONDITION_LABELS[c]} on={p.item.condition === c} onPress={() => (p.onItem({ condition: c }), setSheet(null))} />
        ))}
      </Sheet>
      <Sheet visible={sheet === 'place'} onClose={() => setSheet(null)} title="Quartier" tone="dark">
        <View style={{ gap: spacing.md }}>
          <Field label="Quartier (approximatif)" value={p.item.neighborhood} onChangeText={(t) => p.onItem({ neighborhood: t })} maxLength={60} accessibilityLabel="Quartier" />
          <Button label="Terminé" variant="outlineDark" pill onPress={() => setSheet(null)} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

/** A 44-pt icon of the toolbar. `wecci` = the article switch (mint when off, raised + gold border when on). */
function ToolButton({ icon: Icon, label, onPress, active, wecci, testID }: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean; wecci?: boolean; testID?: string }) {
  // The article toolbar icon is a real switch for assistive tech (and for the tests): « Vendre ou troquer cet article ».
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tool, active && styles.toolOn]}
      accessibilityRole={wecci ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityState={wecci ? { checked: !!active } : { selected: !!active }}
      aria-checked={wecci ? !!active : undefined}
      aria-pressed={!wecci ? (active ?? undefined) : undefined}
      testID={testID}
    >
      <Icon size={22} strokeWidth={2} color={wecci ? colors.wecci : colors.ink} />
    </Pressable>
  );
}

function ChipButton({ label, caption, onPress, warn }: { label: string; caption: string; onPress: () => void; warn?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, warn && styles.chipWarn]} accessibilityRole="button" accessibilityLabel={`${caption} : ${label}`}>
      <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <Text variant="bodyStrong" tone="fog" style={{ flex: 1 }}>
        {label}
      </Text>
      {on ? <Check size={18} color={dark.gold} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  restored: { flex: 1, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: dark.border, justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  audiencePill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.wecci, backgroundColor: dark.background },
  caption: { minHeight: 120, fontFamily: fonts.regular, fontSize: 20, lineHeight: 28, color: colors.ink, textAlignVertical: 'top', paddingVertical: 0 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starter: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  strip: { gap: spacing.sm, paddingVertical: 4 },
  thumb: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mediaBackdrop },
  thumbVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mediaBackdrop },
  thumbBadge: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: dark.glass },
  thumbRemove: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.glass },
  voiceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 14, minHeight: 44, borderRadius: 22, backgroundColor: colors.raised, borderWidth: 1, borderColor: dark.border },
  pasteNote: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, borderRadius: 16, backgroundColor: dark.subtle, borderWidth: 1, borderColor: dark.border, paddingHorizontal: spacing.md },
  pasteUndo: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  sellBox: { alignSelf: 'stretch', borderRadius: 20, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, padding: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priceInput: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: 16, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 26, color: colors.ink, backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  priceWarn: { borderColor: colors.gold },
  priceMode: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 22, backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  modeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  modeChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  chip: { minHeight: 44, maxWidth: 220, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  chipWarn: { borderColor: colors.gold },
  chipOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  destWrap: { gap: spacing.xs },
  destRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  destChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 22, backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  error: { alignSelf: 'stretch', padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.red, backgroundColor: dark.surface },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: dark.border, backgroundColor: dark.background },
  tool: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  toolOn: { backgroundColor: colors.raised, borderColor: colors.gold },
});
void radius;
