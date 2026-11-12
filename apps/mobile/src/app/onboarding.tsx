import { HANDLE_PATTERN, normalizeHandle, suggestHandle, toFrenchError } from '@jefeli/shared';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AvatarPicker } from '@/components/AvatarPicker';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Checkbox, colors, Field, Screen, spacing, Text, Wordmark } from '@/design';
import { isHandleAvailable, updateMyProfile } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';
import { desktopColumn, useLayout } from '@/lib/layout';

/**
 * Native counterpart of the approved Lovable one-screen entry.
 *
 * A member can discover and publish without creating a boutique or choosing
 * business interests. Those are optional follow-up actions in the profile.
 * Keep the existing Supabase Auth + RLS and avatar upload machinery intact.
 */
export default function Onboarding() {
  const { desktop } = useLayout();
  const { userId, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name === 'Nouveau membre' ? '' : (profile?.display_name ?? ''));
  const [handle, setHandle] = useState(profile?.handle?.startsWith('membre') ? '' : (profile?.handle ?? ''));
  const [handleEdited, setHandleEdited] = useState(false);
  const [city, setCity] = useState(profile?.city ?? 'Dakar');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_path ?? null);
  const [adult, setAdult] = useState(!!profile?.adult_confirmed_at);
  const [remote, setRemote] = useState<{ handle: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!HANDLE_PATTERN.test(handle)) return;
    const timeout = setTimeout(() => {
      isHandleAvailable(handle, userId ?? '')
        .then((ok) => setRemote({ handle, ok }))
        .catch(() => setRemote(null));
    }, 350);
    return () => clearTimeout(timeout);
  }, [handle, userId]);

  const handleState: 'idle' | 'invalid' | 'checking' | 'ok' | 'taken' =
    !handle ? 'idle' :
    !HANDLE_PATTERN.test(handle) ? 'invalid' :
    remote?.handle !== handle ? 'checking' :
    remote.ok ? 'ok' : 'taken';

  function changeName(value: string) {
    setName(value);
    if (!handleEdited) setHandle(suggestHandle(value));
  }

  const canEnter = name.trim().length >= 2 && handleState === 'ok' && !!city.trim() && adult && !saving;

  async function enter() {
    if (!canEnter || !userId) return;
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile(userId, {
        display_name: name.trim(),
        handle,
        avatar_path: avatar,
        city: city.trim(),
        // No merchant questionnaire, business-interest gate or fictitious seller badge. Boutique
        // identity and interests are left untouched (never wiped) and stay editable later.
        adult_confirmed_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      });
      await refreshProfile();
    } catch (e) {
      setError(toFrenchError(e));
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard background={colors.background} style={desktopColumn(desktop)}>
      <View style={styles.top}>
        <Wordmark size={27} />
        {/* Moved up from the footer so the fixed CTA stays a single, compact bar. */}
        <Button label="Se déconnecter" variant="ghost" size="sm" onPress={signOut} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text serif weight="600" accessibilityRole="header" style={styles.title}>
          Bienvenue chez vous.
        </Text>

        <AvatarPicker userId={userId ?? ''} name={name} path={avatar} onUploaded={setAvatar} size={72} />
        <Field
          label="Votre nom"
          value={name}
          onChangeText={changeName}
          placeholder="Ex. Awa Ndiaye"
          maxLength={50}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Field
          label="Votre pseudo"
          value={handle}
          onChangeText={(value) => {
            setHandleEdited(true);
            setHandle(normalizeHandle(value).slice(0, 30));
          }}
          placeholder="awa.ndiaye"
          maxLength={30}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          // « Disponible » only once the server has confirmed it; nothing while idle.
          hint={handleState === 'ok' ? 'Disponible' : handleState === 'checking' ? 'Vérification…' : undefined}
          error={handleState === 'taken' ? 'Déjà pris, choisissez une variante.' : handleState === 'invalid' ? '3 à 30 caractères : lettres, chiffres, « _ » et « . »' : undefined}
        />
        <LocationPicker city={city} neighborhood="" onChange={(next) => setCity(next.city)} cityOnly />
        <View style={styles.age}>
          <Checkbox
            checked={adult}
            onToggle={() => setAdult((v) => !v)}
            label="Je confirme avoir 18 ans ou plus"
          />
        </View>
        {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Entrer dans Jëfëli" size="lg" variant="cta" pill loading={saving} disabled={!canEnter} fullWidth onPress={enter} style={styles.cta} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Generous air between fields; the last item (age, error) always scrolls clear of the CTA bar.
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  title: { fontSize: 30, lineHeight: 36, color: colors.ink },
  age: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.glassLight,
    alignItems: 'stretch',
  },
  cta: { height: 56 },
});
