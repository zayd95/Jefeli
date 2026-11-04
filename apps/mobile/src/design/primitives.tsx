/**
 * Small Atlantic Sand primitives: chips, tags, badges, wordmark, dividers, cards,
 * skeletons, empty/error states, progress bar, section headers.
 */
import { BadgeCheck, CircleAlert, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { colors, radius, shadow, spacing } from './theme';

export function Wordmark({ size = 28, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityRole="header" accessibilityLabel="Jëfëli">
      <Text
        weight="800"
        color={color}
        style={{ fontSize: size, lineHeight: size * 1.18, letterSpacing: -size * 0.055 }}
      >
        Jëfëli
      </Text>
      <View
        style={{
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: size * 0.05,
          backgroundColor: colors.accentDeep,
          marginLeft: size * 0.06,
          marginBottom: size * 0.2,
        }}
      />
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
  const fg = tone === 'dark' ? (selected ? colors.ink : colors.white) : selected ? colors.white : colors.textSecondary;
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
    ink: { bg: colors.ink, fg: colors.white },
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

export function DemoBadge() {
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

export function Skeleton({ width, height, radius: r = radius.sm, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
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
  return <Animated.View style={[{ width: width ?? '100%', height, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: spacing.xl }]}>
      <View style={styles.emptyIcon}>
        <Icon size={26} color={colors.ink} strokeWidth={1.8} />
      </View>
      <Text variant="headline" align="center" style={{ marginTop: spacing.md }}>
        {title}
      </Text>
      {body ? (
        <Text variant="callout" tone="secondary" align="center" style={{ marginTop: spacing.xs, maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="cta" onPress={onAction} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite">
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
        <CircleAlert size={26} color={colors.danger} strokeWidth={1.8} />
      </View>
      <Text variant="headline" align="center" style={{ marginTop: spacing.md }}>
        Oups
      </Text>
      <Text variant="callout" tone="secondary" align="center" style={{ marginTop: spacing.xs, maxWidth: 300 }}>
        {message}
      </Text>
      {onRetry ? <Button label="Réessayer" variant="outline" icon={RefreshCw} onPress={onRetry} style={{ marginTop: spacing.lg }} /> : null}
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
  chipSelected: { backgroundColor: colors.ink },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.xs, alignSelf: 'flex-start' },
  demo: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F0DFA8',
  },
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
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
});
