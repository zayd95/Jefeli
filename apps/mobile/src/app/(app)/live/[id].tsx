import { formatListingPrice, toFrenchError } from '@jefeli/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { EyeOff, Flag, MessageCircle, Pin, PinOff, Radio, Send, Share2, UserX, X } from 'lucide-react-native';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Thumb } from '@/components/Media';
import { Avatar, Button, colors, EmptyState, fonts, IconButton, LiveBadge, Screen, Sheet, SheetAction, spacing, Text, useToast } from '@/design';
import {
  fetchCurrentPin,
  fetchLiveComments,
  fetchLiveSession,
  hideLiveComment,
  liveFunction,
  muteInLive,
  pinProduct,
  postLiveComment,
  unpinProduct,
  type LiveComment,
} from '@/lib/api/live';
import { messageAboutProduct } from '@/lib/api/messages';
import { fetchSellerProducts } from '@/lib/api/products';
import { useAuth } from '@/lib/auth';
import { isLiveSdkAvailable } from '@/lib/live';
import { useLiveRealtime } from '@/lib/realtime';
import { shareLinks } from '@/lib/share';
import { goBack } from '@/lib/nav';

const LiveVideo = lazy(() => import('@/components/live/StreamLive').then((m) => ({ default: m.LiveVideo })));

type TokenResponse = { apiKey: string; token: string; callType: string; callId: string; isHost: boolean };

export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<LiveComment | null>(null);
  const [pinSheet, setPinSheet] = useState(false);
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const sdk = isLiveSdkAvailable();

  const session = useQuery({ queryKey: ['live', id], queryFn: () => fetchLiveSession(id ?? ''), refetchInterval: 30_000 });
  const comments = useQuery({ queryKey: ['live-comments', id], queryFn: () => fetchLiveComments(id ?? '') });
  const pin = useQuery({ queryKey: ['live-pin', id], queryFn: () => fetchCurrentPin(id ?? '') });
  useLiveRealtime(id);

  const s = session.data;
  const isHost = s?.host_id === userId;
  const myProducts = useQuery({ queryKey: ['my-active-products', userId], queryFn: () => fetchSellerProducts(userId ?? '', { onlyActive: true }), enabled: isHost && pinSheet });

  // Provider token is minted server-side; only requested when video can actually play.
  useEffect(() => {
    if (!sdk || !s || s.status === 'ended') return;
    liveFunction<TokenResponse>('token', { sessionId: s.id })
      .then(setToken)
      .catch((e: Error) => setVideoError(e.message));
  }, [sdk, s?.id, s?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEnded = useCallback(() => {
    if (isHost && s) liveFunction('end', { sessionId: s.id }).catch(() => {});
    goBack();
  }, [isHost, s]);

  async function send() {
    const body = comment.trim();
    if (!body || !userId || !s) return;
    try {
      await postLiveComment(userId, s.id, body);
      setComment('');
      qc.invalidateQueries({ queryKey: ['live-comments', id] });
    } catch (e) {
      toast(toFrenchError(e), 'error');
    }
  }

  if (!s) {
    return (
      <Screen edges={['top', 'bottom']}>
        {session.isPending ? null : <EmptyState icon={Radio} title="Live introuvable" body="Il est peut-être terminé ou n’est pas visible pour vous." />}
        <Button label="Fermer" variant="outline" onPress={() => goBack()} style={{ margin: spacing.xl }} />
      </Screen>
    );
  }

  const ended = s.status === 'ended';
  const isLive = s.status === 'live';

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {sdk && token && !ended ? (
          <Suspense fallback={null}>
            <LiveVideo
              apiKey={token.apiKey}
              token={token.token}
              user={{ id: userId ?? '', name: profile?.display_name ?? 'Membre' }}
              callType={token.callType}
              callId={token.callId}
              role={isHost ? 'host' : 'viewer'}
              onEnded={onEnded}
              onError={setVideoError}
            />
          </Suspense>
        ) : (
          <View style={styles.placeholder}>
            <Text color={colors.white} align="center" style={{ maxWidth: 300 }}>
              {ended
                ? 'Ce live est terminé.'
                : !sdk
                  ? 'La vidéo en direct nécessite la version installable de Jëfëli (build de développement). Les commentaires restent disponibles.'
                  : videoError
                    ? 'Connexion vidéo impossible pour le moment.'
                    : 'Connexion…'}
            </Text>
          </View>
        )}
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} pointerEvents="box-none">
        <View style={styles.top}>
          {isLive ? <LiveBadge /> : <View style={styles.endedTag}><Text variant="micro" weight="800" color={colors.white}>{ended ? 'TERMINÉ' : 'EN PRÉPARATION'}</Text></View>}
          {isLive && s.viewer_count !== null ? (
            <View style={styles.count}>
              <Text variant="micro" weight="700" color={colors.white}>
                {s.viewer_count} spectateur{s.viewer_count > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <IconButton icon={Share2} label="Partager le live" color={colors.white} onPress={() => shareLinks.live(s.id, s.host?.display_name ?? '')} />
          <IconButton icon={X} label="Quitter" color={colors.white} onPress={() => goBack()} />
        </View>
        <Pressable style={styles.host} onPress={() => s.host && router.push(`/u/${s.host.handle}`)}>
          <Avatar path={s.host?.avatar_path} name={s.host?.display_name ?? '?'} size={34} />
          <View style={{ flexShrink: 1 }}>
            <Text variant="callout" weight="700" color={colors.white} numberOfLines={1}>
              {s.host?.display_name}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
              {s.title}
            </Text>
          </View>
        </Pressable>

        <View style={{ flex: 1 }} pointerEvents="none" />

        <FlatList
          style={styles.comments}
          data={(comments.data ?? []).filter((c) => c.moderation_status === 'active')}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => setSelected(item)} delayLongPress={300}>
              <Text variant="callout" color={colors.white} style={styles.commentText}>
                <Text variant="callout" weight="700" color={colors.white}>
                  {item.author?.display_name ?? 'Membre'} :{' '}
                </Text>
                {item.body}
              </Text>
            </Pressable>
          )}
        />

        {pin.data ? (
          <View style={styles.pinCard}>
            <Thumb media={pin.data.media[0]} style={{ width: 56, height: 56, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="700" numberOfLines={1}>
                {pin.data.title}
              </Text>
              <Text variant="callout" weight="800">
                {formatListingPrice(pin.data)}
              </Text>
            </View>
            {isHost ? (
              <IconButton icon={PinOff} label="Désépingler" onPress={() => unpinProduct(s.id).catch((e) => toast(toFrenchError(e), 'error'))} />
            ) : (
              <View style={{ gap: 4 }}>
                <Button label="Voir l’article" size="sm" variant="cta" onPress={() => router.push(`/p/${pin.data!.id}`)} />
                <Button
                  label="Écrire"
                  size="sm"
                  variant="ghost"
                  icon={MessageCircle}
                  onPress={async () => {
                    try {
                      const cid = await messageAboutProduct(pin.data!.id);
                      router.push(`/chat/${cid}`);
                    } catch (e) {
                      toast(toFrenchError(e), 'error');
                    }
                  }}
                />
              </View>
            )}
          </View>
        ) : null}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.footer}>
            {isLive ? (
              <>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Écrire un commentaire…"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  style={styles.input}
                  maxLength={300}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  accessibilityLabel="Commentaire du live"
                />
                {comment.trim() ? <IconButton icon={Send} label="Envoyer" color={colors.white} onPress={send} /> : null}
              </>
            ) : (
              <Text variant="caption" color="rgba(255,255,255,0.8)">
                Les commentaires ouvrent quand le live est en direct.
              </Text>
            )}
            {isHost && !ended ? <IconButton icon={Pin} label="Épingler un article" color={colors.white} variant="overlay" onPress={() => setPinSheet(true)} /> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Sheet visible={!!selected} onClose={() => setSelected(null)}>
        {isHost && selected && selected.author_id !== userId ? (
          <>
            <SheetAction icon={EyeOff} label="Masquer ce commentaire" onPress={async () => {
              const c = selected; setSelected(null);
              await hideLiveComment(c.id).catch((e) => toast(toFrenchError(e), 'error'));
              qc.invalidateQueries({ queryKey: ['live-comments', id] });
            }} />
            <SheetAction icon={UserX} label={`Rendre ${selected.author?.display_name ?? 'ce membre'} muet pendant ce live`} destructive onPress={async () => {
              const c = selected; setSelected(null);
              await muteInLive(s.id, c.author_id, true).catch((e) => toast(toFrenchError(e), 'error'));
              qc.invalidateQueries({ queryKey: ['live-comments', id] });
            }} />
          </>
        ) : null}
        {selected && selected.author_id !== userId ? (
          <SheetAction icon={Flag} label="Signaler ce commentaire" onPress={() => {
            const c = selected; setSelected(null);
            router.push({ pathname: '/report', params: { type: 'live_comment', id: c.id } });
          }} />
        ) : null}
        {!isHost && selected ? (
          <SheetAction icon={Flag} label="Signaler ce live" onPress={() => {
            setSelected(null);
            router.push({ pathname: '/report', params: { type: 'live_session', id: s.id } });
          }} />
        ) : null}
      </Sheet>

      <Sheet visible={pinSheet} onClose={() => setPinSheet(false)} title="Épingler un article" scroll>
        {(myProducts.data ?? []).map((p) => (
          <Pressable key={p.id} style={styles.pinRow} onPress={async () => {
            setPinSheet(false);
            try {
              await pinProduct(s.id, p.id);
              qc.invalidateQueries({ queryKey: ['live-pin', id] });
            } catch (e) {
              toast(toFrenchError(e), 'error');
            }
          }}>
            <Thumb media={p.media[0]} style={{ width: 48, height: 48, borderRadius: 8 }} />
            <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.title}</Text>
            <Text variant="callout" weight="700">{formatListingPrice(p, { compact: true })}</Text>
          </Pressable>
        ))}
        {myProducts.data?.length === 0 ? <Text tone="secondary">Aucun article disponible à épingler.</Text> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingTop: spacing.sm },
  endedTag: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  count: { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.md, marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', paddingRight: spacing.md, borderRadius: 24, padding: 4, maxWidth: '80%' },
  comments: { maxHeight: 220, flexGrow: 0, paddingHorizontal: spacing.md },
  commentText: { marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  pinCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.surface },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, minHeight: 56 },
  input: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: spacing.lg, color: colors.white, fontFamily: fonts.medium, fontSize: 15, backgroundColor: 'rgba(0,0,0,0.3)' },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
