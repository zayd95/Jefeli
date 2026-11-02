import { HANDLE_PATTERN, normalizeHandle, toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AvatarPicker } from '@/components/AvatarPicker';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Checkbox, Chip, colors, Field, ProgressBar, Screen, spacing, Text, Toggle, Wordmark } from '@/design';
import { fetchCategories } from '@/lib/api/products';
import { isHandleAvailable, updateMyProfile } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

const STEPS = 3;

export default function Onboarding() {
  const { userId, profile, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name === 'Nouveau membre' ? '' : (profile?.display_name ?? ''));
  const [handle, setHandle] = useState(profile?.handle?.startsWith('membre') ? '' : (profile?.handle ?? ''));
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_path ?? null);
  const [city, setCity] = useState(profile?.city ?? 'Dakar');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [merchant, setMerchant] = useState(profile?.is_merchant ?? false);
  const [adult, setAdult] = useState(!!profile?.adult_confirmed_at);
  const [remote, setRemote] = useState<{ handle: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });

  const syncState: 'idle' | 'invalid' | null = !handle ? 'idle' : !HANDLE_PATTERN.test(handle) ? 'invalid' : null;
  useEffect(() => {
    if (syncState) return;
    const t = setTimeout(() => {
      isHandleAvailable(handle, userId ?? '')
        .then((ok) => setRemote({ handle, ok }))
        .catch(() => setRemote(null));
    }, 350);
    return () => clearTimeout(t);
  }, [handle, userId, syncState]);
  const handleState: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' =
    syncState ?? (remote?.handle === handle ? (remote.ok ? 'ok' : 'taken') : 'checking');

  const canNext = [
    name.trim().length >= 2 && handleState === 'ok' && adult,
    city.trim().length > 0,
    true,
  ][step];

  async function finish() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile(userId, {
        display_name: name.trim(),
        handle,
        bio: bio.trim(),
        avatar_path: avatar,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        interests,
        is_merchant: merchant,
        adult_confirmed_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      });
      await refreshProfile();
    } catch (e) {
      setError(toFrenchError(e));
      setSaving(false);
    }
  }

  const handleHint = {
    idle: 'Lettres sans accents, chiffres, « _ » et « . » — c’est l’adresse de votre profil.',
    checking: 'Vérification…',
    ok: 'Disponible',
    taken: 'Déjà pris, essayez une variante.',
    invalid: '3 à 30 caractères : a-z, 0-9, « _ » ou « . »',
  }[handleState];

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <View style={styles.top}>
        <Wordmark size={24} />
        <Text variant="caption" tone="secondary">
          Étape {step + 1} sur {STEPS}
        </Text>
      </View>
      <ProgressBar value={(step + 1) / STEPS} style={{ marginHorizontal: spacing.xl }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Text variant="title">Votre profil</Text>
            <Text tone="secondary">C’est votre identité sociale sur Jëfëli. Votre boutique y apparaîtra dès votre premier article.</Text>
            <AvatarPicker userId={userId ?? ''} name={name} path={avatar} onUploaded={setAvatar} />
            <Field label="Nom affiché" value={name} onChangeText={setName} placeholder="Ex. Awa Ndiaye ou Awa Boutique" maxLength={50} />
            <Field
              label="Nom d’utilisateur"
              value={handle}
              onChangeText={(t) => setHandle(normalizeHandle(t))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="awa_boutique"
              hint={handleState === 'taken' || handleState === 'invalid' ? undefined : handleHint}
              error={handleState === 'taken' || handleState === 'invalid' ? handleHint : null}
            />
            <Field label="Bio (facultatif)" value={bio} onChangeText={setBio} multiline maxLength={300} counter placeholder="Ce que vous partagez ou vendez…" />
            <Checkbox
              checked={adult}
              onToggle={() => setAdult((v) => !v)}
              label="Je confirme avoir 18 ans ou plus"
              description="Jëfëli est réservé aux adultes pendant la phase pilote."
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text variant="title">Où êtes-vous ?</Text>
            <Text tone="secondary">Pour vous montrer les vendeurs et les articles près de chez vous.</Text>
            <LocationPicker
              city={city}
              neighborhood={neighborhood}
              onChange={(n) => {
                setCity(n.city);
                setNeighborhood(n.neighborhood);
              }}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text variant="title">Ce qui vous intéresse</Text>
            <Text tone="secondary">Facultatif. Ça aide à composer votre fil « Pour toi ».</Text>
            <View style={styles.wrap}>
              {(categories.data ?? []).map((c) => {
                const on = interests.includes(c.slug);
                return (
                  <Chip
                    key={c.slug}
                    label={c.name}
                    selected={on}
                    onPress={() => setInterests((cur) => (on ? cur.filter((x) => x !== c.slug) : [...cur, c.slug]))}
                    style={on ? undefined : styles.idle}
                  />
                );
              })}
            </View>
            <View style={styles.divider} />
            <Toggle
              value={merchant}
              onChange={setMerchant}
              label="Je vends régulièrement"
              description="Affiche « Vendeur » sur votre profil. Pas d’abonnement, pas de frais : votre boutique se crée avec votre premier article."
            />
          </>
        ) : null}

        {error ? <Text tone="danger">{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        {step > 0 ? (
          <Button label="Retour" variant="outline" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
        ) : (
          <Button label="Se déconnecter" variant="ghost" onPress={signOut} style={{ flex: 1 }} />
        )}
        <Button
          label={step === STEPS - 1 ? 'Terminer' : 'Continuer'}
          variant="cta"
          disabled={!canNext}
          loading={saving}
          onPress={() => (step === STEPS - 1 ? finish() : setStep((s) => s + 1))}
          style={{ flex: 2 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, paddingBottom: spacing.md },
  body: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  divider: { height: 1, backgroundColor: colors.border },
  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
