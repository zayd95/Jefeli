/**
 * Small Atlantic Sand primitives: chips, tags, badges, wordmark, dividers, cards,
 * skeletons, empty/error states, progress bar, section headers.
 */
import * as Clipboard from 'expo-clipboard';
import { BadgeCheck, ChevronDown, ChevronUp, CircleAlert, Copy, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { colors, dark, light, radius, shadow, spacing } from './theme';

/** Lovable wordmark: Fraunces semibold « Jëfëli » with a gold full stop. */
export function Wordmark({ size = 28, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityRole="header" accessibilityLabel="Jëfëli">
      <Text serif weight="600" color={color} style={{ fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.025 }}>
        Jëfëli
        <Text serif weight="600" color={colors.gold} style={{ fontSize: size, lineHeight: size * 1.2 }}>
          .
        </Text>
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
  style,
  tone = 'light',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  tone?: 'light' | 'dark';
}) {
  const fg = selected ? colors.onPrimary : tone === 'dark' ? colors.ink : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }} aria-selected={!!selected}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && !selected && { backgroundColor: colors.surfaceMuted },
        style,
      ]}
    >
      {Icon ? <Icon size={15} color={fg} strokeWidth={2.2} /> : null}
      <Text variant="callout" weight={selected ? '700' : '500'} color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'mint' | 'warning' | 'ink' | 'danger' }) {
  const map = {
    neutral: { bg: colors.surfaceMuted, fg: colors.ink },
    mint: { bg: colors.mintSoft, fg: colors.ink },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    ink: { bg: colors.surfaceMuted, fg: colors.ink },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: map.bg }]}>
      <Text variant="caption" weight="600" color={map.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View accessibilityLabel="Vendeur vérifié par l’équipe Jëfëli">
      <BadgeCheck size={size} color={colors.white} fill={colors.accentDeep} strokeWidth={2.2} />
    </View>
  );
}

export function DemoBadge({ tone = 'light' }: { tone?: 'light' | 'dark' | 'paper' }) {
  if (tone === 'paper') {
    // White Explorer page: dark ochre on pale gold (AA on white).
    return (
      <View style={[styles.demo, { backgroundColor: '#FFF4D6' }]} accessibilityLabel="Compte de démonstration">
        <Text variant="micro" weight="800" color="#7A5A00" style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
          DÉMO
        </Text>
      </View>
    );
  }
  if (tone === 'dark') {
    // Lovable DemoTag on Atlantic night: quiet fog pill, still clearly « DÉMO ».
    return (
      <View style={styles.demoDark} accessibilityLabel="Compte de démonstration">
        <Text variant="micro" weight="800" tone="fogSecondary" style={{ fontSize: 9.5, letterSpacing: 1.1 }}>
          DÉMO
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.demo} accessibilityLabel="Compte de démonstration">
      <Text variant="micro" weight="800" color={colors.warning} style={{ fontSize: 9.5, letterSpacing: 0.6 }}>
        DÉMO
      </Text>
    </View>
  );
}

/** Only rendered when the provider confirmed the session is live. */
export function LiveBadge({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.live, compact && { paddingHorizontal: 6, paddingVertical: 2 }]} accessibilityLabel="En direct">
      <View style={styles.liveDot} />
      <Text variant="micro" weight="800" color={colors.white} style={{ letterSpacing: 0.5 }}>
        EN DIRECT
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: spacing.lg }, style]}>{children}</View>;
}

/** Gold eyebrow: a short gold rule and a spaced uppercase label above an editorial heading. */
export function Eyebrow({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: 24, height: 2, borderRadius: 1, backgroundColor: colors.gold }} />
      <Text weight="700" color={dark.textSecondary} style={{ fontSize: 11.5, lineHeight: 14, letterSpacing: 1.6 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="headline" weight="800">
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={action}>
          <Text variant="callout" weight="600" tone="secondary">
            {action} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Skeleton({
  width,
  height,
  radius: r = radius.sm,
  style,
  tone = 'light',
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: 'light' | 'dark' | 'paper';
}) {
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width: width ?? '100%', height, borderRadius: r, backgroundColor: tone === 'dark' ? dark.raised : tone === 'paper' ? light.surfaceMuted : colors.skeleton, opacity }, style]} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  compact,
  tone = 'light',
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  /** Dark = Lovable editorial empty state on Atlantic night (serif title, fog body). Paper = the white Explorer page. */
  tone?: 'light' | 'dark' | 'paper';
}) {
  const isDark = tone === 'dark';
  const paper = tone === 'paper';
  return (
    <View style={[styles.empty, compact && { paddingVertical: spacing.xl }]}>
      <View style={[styles.emptyIcon, isDark && { backgroundColor: dark.mintSoft, borderWidth: 1, borderColor: dark.mintLine }, paper && { backgroundColor: light.accentSoft }]}>
        <Icon size={26} color={isDark ? dark.mint : paper ? light.ink : colors.ink} strokeWidth={1.8} />
      </View>
      <Text variant={isDark ? 'title' : 'headline'} serif={isDark} tone={isDark ? 'fog' : 'default'} color={paper ? light.ink : undefined} align="center" style={{ marginTop: spacing.md }}>
        {title}
      </Text>
      {body ? (
        <Text variant="callout" tone={isDark ? 'fogSecondary' : 'secondary'} color={paper ? light.textSecondary : undefined} align="center" style={{ marginTop: spacing.xs, maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="cta" onPress={onAction} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

/**
 * A failed request, with a way forward (W1.3: never a dead screen).
 * - `title`/`message`: from describeFailure() when available, else « Oups » + message.
 * - `onRetry`: always offered; `retrying` shows the attempt in progress.
 * - `alternative`: an action that doesn't depend on the failed request (Explorer, se reconnecter…).
 * - `details`: diagnostics for support, folded by default, with « Copier ».
 */
export function ErrorState({
  title = 'Oups',
  message,
  onRetry,
  retrying,
  alternative,
  details,
  tone = 'light',
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  alternative?: { label: string; icon?: LucideIcon; onPress: () => void };
  details?: string;
  tone?: 'light' | 'dark';
}) {
  const isDark = tone === 'dark';
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite" testID="error-state">
      <View style={[styles.emptyIcon, { backgroundColor: isDark ? dark.subtle : colors.dangerSoft }]}>
        <CircleAlert size={26} color={isDark ? dark.danger : colors.danger} strokeWidth={1.8} />
      </View>
      <Text variant="headline" tone={isDark ? 'fog' : 'default'} align="center" style={{ marginTop: spacing.md }} accessibilityRole="header">
        {title}
      </Text>
      <Text variant="callout" tone={isDark ? 'fogSecondary' : 'secondary'} align="center" style={{ marginTop: spacing.xs, maxWidth: 300 }}>
        {message}
      </Text>
      <View style={styles.errorActions}>
        {onRetry ? (
          <Button label="Réessayer" variant={isDark ? 'outlineDark' : 'outline'} pill icon={RefreshCw} loading={retrying} onPress={onRetry} />
        ) : null}
        {alternative ? (
          <Button label={alternative.label} variant={isDark ? 'ghostDark' : 'ghost'} pill icon={alternative.icon} onPress={alternative.onPress} />
        ) : null}
      </View>
      {details ? <SupportDetails details={details} tone={tone} /> : null}
    </View>
  );
}

function SupportDetails({ details, tone }: { details: string; tone: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDark = tone === 'dark';
  const fg = isDark ? dark.textTertiary : colors.textSecondary;
  return (
    <View style={styles.details}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel="Détails pour l’assistance"
        style={styles.detailsToggle}
      >
        <Text variant="caption" weight="600" color={fg}>
          Détails pour l’assistance
        </Text>
        {open ? <ChevronUp size={14} color={fg} /> : <ChevronDown size={14} color={fg} />}
      </Pressable>
      {open ? (
        <View style={[styles.detailsBox, { backgroundColor: isDark ? dark.subtle : colors.surfaceSubtle }]}>
          <Text variant="caption" color={isDark ? dark.textStrong : colors.ink} selectable style={{ lineHeight: 18 }}>
            {details}
          </Text>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(details);
              setCopied(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Détails copiés' : 'Copier les détails'}
            hitSlop={8}
            style={styles.detailsCopy}
          >
            <Copy size={14} color={fg} />
            <Text variant="caption" weight="700" color={fg}>
              {copied ? 'Copié' : 'Copier'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** One quiet line above or below content that is still shown: « Actualisation impossible · Réessayer ». */
export function InlineRetry({ message, onRetry, retrying, tone = 'light' }: { message: string; onRetry: () => void; retrying?: boolean; tone?: 'light' | 'dark' }) {
  const isDark = tone === 'dark';
  return (
    <View style={[styles.inlineRetry, { backgroundColor: isDark ? dark.subtle : colors.dangerSoft }]} accessibilityLiveRegion="polite" testID="inline-retry">
      <CircleAlert size={16} color={isDark ? dark.danger : colors.danger} strokeWidth={2} />
      <Text variant="caption" weight="600" color={isDark ? dark.textStrong : colors.ink} style={{ flex: 1 }}>
        {message}
      </Text>
      <Pressable onPress={onRetry} disabled={retrying} accessibilityRole="button" accessibilityLabel="Réessayer" hitSlop={10} style={styles.inlineRetryBtn}>
        <RefreshCw size={14} color={isDark ? dark.mint : colors.ink} />
        <Text variant="caption" weight="800" color={isDark ? dark.mint : colors.ink}>
          {retrying ? '…' : 'Réessayer'}
        </Text>
      </Pressable>
    </View>
  );
}

export function ProgressBar({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.progressTrack, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.max(2, Math.min(100, value * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  chipIdle: { backgroundColor: 'transparent' },
  chipSelected: { backgroundColor: colors.primary },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.xs, alignSelf: 'flex-start' },
  demo: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F0DFA8',
  },
  demoDark: { backgroundColor: dark.subtle, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.live,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  details: { alignItems: 'center', marginTop: spacing.lg, alignSelf: 'stretch' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing.md },
  detailsBox: { width: '100%', maxWidth: 360, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  detailsCopy: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', minHeight: 32 },
  inlineRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  inlineRetryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
});
