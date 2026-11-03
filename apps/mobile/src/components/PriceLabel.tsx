/**
 * Price with a quiet currency (owner's UI reference: strong digits, softer suffix).
 * « 35 000 F CFA » → strong « 35 000 », secondary « F CFA ». Listings without a displayed price
 * show their label instead (« Prix sur demande », « Prix à discuter », « À échanger »), never 0 F.
 * The full label stays in the accessibility name.
 */
import { formatListingPrice, formatXOF, hasDisplayedPrice } from '@jefeli/shared';
import type { TextStyle } from 'react-native';

import { colors, Text } from '@/design';

type Priced = { price_xof: number | null; price_mode?: string | null; listing_mode?: string | null };

const SIZES = {
  card: { digits: 16, line: 21, suffix: 12.5 },
  inline: { digits: 18, line: 23, suffix: 13 },
  display: { digits: 30, line: 36, suffix: 17 },
} as const;

export function PriceLabel({ product, size = 'card', compact = false, style }: { product: Priced; size?: keyof typeof SIZES; compact?: boolean; style?: TextStyle }) {
  const s = SIZES[size];
  const label = formatListingPrice(product, { compact });
  if (!hasDisplayedPrice(product)) {
    return (
      <Text weight="700" numberOfLines={1} style={[{ fontSize: s.digits - (size === 'display' ? 6 : 1), lineHeight: s.line }, style]} accessibilityLabel={label}>
        {label}
      </Text>
    );
  }
  const negotiable = product.price_mode === 'negotiable';
  const full = formatXOF(product.price_xof);
  const digits = full.replace(/ F CFA$/, '');
  // Narrow grid cards shorten to « F » when « à discuter » follows; elsewhere the full « F CFA ».
  const suffix = compact || (negotiable && size === 'card') ? 'F' : 'F CFA';
  return (
    <Text weight="800" numberOfLines={1} style={[{ fontSize: s.digits, lineHeight: s.line, letterSpacing: size === 'display' ? -0.6 : -0.2 }, style]} accessibilityLabel={label}>
      {digits}
      <Text weight="600" color={colors.textSecondary} style={{ fontSize: s.suffix, lineHeight: s.line, letterSpacing: 0 }}>
        {` ${suffix}`}
      </Text>
      {negotiable ? (
        <Text weight="600" color={colors.textSecondary} style={{ fontSize: s.suffix, lineHeight: s.line, letterSpacing: 0 }}>
          {' · à discuter'}
        </Text>
      ) : null}
    </Text>
  );
}
