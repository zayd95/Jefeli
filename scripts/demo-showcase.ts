#!/usr/bin/env node
/**
 * Jëfëli — DÉMO showcase for the family preview (staging). One script, fully reversible.
 *
 *   node scripts/demo-showcase.ts            create the showcase (or, when it is already there,
 *                                            only recreate the DÉMO statuses that expired: they live 24 h)
 *   node scripts/demo-showcase.ts --remove   delete every showcase account, item, status, Reel and file
 *   node scripts/demo-showcase.ts --status   count what is there, change nothing
 *
 * What it creates (through the same RPCs the apps use, each shop signs in as itself):
 *   8 Dakar shops (Mode, Téléphones, Maison, Beauté), 40 items (Vendre, Troquer, Donner),
 *   10 statuses with product stickers, 6 Reels, 5 text « Je cherche » posts.
 *
 * What it never creates: views, followers, likes, comments, reviews, messages, offers, deals or
 * verification badges. Every account is `profiles.is_demo = true` (the « DÉMO » label on its name and
 * its cards). Images and videos are generated here (vector pictograms, ffmpeg): no scraping, no
 * photo of a person. The owner replaces them with real photos later.
 *
 * Env: SUPABASE_URL (default: local), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY,
 *      ALLOW_DEMO_SHOWCASE=jefeli-staging (required for the hosted staging project).
 * Showcase accounts use the e-mail domain @showcase.jefeli.test, with random passwords that are
 * never stored: nobody signs in to them after the run.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { palette } from '../packages/shared/src/tokens.ts';

const URL_ = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const DOMAIN = 'showcase.jefeli.test';
const STAGING_REF = 'gbsoifwllbacwsknydkq';

const args = new Set(process.argv.slice(2));
const host = new URL(URL_).hostname;
const isLocal = ['localhost', '127.0.0.1'].includes(host);
if (!isLocal && !(host === `${STAGING_REF}.supabase.co` && process.env.ALLOW_DEMO_SHOWCASE === 'jefeli-staging')) {
  console.error(`Refusing ${host}: the showcase is for local or jefeli-staging (set ALLOW_DEMO_SHOWCASE=jefeli-staging) only.`);
  process.exit(1);
}
if (!SERVICE || (!PUBLISHABLE && !args.has('--remove') && !args.has('--status'))) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_PUBLISHABLE_KEY for a creation).');
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const must = <T>(res: { data: T; error: { message: string } | null }, what: string): T => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

// ---------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------
type Mode = 'sale' | 'sale_or_trade' | 'trade' | 'give';
type Glyph = 'dress' | 'shirt' | 'shoe' | 'fabric' | 'phone' | 'laptop' | 'headphones' | 'speaker' | 'chair' | 'lamp' | 'cushion' | 'pot' | 'fan' | 'jar' | 'bottle' | 'soap' | 'comb' | 'mirror';
interface Item {
  title: string;
  description: string;
  mode: Mode;
  price?: number;
  priceMode?: 'fixed' | 'negotiable' | 'on_request';
  category: string;
  condition: 'new' | 'like_new' | 'very_good' | 'good' | 'fair' | 'refurbished';
  glyph: Glyph;
}
interface Shop {
  key: string;
  handle: string;
  boutique: string;
  owner: string;
  area: string;
  category: string;
  aisle: string;
  bio: string;
  items: Item[];
}

const SHOPS: Shop[] = [
  {
    key: 'wax', handle: 'wax_tendance_demo', boutique: 'Wax & Tendance', owner: 'Aminata Faye', area: 'Médina', category: 'mode-femme', aisle: 'Mode',
    bio: 'Mode femme et tissus wax, coupe soignée. Retrait à la Médina, livraison sur Dakar.',
    items: [
      { title: 'Robe wax évasée — taille M', description: 'Robe en wax 100 % coton, coupe évasée, doublée. Taille M, retouches possibles sous 48 h.', mode: 'sale', price: 18000, category: 'mode-femme', condition: 'new', glyph: 'dress' },
      { title: 'Ensemble pagne deux pièces', description: 'Haut et jupe assortis, tissu léger. Je prends aussi un troc contre des chaussures femme pointure 38.', mode: 'sale_or_trade', price: 32000, category: 'mode-femme', condition: 'new', glyph: 'dress' },
      { title: 'Tissu wax 6 yards — motif cauris', description: 'Six yards de wax coton, motifs cauris. Idéal pour un boubou ou un ensemble.', mode: 'sale', price: 12500, category: 'tissus-wax', condition: 'new', glyph: 'fabric' },
      { title: 'Tissu wax indigo 6 yards — à échanger', description: 'Jamais utilisé. Je cherche en échange un sac à main ou des chutes de tissu uni.', mode: 'trade', category: 'tissus-wax', condition: 'new', glyph: 'fabric' },
      { title: 'Foulards en wax — lot de 3 à donner', description: 'Trois foulards de fin de série, motifs variés. À récupérer à la Médina, un lot par personne.', mode: 'give', category: 'mode-femme', condition: 'good', glyph: 'fabric' },
    ],
  },
  {
    key: 'fann', handle: 'fann_chic_demo', boutique: 'Fann Chic Friperie', owner: 'Cheikh Mbaye', area: 'Fann', category: 'mode-homme', aisle: 'Mode',
    bio: 'Friperie homme triée et lavée. Troc bienvenu, remise en main propre à Fann.',
    items: [
      { title: 'Chemise bleue homme — taille L', description: 'Coton, très bon état, repassée. Taille L.', mode: 'sale', price: 6000, category: 'mode-homme', condition: 'very_good', glyph: 'shirt' },
      { title: 'Veste en jean — taille M', description: 'Veste en jean épais, quelques traces d’usage. Vente ou troc contre une veste légère.', mode: 'sale_or_trade', price: 9500, category: 'mode-homme', condition: 'good', glyph: 'shirt' },
      { title: 'Baskets blanches — pointure 42', description: 'Portées quelques fois, très propres. Vente ou troc contre des sandales pointure 42.', mode: 'sale_or_trade', price: 15000, category: 'chaussures', condition: 'very_good', glyph: 'shoe' },
      { title: 'Boubou homme brodé', description: 'Boubou brodé, bleu nuit, taille XL. Prix à discuter.', mode: 'sale', price: 28000, priceMode: 'negotiable', category: 'mode-homme', condition: 'like_new', glyph: 'shirt' },
      { title: 'Lot de 5 t-shirts — à donner', description: 'Cinq t-shirts usagés mais propres, tailles M et L. À récupérer à Fann.', mode: 'give', category: 'mode-homme', condition: 'fair', glyph: 'shirt' },
    ],
  },
  {
    key: 'allo', handle: 'allo_mobile_demo', boutique: 'Allo Mobile Plateau', owner: 'Ibrahima Seck', area: 'Plateau', category: 'telephones', aisle: 'Téléphones',
    bio: 'Téléphones testés avant la vente, accessoires et petits troc. Au Plateau.',
    items: [
      { title: 'Smartphone Android 128 Go — reconditionné', description: 'Testé, batterie vérifiée, chargeur fourni. Écran sans rayure.', mode: 'sale', price: 85000, category: 'telephones', condition: 'refurbished', glyph: 'phone' },
      { title: 'Smartphone 64 Go bon état — troc possible', description: 'Fonctionne parfaitement, trace d’usage sur la coque. Vente ou troc contre une tablette.', mode: 'sale_or_trade', price: 60000, category: 'telephones', condition: 'good', glyph: 'phone' },
      { title: 'Écouteurs sans fil neufs', description: 'Écouteurs Bluetooth avec boîtier de charge, neufs dans leur emballage.', mode: 'sale', price: 9000, category: 'telephones', condition: 'new', glyph: 'headphones' },
      { title: 'Enceinte portable de poche', description: 'Petite enceinte Bluetooth, autonomie d’environ 6 heures.', mode: 'sale', price: 7500, category: 'telephones', condition: 'like_new', glyph: 'speaker' },
      { title: 'Téléphone à écran fissuré — pour pièces, à donner', description: 'Ne s’allume plus, utile pour les pièces. À récupérer au Plateau.', mode: 'give', category: 'telephones', condition: 'fair', glyph: 'phone' },
    ],
  },
  {
    key: 'tech', handle: 'tech_liberte_demo', boutique: 'Tech Liberté', owner: 'Mariama Sow', area: 'Liberté 6', category: 'electronique', aisle: 'Téléphones',
    bio: 'Ordinateurs, tablettes et accessoires d’occasion. Test sur place à Liberté 6.',
    items: [
      { title: 'Ordinateur portable 8 Go / SSD 256 Go', description: 'Idéal pour les cours et le bureau. Batterie environ 4 heures, chargeur fourni.', mode: 'sale', price: 120000, category: 'electronique', condition: 'good', glyph: 'laptop' },
      { title: 'Tablette 10 pouces avec housse', description: 'Écran en bon état, housse incluse. Vente ou troc contre un smartphone.', mode: 'sale_or_trade', price: 45000, category: 'electronique', condition: 'very_good', glyph: 'laptop' },
      { title: 'Casque audio filaire', description: 'Casque fermé, son équilibré, câble en bon état.', mode: 'sale', price: 8000, category: 'electronique', condition: 'good', glyph: 'headphones' },
      { title: 'Clavier et souris sans fil — à échanger', description: 'Ensemble complet, fonctionne bien. Je prends en échange une clé USB 64 Go ou un disque externe.', mode: 'trade', category: 'electronique', condition: 'very_good', glyph: 'laptop' },
      { title: 'Chargeurs de téléphone variés — à donner', description: 'Une dizaine de chargeurs et câbles, à récupérer à Liberté 6.', mode: 'give', category: 'electronique', condition: 'fair', glyph: 'speaker' },
    ],
  },
  {
    key: 'teranga', handle: 'deco_teranga_demo', boutique: 'Déco Teranga', owner: 'Ndèye Diop', area: 'Ouakam', category: 'maison', aisle: 'Maison',
    bio: 'Décoration et petit mobilier artisanal. Retrait à Ouakam, livraison selon distance.',
    items: [
      { title: 'Fauteuil en rotin', description: 'Fauteuil tressé main, solide, très confortable. Quelques marques d’usage.', mode: 'sale', price: 38000, category: 'maison', condition: 'good', glyph: 'chair' },
      { title: 'Lampe de chevet en calebasse', description: 'Pièce artisanale, abat-jour en calebasse, ampoule fournie. Vente ou troc contre un miroir.', mode: 'sale_or_trade', price: 14000, category: 'maison', condition: 'new', glyph: 'lamp' },
      { title: 'Coussins en wax — set de 2', description: 'Deux coussins 45×45 cm, housses lavables.', mode: 'sale', price: 8000, category: 'maison', condition: 'new', glyph: 'cushion' },
      { title: 'Tapis tressé 160×230 cm', description: 'Tapis en fibres naturelles, usage léger. Prix à discuter.', mode: 'sale', price: 35000, priceMode: 'negotiable', category: 'maison', condition: 'very_good', glyph: 'cushion' },
      { title: 'Petite table basse — à échanger', description: 'Table basse en bois. Je cherche en échange une étagère ou des cadres.', mode: 'trade', category: 'maison', condition: 'good', glyph: 'chair' },
    ],
  },
  {
    key: 'mame', handle: 'chez_mame_demo', boutique: 'Chez Mame Maison', owner: 'Mame Gueye', area: 'Sacré-Cœur', category: 'electromenager', aisle: 'Maison',
    bio: 'Ustensiles, petit électroménager et vaisselle. Retrait à Sacré-Cœur.',
    items: [
      { title: 'Marmite en aluminium 12 L', description: 'Grande marmite avec couvercle, parfaite pour les repas de famille.', mode: 'sale', price: 16000, category: 'maison', condition: 'good', glyph: 'pot' },
      { title: 'Mixeur 1,5 L', description: 'Mixeur en bon état de marche, deux vitesses. Vente ou troc contre une bouilloire.', mode: 'sale_or_trade', price: 18000, category: 'electromenager', condition: 'very_good', glyph: 'pot' },
      { title: 'Service de 6 verres', description: 'Six verres identiques, aucun éclat.', mode: 'sale', price: 5000, category: 'maison', condition: 'like_new', glyph: 'jar' },
      { title: 'Ventilateur sur pied', description: 'Trois vitesses, hauteur réglable. Vente ou troc contre un petit réfrigérateur.', mode: 'sale_or_trade', price: 22000, category: 'electromenager', condition: 'good', glyph: 'fan' },
      { title: 'Assiettes dépareillées — à donner', description: 'Une douzaine d’assiettes, certaines ébréchées. À récupérer à Sacré-Cœur.', mode: 'give', category: 'maison', condition: 'fair', glyph: 'pot' },
    ],
  },
  {
    key: 'karite', handle: 'karite_co_demo', boutique: 'Karité & Co', owner: 'Fatoumata Kane', area: 'Yoff', category: 'beaute', aisle: 'Beauté',
    bio: 'Soins naturels : karité, huiles et savons. Préparés en petites quantités, retrait à Yoff.',
    items: [
      { title: 'Beurre de karité pur — 250 g', description: 'Non raffiné, pour la peau et les cheveux. Pot en verre.', mode: 'sale', price: 3500, category: 'beaute', condition: 'new', glyph: 'jar' },
      { title: 'Huile de coco — 200 ml', description: 'Huile vierge pressée à froid, flacon en verre.', mode: 'sale', price: 3000, category: 'beaute', condition: 'new', glyph: 'bottle' },
      { title: 'Savon noir artisanal', description: 'Savon noir doux, pain d’environ 150 g.', mode: 'sale', price: 1500, category: 'beaute', condition: 'new', glyph: 'soap' },
      { title: 'Coffret soin visage — à échanger', description: 'Coffret neuf. Je cherche en échange des flacons de voyage ou du matériel de conditionnement.', mode: 'trade', category: 'beaute', condition: 'new', glyph: 'jar' },
      { title: 'Échantillons de crème — à donner', description: 'Petits pots d’essai à offrir, à récupérer à Yoff.', mode: 'give', category: 'beaute', condition: 'new', glyph: 'jar' },
    ],
  },
  {
    key: 'almadies', handle: 'beaute_almadies_demo', boutique: 'Beauté Almadies', owner: 'Rokhaya Thiam', area: 'Almadies', category: 'beaute', aisle: 'Beauté',
    bio: 'Produits de coiffure et de soin, accessoires de salon. Rendez-vous aux Almadies.',
    items: [
      { title: 'Sérum visage 30 ml', description: 'Sérum hydratant, flacon pipette, scellé.', mode: 'sale', price: 7500, category: 'beaute', condition: 'new', glyph: 'bottle' },
      { title: 'Bougie parfumée en pot', description: 'Bougie parfumée, pot réutilisable. Vente ou troc contre un diffuseur.', mode: 'sale_or_trade', price: 6000, category: 'beaute', condition: 'new', glyph: 'jar' },
      { title: 'Brosse à cheveux et peigne', description: 'Brosse démêlante et peigne à dents larges, propres.', mode: 'sale', price: 2500, category: 'beaute', condition: 'like_new', glyph: 'comb' },
      { title: 'Miroir de coiffeuse', description: 'Miroir sur pied, cadre en bois. Prix à discuter.', mode: 'sale', price: 9000, priceMode: 'negotiable', category: 'beaute', condition: 'good', glyph: 'mirror' },
      { title: 'Flacons en verre vides — à donner', description: 'Une vingtaine de flacons nettoyés, à récupérer aux Almadies.', mode: 'give', category: 'beaute', condition: 'good', glyph: 'bottle' },
    ],
  },
];

/** Six Reels: [shop key, item index, caption]. */
const REELS: [string, number, string][] = [
  ['wax', 0, 'La robe wax évasée en mouvement. Disponible en taille M.'],
  ['allo', 0, 'Smartphone reconditionné, testé avant la vente.'],
  ['teranga', 0, 'Le fauteuil en rotin, fait main. Retrait à Ouakam.'],
  ['karite', 0, 'Beurre de karité pur, préparé en petite quantité.'],
  ['fann', 2, 'Baskets blanches pointure 42 : vente ou troc.'],
  ['tech', 2, 'Casque audio filaire : on teste le son avant de repartir.'],
];

/** Ten statuses with a product sticker: [shop key, item index, caption]. */
const STATUSES: [string, number, string][] = [
  ['wax', 2, 'Nouveau tissu cauris'],
  ['wax', 4, 'À donner : foulards en wax'],
  ['fann', 0, 'Chemise bleue, taille L'],
  ['allo', 2, 'Écouteurs neufs en boîte'],
  ['tech', 2, 'Casque audio, test sur place'],
  ['teranga', 2, 'Coussins en wax, set de 2'],
  ['mame', 0, 'Grande marmite 12 L'],
  ['karite', 1, 'Huile de coco, flacon verre'],
  ['almadies', 2, 'Brosse et peigne'],
  ['almadies', 0, 'Sérum visage 30 ml'],
];

/** Five text « Je cherche » posts, one per shop. */
const SEEK: [string, string][] = [
  ['wax', 'Je cherche une machine à coudre d’occasion en bon état, plutôt sur Dakar. Budget à discuter, troc possible contre du tissu wax.'],
  ['allo', 'Je cherche des écrans de téléphone de rechange (modèles Android courants), en lot. Qui en a ?'],
  ['teranga', 'Je cherche une table de salle à manger pour 6 personnes, en bois ou en rotin. Retrait à Ouakam possible.'],
  ['karite', 'Je cherche des pots en verre de 100 à 250 ml pour conditionner mes soins. Troc possible contre du savon noir.'],
  ['almadies', 'Je cherche une étagère murale pour mon salon de coiffure. Petit prix ou troc contre des produits de soin.'],
];

// ---------------------------------------------------------------------------------------------
// Generated images (vector pictograms on the brand canvas) and videos (ffmpeg)
// ---------------------------------------------------------------------------------------------
const P = palette;
const GLYPHS: Record<Glyph, (a: string, b: string) => string> = {
  dress: (a, b) => `<path d="M420 200h60l30 120 30-120h60l40 230 120 380H240L380 430z" fill="${a}"/><rect x="356" y="420" width="288" height="26" rx="13" fill="${b}"/>`,
  shirt: (a, b) => `<path d="M300 240l120-40q80 70 160 0l120 40 80 150-100 50v360H320V440l-100-50z" fill="${a}"/><path d="M420 200q80 70 160 0" stroke="${b}" stroke-width="22" fill="none"/>`,
  shoe: (a, b) => `<path d="M180 600V470q150 30 250-60l90 50q90 70 270 100 70 15 70 80v60H180z" fill="${a}"/><rect x="180" y="680" width="680" height="46" rx="23" fill="${b}"/><path d="M440 470l60 50M500 450l60 50" stroke="${b}" stroke-width="14"/>`,
  fabric: (a, b) => Array.from({ length: 16 }, (_, i) => { const x = 250 + (i % 4) * 170 + (Math.floor(i / 4) % 2) * 60, y = 240 + Math.floor(i / 4) * 150; return `<circle cx="${x}" cy="${y}" r="62" fill="${a}"/><circle cx="${x}" cy="${y}" r="36" fill="${P.surface}"/><circle cx="${x}" cy="${y}" r="14" fill="${b}"/>`; }).join(''),
  phone: (a, b) => `<rect x="360" y="170" width="280" height="660" rx="48" fill="${a}"/><rect x="384" y="214" width="232" height="560" rx="24" fill="${P.surface}"/><circle cx="500" cy="190" r="9" fill="${b}"/><rect x="456" y="794" width="88" height="10" rx="5" fill="${b}"/>`,
  laptop: (a, b) => `<rect x="260" y="260" width="480" height="320" rx="24" fill="${a}"/><rect x="284" y="284" width="432" height="272" rx="10" fill="${P.surface}"/><path d="M180 620h640l-50 80H230z" fill="${b}"/>`,
  headphones: (a, b) => `<path d="M280 560V470q0-200 220-200t220 200v90" stroke="${a}" stroke-width="40" fill="none"/><rect x="230" y="500" width="110" height="230" rx="45" fill="${b}"/><rect x="660" y="500" width="110" height="230" rx="45" fill="${b}"/>`,
  speaker: (a, b) => `<rect x="330" y="220" width="340" height="560" rx="70" fill="${a}"/><circle cx="500" cy="400" r="95" fill="${P.surface}"/><circle cx="500" cy="400" r="45" fill="${b}"/><circle cx="500" cy="640" r="60" fill="${P.surface}"/>`,
  chair: (a, b) => `<rect x="300" y="200" width="60" height="380" rx="20" fill="${a}"/><rect x="300" y="520" width="400" height="70" rx="24" fill="${a}"/><rect x="300" y="590" width="40" height="220" rx="14" fill="${b}"/><rect x="660" y="590" width="40" height="220" rx="14" fill="${b}"/><rect x="330" y="330" width="200" height="30" rx="12" fill="${b}"/>`,
  lamp: (a, b) => `<path d="M360 230h280l80 260H280z" fill="${a}"/><rect x="484" y="490" width="32" height="240" rx="14" fill="${b}"/><rect x="380" y="730" width="240" height="46" rx="22" fill="${b}"/>`,
  cushion: (a, b) => `<rect x="230" y="270" width="540" height="460" rx="90" fill="${a}"/><path d="M500 320l130 180-130 180-130-180z" fill="${b}"/><path d="M500 390l62 110-62 110-62-110z" fill="${P.surface}"/>`,
  pot: (a, b) => `<rect x="280" y="400" width="440" height="330" rx="60" fill="${a}"/><rect x="250" y="350" width="500" height="64" rx="30" fill="${b}"/><rect x="460" y="300" width="80" height="60" rx="26" fill="${b}"/><rect x="190" y="470" width="90" height="34" rx="17" fill="${b}"/><rect x="720" y="470" width="90" height="34" rx="17" fill="${b}"/>`,
  fan: (a, b) => `<circle cx="500" cy="400" r="230" fill="none" stroke="${a}" stroke-width="30"/><path d="M500 400q-20-170 80-170 60 70-80 170zM500 400q170-20 170 80-70 60-170-80zM500 400q20 170-80 170-60-70 80-170zM500 400q-170 20-170-80 70-60 170 80z" fill="${a}"/><circle cx="500" cy="400" r="34" fill="${b}"/><rect x="480" y="630" width="40" height="150" rx="16" fill="${b}"/><rect x="360" y="770" width="280" height="40" rx="20" fill="${b}"/>`,
  jar: (a, b) => `<rect x="320" y="330" width="360" height="400" rx="70" fill="${a}"/><rect x="300" y="250" width="400" height="100" rx="34" fill="${b}"/><rect x="380" y="480" width="240" height="120" rx="30" fill="${P.surface}"/>`,
  bottle: (a, b) => `<rect x="450" y="190" width="100" height="90" rx="22" fill="${b}"/><rect x="470" y="270" width="60" height="110" fill="${a}"/><rect x="340" y="370" width="320" height="410" rx="80" fill="${a}"/><rect x="390" y="500" width="220" height="150" rx="26" fill="${P.surface}"/>`,
  soap: (a, b) => `<rect x="260" y="400" width="480" height="280" rx="90" fill="${a}"/><circle cx="360" cy="300" r="44" fill="${b}"/><circle cx="470" cy="240" r="30" fill="${b}"/><circle cx="590" cy="310" r="52" fill="${b}"/>`,
  comb: (a, b) => `<rect x="220" y="260" width="560" height="110" rx="40" fill="${a}"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${250 + i * 60}" y="370" width="30" height="300" rx="15" fill="${b}"/>`).join('')}`,
  mirror: (a, b) => `<ellipse cx="500" cy="400" rx="230" ry="280" fill="${b}"/><ellipse cx="500" cy="400" rx="190" ry="240" fill="${P.surface}"/><path d="M400 300q60-60 130-20" stroke="${a}" stroke-width="18" fill="none"/><rect x="470" y="680" width="60" height="150" rx="24" fill="${b}"/>`,
};

const svgDoc = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

/** A product picture: the brand canvas, one pictogram, a discreet « DÉMO · photo à venir » caption. */
async function picture(glyph: Glyph, variant: number, w = 1080, h = 1350, withCaption = true): Promise<Buffer> {
  const accent = [P.gold, P.mint, P.ink][variant % 3];
  const detail = [P.mint, P.gold, P.slate][variant % 3];
  const s = Math.min(w, h) / 1000;
  const x = (w - 1000 * s) / 2;
  const y = (h - 1000 * s) / 2 - h * 0.03;
  const caption = withCaption
    ? `<text x="${w / 2}" y="${h - 56}" font-family="DejaVu Sans, sans-serif" font-size="${Math.round(w * 0.028)}" text-anchor="middle" fill="${P.slate}" letter-spacing="2">DÉMO · PHOTO À VENIR</text>`
    : '';
  const svg = svgDoc(
    w,
    h,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.raised}"/><stop offset="1" stop-color="${P.canvas}"/></linearGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)"/><rect x="${w * 0.07}" y="${h * 0.05}" width="${w * 0.86}" height="${h * 0.9}" rx="48" fill="none" stroke="${P.line}" stroke-width="4"/>` +
      `<g transform="translate(${x} ${y}) scale(${s})">${GLYPHS[glyph](accent, detail)}</g>${caption}`,
  );
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

async function avatar(initials: string, variant: number): Promise<Buffer> {
  const bg = [P.raised, P.surface, P.line][variant % 3];
  const svg = svgDoc(480, 480, `<rect width="480" height="480" fill="${bg}"/><text x="240" y="285" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="170" text-anchor="middle" fill="${[P.gold, P.mint][variant % 2]}">${initials}</text>`);
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

const WORK = mkdtempSync(path.join(tmpdir(), 'jefeli-showcase-'));
process.on('exit', () => rmSync(WORK, { recursive: true, force: true }));

/** A 6-second 720×1280 vertical clip (slow zoom on a generated picture), H.264 + faststart, no audio. */
async function clip(glyph: Glyph, variant: number): Promise<{ video: Buffer; poster: Buffer; width: number; height: number; durationMs: number }> {
  const still = path.join(WORK, `${randomUUID()}.png`);
  const out = path.join(WORK, `${randomUUID()}.mp4`);
  const png = await sharp(Buffer.from(svgDoc(1440, 2560, `<rect width="1440" height="2560" fill="${P.canvas}"/>`)))
    .composite([{ input: await picture(glyph, variant, 1440, 2560, false), top: 0, left: 0 }])
    .png()
    .toBuffer();
  await sharp(png).toFile(still);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', still, '-vf', "zoompan=z='min(zoom+0.0016,1.28)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=720x1280:fps=25,format=yuv420p", '-t', '6', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-movflags', '+faststart', '-an', out]);
  const poster = await sharp(png).resize(720, 1280).jpeg({ quality: 84 }).toBuffer();
  return { video: readFileSync(out), poster, width: 720, height: 1280, durationMs: 6000 };
}

// ---------------------------------------------------------------------------------------------
// Accounts and remove
// ---------------------------------------------------------------------------------------------
async function listShowcaseUsers() {
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data?.users ?? []) if (u.email?.endsWith(`@${DOMAIN}`)) out.push({ id: u.id, email: u.email });
    if ((data?.users.length ?? 0) < 200) break;
  }
  return out;
}

async function removeFiles(userId: string) {
  for (const bucket of ['avatars', 'public-media', 'private-media']) {
    const files: string[] = [];
    const walk = async (prefix: string) => {
      const { data: items } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      for (const it of items ?? []) {
        const p = `${prefix}/${it.name}`;
        if (!it.id) await walk(p);
        else files.push(p);
      }
    };
    await walk(userId);
    for (let i = 0; i < files.length; i += 100) await admin.storage.from(bucket).remove(files.slice(i, i + 100));
  }
}

async function remove() {
  const users = await listShowcaseUsers();
  for (const u of users) {
    // Safety: only a DÉMO profile is ever removed.
    const prof = must(await admin.from('profiles').select('is_demo').eq('id', u.id).maybeSingle(), 'profile');
    if (prof && !prof.is_demo) {
      console.log(`  skipped ${u.email}: not marked DÉMO`);
      continue;
    }
    await removeFiles(u.id);
    must(await admin.auth.admin.deleteUser(u.id), `delete ${u.email}`);
    console.log(`  removed ${u.email}`);
  }
  console.log(`Showcase removed (${users.length} account(s)).`);
}

async function counts() {
  const users = await listShowcaseUsers();
  const ids = users.map((u) => u.id);
  const c = async (t: string, col: string) => (ids.length ? (await admin.from(t).select('*', { count: 'exact', head: true }).in(col, ids)).count ?? 0 : 0);
  const reels = ids.length ? (await admin.from('posts').select('*', { count: 'exact', head: true }).in('author_id', ids).eq('in_reels', true)).count ?? 0 : 0;
  const activeStories = ids.length ? (await admin.from('stories').select('*', { count: 'exact', head: true }).in('author_id', ids).is('deleted_at', null).gt('expires_at', new Date().toISOString())).count ?? 0 : 0;
  return { accounts: users.length, products: await c('products', 'seller_id'), posts: await c('posts', 'author_id'), reels, statusesActive: activeStories, stories: await c('stories', 'author_id') };
}

// ---------------------------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------------------------
interface Actor { client: SupabaseClient; id: string; shop: Shop }
const initials = (n: string) => n.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

async function upload(a: Actor, bucket: string, folder: string, buf: Buffer, contentType: string, ext: string) {
  const p = `${a.id}/${folder}/${randomUUID()}.${ext}`;
  must(await a.client.storage.from(bucket).upload(p, buf, { contentType, upsert: false }), `upload ${p}`);
  return p;
}

async function actorFor(shop: Shop, id: string, email: string, password: string): Promise<Actor> {
  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${shop.key}`);
  return { client, id, shop };
}

async function create() {
  const existing = await listShowcaseUsers();
  if (existing.length) {
    console.log(`Showcase already present (${existing.length} accounts). Recreating the expired statuses only…`);
    return refreshStatuses();
  }
  console.log('Creating 8 DÉMO shops…');
  const actors: Record<string, Actor> = {};
  const productIds: Record<string, string[]> = {};
  let n = 0;
  for (const shop of SHOPS) {
    const email = `${shop.key}@${DOMAIN}`;
    const password = randomBytes(18).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: shop.owner, handle: shop.handle } });
    if (!data.user) throw new Error(`create ${email}: ${error?.message}`);
    const a = await actorFor(shop, data.user.id, email, password);
    actors[shop.key] = a;
    const avatarPath = await upload(a, 'avatars', 'avatar', await avatar(initials(shop.boutique), n++), 'image/jpeg', 'jpg');
    must(
      await a.client.from('profiles').update({
        bio: shop.bio, city: 'Dakar', neighborhood: shop.area, is_merchant: true, boutique_name: shop.boutique, boutique_category_slug: shop.category,
        interests: [shop.category], avatar_path: avatarPath, adult_confirmed_at: new Date().toISOString(), onboarded_at: new Date().toISOString(),
      }).eq('id', a.id),
      `profile ${shop.key}`,
    );
    // The DÉMO label can only be set by a trusted context.
    must(await admin.from('profiles').update({ is_demo: true }).eq('id', a.id), 'is_demo');
  }

  console.log('Publishing 40 items…');
  for (const shop of SHOPS) {
    const a = actors[shop.key]!;
    productIds[shop.key] = [];
    let v = 0;
    for (const it of shop.items) {
      const photo = await upload(a, 'public-media', 'listings', await picture(it.glyph, v++), 'image/jpeg', 'jpg');
      const id = must(
        await a.client.rpc('create_listing', {
          p_title: it.title, p_description: it.description, p_price_xof: it.mode === 'give' ? 0 : it.price ?? null,
          p_price_mode: it.mode === 'give' || it.mode === 'trade' ? 'fixed' : it.priceMode ?? 'fixed', p_category_slug: it.category, p_condition: it.condition,
          p_listing_mode: it.mode, p_quantity: 1, p_city: 'Dakar', p_neighborhood: shop.area, p_delivery_options: ['pickup'], p_delivery_notes: `Remise en main propre à ${shop.area}.`,
          p_media: [{ kind: 'image', path: photo, width: 1080, height: 1350 }],
        }),
        `listing ${it.title}`,
      ) as string;
      productIds[shop.key]!.push(id);
    }
  }

  console.log('Publishing 6 Reels…');
  let rv = 0;
  for (const [key, idx, caption] of REELS) {
    const a = actors[key]!;
    const item = a.shop.items[idx]!;
    const c = await clip(item.glyph, rv++);
    const videoPath = await upload(a, 'public-media', 'studio', c.video, 'video/mp4', 'mp4');
    const posterPath = await upload(a, 'public-media', 'studio', c.poster, 'image/jpeg', 'jpg');
    const postId = must(
      await a.client.rpc('create_post', {
        p_body: caption, p_visibility: 'public', p_intent: 'share', p_product_ids: [productIds[key]![idx]],
        p_media: [{ kind: 'video', path: videoPath, poster_path: posterPath, width: c.width, height: c.height, duration_ms: c.durationMs }],
      }),
      `reel ${key}`,
    ) as string;
    must(await a.client.rpc('set_post_surfaces', { p_post_id: postId, p_in_feed: true, p_in_reels: true }), `surfaces ${key}`);
  }

  console.log('Publishing 5 « Je cherche » posts…');
  for (const [key, body] of SEEK) {
    must(await actors[key]!.client.rpc('create_post', { p_body: body, p_visibility: 'public', p_media: [], p_product_ids: [], p_intent: 'seek' }), `seek ${key}`);
  }

  console.log('Publishing 10 statuses with product stickers…');
  for (const [key, idx, caption] of STATUSES) {
    await createStatus(actors[key]!, productIds[key]![idx]!, SHOPS.find((s) => s.key === key)!.items[idx]!, caption);
  }
  console.log('Showcase ready.');
}

async function createStatus(a: Actor, productId: string, item: Item, caption: string) {
  // A 9:16 picture for the status viewer (the pictogram stays centred on the brand canvas).
  const buf = await picture(item.glyph, 1, 1080, 1920);
  const p = await upload(a, 'private-media', 'stories', buf, 'image/jpeg', 'jpg');
  must(
    await a.client.rpc('create_story', { p_media_kind: 'image', p_path: p, p_poster_path: null, p_width: 1080, p_height: 1920, p_duration_ms: null, p_caption: caption, p_audience: 'public', p_product_id: productId }),
    `status ${caption}`,
  );
}

/** Statuses live 24 h: recreate the ones that expired (called when the showcase already exists). */
async function refreshStatuses() {
  const users = await listShowcaseUsers();
  const byKey = new Map(users.map((u) => [u.email.split('@')[0]!, u]));
  const minExpiry = new Date(Date.now() + 2 * 3600_000).toISOString();
  let made = 0;
  for (const [key, idx, caption] of STATUSES) {
    const shop = SHOPS.find((s) => s.key === key)!;
    const u = byKey.get(key);
    if (!u) continue;
    const live = must(await admin.from('stories').select('id').eq('author_id', u.id).eq('caption', caption).is('deleted_at', null).gt('expires_at', minExpiry).limit(1), 'stories');
    if (live.length) continue;
    const item = shop.items[idx]!;
    const product = must(await admin.from('products').select('id').eq('seller_id', u.id).eq('title', item.title).maybeSingle(), 'product');
    if (!product) continue;
    // Act as the shop through a one-time magic link-free path: a fresh random password set by the admin.
    const password = randomBytes(18).toString('base64url');
    must(await admin.auth.admin.updateUserById(u.id, { password }), 'password');
    const a = await actorFor(shop, u.id, u.email, password);
    await createStatus(a, product.id, item, caption);
    made++;
  }
  console.log(made ? `Recreated ${made} expired status(es).` : 'All DÉMO statuses are still valid.');
}

/** `--preview-assets <dir>`: write one picture per pictogram and one clip, touching nothing else (no network). */
async function previewAssets(dir: string) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  const glyphs = Object.keys(GLYPHS) as Glyph[];
  for (const [i, g] of glyphs.entries()) writeFileSync(path.join(dir, `${g}.jpg`), await picture(g, i));
  const c = await clip('dress', 0);
  writeFileSync(path.join(dir, 'clip.mp4'), c.video);
  writeFileSync(path.join(dir, 'clip-poster.jpg'), c.poster);
  console.log(`${glyphs.length} pictures + 1 clip (${(c.video.length / 1024).toFixed(0)} KB) in ${dir}`);
}

(async () => {
  const pv = process.argv.indexOf('--preview-assets');
  if (pv >= 0) return previewAssets(process.argv[pv + 1] ?? path.join(WORK, 'preview'));
  if (args.has('--remove')) {
    console.log('Removing the DÉMO showcase…');
    await remove();
  } else if (args.has('--status')) {
    // nothing to do: counted below
  } else {
    await create();
  }
  console.log(JSON.stringify(await counts()));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
