import { HANDLE_PATTERN, normalizeHandle, toFrenchError } from '@jefeli/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { AvatarPicker } from '@/components/AvatarPicker';
import { LocationPicker } from '@/components/LocationPicker';
import { Button, Field, Header, Screen, spacing, Text, Toggle, useToast } from '@/design';
import { isHandleAvailable, updateMyProfile } from '@/lib/api/profiles';
import { useAuth } from '@/lib/auth';

export default function EditProfile() {
  const { userId, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_path ?? null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [merchant, setMerchant] = useState(profile?.is_merchant ?? false);
  const [handleOk, setHandleOk] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!HANDLE_PATTERN.test(handle)) return setHandleOk(false);
    if (handle === profile?.handle) return setHandleOk(true);
    const t = setTimeout(() => isHandleAvailable(handle, userId ?? '').then(setHandleOk).catch(() => setHandleOk(true)), 350);
    return () => clearTimeout(t);
  }, [handle, profile?.handle, userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateMyProfile(userId, {
        display_name: name.trim(),
        handle,
        bio: bio.trim(),
        avatar_path: avatar,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        is_private: isPrivate,
        is_merchant: merchant,
      });
      await refreshProfile();
      toast('Profil mis à jour', 'success');
      router.back();
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
        <Text variant="caption" tone="secondary">
          Votre e-mail et votre numéro de téléphone ne sont jamais affichés publiquement.
        </Text>
      </ScrollView>
    </Screen>
  );
}
