/**
 * Context pane of the desktop Messages workspace (W1.4): the member, the article discussed,
 * offers / Wecci proposals with their real status, and the safety reminder with report / profile
 * links. Read-only: every action stays in the thread (offer cards) or on the article page.
 */
import { AGREEMENT_STATUS_LABELS, formatListingPrice, formatXOF, OFFER_STATUS_LABELS, PLATFORM_DISCLAIMER, type OfferStatus } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Flag, Repeat, ShieldCheck, Tag, UserRound } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Thumb } from '@/components/Media';
import { ProfileName } from '@/components/ProfileName';
import { Avatar, dark, radius, spacing, Text } from '@/design';
import { fetchAgreementsForConversation, fetchConversation, fetchLatestConversationProductId, fetchOffersForConversation } from '@/lib/api/messages';
import { fetchProduct } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { isHovered } from '@/lib/layout';

export function ChatContext({ conversationId, aboutId }: { conversationId: string; aboutId: string | null }) {
  const { userId } = useAuth();
  const conv = useQuery({ queryKey: ['conversation', conversationId], queryFn: () => fetchConversation(conversationId) });
  const offers = useQuery({ queryKey: ['offers', conversationId], queryFn: () => fetchOffersForConversation(conversationId) });
  const agreements = useQuery({ queryKey: ['agreements', conversationId], queryFn: () => fetchAgreementsForConversation(conversationId) });
  const latest = useQuery({ queryKey: ['conversation-product', conversationId], queryFn: () => fetchLatestConversationProductId(conversationId), enabled: !aboutId });
  const lastOffer = [...(offers.data ?? [])].reverse()[0];
  const productId = aboutId ?? lastOffer?.product_id ?? latest.data ?? null;
  const product = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId ?? ''), enabled: !!productId, staleTime: 60_000 });

  const other = conv.data?.members.find((m) => m.user_id !== userId);
  const p = product.data;

  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Contexte de la conversation">
      {other?.profile ? (
        <Pressable onPress={() => router.push(`/u/${other.profile?.handle}`)} accessibilityRole="link" style={(s) => [styles.member, isHovered(s) && styles.hover]}>
          <Avatar path={other.profile.avatar_path} name={other.profile.display_name} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ProfileName profile={other.profile} tone="dark" />
            <Text variant="caption" color={dark.textSecondary} numberOfLines={1}>
              @{other.profile.handle}
              {other.profile.city ? ` · ${other.profile.city}` : ''}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {p ? (
        <Section title="Article discuté">
          <Pressable onPress={() => router.push(`/p/${p.id}`)} accessibilityRole="link" accessibilityLabel={`${p.title}, ${formatListingPrice(p)}`} style={{ gap: spacing.sm }}>
            <Thumb media={p.media.find((m) => m.kind !== 'audio')} style={styles.image} />
            <Text weight="700" color={dark.text} numberOfLines={2} style={{ fontSize: 14.5 }}>
              {p.title}
            </Text>
            <Text weight="800" color={dark.text} style={{ fontSize: 15 }}>
              {formatListingPrice(p)}
            </Text>
            <Text variant="caption" weight="700" color={dark.mint}>
              Voir l’article →
            </Text>
          </Pressable>
        </Section>
      ) : null}

      {(offers.data ?? []).length > 0 ? (
        <Section title="Propositions">
          {[...(offers.data ?? [])].reverse().slice(0, 4).map((o) => {
            const agreement = (agreements.data ?? []).find((a) => a.offer_id === o.id);
            const barter = o.kind === 'barter';
            const Icon = barter ? Repeat : Tag;
            return (
              <View key={o.id} style={styles.offer}>
                <Icon size={16} color={barter ? dark.gold : dark.mint} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight="700" color={dark.text} style={{ fontSize: 13.5 }}>
                    {barter ? 'Wecci (troc)' : 'Offre de prix'}
                    {o.amount_xof ? ` · ${formatXOF(o.amount_xof)}` : ''}
                  </Text>
                  <Text variant="caption" color={dark.textSecondary}>
                    {o.proposer_id === userId ? 'Vous proposez' : 'Proposé à vous'} · {agreement ? AGREEMENT_STATUS_LABELS[agreement.status] ?? agreement.status : OFFER_STATUS_LABELS[o.status as OfferStatus] ?? o.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </Section>
      ) : null}

      <Section title="Sécurité">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ShieldCheck size={16} color={dark.mint} />
          <Text variant="caption" color={dark.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
            {PLATFORM_DISCLAIMER} Ne partagez jamais de codes reçus par SMS.
          </Text>
        </View>
        {other ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={() => router.push(`/u/${other.profile?.handle}`)} accessibilityRole="link" style={styles.link}>
              <UserRound size={15} color={dark.text} />
              <Text variant="callout" weight="700" color={dark.text}>
                Voir le profil
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: '/report', params: { type: 'profile', id: other.user_id } })} accessibilityRole="link" style={styles.link}>
              <Flag size={15} color={dark.text} />
              <Text variant="callout" weight="700" color={dark.text}>
                Signaler
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="micro" weight="800" color={dark.textSecondary} accessibilityRole="header" style={{ fontSize: 11, letterSpacing: 1 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 4, borderRadius: 12 },
  hover: { backgroundColor: dark.subtle },
  section: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: dark.border },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: dark.raised },
  offer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
});
