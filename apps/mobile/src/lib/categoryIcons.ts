import {
  Baby,
  Dumbbell,
  Flower2,
  Footprints,
  Handbag,
  Laptop,
  LayoutGrid,
  Package,
  Palette,
  Refrigerator,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Spool,
  type LucideIcon,
} from 'lucide-react-native';

/** Icon and short tile label per category slug; the full name stays the accessibility label. */
export const CATEGORY_TILES: Record<string, { icon: LucideIcon; short: string }> = {
  'mode-femme': { icon: Flower2, short: 'Femme' },
  'mode-homme': { icon: Shirt, short: 'Homme' },
  'tissus-wax': { icon: Spool, short: 'Tissus' },
  chaussures: { icon: Footprints, short: 'Chaussures' },
  'sacs-accessoires': { icon: Handbag, short: 'Sacs' },
  beaute: { icon: Sparkles, short: 'Beauté' },
  telephones: { icon: Smartphone, short: 'Téléphones' },
  electronique: { icon: Laptop, short: 'High-tech' },
  maison: { icon: Sofa, short: 'Maison' },
  electromenager: { icon: Refrigerator, short: 'Appareils' },
  enfants: { icon: Baby, short: 'Enfants' },
  sport: { icon: Dumbbell, short: 'Sport' },
  artisanat: { icon: Palette, short: 'Artisanat' },
  epicerie: { icon: ShoppingBasket, short: 'Épicerie' },
  autres: { icon: Package, short: 'Autres' },
};

export const ALL_CATEGORIES_TILE = { icon: LayoutGrid, short: 'Tous' };

export function categoryTile(slug: string, name: string) {
  return CATEGORY_TILES[slug] ?? { icon: Package, short: name };
}
