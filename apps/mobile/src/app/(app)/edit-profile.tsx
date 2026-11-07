import { HANDLE_PATTERN, normalizeHandle, toFrenchError } from '@jefeli/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AvatarPicker, CoverPicker } from '@/components/AvatarPicker';
import { BoutiqueIdentityFields, boutiqueIdentityValid } from '@/components/BoutiqueIdentityFields';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Chip, colors, Field, Header, Screen, spacing, Text, Toggle, useToast } from '@/design';
import { fetchCategories } from '@/lib/api/products';
import { isHandleAvailable, updateMyProfile } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/nav';

const MAX_INTERESTS = 5;

export default function EditProfile() {
  const { userId, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_path ?? null);
  const [cover, setCover] = useState(profile?.cover_path ?? null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [merchant, setMerchant] = useState(profile?.is_merchant ?? false);
  const [boutiqueName, setBoutiqueName] = useState(profile?.boutique_name ?? '');
  const [boutiqueCategory, setBoutiqueCategory] = useState<string | null>(profile?.boutique_category_slug ?? null);
  // Business sectors (Lovable « Intérêts business »): up to five active category slugs, stored in
  // the existing profiles.interests array that the feed ranking already reads. Never hobbies.
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const [showErrors, setShowErrors] = useState(false);
  const [remote, setRemote] = useState<{ handle: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = HANDLE_PATTERN.test(handle);
  const unchanged = handle === profile?.handle;
  useEffect(() => {
    if (!valid || unchanged) return;
    const t = setTimeout(() => isHandleAvailable(handle, userId ?? '').then((ok) => setRemote({ handle, ok })).catch(() => setRemote({ handle, ok: true })), 350);
    return () => clearTimeout(t);
  }, [handle, valid, unchanged, userId]);
  const handleOk = valid && (unchanged || (remote?.handle === handle ? remote.ok : true));

  const identityOk = !merchant || boutiqueIdentityValid(boutiqueName, boutiqueCategory);

  async function save() {
    if (!userId) return;
    if (!identityOk) {
      setShowErrors(true);
      toast('Indiquez le nom et la catégorie de votre boutique, ou désactivez « Je vends régulièrement ».', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile(userId, {
        display_name: name.trim(),
        handle,
        bio: bio.trim(),
        avatar_path: avatar,
        cover_path: cover,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        is_private: isPrivate,
        is_merchant: merchant,
        // Kept when « Je vends régulièrement » is switched off, so switching it back on is one tap.
        boutique_name: boutiqueName.trim().length >= 2 ? boutiqueName.trim().slice(0, 60) : null,
        boutique_category_slug: boutiqueCategory,
        // Only when edited: members with more sectors from the former onboarding keep them all.
        ...(interests.join('|') !== (profile?.interests ?? []).join('|') ? { interests } : {}),
      });
      await refreshProfile();
      toast('Profil mis à jour', 'success');
      goBack();
    } catch (e) {
      toast(toFrenchError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <Header title="Modifier le profil" right={<Button label="Enregistrer" size="sm" variant="cta" loading={saving} disabled={name.trim().length < 2 || !handleOk} onPress={save} style={{ marginRight: spacing.sm }} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <AvatarPicker userId={userId ?? ''} name={name} path={avatar} onUploaded={setAvatar} />
        <CoverPicker userId={userId ?? ''} path={cover} onChange={setCover} />
        <Field label="Nom affiché" value={name} onChangeText={setName} maxLength={50} />
        <Field
          label="Nom d’utilisateur"
          value={handle}
          onChangeText={(t) => setHandle(normalizeHandle(t))}
          autoCapitalize="none"
          error={!handleOk ? 'Indisponible ou invalide (a-z, 0-9, « _ » et « . »)' : null}
          hint="Changer votre nom d’utilisateur change l’adresse de votre profil public."
        />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} counter />
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="600">
            Intérêts business · jusqu’à {MAX_INTERESTS}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(categories.data ?? []).map((c) => {
              const on = interests.includes(c.slug);
              const full = !on && interests.length >= MAX_INTERESTS;
              return (
                <Chip
                  key={c.slug}
                  label={c.name}
                  selected={on}
                  onPress={full ? undefined : () => setInterests((v) => (on ? v.filter((x) => x !== c.slug) : [...v, c.slug]))}
                  style={on ? undefined : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: full ? 0.45 : 1 }}
                />
              );
            })}
          </View>
        </View>
        <LocationPicker
          city={city}
          neighborhood={neighborhood}
          onChange={(n) => {
            setCity(n.city);
            setNeighborhood(n.neighborhood);
          }}
        />
        <Toggle value={isPrivate} onChange={setIsPrivate} label="Compte privé" description="Vous validez chaque nouvel abonné. Vos publications, statuts et votre boutique ne sont visibles que par eux." />
        <Toggle value={merchant} onChange={setMerchant} label="Je vends régulièrement" description="Affiche « Vendeur » sur votre profil. Pour le badge « Vendeur vérifié », faites une demande dans Réglages." />
        {merchant ? (
          <BoutiqueIdentityFields name={boutiqueName} onName={setBoutiqueName} category={boutiqueCategory} onCategory={setBoutiqueCategory} showErrors={showErrors} />
        ) : null}
        <Text variant="caption" tone="secondary">
          Votre e-mail et votre numéro de téléphone ne sont jamais affichés publiquement.
        </Text>
      </ScrollView>
    </Screen>
  );
}
