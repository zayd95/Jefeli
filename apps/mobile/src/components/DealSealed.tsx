import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Handshake } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, dark, spacing, Text } from '@/design';

/**
 * « Marché conclu » — the brand moment (P1 identity, docs/IDENTITY.md § Signature moments).
 * Shown to the member who seals a Waxaale deal (accepts an offer) and when an exchange is
 * confirmed by both sides. Sequence (ms): scrim 0–180 · seal 0.4 → 1.08 → 1 with −12° → 0°,
 * 60–480 (out-back) · haptic « success » at 240 · chime at 240 · burst of 12 gold / mint dots
 * 240–900 (out-cubic) · title 300–560 · auto close at 2 400 or on tap. Reduced motion: the seal
 * and words appear at once, no burst, no rotation. The chime is an original 0.7 s sound
 * (assets/sounds/deal-sealed.wav) and follows the phone's silent mode on iOS.
 */

const DOTS = 12;
const SOUND = require('../../assets/sounds/deal-sealed.wav');

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduce(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return reduce;
}

function playChime() {
  try {
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
    const player = createAudioPlayer(SOUND);
    player.volume = 0.7;
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        /* already released */
      }
    }, 1500);
  } catch {
    /* sound is a bonus: never block the moment */
  }
}

export function DealSealed({ visible, title = 'Marché conclu !', subtitle, onDone }: { visible: boolean; title?: string; subtitle?: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [scrim] = useState(() => new Animated.Value(0));
  const [seal] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [words] = useState(() => new Animated.Value(0));
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!visible) return;
    scrim.setValue(0);
    seal.setValue(0);
    burst.setValue(0);
    words.setValue(0);
    const native = Platform.OS !== 'web';
    if (reduce) {
      scrim.setValue(1);
      seal.setValue(1);
      words.setValue(1);
    } else {
      Animated.parallel([
        Animated.timing(scrim, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.sequence([Animated.delay(60), Animated.timing(seal, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.8)), useNativeDriver: native })]),
        Animated.sequence([Animated.delay(240), Animated.timing(burst, { toValue: 1, duration: 660, easing: Easing.out(Easing.cubic), useNativeDriver: native })]),
        Animated.sequence([Animated.delay(300), Animated.timing(words, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: native })]),
      ]).start();
    }
    const fx = setTimeout(() => {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playChime();
    }, reduce ? 0 : 240);
    const close = setTimeout(() => doneRef.current(), 2400);
    return () => {
      clearTimeout(fx);
      clearTimeout(close);
    };
  }, [visible, reduce, scrim, seal, burst, words]);

  if (!visible) return null;

  const sealScale = seal.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const sealTurn = seal.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityRole="button" accessibilityLabel={`${title} Toucher pour fermer`} testID="deal-sealed">
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrim }]} />
        <View style={styles.center} pointerEvents="none">
          <View style={styles.stage}>
            {reduce
              ? null
              : Array.from({ length: DOTS }).map((_, i) => {
                  const a = (i / DOTS) * Math.PI * 2;
                  const r = i % 2 === 0 ? 118 : 96;
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.dot,
                        i % 3 === 0 ? styles.dotMint : null,
                        {
                          opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                          transform: [
                            { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * r] }) },
                            { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * r] }) },
                            { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.5] }) },
                          ],
                        },
                      ]}
                    />
                  );
                })}
            <Animated.View style={[styles.seal, { opacity: seal, transform: [{ scale: sealScale }, { rotate: sealTurn }] }]}>
              <View style={styles.sealRing}>
                <Handshake size={56} color={colors.onPrimary} strokeWidth={2.2} />
              </View>
            </Animated.View>
          </View>
          <Animated.View style={{ alignItems: 'center', gap: 6, opacity: words, transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
            <Text serif color={colors.ink} accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40, textAlign: 'center' }}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="callout" color={dark.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
                {subtitle}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: dark.scrim },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.xl },
  stage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  seal: { width: 148, height: 148, borderRadius: 74, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  sealRing: { width: 124, height: 124, borderRadius: 62, borderWidth: 2, borderColor: colors.onPrimary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  dotMint: { backgroundColor: colors.mintAccent, width: 9, height: 9, borderRadius: 5 },
});
