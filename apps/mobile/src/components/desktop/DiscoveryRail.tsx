/**
 * Desktop discovery rail beside the Accueil feed (W1.4, web ≥ 1100 px). Contextual and real only:
 *   1. « On cherche » — latest « Je cherche » publications (buyer requests, not filtered by city);
 *   2. articles linked to the publications currently in the feed;
 *   3. articles near the member (their city);
 *   4. boutiques selling those nearby articles.
 * A section with nothing real to show is not rendered. No recommendation is invented.
 */
import { formatListingPrice, type PostIntent } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/Media';
import { Avatar, colors, dark, DemoBadge, radius, spacing, Text, VerifiedBadge } from '@/design';
import { fetchRecentRequests } from '@/lib/api/posts';
import { browseProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { isHovered } from '@/lib/layout';
import type { PostCardData, ProductCard, TaggedProduct } from '@/lib/types';

export function DiscoveryRail({ feed }: { feed: PostCardData[] }) {
  const { userId, profile } = useAuth();
  const city = profile?.city ?? null;
  const requests = useQuery({ queryKey: ['rail-requests'], queryFn: () => fetchRecentRequests(3), staleTime: 60_000 });
  const nearby = useQuery({
    queryKey: ['rail-nearby', city],
    queryFn: () => browseProducts({ mode: 'recent', city, limit: 8 }),
    enabled: !!city,
    staleTime: 60_000,
  });

  const linked = useMemo(() => {
    const seen = new Set<string>();
    const out: TaggedProduct[] = [];
    for (const post of feed) {
      for (const t of post.tagged ?? []) {
        const p = t.product;
        if (p && p.status === 'active' && !seen.has(p.id)) {
          seen.add(p.id);
          out.push(p);
        }
      }
    }
    return out.slice(0, 3);
  }, [feed]);

  const nearbyItems = (nearby.data ?? []).filter((p) => p.seller_id !== userId).slice(0, 4);
  const boutiques = useMemo(() => {
    const seen = new Map<string, NonNullable<ProductCard['seller']>>();
    for (const p of nearby.data ?? []) if (p.seller && p.seller.id !== userId && !seen.has(p.seller.id)) seen.set(p.seller.id, p.seller);
    return [...seen.values()].slice(0, 3);
  }, [nearby.data, userId]);
  const requestItems = (requests.data ?? []).filter((r) => r.author?.id !== userId);

  return (
    <ScrollView style={styles.rail} contentContainerStyle={styles.content} accessibilityLabel="Découvrir">
      {requestItems.length > 0 ? (
        <Section title="On cherche">
          {requestItems.map((r) => (
            <Pressable key={r.id} onPress={() => router.push(`/post/${r.id}`)} accessibilityRole="link" style={(s) => [styles.row, isHovered(s) && styles.hover]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="micro" weight="800" color={dark.mint} style={{ fontSize: 11, letterSpacing: 1 }}>
                  {intentLabel(r.intent as PostIntent)}
                </Text>
                <Text variant="caption" color={dark.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {r.author?.display_name}
                </Text>
                {r.author?.is_demo ? <DemoBadge tone="dark" /> : null}
              </View>
              <Text color={dark.text} numberOfLines={3} style={{ fontSize: 14.5, lineHeight: 20 }}>
                {r.body}
              </Text>
            </Pressable>
          ))}
        </Section>
      ) : null}

      {linked.length > 0 ? (
        <Section title="Articles des publications">
          {linked.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/p/${p.id}`)} accessibilityRole="link" accessibilityLabel={`${p.title}, ${formatListingPrice(p)}`} style={(s) => [styles.product, isHovered(s) && styles.hover]}>
              <Thumb media={[...(p.media ?? [])].sort((a, b) => a.position - b.position)[0]} style={styles.thumb} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="600" color={dark.text} numberOfLines={2} style={{ fontSize: 14 }}>
                  {p.title}
                </Text>
                <Text weight="800" color={dark.text} style={{ fontSize: 14 }}>
                  {formatListingPrice(p)}
                </Text>
              </View>
            </Pressable>
          ))}
        </Section>
      ) : null}

      {nearbyItems.length > 0 ? (
        <Section title={`Près de chez vous · ${city}`} action={{ label: 'Tout voir', onPress: () => router.push('/explore') }}>
          <View style={styles.grid}>
            {nearbyItems.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/p/${p.id}`)} accessibilityRole="link" accessibilityLabel={`${p.title}, ${formatListingPrice(p)}`} style={styles.tile}>
                <Thumb media={p.media[0]} style={styles.tileImage} />
                <Text weight="800" color={dark.text} numberOfLines={1} style={{ fontSize: 14 }}>
                  {formatListingPrice(p)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MapPin size={11} color={dark.textSecondary} />
                  <Text variant="caption" color={dark.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {p.neighborhood ?? p.city}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {boutiques.length > 0 ? (
        <Section title="Boutiques près de chez vous">
          {boutiques.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/u/${s.handle}`)} accessibilityRole="link" style={(s) => [styles.product, isHovered(s) && styles.hover]}>
              <Avatar path={s.avatar_path} name={s.display_name} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text weight="700" color={dark.text} numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
                    {s.display_name}
                  </Text>
                  {s.verification_level === 'merchant_verified' ? <VerifiedBadge size={14} /> : null}
                  {s.is_demo ? <DemoBadge tone="dark" /> : null}
                </View>
                <Text variant="caption" color={dark.textSecondary} numberOfLines={1}>
                  @{s.handle}
                  {s.city ? ` · ${s.city}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </Section>
      ) : null}

      <Text variant="caption" color={dark.textTertiary} style={{ paddingHorizontal: 4 }}>
        Conditions · Confidentialité · Règles de la communauté
      </Text>
    </ScrollView>
  );
}

function intentLabel(intent: PostIntent): string {
  return intent === 'seek' ? 'JE CHERCHE' : 'DEMANDE';
}

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text weight="800" color={dark.text} accessibilityRole="header" style={{ fontSize: 16 }}>
          {title}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={8}>
            <Text variant="caption" weight="700" color={dark.mint}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { width: 340, flexGrow: 0, flexShrink: 0 },
  content: { paddingVertical: spacing.lg, paddingRight: spacing.xl, gap: spacing.lg },
  section: { backgroundColor: dark.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: dark.border, padding: spacing.lg, gap: spacing.md },
  row: { gap: 4, paddingVertical: 4, borderRadius: 10 },
  hover: { backgroundColor: dark.subtle },
  product: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 12, padding: 2 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: dark.raised },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47%', gap: 4 },
  tileImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.night },
});
