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
  statusNeedsFeed,
  type Destination,
  type ItemCondition,
  type ListingMode,
  type PriceMode,
  type StudioInput,
} from '@jefeli/shared';
import { Check, ChevronDown, ChevronLeft, Mic } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostMedia } from '@/components/PostMedia';
import { Button, colors, dark, Field, fonts, IconButton, radius, Sheet, spacing, Text, Toggle, WEB_NO_OUTLINE } from '@/design';
import type { LocalMedia } from '@/lib/upload';
import type { MediaRow } from '@/lib/types';
import type { VoiceAttachment } from '@/lib/voice';

export interface ItemDraft {
  mode: ListingMode;
  priceMode: PriceMode;
  price: string;
  category: string;
  condition: ItemCondition;
  neighborhood: string;
}

const MODES: { key: ListingMode; label: string }[] = [
  { key: 'sale', label: 'Vendre' },
  { key: 'trade', label: 'Troquer' },
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
  onBack: () => void;
  onPublish: () => void;
  publishing: boolean;
  linkedTitle?: string | null;
  onUnlink?: () => void;
}

export function StudioComposer(p: ComposerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sheet, setSheet] = useState<null | 'price' | 'category' | 'condition' | 'place' | 'audience'>(null);
  const previewW = Math.min(width, 520) - spacing.lg * 2;
  const states = destinationStates(p.input);
  const hasMedia = p.media.length > 0;

  const rows: MediaRow[] = useMemo(
    () =>
      p.media.map((m, i) => ({
        id: `${m.uri}-${i}`,
        kind: m.kind,
        storage_path: '',
        poster_path: null,
        width: m.width,
        height: m.height,
        duration_ms: m.durationMs ?? null,
        position: i,
        local_uri: m.uri,
        local_poster: m.posterUri ?? null,
      })),
    [p.media],
  );
  const category = p.categories.find((c) => c.slug === p.item.category);
  const sells = p.item.mode === 'sale' || p.item.mode === 'sale_or_trade';
  const priceLabel = p.item.mode === 'give' ? 'Gratuit' : p.item.mode === 'trade' ? 'Valeur facultative' : p.item.priceMode === 'on_request' ? 'Sur demande' : p.item.priceMode === 'negotiable' ? 'À discuter' : p.item.price ? `${p.item.price} F` : 'Prix';

  return (
    <View style={styles.root} testID="studio-composer">
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <IconButton icon={ChevronLeft} label="Revenir à la caméra" variant="glass" color={colors.white} onPress={p.onBack} />
        <Text variant="bodyStrong" tone="fog" accessibilityRole="header" style={{ flex: 1 }}>
          Nouvelle création
        </Text>
        {p.restored ? (
          <Pressable onPress={p.onRestart} accessibilityRole="button" accessibilityLabel="Brouillon repris. Recommencer" style={styles.restored}>
            <Text variant="caption" weight="700" tone="fog">
              Brouillon repris · Recommencer
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {/* Preview */}
        {hasMedia ? (
          <View style={[styles.preview, { width: previewW }]}>
            <PostMedia visual={rows} voice={null} bucket="public-media" width={previewW} height={Math.min(previewW * 1.1, 380)} />
          </View>
        ) : p.voice ? (
          <View style={styles.voiceChip}>
            <Mic size={18} color={colors.ink} />
            <Text variant="callout" weight="700" color={colors.ink}>
              {`Message vocal · ${Math.round(p.voice.durationMs / 1000)} s`}
            </Text>
          </View>
        ) : null}
        {hasMedia && p.voice ? (
          <View style={styles.voiceChip}>
            <Mic size={18} color={colors.ink} />
            <Text variant="callout" weight="700" color={colors.ink}>
              {`Votre voix accompagne ce contenu · ${Math.round(p.voice.durationMs / 1000)} s`}
            </Text>
          </View>
        ) : null}

        {/* Caption */}
        <View style={styles.captionBox}>
          <TextInput
            value={p.caption}
            onChangeText={p.onCaption}
            placeholder={p.sell ? 'Nom de l’article, puis sa description…' : hasMedia || p.voice ? 'Ajoutez une légende…' : 'Écrivez votre texte…'}
            placeholderTextColor={dark.textSecondary}
            multiline
            maxLength={2200}
            style={[styles.caption, WEB_NO_OUTLINE]}
            accessibilityLabel={p.sell ? 'Nom et description de l’article' : 'Légende'}
            testID="studio-caption"
          />
        </View>

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

        {p.linkedTitle ? (
          <Pressable onPress={p.onUnlink} style={styles.voiceChip} accessibilityRole="button" accessibilityLabel={`Article lié : ${p.linkedTitle}. Retirer`}>
            <Text variant="callout" weight="700" color={colors.ink} numberOfLines={1}>
              {`Article lié : ${p.linkedTitle}`}
            </Text>
          </Pressable>
        ) : null}

        {/* The one switch */}
        {p.canSell ? (
          <View style={styles.sellBox}>
            <Toggle value={p.sell} onChange={p.onSell} label="Vendre ou troquer cet article" description={p.sell ? undefined : 'Prix, mode, catégorie : votre publication devient un article.'} />
            {p.sell ? (
              <View style={styles.chips} testID="studio-item-chips">
                <ChipButton label={priceLabel} caption="Prix" onPress={() => setSheet('price')} warn={sells && p.item.priceMode === 'fixed' && !p.item.price} />
                <View style={styles.modeRow} accessibilityLabel="Vendre, troquer ou donner">
                  {MODES.map((m) => {
                    const on = modeOn(p.item.mode, m.key);
                    return (
                      <Pressable key={m.key} onPress={() => p.onItem({ mode: nextMode(p.item.mode, m.key) })} style={[styles.modeChip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }} aria-pressed={on} accessibilityLabel={m.label}>
                        <Text variant="callout" weight={on ? '800' : '600'} color={colors.ink}>
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <ChipButton label={category?.name ?? 'Catégorie'} caption="Catégorie" onPress={() => setSheet('category')} warn={!category} />
                <ChipButton label={CONDITION_LABELS[p.item.condition]} caption="État" onPress={() => setSheet('condition')} />
                <ChipButton label={p.item.neighborhood || 'Quartier'} caption="Quartier" onPress={() => setSheet('place')} />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Destinations */}
        <View style={styles.dest} accessibilityRole="list">
          <Text variant="micro" weight="800" tone="mint" style={{ letterSpacing: 1 }}>
            PUBLIER SUR
          </Text>
          {DESTINATIONS.map((d) => {
            const st = states.find((s) => s.key === d)!;
            // Boutique is the switch: ticked and locked while it is on, absent otherwise.
            if (d === 'boutique' && !p.sell) return null;
            const on = p.selected.includes(d);
            const locked = d === 'boutique';
            const needsFeed = d === 'status' && statusNeedsFeed(p.input) && !p.selected.includes('feed');
            const available = st.available && !needsFeed;
            const hint =
              d === 'status' && st.available
                ? needsFeed
                  ? 'Avec voix ou plusieurs photos : cochez aussi Fil.'
                  : p.statusAudienceLabel
                : d === 'boutique'
                  ? 'L’article est ajouté à votre Boutique.'
                  : !st.available
                    ? st.reason
                    : null;
            return (
              <View key={d} style={[styles.destRow, !available && { opacity: 0.5 }]}>
                <Pressable
                  onPress={() => available && !locked && p.onToggle(d)}
                  disabled={!available || locked}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !available || locked }}
                  aria-checked={on}
                  aria-disabled={!available || locked}
                  accessibilityLabel={DESTINATION_LABELS[d]}
                  style={styles.destMain}
                  testID={`studio-dest-${d}`}
                >
                  <View style={[styles.box, on && styles.boxOn]}>{on ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" tone="fog">
                      {DESTINATION_LABELS[d]}
                    </Text>
                    {hint ? (
                      <Text variant="caption" tone="fogSecondary">
                        {hint}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {d === 'feed' && on ? (
                  <Pressable onPress={() => setSheet('audience')} style={styles.audiencePill} accessibilityRole="button" accessibilityLabel={`Visible par : ${AUDIENCE_LABELS[p.feedAudience].toLowerCase()}. Changer`} testID="studio-feed-audience">
                    <Text variant="caption" weight="700" tone="fog">
                      {{ public: 'Tout le monde', followers: 'Abonnés', friends: 'Amis' }[p.feedAudience]}
                    </Text>
                    <ChevronDown size={14} color={dark.text} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        {p.error ? (
          <View style={styles.error} accessibilityRole="alert">
            <Text variant="callout" tone="fog">
              {p.error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button label="Publier" variant="cta" size="lg" pill fullWidth loading={p.publishing} onPress={p.onPublish} testID="studio-publish" />
      </View>

      {/* Sheets */}
      <Sheet visible={sheet === 'price'} onClose={() => setSheet(null)} title="Prix" tone="dark">
        <View style={{ gap: spacing.md }}>
          {sells ? (
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
          ) : null}
          {p.item.mode === 'give' ? (
            <Text variant="callout" tone="fogSecondary">
              Un article donné est gratuit.
            </Text>
          ) : sells && p.item.priceMode === 'on_request' ? (
            <Text variant="callout" tone="fogSecondary">
              Aucun prix affiché : les acheteurs vous écrivent.
            </Text>
          ) : (
            <Field
              label={p.item.mode === 'trade' ? 'Valeur estimée (facultatif)' : 'Prix'}
              value={p.item.price}
              onChangeText={(t) => p.onItem({ price: formatAmountInput(t) })}
              keyboardType="number-pad"
              suffix="F CFA"
              accessibilityLabel={p.item.mode === 'trade' ? 'Valeur estimée' : 'Prix'}
            />
          )}
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
    </View>
  );
}

/** Vendre and Troquer can both be on (an article open to offers and swaps); Donner stands alone. */
function modeOn(mode: ListingMode, key: ListingMode): boolean {
  if (key === 'give') return mode === 'give';
  return mode === key || mode === 'sale_or_trade';
}
function nextMode(mode: ListingMode, key: ListingMode): ListingMode {
  if (key === 'give') return 'give';
  const sale = mode === 'give' ? key === 'sale' : key === 'sale' ? !(mode === 'sale' || mode === 'sale_or_trade') : mode === 'sale' || mode === 'sale_or_trade';
  const trade = mode === 'give' ? key === 'trade' : key === 'trade' ? !(mode === 'trade' || mode === 'sale_or_trade') : mode === 'trade' || mode === 'sale_or_trade';
  if (!sale && !trade) return mode;
  return sale && trade ? 'sale_or_trade' : sale ? 'sale' : 'trade';
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
  restored: { paddingHorizontal: 12, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: dark.border, justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  preview: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.mediaBackdrop },
  voiceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: colors.raised, borderWidth: 1, borderColor: dark.border },
  pasteNote: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, borderRadius: 16, backgroundColor: dark.subtle, borderWidth: 1, borderColor: dark.border, paddingHorizontal: spacing.md },
  pasteUndo: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  captionBox: { alignSelf: 'stretch', minHeight: 110, borderRadius: 20, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, padding: spacing.md },
  caption: { minHeight: 84, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.ink, textAlignVertical: 'top' },
  sellBox: { alignSelf: 'stretch', borderRadius: 20, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, padding: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  modeChip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  chip: { minHeight: 44, maxWidth: 220, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: dark.background, borderWidth: 1, borderColor: dark.border },
  chipWarn: { borderColor: colors.gold },
  chipOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  dest: { alignSelf: 'stretch', gap: spacing.sm },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingRight: spacing.sm, borderRadius: 16, backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border },
  destMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingLeft: spacing.md },
  audiencePill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: dark.border, backgroundColor: dark.background },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: dark.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.raised, borderColor: colors.gold },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  error: { alignSelf: 'stretch', padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.red, backgroundColor: dark.surface },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: dark.background, borderTopWidth: 1, borderTopColor: dark.border },
});
void radius;
