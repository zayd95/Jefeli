import { PLATFORM_DISCLAIMER, toFrenchError } from '@jefeli/shared';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Bell, BellOff, ChevronLeft, EyeOff, Flag, MessageCircleOff, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { confirmAsync } from '@/components/ContentMenu';
import { ChatComposer, type VoiceClip } from '@/components/chat/Composer';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { OfferCard } from '@/components/chat/OfferCard';
import { ProductPicker } from '@/components/chat/ProductPicker';
import { ProfileName } from '@/components/ProfileName';
import { Avatar, colors, EmptyState, Header, IconButton, Screen, Sheet, SheetAction, Skeleton, spacing, Text, useToast } from '@/design';
import {
  deleteMessage,
  fetchAgreementsForConversation,
  fetchConversation,
  fetchMessages,
  fetchOffersForConversation,
  hideConversation,
  markConversationRead,
  MESSAGE_PAGE,
  sendAttachment,
  sendProductCards,
  sendText,
  setConversationMuted,
} from '@/lib/api/messages';
import { block } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';
import { useFlag } from '@/lib/flags';
import { useConversationRealtime } from '@/lib/realtime';
import { compressImage, newObjectPath, pickMedia, uploadErrorMessage, uploadWithRetry, UploadError } from '@/lib/upload';
import type { MessageRow } from '@/lib/types';
import { goBack } from '@/lib/nav';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const me = userId ?? '';
  const qc = useQueryClient();
  const toast = useToast();
  const voiceEnabled = useFlag('voice_messages');
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [picker, setPicker] = useState(false);

  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => fetchConversation(id ?? '') });
  const messages = useInfiniteQuery({
    queryKey: ['messages', id],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchMessages(id ?? '', pageParam),
    getNextPageParam: (last) => (last.length < MESSAGE_PAGE ? undefined : last[last.length - 1]?.created_at),
  });
  const offers = useQuery({ queryKey: ['offers', id], queryFn: () => fetchOffersForConversation(id ?? '') });
  const agreements = useQuery({ queryKey: ['agreements', id], queryFn: () => fetchAgreementsForConversation(id ?? '') });

  const markRead = useCallback(() => {
    if (!id || !me) return;
    markConversationRead(me, id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['unread-messages'] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
      })
      .catch(() => {});
  }, [id, me, qc]);

  useConversationRealtime(id, markRead);
  const latestMessageId = messages.data?.pages[0]?.[0]?.id;
  useEffect(() => {
    markRead();
  }, [markRead, latestMessageId]);

  const other = conv.data?.members.find((m) => m.user_id !== me);
  const mine = conv.data?.members.find((m) => m.user_id === me);
  const otherName = other?.profile?.display_name ?? 'Membre';
  const items = useMemo(() => messages.data?.pages.flat() ?? [], [messages.data]);
  const offerById = useMemo(() => new Map((offers.data ?? []).map((o) => [o.id, o])), [offers.data]);
  const agreementByOffer = useMemo(() => new Map((agreements.data ?? []).map((a) => [a.offer_id, a])), [agreements.data]);
  const lastMine = items.find((m) => m.sender_id === me && m.kind !== 'system');

  function refresh() {
    qc.invalidateQueries({ queryKey: ['messages', id] });
  }

  async function onSendText(text: string) {
    try {
      await sendText(me, id ?? '', text);
      refresh();
    } catch (e) {
      toast(toFrenchError(e), 'error');
      throw e;
    }
  }

  async function onPickImage() {
    try {
      const picked = await pickMedia({ allowVideo: false });
      const img = picked?.[0];
      if (!img) return;
      const c = await compressImage(img);
      const path = newObjectPath(me, 'messages', 'image/jpeg');
      await uploadWithRetry({ bucket: 'private-media', path, uri: c.uri, mimeType: 'image/jpeg', file: c.file });
      await sendAttachment(me, id ?? '', 'image', path, { width: c.width, height: c.height });
      refresh();
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    }
  }

  async function onSendProducts(productIds: string[]) {
    await sendProductCards(me, id ?? '', productIds);
    refresh();
  }

  async function onSendVoice(clip: VoiceClip) {
    try {
      const path = newObjectPath(me, 'messages', clip.mimeType);
      await uploadWithRetry({ bucket: 'private-media', path, uri: clip.uri, mimeType: clip.mimeType });
      await sendAttachment(me, id ?? '', 'voice', path, { duration_ms: Math.round(clip.durationMs) });
      refresh();
    } catch (e) {
      toast(e instanceof UploadError ? uploadErrorMessage(e) : toFrenchError(e), 'error');
    }
  }

  if (conv.isPending) {
    return (
      <Screen>
        <Header />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={40} width="60%" />
          <Skeleton height={40} width="45%" style={{ alignSelf: 'flex-end' }} />
        </View>
      </Screen>
    );
  }
  if (!conv.data) {
    return (
      <Screen>
        <Header />
        <EmptyState icon={MessageCircleOff} title="Conversation introuvable" body="Elle a peut-être été supprimée, ou vous n’en faites pas partie." />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.peerBar}>
          <IconButton icon={ChevronLeft} label="Retour" size={26} onPress={() => goBack('/messages')} />
          <Pressable
            style={styles.peer}
            onPress={() => other?.profile && router.push(`/u/${other.profile.handle}`)}
            accessibilityRole="button"
            accessibilityLabel={`Profil de ${otherName}`}
          >
            <Avatar path={other?.profile?.avatar_path} name={otherName} size={40} />
            <View style={{ flex: 1 }}>
              {other?.profile ? <ProfileName profile={other.profile} /> : <Text variant="bodyStrong">{otherName}</Text>}
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                @{other?.profile?.handle}
                {mine?.muted ? ' · en sourdine' : ''}
              </Text>
            </View>
          </Pressable>
          <IconButton icon={MoreHorizontal} label="Options de la conversation" onPress={() => setMenu(true)} />
        </View>

        <FlatList
          inverted
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            !messages.hasNextPage && !messages.isPending ? (
              <View style={styles.safety}>
                <ShieldCheck size={16} color={colors.accentDeep} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {PLATFORM_DISCLAIMER} Ne partagez jamais de codes reçus par SMS.
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => {
            const next = items[index - 1];
            const showTime = !next || next.sender_id !== item.sender_id || new Date(next.created_at).getTime() - new Date(item.created_at).getTime() > 5 * 60_000;
            const isMine = item.sender_id === me;
            if (item.kind === 'offer' && item.offer_id) {
              const offer = offerById.get(item.offer_id);
              if (!offer) return null;
              return (
                <View style={[styles.offerRow, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  <OfferCard offer={offer} me={me} agreement={agreementByOffer.get(offer.id)} otherName={otherName} />
                </View>
              );
            }
            const receipt =
              item.id === lastMine?.id && other
                ? new Date(other.last_read_at).getTime() >= new Date(item.created_at).getTime()
                  ? 'Vu'
                  : 'Envoyé'
                : null;
            return (
              <MessageBubble
                message={item}
                mine={isMine}
                showTime={showTime}
                receipt={receipt as 'Vu' | 'Envoyé' | null}
                onLongPress={() => setSelected(item)}
              />
            );
          }}
          ListEmptyComponent={
            messages.isPending ? undefined : (
              <Text variant="callout" tone="secondary" align="center" style={{ padding: spacing.xl, transform: [{ scaleY: -1 }] }}>
                Dites bonjour à {otherName}.
              </Text>
            )
          }
        />
        <ChatComposer
          onSendText={onSendText}
          onPickImage={onPickImage}
          onSendVoice={onSendVoice}
          onPickProducts={() => setPicker(true)}
          voiceEnabled={voiceEnabled}
        />
      </KeyboardAvoidingView>

      <ProductPicker visible={picker} onClose={() => setPicker(false)} me={me} otherId={other?.user_id ?? null} otherName={otherName} onSend={onSendProducts} />

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction
          icon={mine?.muted ? Bell : BellOff}
          label={mine?.muted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
          onPress={async () => {
            setMenu(false);
            await setConversationMuted(me, id ?? '', !mine?.muted).catch((e) => toast(toFrenchError(e), 'error'));
            qc.invalidateQueries({ queryKey: ['conversation', id] });
          }}
        />
        <SheetAction
          icon={EyeOff}
          label="Masquer la conversation"
          description="Elle réapparaîtra si vous recevez un nouveau message."
          onPress={async () => {
            setMenu(false);
            await hideConversation(me, id ?? '');
            qc.invalidateQueries({ queryKey: ['conversations'] });
            goBack();
          }}
        />
        {other ? (
          <>
            <SheetAction
              icon={Flag}
              label={`Signaler ${otherName}`}
              onPress={() => {
                setMenu(false);
                router.push({ pathname: '/report', params: { type: 'profile', id: other.user_id } });
              }}
            />
            <SheetAction
              icon={Ban}
              label={`Bloquer ${otherName}`}
              destructive
              onPress={async () => {
                setMenu(false);
                if (await confirmAsync(`Bloquer ${otherName} ?`, 'Vous ne pourrez plus vous écrire ni voir vos contenus respectifs.', 'Bloquer')) {
                  try {
                    await block(me, other.user_id);
                    qc.invalidateQueries();
                    toast(`${otherName} est bloqué(e)`, 'success');
                    goBack();
                  } catch (e) {
                    toast(toFrenchError(e), 'error');
                  }
                }
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected?.sender_id === me ? (
          <SheetAction
            icon={Trash2}
            label="Supprimer ce message"
            destructive
            description="Le contenu sera effacé pour vous deux."
            onPress={async () => {
              const m = selected;
              setSelected(null);
              try {
                await deleteMessage(m.id);
                refresh();
              } catch (e) {
                toast(toFrenchError(e), 'error');
              }
            }}
          />
        ) : selected ? (
          <SheetAction
            icon={Flag}
            label="Signaler ce message"
            description="Une copie de ce message sera transmise à la modération."
            onPress={() => {
              const m = selected;
              setSelected(null);
              router.push({ pathname: '/report', params: { type: 'message', id: m.id } });
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  peerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderColor: colors.border },
  peer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  offerRow: { paddingHorizontal: spacing.md, marginVertical: spacing.sm },
  safety: { flexDirection: 'row', gap: spacing.sm, margin: spacing.lg, padding: spacing.md, backgroundColor: colors.mintSoft, borderRadius: 12 },
});
