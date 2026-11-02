#!/usr/bin/env node
/**
 * Jëfëli — LOCAL development fixtures for the web app (share pages + moderation console).
 *
 * Creates a fresh, randomly-suffixed set of DEMO members through the real APIs:
 *   - users via the Auth admin API (service role, LOCAL ONLY), then each member signs in with the
 *     anon key and acts as themselves (profile update, storage uploads, create_listing, create_post,
 *     create_story, follows, likes, comments, offers → agreement → reviews, reports, appeal);
 *   - an admin member (staff_roles row inserted with the service role) who approves a
 *     verification request and hides a reported post;
 *   - a live session row (only trusted server code may create those — service role here).
 * All fixture profiles are flagged is_demo = true.
 *
 * Usage:  pnpm --filter @jefeli/web fixtures            (create a new set)
 *         pnpm --filter @jefeli/web fixtures --purge    (delete sets created by this script)
 * Refuses to run against anything but a local Supabase stack. Never ship the service-role key in
 * application code: it only lives in this local script (well-known `supabase start` demo key).
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321').replace(/\/+$/, '');
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  console.error(`Refus : ${SUPABASE_URL} n'est pas une instance Supabase locale. Ce script ne s'exécute qu'en local.`);
  process.exit(1);
}
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const suffix = randomBytes(2).toString('hex');
const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

function must(result, label) {
  if (result.error) {
    console.error(`✗ ${label}:`, result.error.message ?? result.error);
    process.exit(1);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Images: owner-provided reference photos, upscaled with sharp when available.
// ---------------------------------------------------------------------------
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('! sharp indisponible : images envoyées dans leur taille d’origine');
}

/**
 * The reference photos come from a UI mockup: some have a heart / counter badge baked in.
 * `patches` paint those areas with a background colour sampled nearby; `extract` crops.
 */
const IMAGE_PREP = {
  'shoes.jpg': {
    extract: { left: 6, top: 36, width: 198, height: 143 },
    patches: [{ left: 148, top: 102, width: 50, height: 36, sample: [138, 122] }],
    extendTop: { px: 44 },
  },
  'purple_bag.jpg': { extract: { left: 2, top: 2, width: 91, height: 91 }, patches: [{ left: 64, top: 3, width: 27, height: 22, sample: [80, 28] }] },
  'yellow_dress.jpg': { extract: { left: 3, top: 2, width: 92, height: 92 }, patches: [{ left: 62, top: 3, width: 30, height: 24, sample: [86, 32] }] },
  'seller_gold.jpg': { extract: { left: 28, top: 14, width: 100, height: 100 } },
  'seller_mint.jpg': { extract: { left: 20, top: 4, width: 186, height: 186 } },
};

/** Average colour of a 5×5 area (raw RGB buffer). */
function sampleColor(data, info, x, y) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = Math.min(info.width - 1, Math.max(0, x + dx));
      const py = Math.min(info.height - 1, Math.max(0, y + dy));
      const i = (py * info.width + px) * info.channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

async function prepare(raw, name) {
  const prep = IMAGE_PREP[name];
  if (!prep) return raw;
  let buf = raw;
  if (prep.extract) buf = await sharp(buf).extract(prep.extract).toBuffer();
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (prep.patches?.length) {
    const composites = [];
    for (const p of prep.patches) {
      const background = sampleColor(data, info, p.sample[0], p.sample[1]);
      const width = Math.min(p.width, info.width - p.left);
      const height = Math.min(p.height, info.height - p.top);
      const patch = await sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
      composites.push({ input: patch, left: p.left, top: p.top });
    }
    buf = await sharp(buf).composite(composites).toBuffer();
  }
  if (prep.extendTop) {
    // Repeat the (uniform studio) top edge so the square crop keeps the whole subject.
    buf = await sharp(buf).extend({ top: prep.extendTop.px, extendWith: 'copy' }).toBuffer();
  }
  return buf;
}

async function image(name, { size = 720, flop = false } = {}) {
  const raw = await readFile(join(repoRoot, 'reference', 'assets', name));
  if (!sharp) return { buffer: raw, width: null, height: null };
  let pipeline = sharp(await prepare(raw, name)).resize({ width: size, height: size, fit: 'cover', kernel: 'lanczos3' });
  if (flop) pipeline = pipeline.flop();
  const buffer = await pipeline.sharpen({ sigma: 0.6 }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return { buffer, width: size, height: size };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function createMember({ key, displayName, handle }) {
  const email = `${key}-${suffix}@jefeli.test`;
  const password = `Jefeli-${randomBytes(6).toString('hex')}`;
  const created = must(
    await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } }),
    `création ${key}`,
  );
  const client = createClient(SUPABASE_URL, ANON_KEY, noSession);
  must(await client.auth.signInWithPassword({ email, password }), `connexion ${key}`);
  return { key, id: created.user.id, email, password, handle: `${handle}_${suffix}`, displayName, client };
}

async function setupProfile(m, fields) {
  const now = new Date().toISOString();
  must(
    await m.client
      .from('profiles')
      .update({ handle: m.handle, display_name: m.displayName, onboarded_at: now, adult_confirmed_at: now, ...fields })
      .eq('id', m.id),
    `profil ${m.key}`,
  );
}

async function upload(m, bucket, path, img) {
  must(
    await m.client.storage.from(bucket).upload(`${m.id}/${path}`, img.buffer, { contentType: 'image/jpeg', upsert: false }),
    `upload ${bucket}/${path}`,
  );
  return { path: `${m.id}/${path}`, width: img.width, height: img.height };
}

async function listing(m, data, media) {
  return must(
    await m.client.rpc('create_listing', {
      p_title: data.title,
      p_description: data.description,
      p_price_xof: data.price ?? null,
      p_category_slug: data.category,
      p_condition: data.condition,
      p_listing_mode: data.mode,
      p_quantity: data.quantity ?? 1,
      p_city: 'Dakar',
      p_neighborhood: data.neighborhood ?? null,
      p_delivery_options: data.delivery,
      p_delivery_notes: data.deliveryNotes ?? '',
      p_media: media.map((x) => ({ kind: 'image', path: x.path, width: x.width, height: x.height })),
    }),
    `annonce ${data.title}`,
  );
}

// --purge: delete members created by previous runs of THIS script (email pattern below) and
// their storage folders, then exit. Nothing else in the local database is touched.
const FIXTURE_EMAIL = /^(awa|moussa|fatou|admin)-[0-9a-f]{4}@jefeli\.test$/;
if (process.argv.includes('--purge')) {
  let page = 1;
  const victims = [];
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    victims.push(...data.users.filter((u) => FIXTURE_EMAIL.test(u.email ?? '')));
    if (data.users.length < 200) break;
    page += 1;
  }
  for (const u of victims) {
    for (const bucket of ['avatars', 'public-media', 'private-media']) {
      const { data: objs } = await service.storage.from(bucket).list(u.id, { limit: 1000 });
      if (objs?.length) await service.storage.from(bucket).remove(objs.map((o) => `${u.id}/${o.name}`));
    }
    await service.from('live_sessions').delete().eq('host_id', u.id);
    const { error } = await service.auth.admin.deleteUser(u.id);
    console.log(error ? `✗ ${u.email}: ${error.message}` : `✓ supprimé ${u.email}`);
  }
  console.log(`${victims.length} membre(s) de fixtures supprimé(s).`);
  process.exit(0);
}

console.log(`Jëfëli fixtures — suffixe ${suffix} — ${SUPABASE_URL}`);

const awa = await createMember({ key: 'awa', displayName: 'Awa Ndiaye', handle: 'awa' });
const moussa = await createMember({ key: 'moussa', displayName: 'Moussa Diop', handle: 'moussa' });
const fatou = await createMember({ key: 'fatou', displayName: 'Fatou Sarr', handle: 'fatou' });
const admin = await createMember({ key: 'admin', displayName: 'Équipe modération', handle: 'moderation' });

// Staff role: never client-writable, inserted with the service role.
must(await service.from('staff_roles').insert({ user_id: admin.id, role: 'admin' }), 'rôle admin');

const awaAvatar = await upload(awa, 'avatars', `avatar-${suffix}.jpg`, await image('seller_mint.jpg', { size: 400 }));
const fatouAvatar = await upload(fatou, 'avatars', `avatar-${suffix}.jpg`, await image('seller_gold.jpg', { size: 400 }));

await setupProfile(awa, {
  bio: 'Mode, wax et accessoires choisis avec soin. Essayage possible à Liberté 6, livraison dans Dakar.',
  city: 'Dakar',
  neighborhood: 'Liberté 6',
  is_merchant: true,
  avatar_path: awaAvatar.path,
});
await setupProfile(moussa, { bio: 'Passionné de sneakers et de troc.', city: 'Dakar', neighborhood: 'Ouakam' });
await setupProfile(fatou, { bio: 'Je vends ce que je ne porte plus.', city: 'Thiès', is_private: true, avatar_path: fatouAvatar.path });
await setupProfile(admin, { bio: 'Compte de l’équipe de modération (local).' });
console.log('✓ membres', [awa, moussa, fatou, admin].map((m) => m.handle).join(', '));

// Listings ------------------------------------------------------------------
const shoes1 = await upload(awa, 'public-media', `baskets-1-${suffix}.jpg`, await image('shoes.jpg'));
const shoes2 = await upload(awa, 'public-media', `baskets-2-${suffix}.jpg`, await image('shoes.jpg', { flop: true }));
const bagImg = await upload(awa, 'public-media', `sac-${suffix}.jpg`, await image('purple_bag.jpg'));
const dressImg = await upload(awa, 'public-media', `robe-${suffix}.jpg`, await image('yellow_dress.jpg'));
const bazinImg = await upload(awa, 'public-media', `bazin-${suffix}.jpg`, await image('live_purple.jpg'));

const dressId = await listing(
  awa,
  {
    title: 'Robe jaune en wax, coupe évasée',
    description: 'Robe neuve cousue à Dakar. Taille M (38-40). Tissu wax 100 % coton, doublure légère.',
    price: 25000,
    category: 'mode-femme',
    condition: 'new',
    mode: 'sale',
    neighborhood: 'Liberté 6',
    delivery: ['pickup', 'delivery', 'shipping'],
    deliveryNotes: 'Livraison dans Dakar : 1 500 F selon le quartier. Envoi vers Thiès et Saint-Louis par car.',
  },
  [dressImg],
);
const bazinId = await listing(
  awa,
  {
    title: 'Tissu bazin riche violet, 5 mètres',
    description: 'Bazin neuf, jamais coupé. À échanger contre du wax ou un sac de qualité équivalente.',
    price: null,
    category: 'tissus-wax',
    condition: 'new',
    mode: 'trade',
    neighborhood: 'Liberté 6',
    delivery: ['pickup'],
  },
  [bazinImg],
);
const bagId = await listing(
  awa,
  {
    title: 'Sac à main violet en cuir',
    description: 'Porté deux fois, comme neuf. Fermeture dorée, bandoulière amovible.',
    price: 18000,
    category: 'sacs-accessoires',
    condition: 'like_new',
    mode: 'sale',
    neighborhood: 'Liberté 6',
    delivery: ['pickup'],
  },
  [bagImg],
);
const shoesId = await listing(
  awa,
  {
    title: 'Baskets blanches en cuir',
    description:
      'Baskets blanches en cuir, portées quelques fois, très bon état.\nPointures disponibles : 41 et 42.\n\nÉchange possible contre des sneakers de valeur équivalente.',
    price: 35000,
    category: 'chaussures',
    condition: 'very_good',
    mode: 'sale_or_trade',
    neighborhood: 'Liberté 6',
    delivery: ['pickup', 'delivery'],
    deliveryNotes: 'Remise à Liberté 6 ou au rond-point de la VDN.',
  },
  [shoes1, shoes2],
);
must(
  await awa.client
    .from('boutiques')
    .update({
      description: 'Vêtements en wax cousus à Dakar, tissus et accessoires sélectionnés. Nouveautés chaque semaine.',
      pickup_notes: 'Liberté 6, du lundi au samedi, 10 h – 19 h.',
      delivery_notes: 'Dakar et banlieue sous 48 h.',
      payment_notes: 'Espèces ou mobile money à la remise.',
    })
    .eq('owner_id', awa.id),
  'boutique',
);
console.log('✓ annonces', { shoesId, bagId, dressId, bazinId });

// Social graph & posts ------------------------------------------------------
must(await moussa.client.from('follows').insert({ follower_id: moussa.id, followee_id: awa.id }), 'follow moussa→awa');
must(await fatou.client.from('follows').insert({ follower_id: fatou.id, followee_id: awa.id }), 'follow fatou→awa');
must(await awa.client.from('follows').insert({ follower_id: awa.id, followee_id: moussa.id }), 'follow awa→moussa');

const postImg = await upload(awa, 'public-media', `post-${suffix}.jpg`, await image('shoes.jpg', { size: 900 }));
const postId = must(
  await awa.client.rpc('create_post', {
    p_body: 'Nouvel arrivage : baskets blanches en cuir, pointures 41 et 42. Passez en message pour les essayer à Liberté 6.',
    p_visibility: 'public',
    p_media: [{ kind: 'image', path: postImg.path, width: postImg.width, height: postImg.height }],
    p_product_ids: [shoesId],
  }),
  'publication 1',
);
const spamPostId = must(
  await awa.client.rpc('create_post', {
    p_body: 'PROMO PROMO PROMO sac violet 18 000 F !!! Écrivez-moi vite !!!',
    p_visibility: 'public',
    p_media: [],
    p_product_ids: [bagId],
  }),
  'publication 2',
);
must(await moussa.client.from('post_likes').insert({ post_id: postId, user_id: moussa.id }), 'like');
must(
  await moussa.client.from('comments').insert({ post_id: postId, author_id: moussa.id, body: 'Disponible en 42 ?' }),
  'commentaire',
);

// Status (24 h story) in private-media — exercises signed URLs for staff evidence.
const storyImg = await upload(awa, 'private-media', `statut-${suffix}.jpg`, await image('yellow_dress.jpg', { size: 640 }));
const storyId = must(
  await awa.client.rpc('create_story', {
    p_media_kind: 'image',
    p_path: storyImg.path,
    p_poster_path: null,
    p_width: storyImg.width,
    p_height: storyImg.height,
    p_duration_ms: null,
    p_caption: 'Dernière robe en taille M !',
    p_audience: 'public',
    p_product_id: dressId,
  }),
  'statut',
);

// Offer → agreement → both confirm → reviews (real counts, real rating) ----------
const offerId = must(
  await moussa.client.rpc('make_offer', {
    p_product_id: dressId,
    p_kind: 'price',
    p_amount_xof: 23000,
    p_message: 'Bonjour, 23 000 F pour la robe ? Je peux passer demain.',
  }),
  'offre',
);
const agreementId = must(await awa.client.rpc('respond_offer', { p_offer_id: offerId, p_accept: true }), 'acceptation');
must(await awa.client.rpc('confirm_agreement_completed', { p_agreement_id: agreementId }), 'confirmation vendeuse');
must(await moussa.client.rpc('confirm_agreement_completed', { p_agreement_id: agreementId }), 'confirmation acheteur');
must(
  await moussa.client.rpc('leave_review', {
    p_agreement_id: agreementId,
    p_rating: 5,
    p_body: 'Robe conforme aux photos, rendez-vous ponctuel. Merci !',
  }),
  'avis moussa',
);
must(
  await awa.client.rpc('leave_review', { p_agreement_id: agreementId, p_rating: 5, p_body: 'Acheteur sérieux.' }),
  'avis awa',
);
must(await awa.client.from('products').update({ status: 'sold' }).eq('id', dressId), 'robe vendue');

// Live (rows are created by trusted server code only: service role here) -------
const liveId = must(
  await service
    .from('live_sessions')
    .insert({
      host_id: awa.id,
      title: 'Nouveautés wax de la semaine',
      status: 'live',
      provider_call_id: `fixture-${suffix}`,
      started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single(),
  'live',
).id;
const pin = await awa.client.rpc('pin_live_product', { p_session_id: liveId, p_product_id: shoesId });
if (pin.error) console.warn('! épinglage live :', pin.error.message);

// Verification requests ----------------------------------------------------
const awaRequest = must(
  await awa.client
    .from('verification_requests')
    .insert({
      user_id: awa.id,
      business_name: 'Awa Couture',
      business_type: 'boutique',
      details: 'Atelier de couture à Liberté 6 depuis 2019. Registre de commerce disponible sur demande.',
    })
    .select('id')
    .single(),
  'demande vérification awa',
).id;
must(
  await moussa.client.from('verification_requests').insert({
    user_id: moussa.id,
    business_name: 'Moussa Sneakers',
    business_type: 'autre',
    details: 'Revente de sneakers d’occasion, environ 20 paires par mois.',
  }),
  'demande vérification moussa',
);
must(
  await admin.client.rpc('review_verification_request', {
    p_request_id: awaRequest,
    p_approve: true,
    p_note: 'Atelier visité, registre de commerce consulté (fixture locale).',
  }),
  'approbation vérification',
);

// Reports (from other members, through report_content) ----------------------
const reportBag1 = must(
  await moussa.client.rpc('report_content', {
    p_target_type: 'product',
    p_target_id: bagId,
    p_reason: 'counterfeit',
    p_details: 'Le fermoir ressemble à une copie de marque.',
  }),
  'signalement sac (moussa)',
);
const reportBag2 = must(
  await fatou.client.rpc('report_content', {
    p_target_type: 'product',
    p_target_id: bagId,
    p_reason: 'scam',
    p_details: 'Le vendeur demande un paiement avant de montrer le sac.',
  }),
  'signalement sac (fatou)',
);
const reportStory = must(
  await moussa.client.rpc('report_content', { p_target_type: 'story', p_target_id: storyId, p_reason: 'spam', p_details: '' }),
  'signalement statut',
);
const reportSpam = must(
  await fatou.client.rpc('report_content', {
    p_target_type: 'post',
    p_target_id: spamPostId,
    p_reason: 'spam',
    p_details: 'Même message publié plusieurs fois par jour.',
  }),
  'signalement publication',
);

// Moderation decision + appeal ---------------------------------------------
const actionId = must(
  await admin.client.rpc('moderate', {
    p_action: 'hide_content',
    p_target_type: 'post',
    p_target_id: spamPostId,
    p_report_id: reportSpam,
    p_reason: 'Publication promotionnelle répétée (spam). Règles de la communauté, section 3.',
  }),
  'masquage publication',
);
const appealId = must(
  await awa.client.rpc('submit_appeal', {
    p_moderation_action_id: actionId,
    p_body: 'Je ne publie cette promotion qu’une fois par semaine, ce n’est pas du spam. Merci de revoir la décision.',
  }),
  'contestation',
);

// Fixture data is DEMO data.
must(await service.from('profiles').update({ is_demo: true }).in('id', [awa.id, moussa.id, fatou.id, admin.id]), 'is_demo');

const summary = {
  suffix,
  supabaseUrl: SUPABASE_URL,
  members: Object.fromEntries([awa, moussa, fatou, admin].map((m) => [m.key, { id: m.id, handle: m.handle, email: m.email, password: m.password }])),
  products: { shoesId, bagId, dressId, bazinId },
  posts: { postId, spamPostId },
  storyId,
  liveId,
  reports: { reportBag1, reportBag2, reportStory, reportSpam },
  moderation: { actionId, appealId },
  urls: {
    profile: `/${awa.handle}`,
    privateProfile: `/${fatou.handle}`,
    product: `/p/${shoesId}`,
    tradeProduct: `/p/${bazinId}`,
    soldProduct: `/p/${dressId}`,
    post: `/post/${postId}`,
    live: `/live/${liveId}`,
    admin: '/admin',
  },
};
await writeFile(join(here, '.fixtures.local.json'), JSON.stringify(summary, null, 2));
console.log('✓ terminé — résumé dans apps/web/scripts/.fixtures.local.json');
console.log(JSON.stringify(summary.urls, null, 2));
console.log(`Console admin : ${admin.email} / ${admin.password}`);
