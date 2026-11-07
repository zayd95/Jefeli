/**
 * The owner's pilot script (docs/ACCEPTANCE_TESTS.md), automated through the real UI with
 * two isolated browser contexts — buyer A and seller B — on a phone-sized viewport,
 * against the local Supabase stack. Every step persists through the real backend.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { FIXTURE, btn, field, newDevice, pickFile, publishListing, runId, shot, signUp, WEB_URL } from './helpers';

const RUN = runId();
const PASSWORD = 'Test-jefeli-2026!';
const A = { name: `Fatima Test ${RUN}`, email: `a-${RUN}@e2e.jefeli.test`, handle: `acheteuse_${RUN}`, password: PASSWORD };
const B = { name: `Boutique Test ${RUN}`, email: `b-${RUN}@e2e.jefeli.test`, handle: `vendeur_${RUN}`, password: PASSWORD };
const LISTING = `Baskets test ${RUN}`;
const A_ITEM = `Sac test ${RUN}`;
const DIR = 'journey';
// The DÉMO admin by default; a pilot moderator bootstrapped by SQL on an unseeded database
// (docs/PILOT_OPERATIONS.md) when E2E_MODERATOR_EMAIL / E2E_MODERATOR_PASSWORD are set.
const MODERATOR = {
  email: process.env.E2E_MODERATOR_EMAIL ?? 'admin@demo.jefeli.test',
  password: process.env.E2E_MODERATOR_PASSWORD ?? 'Demo-jefeli-2026!',
};

let ctxA: BrowserContext;
let ctxB: BrowserContext;
let a: Page;
let b: Page;
let productUrl = '';

test.describe.serial('Two-account social commerce journey', () => {
  test.beforeAll(async ({ browser }) => {
    ({ ctx: ctxA, page: a } = await newDevice(browser));
    ({ ctx: ctxB, page: b } = await newDevice(browser));
  });

  test.afterAll(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test('ID-01 · two independent accounts sign up and complete onboarding', async () => {
    await signUp(b, B);
    await shot(b, DIR, 'B-home-after-onboarding');
    await signUp(a, A);
    await shot(a, DIR, 'A-home-after-onboarding');
  });

  test('PROF-01 / MKT-01 · B publishes a used listing; boutique appears automatically', async () => {
    await publishListing(b, {
      file: FIXTURE('shoe.jpg'),
      title: LISTING,
      mode: 'Vente ou troc',
      price: '35000',
      category: 'Chaussures',
      condition: 'Très bon état',
      description: 'Pointure 42, portées deux fois. Remise à Liberté 6.',
    });
    await expect(b.getByText('35 000 F CFA').first()).toBeVisible({ timeout: 60_000 });
    await expect(b.getByText(LISTING, { exact: true }).last()).toBeVisible();
    productUrl = b.url();
    expect(productUrl).toMatch(/\/p\/[0-9a-f-]{36}$/);
    await shot(b, DIR, 'B-product-owner-view');

    // The boutique is part of the profile — created by the first listing, no wizard. Lovable
    // compact profile: it is the « Boutique » tab (with its count), not a preview carousel.
    await b.goto('/profile');
    await expect(b.getByRole('tab', { name: 'Boutique, 1' })).toBeVisible();
    await b.getByRole('tab', { name: 'Boutique, 1' }).click();
    await expect(b.getByRole('button', { name: new RegExp(`^${LISTING}, `) })).toBeVisible();
    await shot(b, DIR, 'B-profile-with-boutique');
  });

  test('SOC-03 · A finds B’s listing without following B (search, accent/typo tolerant)', async () => {
    await a.goto('/search');
    await a.getByRole('textbox', { name: 'Rechercher' }).fill(`baskets test ${RUN}`);
    await expect(a.getByRole('button', { name: new RegExp(LISTING) })).toBeVisible();
    await shot(a, DIR, 'A-search-results');
    await a.getByRole('button', { name: new RegExp(LISTING) }).click();
    await expect(a.getByText('Très bon état', { exact: true }).last()).toBeVisible();
    await expect(a.getByText('Vente ou troc', { exact: true }).last()).toBeVisible();
    await shot(a, DIR, 'A-product-detail');
  });

  test('MSG-01 · product-linked chat between A and B, realtime both ways', async () => {
    await btn(a, 'Envoyer un message').click();
    await expect(a.getByText('ARTICLE', { exact: true }).last()).toBeVisible();
    await a.getByRole('textbox', { name: 'Message' }).fill('Salam ! Elles sont toujours disponibles ?');
    await btn(a, 'Envoyer').click();
    await expect(a.getByText('Salam ! Elles sont toujours disponibles ?', { exact: true }).last()).toBeVisible();

    // B: inbox shows the unread conversation.
    await b.goto('/messages');
    await expect(b.getByRole('button', { name: new RegExp(`Conversation avec ${A.name}.*non lus`) })).toBeVisible();
    await shot(b, DIR, 'B-inbox-unread');
    await b.getByRole('button', { name: new RegExp(`Conversation avec ${A.name}`) }).click();
    await expect(b.getByText('Salam ! Elles sont toujours disponibles ?', { exact: true }).last()).toBeVisible();
    await b.getByRole('textbox', { name: 'Message' }).fill('Oui, toujours disponibles. Achat ou échange ?');
    await btn(b, 'Envoyer').click();

    // A receives B's reply without reloading (Supabase Realtime).
    await expect(a.getByText('Oui, toujours disponibles. Achat ou échange ?', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    await expect(b.getByText(/· Vu$/).last()).toBeVisible({ timeout: 20_000 });
    await shot(a, DIR, 'A-chat-realtime-reply');
    await shot(b, DIR, 'B-chat-read-receipt');
  });

  test('restart · history survives a full reload (session + messages persisted)', async () => {
    await a.reload();
    await expect(a.getByText('Oui, toujours disponibles. Achat ou échange ?', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
  });

  test('MKT-02 · A offers a price, B counters, A accepts → agreement recorded', async () => {
    await a.goto(productUrl);
    await btn(a, 'Faire une offre').click();
    await field(a, 'Votre offre').fill('28000');
    await btn(a, 'Envoyer la proposition').click();
    await expect(a.getByText('OFFRE DE PRIX', { exact: true }).last()).toBeVisible();
    await expect(a.getByText('28 000 F CFA').last()).toBeVisible();
    await shot(a, DIR, 'A-price-offer-sent');

    await b.reload();
    await expect(b.getByText('OFFRE DE PRIX', { exact: true }).last()).toBeVisible();
    await btn(b, 'Contre-proposer').click();
    await field(b, 'Votre nouveau prix').fill('32000');
    await btn(b, 'Envoyer la contre-proposition').click();
    await expect(b.getByText('CONTRE-PROPOSITION', { exact: false }).first()).toBeVisible();

    await expect(a.getByText('32 000 F CFA').last()).toBeVisible({ timeout: 20_000 });
    await shot(a, DIR, 'A-counter-received');
    await btn(a, 'Accepter').last().click();
    await expect(a.getByText(/Proposition acceptée/).first()).toBeVisible();
    await btn(a, 'Voir l’accord').last().click();
    await expect(a.getByText('TERMES ACCEPTÉS (NON MODIFIABLES)', { exact: true }).last()).toBeVisible();
    await expect(a.getByText('32 000 F CFA', { exact: true }).last()).toBeVisible();
    await expect(a.getByText(/ne détient aucun fonds/).last()).toBeVisible();
    await shot(a, DIR, 'A-agreement-price');
  });

  test('MKT-03 · A proposes a barter (A-owned item + XOF difference); B accepts', async () => {
    // A lists an item to trade.
    await publishListing(a, { file: FIXTURE('bag.jpg'), title: A_ITEM, mode: 'Vente ou troc', price: '18000', category: 'Sacs & accessoires', condition: 'Comme neuf' });
    await expect(a.getByText('18 000 F CFA').first()).toBeVisible({ timeout: 60_000 });

    await a.goto(productUrl);
    await btn(a, 'Proposer un échange (troc)').click();
    await a.getByRole('radio', { name: A_ITEM }).click();
    await field(a, 'Différence en argent (facultatif)').fill('15000');
    await a.getByRole('radio', { name: /Moi/ }).click();
    await shot(a, DIR, 'A-barter-composer');
    await btn(a, 'Envoyer la proposition').click();
    await expect(a.getByText('PROPOSITION DE TROC', { exact: true }).last()).toBeVisible();
    await expect(a.getByText('Vous ajoutez 15 000 F CFA', { exact: true }).last()).toBeVisible();

    await b.reload();
    await expect(b.getByText('Vous recevez 15 000 F CFA', { exact: true }).last()).toBeVisible();
    await shot(b, DIR, 'B-barter-received');
    // Inverted chat list: the newest card is first in the DOM.
    await btn(b, 'Accepter').first().click();
    await expect(btn(b, 'Voir l’accord')).toHaveCount(2); // price deal + this barter
    await btn(b, 'Voir l’accord').first().click();
    await expect(b.getByText('Accord d’échange', { exact: true }).last()).toBeVisible();
    await expect(b.getByText(A_ITEM, { exact: true }).last()).toBeVisible();
    await expect(b.getByText(LISTING, { exact: true }).last()).toBeVisible();
    await shot(b, DIR, 'B-agreement-barter');

    // Terms survive a reload (immutable snapshot in the database).
    await b.reload();
    await expect(b.getByText('Vous recevez 15 000 F CFA', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
  });

  test('SOC-01 · A follows B; the real follower count changes', async () => {
    await a.goto(`/u/${B.handle}`);
    await expect(a.getByRole('button', { name: /0 Abonné/ })).toBeVisible();
    await btn(a, 'Suivre').click();
    await expect(a.getByRole('button', { name: 'Abonné(e)' })).toBeVisible();
    await a.reload();
    await expect(a.getByRole('button', { name: /1 Abonné/ })).toBeVisible({ timeout: 30_000 });
    await shot(a, DIR, 'A-follows-B');
  });

  test('STA-01 · B posts a 24h status; A views it and replies privately', async () => {
    await b.goto('/publish/status');
    await pickFile(b, () => btn(b, 'Choisir dans la galerie').click(), FIXTURE('dress.jpg'));
    await b.getByRole('textbox', { name: 'Légende du statut' }).fill('Nouvel arrivage ce matin');
    await b.getByRole('radio', { name: 'Mes abonnés' }).click();
    await btn(b, 'Publier le statut').click();
    await expect(b.getByRole('button', { name: 'Notifications' })).toBeVisible({ timeout: 60_000 });

    await a.goto('/');
    await btn(a, `Voir le statut de ${B.name}`).click();
    await expect(a.getByText('Nouvel arrivage ce matin', { exact: true }).last()).toBeVisible();
    await shot(a, DIR, 'A-status-viewer');
    await a.getByRole('textbox', { name: 'Répondre en message privé' }).fill('Il reste la taille M ?');
    await btn(a, 'Envoyer la réponse').click();
    await expect(a.getByText('A RÉPONDU À VOTRE STATUT', { exact: false }).or(a.getByText('VOUS AVEZ RÉPONDU À SON STATUT', { exact: true }).last())).toBeVisible();
    await expect(a.getByText('Il reste la taille M ?', { exact: true }).last()).toBeVisible();
    await shot(a, DIR, 'A-status-reply-in-chat');
  });

  test('SAF-01 · A reports B’s listing; admin acts in the web console; A blocks B', async ({ browser }) => {
    await a.goto(productUrl);
    await btn(a, 'Plus d’options').last().click();
    await btn(a, 'Signaler').click();
    await a.getByRole('radio', { name: 'Contrefaçon' }).click();
    await field(a, 'Détails (facultatif)').fill(`Logo suspect (test ${RUN})`);
    await btn(a, 'Envoyer le signalement').click();
    await expect(a.getByText('Merci pour votre signalement', { exact: true }).last()).toBeVisible();
    await shot(a, DIR, 'A-report-sent');

    // A moderator reviews it in the restricted web console.
    const admin = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
    const m = await admin.newPage();
    await m.goto(`${WEB_URL}/admin`);
    await m.getByLabel(/e-mail/i).fill(MODERATOR.email);
    await m.getByLabel(/mot de passe/i).fill(MODERATOR.password);
    await m.getByRole('button', { name: /se connecter/i }).click();
    await expect(m.getByText(LISTING).first()).toBeVisible({ timeout: 30_000 });
    await m.getByText(LISTING).first().click();
    await expect(m.getByText(`Logo suspect (test ${RUN})`)).toBeVisible();
    await shot(m, DIR, 'admin-report-detail');
    // Act: hide the listing with a mandatory written reason.
    await m.getByRole('button', { name: 'Masquer', exact: true }).first().click();
    await m.getByRole('textbox', { name: /Motif/ }).fill(`Contrefaçon probable (test ${RUN})`);
    await m.getByRole('button', { name: 'Confirmer', exact: true }).click();
    await expect(m.getByText(/Masquer le contenu\s*:\s*action enregistrée/).first()).toBeVisible({ timeout: 20_000 });
    await shot(m, DIR, 'admin-content-hidden');
    await admin.close();

    // The hidden listing is no longer visible to other members.
    await a.goto(productUrl);
    await expect(a.getByText('Article indisponible', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
    await shot(a, DIR, 'A-listing-hidden-by-moderation');

    // A blocks B: B's profile and DMs are no longer reachable.
    await a.goto(`/u/${B.handle}`);
    await btn(a, 'Plus d’options').last().click();
    await btn(a, `Bloquer ${B.name}`).click();
    await expect(a.getByText(/est bloqué\(e\)/).last()).toBeVisible();
    await b.goto(`/u/${A.handle}`);
    await expect(b.getByText('Profil indisponible', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
    await shot(b, DIR, 'B-sees-A-unavailable-after-block');
  });

  test('ID-01 · logout removes access to private screens', async () => {
    await a.goto('/settings');
    await btn(a, 'Se déconnecter').click();
    await expect(a.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
    await a.goto('/messages');
    await expect(a.getByRole('button', { name: 'Créer un compte' })).toBeVisible();
  });
});
