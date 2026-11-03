/**
 * Shown under « Je vends régulièrement »: opting into the merchant identity needs only a shop
 * name and a main category (database rule profiles_boutique_identity_required). Casual sellers
 * never see it: anyone can list an article without it.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, colors, Field, spacing, Text } from '@/design';
import { fetchCategories } from '@/lib/api/products';

const FEATURED = 8;

export function boutiqueIdentityValid(name: string, category: string | null): boolean {
  const n = name.trim().length;
  return n >= 2 && n <= 60 && !!category;
}

export function BoutiqueIdentityFields({
  name,
  onName,
  category,
  onCategory,
  showErrors,
}: {
  name: string;
  onName: (v: string) => void;
  category: string | null;
  onCategory: (slug: string) => void;
  showErrors?: boolean;
}) {
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: Infinity });
  const [all, setAll] = useState(false);
  const cats = categories.data ?? [];
  const selected = cats.find((c) => c.slug === category);
  const shown = all ? cats : cats.slice(0, FEATURED).concat(selected && cats.indexOf(selected) >= FEATURED ? [selected] : []);
  const nameError = showErrors && (name.trim().length < 2 || name.trim().length > 60) ? 'Indiquez un nom de 2 à 60 caractères.' : null;

  return (
    <View style={{ gap: spacing.md }}>
      <Field
        label="Nom de la boutique"
        value={name}
        onChangeText={onName}
        maxLength={60}
        counter
        placeholder="Ex. Awa Couture"
        error={nameError}
        hint="Affiché sur votre profil. Ce n’est pas une vérification de votre activité."
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="600">
          Catégorie principale
        </Text>
        <View style={styles.wrap}>
          {shown.map((c) => (
            <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => onCategory(c.slug)} style={category === c.slug ? undefined : styles.idle} />
          ))}
          {cats.length > FEATURED ? <Chip label={all ? 'Moins' : `Voir tout (${cats.length})`} onPress={() => setAll((x) => !x)} style={styles.idle} /> : null}
        </View>
        {showErrors && !category ? (
          <Text variant="caption" tone="danger">
            Choisissez une catégorie.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
