/**
 * « Nouveau mot de passe », reached from the recovery e-mail (see lib/recovery.ts). Lives outside
 * the signed-in / signed-out groups: opening the link signs the member in with a recovery session,
 * and they must stay here until the new password is saved. The form only appears for a session
 * that this very link opened — a signed-in member who lands here without one sees the expired
 * state, not a password change.
 */
import { toFrenchError } from '@jefeli/shared';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';

import { Button, colors, Field, Header, Screen, spacing, Text, useToast } from '@/design';
import { useAuth } from '@/lib/auth';
import { desktopColumn, useLayout } from '@/lib/layout';
import { parseRecoveryLink } from '@/lib/recovery';
import { initialWebUrl, supabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

export default function ResetPassword() {
  const { desktop } = useLayout();
  const linkingUrl = Linking.useLinkingURL();
  const link = useMemo(() => parseRecoveryLink(Platform.OS === 'web' ? initialWebUrl : linkingUrl), [linkingUrl]);
  const { session } = useAuth();
  const toast = useToast();
  const [opened, setOpened] = useState<{ token: string; ok: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (link?.kind !== 'session') return;
    // On the web supabase-js opens the session from the URL itself; on a phone we do it here.
    const open =
      Platform.OS === 'web'
        ? supabase.auth.getSession().then(({ data }) => data.session?.access_token === link.accessToken)
        : supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken }).then(({ error: e }) => !e);
    open
      .catch(() => false)
      .then((ok) => setOpened({ token: link.refreshToken, ok }));
  }, [link]);

  const state =
    link?.kind !== 'session' ? 'invalid' : opened?.token !== link.refreshToken ? 'checking' : opened.ok ? 'form' : 'invalid';

  async function save() {
    setError(null);
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(toFrenchError(err));
      return;
    }
    toast('Mot de passe modifié', 'success');
    router.replace('/');
  }

  return (
    <Screen edges={['top', 'bottom']} keyboard style={desktopColumn(desktop)}>
      <Header title="Nouveau mot de passe" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        {state === 'checking' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
            <ActivityIndicator color={colors.ink} />
            <Text tone="secondary">Vérification du lien…</Text>
          </View>
        ) : state === 'invalid' ? (
          <>
            <Text variant="title">Lien expiré</Text>
            <Text tone="secondary">Ce lien n’est plus valide. Demandez-en un nouveau.</Text>
            {session ? (
              <Button label="Continuer" variant="cta" onPress={() => router.replace('/')} />
            ) : (
              <Button label="Demander un nouveau lien" variant="cta" onPress={() => router.replace('/forgot-password')} />
            )}
          </>
        ) : (
          <>
            <Text variant="title">Choisissez un nouveau mot de passe</Text>
            <Field
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              hint={`${MIN_PASSWORD} caractères minimum.`}
            />
            {error ? (
              <Text tone="danger" variant="callout" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label="Enregistrer"
              variant="cta"
              size="lg"
              loading={saving}
              disabled={password.length < MIN_PASSWORD}
              onPress={save}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
