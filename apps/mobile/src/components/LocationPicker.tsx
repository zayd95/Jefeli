import { DAKAR_AREAS, SENEGAL_CITIES } from '@jefeli/shared';
import { MapPin } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, colors, Field, spacing, Text } from '@/design';

/** Voluntary, approximate location: a city and optionally a neighbourhood. Never GPS. */
export function LocationPicker({
  city,
  neighborhood,
  onChange,
  compact,
  cityOnly,
}: {
  city: string;
  neighborhood: string;
  onChange: (next: { city: string; neighborhood: string }) => void;
  compact?: boolean;
  /** One-screen onboarding: the city only (all cities + « Autre »), the neighbourhood comes later. */
  cityOnly?: boolean;
}) {
  const isDakar = city.trim().toLowerCase() === 'dakar';
  const other = !SENEGAL_CITIES.includes(city);
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.note}>
        <MapPin size={16} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          Ville choisie par vous, sans GPS.
        </Text>
      </View>
      <Text variant="callout" weight="600">
        Ville
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {SENEGAL_CITIES.slice(0, compact && !cityOnly ? 8 : 17).map((c) => (
          <Chip
            key={c}
            label={c}
            selected={city === c}
            onPress={() => onChange({ city: c, neighborhood: c === city ? neighborhood : '' })}
            style={city === c ? undefined : styles.idle}
          />
        ))}
        {cityOnly ? <Chip label="Autre ville" selected={other} onPress={() => onChange({ city: other ? city : '', neighborhood: '' })} style={other ? undefined : styles.idle} /> : null}
      </ScrollView>
      {other ? (
        <Field value={city} onChangeText={(t) => onChange({ city: t, neighborhood })} placeholder="Autre ville" maxLength={60} accessibilityLabel="Autre ville" />
      ) : null}
      {cityOnly ? null : isDakar ? (
        <>
          <Text variant="callout" weight="600">
            Quartier (facultatif)
          </Text>
          <View style={styles.wrap}>
            {DAKAR_AREAS.slice(0, compact ? 12 : DAKAR_AREAS.length).map((a) => (
              <Chip
                key={a}
                label={a}
                selected={neighborhood === a}
                onPress={() => onChange({ city, neighborhood: neighborhood === a ? '' : a })}
                style={neighborhood === a ? undefined : styles.idle}
              />
            ))}
          </View>
        </>
      ) : city ? (
        <Field
          label="Quartier (facultatif)"
          value={neighborhood}
          onChangeText={(t) => onChange({ city, neighborhood: t })}
          placeholder="Ex. Centre-ville"
          maxLength={60}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
