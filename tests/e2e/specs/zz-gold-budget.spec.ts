/**
 * Gold budget (owner addendum 15 Nov 2026, 1b): at most ONE filled gold element per screen — the
 * primary action. Every other use of gold is a small marker (active tab, Jëf, Waxaale tag, hairline).
 *
 * « Filled gold element » = an element whose background is the gold (or pressed gold) token and
 * whose smaller side is ≥ 28 px (buttons, selected chips, bars, the « + »). Badges, dots and
 * underlines under 28 px are markers and are not counted.
 *
 * Visits each screen at 390 px as a DÉMO member (and as the buyer of an open agreement) and
 * records every violation. GOLD_REPORT=<name> writes docs/evidence/p1-identity/gold-budget/<name>.json
 * and never fails (used for the before/after lists); without it the test fails on any screen > 1.
 */
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { EVIDENCE, goldFills, newDevice, signIn, WEB_URL, type GoldHit as Hit } from './helpers';

const REPORT = process.env.GOLD_REPORT;
const OUT = path.join(EVIDENCE, '..', 'p1-identity', 'gold-budget');

function sql(q: string): string {
  try {
    return execSync(`docker exec supabase_db_jefeli psql -U postgres -tAc "${q}"`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const FATOU = ['fatou@demo.jefeli.test', 'Demo-jefeli-2026!'] as const;
const PRODUCT = sql(`select id from products where status='active' and moderation_status='active' and seller_id<>(select id from profiles where handle='fatou_sarr') limit 1`);
const OWN = sql(`select id from products where seller_id=(select id from profiles where handle='fatou_sarr') limit 1`);
const CONV = sql(`select c.id from conversations c join conversation_members m on m.conversation_id=c.id join profiles p on p.id=m.user_id where p.handle='fatou_sarr' limit 1`);
const OTHER = sql(`select handle from profiles where is_demo and handle<>'fatou_sarr' limit 1`);
const DEAL = sql(`select a.id || '|' || a.conversation_id || '|' || u.email from agreements a join auth.users u on u.id=a.buyer_id where u.email like '%@e2e.jefeli.test' and a.status='agreed' order by a.created_at desc limit 1`).split('|');

type Screen = { name: string; path: string; as?: 'fatou' | 'buyer'; after?: (p: Page) => Promise<void> };
const SCREENS: Screen[] = [
  { name: 'accueil', path: '/' },
  { name: 'explorer', path: '/explore' },
  { name: 'messages', path: '/messages' },
  { name: 'profil-perso', path: '/profile' },
  { name: 'boutique-autre', path: `/u/${OTHER}`, after: async (p) => {
      await p.getByRole('tab', { name: /^Boutique/ }).click({ timeout: 5000 });
    },
  },
  { name: 'article-acheteur', path: `/p/${PRODUCT}` },
  { name: 'article-vendeur', path: `/p/${OWN}` },
  { name: 'offre', path: `/offer/${PRODUCT}` },
  { name: 'discussion', path: `/chat/${CONV}` },
  { name: 'accord-acheteur', path: `/agreement/${DEAL[0]}`, as: 'buyer' },
  { name: 'discussion-offres', path: `/chat/${DEAL[1]}`, as: 'buyer' },
  { name: 'notifications', path: '/notifications' },
  { name: 'recherche', path: '/search' },
  { name: 'enregistres', path: '/saved' },
  { name: 'amis', path: '/friends' },
  { name: 'inviter', path: '/invite' },
  { name: 'reglages', path: '/settings' },
  { name: 'reglages-compte', path: '/settings/account' },
  { name: 'reglages-confidentialite', path: '/settings/privacy' },
  { name: 'modifier-profil', path: '/edit-profile' },
  { name: 'modifier-boutique', path: '/boutique-edit' },
  { name: 'studio-capture', path: '/studio?mode=photo' },
  { name: 'studio-composer', path: '/studio' },
  { name: 'studio-voix', path: '/studio?mode=voice' },
  { name: 'reels', path: '/reels' },
  { name: 'accords', path: '/agreements' },
  {
    name: 'studio-depuis-plus',
    path: '/',
    after: async (p) => {
      await p.getByRole('tab', { name: 'Publier' }).click({ timeout: 5000 });
      await p.waitForTimeout(900);
    },
  },
  {
    name: 'explorer-filtres',
    path: '/explore',
    after: async (p) => {
      await p.getByRole('button', { name: 'Filtres' }).first().click({ timeout: 5000 });
      await p.waitForTimeout(600);
    },
  },
];
const AUTH_SCREENS = [
  { name: 'connexion', path: '/sign-in' },
  { name: 'inscription', path: '/sign-up' },
  { name: 'accueil-visiteur', path: '/' },
  { name: 'mot-de-passe-oublie', path: '/forgot-password' },
];

test.describe('gold budget', () => {
  test.setTimeout(600_000);
  const results: Record<string, Hit[]> = {};

  test('every screen has at most one filled gold element', async ({ browser }) => {
    const fatou = await newDevice(browser, { width: 390, height: 844 });
    await signIn(fatou.page, ...FATOU);
    const buyer = DEAL[2] ? await newDevice(browser, { width: 390, height: 844 }) : null;
    if (buyer) await signIn(buyer.page, DEAL[2]!, 'Test-jefeli-2026!');

    for (const s of SCREENS) {
      const page = s.as === 'buyer' ? buyer?.page : fatou.page;
      if (!page || s.path.includes('undefined') || (s.path.length > 1 && s.path.endsWith('/'))) {
        console.log(`GOLD skipped ${s.name} (no data)`);
        continue;
      }
      await page.goto(s.path);
      await page.waitForTimeout(2200);
      if (s.after) await s.after(page).catch(() => console.log(`GOLD note: step failed on ${s.name}`));
      results[s.name] = await goldFills(page);
    }
    await fatou.ctx.close();
    await buyer?.ctx.close();

    const visitor = await newDevice(browser, { width: 390, height: 844 });
    for (const s of AUTH_SCREENS) {
      await visitor.page.goto(s.path);
      await visitor.page.waitForTimeout(1800);
      results[s.name] = await goldFills(visitor.page);
    }
    await visitor.ctx.close();

    if (REPORT) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${REPORT}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
    const over = Object.entries(results).filter(([, hits]) => hits.length > 1);
    console.log(`GOLD ${Object.keys(results).length} screens, ${over.length} over budget`);
    for (const [name, hits] of over) console.log(`GOLD ✗ ${name}: ${hits.map((h) => `${h.text || h.tag}(${h.w}x${h.h})`).join(' | ')}`);
    if (!REPORT) expect(over.map(([n]) => n)).toEqual([]);
  });

  test('public web pages (share pages, boutique, legal) have at most one filled gold element', async ({ browser }) => {
    const handle = sql(`select handle from profiles where id=(select seller_id from products where id='${PRODUCT}')`);
    const post = sql(`select id from posts where visibility='public' limit 1`);
    const pages = [
      ['web-accueil', '/'],
      ['web-article', `/p/${PRODUCT}`],
      ['web-boutique', `/${handle}`],
      ['web-publication', `/post/${post}`],
      ['web-regles', '/legal/regles'],
    ] as const;
    const web: Record<string, Hit[]> = {};
    const { ctx, page } = await newDevice(browser, { width: 390, height: 844 });
    for (const [name, p] of pages) {
      await page.goto(`${WEB_URL}${p}`);
      await page.waitForTimeout(1200);
      web[name] = await goldFills(page);
    }
    await ctx.close();
    if (REPORT) {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${REPORT}-web.json`), `${JSON.stringify(web, null, 2)}\n`);
    }
    const over = Object.entries(web).filter(([, hits]) => hits.length > 1);
    for (const [name, hits] of over) console.log(`GOLD ✗ ${name}: ${hits.map((h) => `${h.text || h.tag}(${h.w}x${h.h})`).join(' | ')}`);
    console.log(`GOLD web ${pages.length} pages, ${over.length} over budget`);
    if (!REPORT) expect(over.map(([n]) => n)).toEqual([]);
  });
});
