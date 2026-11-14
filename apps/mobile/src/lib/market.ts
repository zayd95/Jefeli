import { Shirt, Smartphone, type LucideIcon } from 'lucide-react-native';

import { CATEGORY_TILES } from './categoryIcons';

/**
 * The market's aisles (« allées », P1 identity — docs/IDENTITY.md § Market structure). Two launch
 * aisles group several categories; every other category is its own small aisle. The keys are
 * stable identifiers, the labels are what members read.
 */
export type Aisle = { key: string; label: string; hint?: string; categories: string[]; icon: LucideIcon; launch: boolean };

export const LAUNCH_AISLES: Aisle[] = [
  { key: 'telephones', label: 'Téléphones', hint: 'Téléphones, tablettes, high-tech', categories: ['telephones', 'electronique'], icon: Smartphone, launch: true },
  { key: 'mode', label: 'Mode', hint: 'Habits, chaussures, sacs, wax', categories: ['mode-femme', 'mode-homme', 'chaussures', 'sacs-accessoires', 'tissus-wax'], icon: Shirt, launch: true },
];

const IN_LAUNCH = new Set(LAUNCH_AISLES.flatMap((a) => a.categories));

/** Small aisles: every other active category, in the catalogue's order. */
export function otherAisles(categories: { slug: string; name: string }[]): Aisle[] {
  return categories
    .filter((c) => !IN_LAUNCH.has(c.slug))
    .map((c) => {
      const t = CATEGORY_TILES[c.slug];
      return { key: c.slug, label: t?.short ?? c.name, hint: c.name, categories: [c.slug], icon: t?.icon ?? Smartphone, launch: false };
    });
}

export function aisleCounts(aisle: Aisle, counts: { category_slug: string; articles: number; sellers: number }[]) {
  const rows = counts.filter((c) => aisle.categories.includes(c.category_slug));
  return { articles: rows.reduce((n, r) => n + r.articles, 0), sellers: rows.reduce((n, r) => n + r.sellers, 0) };
}
