import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deepLinks, formatDate, shareUrls, timeAgo } from '@jefeli/shared';
import { OpenInApp } from '@/components/OpenInApp';
import { ShareActions } from '@/components/ShareActions';
import { Avatar, DemoChip, ProductCard, VerifiedBadge } from '@/components/ui';
import { env } from '@/lib/env';
import { avatarUrl } from '@/lib/media';
import { getLive, getLivePinnedProduct, type LiveDetail } from '@/lib/public-data';

// Live status changes quickly: never serve a stale "EN DIRECT".
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

function stateLabel(live: LiveDetail): string {
  if (live.status === 'live') return 'En direct';
  if (live.status === 'ended') return 'Live terminé';
  return 'Pas encore commencé';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const live = await getLive(id);
  if (!live) return { title: 'Live introuvable', robots: { index: false } };
  const host = live.host?.display_name ?? 'Un membre';
  const url = shareUrls.live(env.siteUrl, live.id);
  const title = `${live.status === 'live' ? 'En direct · ' : ''}${live.title} — ${host}`;
  const description =
    live.status === 'live'
      ? `${host} est en direct sur Jëfëli. Le live se regarde dans l’application.`
      : live.status === 'ended'
        ? `Live de ${host} sur Jëfëli (terminé).`
        : `Live de ${host} sur Jëfëli (pas encore commencé).`;
  const image = avatarUrl(live.host?.avatar_path);
  const images = [{ url: image ?? '/og-default.png', alt: host }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName: 'Jëfëli', locale: 'fr_SN', images },
    twitter: { card: image ? 'summary' : 'summary_large_image', title, description, images: images.map((i) => i.url) },
  };
}

export default async function LivePage({ params }: Props) {
  const { id } = await params;
  const live = await getLive(id);
  if (!live) notFound();
  const pinned = live.status === 'live' ? await getLivePinnedProduct(live.id) : null;
  const host = live.host;
  const isLive = live.status === 'live';

  return (
    <div className="container-narrow">
      <section className="live-stage" aria-labelledby="live-title">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isLive ? <span className="chip chip-live">EN DIRECT</span> : <span className="live-state">{stateLabel(live)}</span>}
          {host?.is_demo ? <DemoChip /> : null}
        </div>
        <div>
          <h1 id="live-title">{live.title}</h1>
          <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.78)', fontSize: 14 }}>
            {isLive && live.started_at ? `Commencé ${timeAgo(live.started_at)}. ` : null}
            {live.status === 'ended' && live.ended_at ? `Terminé le ${formatDate(new Date(live.ended_at))}. ` : null}
            {live.status === 'created' ? 'L’hôte prépare son live. ' : null}
            La vidéo se regarde uniquement dans l’application.
          </p>
        </div>
        {host ? (
          <Link href={`/${host.handle}`} className="live-host">
            <Avatar src={avatarUrl(host.avatar_path)} name={host.display_name} size={44} />
            <span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                {host.display_name}
                {host.verification_level === 'merchant_verified' ? <VerifiedBadge label={false} interactive={false} /> : null}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>@{host.handle}</span>
            </span>
          </Link>
        ) : null}
      </section>

      <div className="stack-12" style={{ marginTop: 20 }}>
        <OpenInApp
          href={deepLinks.live(live.id)}
          label={isLive ? 'Regarder dans l’app' : 'Ouvrir dans l’app'}
          note={
            isLive
              ? undefined
              : live.status === 'ended'
                ? 'Ce live est terminé. Retrouvez les articles de l’hôte sur son profil.'
                : 'Vous serez notifié dans l’application quand le live commencera si vous suivez ce compte.'
          }
        />
        <ShareActions url={shareUrls.live(env.siteUrl, live.id)} text={`${live.title} — live Jëfëli`} />
      </div>

      {pinned ? (
        <section className="section" aria-labelledby="pinned-title">
          <div className="section-head">
            <h2 className="section-title" id="pinned-title">
              Article présenté
            </h2>
          </div>
          <div style={{ maxWidth: 240 }}>
            <ProductCard product={pinned} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
