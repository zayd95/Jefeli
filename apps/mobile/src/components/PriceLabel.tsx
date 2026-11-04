/**
 * Price with a quiet currency (strong digits, softer « F CFA »), ported to the Lovable PriceLine:
 *   - Prix affiché  → « 35 000 F CFA »
 *   - À discuter    → digits + a gold « À discuter » pill on cards; « … · à discuter » on the product page
 *   - Sur demande   → a gold dot + « Prix sur demande » (never « 0 F »)
 * The full label stays in the accessibility name. `tone="dark"` is for Atlantic-night surfaces.
 */
import { formatListingPrice, formatXOF, hasDisplayedPrice } from '@jefeli/shared';
import { View, type TextStyle } from 'react-native';

import { colors, dark, Text } from '@/design';

type Priced = { price_xof: number | null; price_mode?: string | null; listing_mode?: string | null };

const SIZES = {
  card: { digits: 15, line: 20, suffix: 12 },
  inline: { digits: 16, line: 21, suffix: 12.5 },
  display: { digits: 22, line: 28, suffix: 15 },
} as const;

export function PriceLabel({
  product,
  size = 'card',
  compact = false,
  style,
  tone = 'light',
}: {
  product: Priced;
  size?: keyof typeof SIZES;
  compact?: boolean;
  style?: TextStyle;
  tone?: 'light' | 'dark';
}) {
  const s = SIZES[size];
  const isDark = tone === 'dark';
  const strong = isDark ? dark.text : colors.ink;
  const soft = isDark ? dark.textSecondary : colors.textSecondary;
  const label = formatListingPrice(product, { compact });
  const negotiable = product.price_mode === 'negotiable';
  const pill = negotiable && size !== 'display';

  if (!hasDisplayedPrice(product)) {
    const onRequest = label === 'Prix sur demande';
    if (pill || (onRequest && size !== 'display')) {
      // Cards: « Prix sur demande » with a gold dot, « À discuter » as the gold pill alone.
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={label}>
          {pill ? (
            <NegotiablePill dark={isDark} />
          ) : (
            <>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
              <Text weight="600" color={soft} numberOfLines={1} style={[{ fontSize: s.digits - 2, lineHeight: s.line }, style]}>
                {label}
              </Text>
            </>
          )}
        </View>
      );
    }
    return (
      <Text weight="700" color={strong} numberOfLines={1} style={[{ fontSize: s.digits - (size === 'display' ? 2 : 1), lineHeight: s.line }, style]} accessibilityLabel={label}>
        {label}
      </Text>
    );
  }

  const full = formatXOF(product.price_xof);
  const digits = full.replace(/[\s\u00A0\u202F]*F CFA$/, '');
  const suffix = compact ? 'F' : 'F CFA';
  const amount = (
    <Text weight="800" color={strong} numberOfLines={1} style={[{ fontSize: s.digits, lineHeight: s.line, letterSpacing: size === 'display' ? -0.4 : -0.1, fontVariant: ['tabular-nums'] }, style]} accessibilityLabel={pill ? undefined : label}>
      {digits}
      <Text weight="600" color={soft} style={{ fontSize: s.suffix, lineHeight: s.line, letterSpacing: 0 }}>
        {` ${suffix}`}
      </Text>
      {negotiable && !pill ? (
        <Text weight="600" color={soft} style={{ fontSize: s.suffix, lineHeight: s.line, letterSpacing: 0 }}>
          {' · à discuter'}
        </Text>
      ) : null}
    </Text>
  );
  if (!pill) return amount;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }} accessible accessibilityLabel={label}>
      {amount}
      <NegotiablePill dark={isDark} />
    </View>
  );
}

function NegotiablePill({ dark: isDark }: { dark: boolean }) {
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: isDark ? dark.goldSoft : colors.goldSoft }}>
      <Text weight="700" color={isDark ? dark.gold : colors.ink} style={{ fontSize: 11, lineHeight: 15 }}>
        À discuter
      </Text>
    </View>
  );
}
