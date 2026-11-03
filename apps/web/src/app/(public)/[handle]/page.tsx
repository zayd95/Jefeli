import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { deepLinks, formatCount, plural, shareUrls, timeAgo } from '@jefeli/shared';
import { OpenInApp } from '@/components/OpenInApp';
import { ShareActions } from '@/components/ShareActions';
import { IconComment, IconLock, IconPin, IconPlay, IconUpvote } from '@/components/icons';
import { Avatar, DemoChip, PinnedChip, ProductCard, Stars, VerifiedBadge, locationLabel } from '@/components/ui';
import { env } from '@/lib/env';
import { deName } from '@/lib/format';
import { avatarUrl, coverUrl, firstStill, publicMediaUrl, sortMedia } from '@/lib/media';
import {
  getBoutique,
  getProfileByHandle,
  getRecentPosts,
  getRecentReviews,
  getSellerProducts,
  ratingAverage,
  type PostRow,
  type PublicProfile,
} from '@/lib/public-data';

export const revalidate = 60;

// No paths at build time: each share page is rendered on first visit, then cached (ISR, 60 s).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ handle: string }> };

function normalizeParam(raw: string): string {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return value.replace(/^@/, '').trim().toLowerCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = normalizeParam(raw);
  const profile = await getProfileByHandle(handle);
  if (!profile) return { title: 'Profil introuvable', robots: { index: false } };

  const url = shareUrls.profile(env.siteUrl, profile.handle);
  const title = `${profile.display_name} (@${profile.handle})`;
  const where = locationLabel(profile.neighborhood, profile.city);
  let description: string;
  let image = avatarUrl(profile.avatar_path);

  if (profile.is_private) {
    description = `Compte privé sur Jëfëli. Abonnez-vous depuis l’application pour voir ses publications.`;
  } else {
    description =
      profile.bio.trim() ||
      `Profil${profile.products_count > 0 ? ' et boutique' : ''} de ${profile.display_name} sur Jëfëli${where ? ` · ${where}` : ''}.`;
    if (!image) {
      const products = await getSellerProducts(profile.id);
      image = products.map((p) => firstStill(p.product_media)).find((x): x is string => !!x) ?? null;
    }
  }
  const images = [{ url: image ?? '/og-default.png', alt: profile.display_name }];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', url, title, description, siteName: 'Jëfëli', locale: 'fr_SN', images, username: profile.handle },
    twitter: { card: image ? 'summary' : 'summary_large_image', title, description, images: images.map((i) => i.url) },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle: raw } = await params;
  const handle = normalizeParam(raw);
  if (handle !== raw) {
    // "/@Awa" or "/AWA" → canonical "/awa"
    const profile = await getProfileByHandle(handle);
    if (profile) permanentRedirect(`/${profile.handle}`);
    notFound();
  }

  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const shareUrl = shareUrls.profile(env.siteUrl, profile.handle);

  if (profile.is_private) {
    return (
      <div className="container">
        <ProfileHeader profile={profile} />
        <div className="profile-layout">
          <div className="profile-aside">
            <ProfileIdentity profile={profile} />
          </div>
          <div className="section">
            <div className="card private-card">
              <IconLock />
              <h2>Ce compte est privé</h2>
              <p className="muted small" style={{ maxWidth: 360 }}>
                Seuls les abonnés acceptés voient ses publications et sa boutique. Envoyez une demande d’abonnement
                depuis l’application.
              </p>
              <div style={{ width: '100%', maxWidth: 360, marginTop: 6 }}>
                <OpenInApp href={deepLinks.profile(profile.handle)} label="Ouvrir dans l’app" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [boutique, products, posts, reviews] = await Promise.all([
    getBoutique(profile.id),
    getSellerProducts(profile.id),
    getRecentPosts(profile.id),
    profile.rating_count > 0 ? getRecentReviews(profile.id) : Promise.resolve([]),
  ]);

  const average = ratingAverage(profile.rating_sum, profile.rating_count);
  const hasBoutique = boutique !== null || products.length > 0;
  const shareMessage = `À découvrir sur Jëfëli\u00A0: ${hasBoutique ? 'la boutique' : 'le profil'} ${deName(profile.display_name)} (@${profile.handle})`;
  const notes = boutique
    ? ([
        ['Retrait', boutique.pickup_notes],
        ['Livraison', boutique.delivery_notes],
        ['Paiement', boutique.payment_notes],
      ] as const).filter(([, v]) => v.trim().length > 0)
    : [];

  return (
    <div className="container">
      <ProfileHeader profile={profile} />
      <div className="profile-layout">
        <aside className="profile-aside" aria-label="Profil">
          <ProfileIdentity profile={profile} showBio />
          {average ? (
            <p className="rating-line">
              <Stars value={profile.rating_sum / profile.rating_count} />
              <strong>{average}</strong>
              <span>
                {profile.rating_count} {plural(profile.rating_count, 'avis', 'avis')} après échanges déclarés terminés
              </span>
            </p>
          ) : null}
          <div className="profile-actions">
            <div style={{ flex: 1 }}>
              <OpenInApp
                href={deepLinks.profile(profile.handle)}
                label="Suivre dans l’app"
                note="Pour suivre ce compte ou lui écrire, ouvrez l’application Jëfëli (phase pilote)."
              />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <ShareActions url={shareUrl} text={`${profile.display_name} sur Jëfëli`} message={shareMessage} />
          </div>
        </aside>

        <div>
          <section className="section" aria-labelledby="boutique-title">
            <div className="section-head">
              <h2 className="section-title" id="boutique-title">
                Boutique
              </h2>
              {products.length > 0 ? (
                <span className="section-meta">
                  {profile.products_count} {plural(profile.products_count, 'article disponible', 'articles disponibles')}
                </span>
              ) : null}
            </div>
            {boutique?.description.trim() ? <p className="prewrap" style={{ marginBottom: 14 }}>{boutique.description}</p> : null}
            {notes.length > 0 ? (
              <dl className="notes-list card card-pad" style={{ marginTop: 0, marginBottom: 18 }}>
                {notes.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="prewrap">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {products.length > 0 ? (
              <div className="product-grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} showPinned />
                ))}
              </div>
            ) : (
              <p className="empty">{hasBoutique ? 'Aucun article en ce moment.' : 'Pas encore d’article en vente.'}</p>
            )}
          </section>

          <section className="section" aria-labelledby="posts-title">
            <div className="section-head">
              <h2 className="section-title" id="posts-title">
                Publications
              </h2>
              {profile.posts_count > 0 ? (
                <span className="section-meta">
                  {formatCount(profile.posts_count)} {plural(profile.posts_count, 'publication', 'publications')}
                </span>
              ) : null}
            </div>
            {posts.length > 0 ? (
              <div className="post-list">
                {posts.map((post) => (
                  <PostItem key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="empty">Aucune publication publique pour le moment.</p>
            )}
          </section>

          {reviews.length > 0 && average ? (
            <section className="section" aria-labelledby="reviews-title">
              <div className="section-head">
                <h2 className="section-title" id="reviews-title">
                  Avis
                </h2>
              </div>
              <div className="card card-pad">
                <div className="review-summary">
                  <span className="review-score">{average}</span>
                  <div>
                    <Stars value={profile.rating_sum / profile.rating_count} />
                    <p className="muted small">
                      {profile.rating_count} {plural(profile.rating_count, 'avis', 'avis')} après échanges déclarés
                      terminés
                    </p>
                  </div>
                </div>
                <div className="review-list">
                  {reviews.map((r) => (
                    <article className="review" key={r.id}>
                      <div className="review-head">
                        <Avatar src={avatarUrl(r.reviewer?.avatar_path)} name={r.reviewer?.display_name ?? 'Membre'} size={28} />
                        <strong>{r.reviewer?.display_name ?? 'Membre Jëfëli'}</strong>
                        <Stars value={r.rating} />
                        <span className="sr-only">{r.rating} sur 5</span>
                        <span className="muted" style={{ marginLeft: 'auto' }}>
                          {timeAgo(r.created_at)}
                        </span>
                      </div>
                      {r.body.trim() ? <p className="prewrap">{r.body}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const cover = coverUrl(profile.cover_path);
  return (
    <div className={`profile-cover ${cover ? '' : 'is-empty'}`}>
      {cover ? <img src={cover} alt="" width={1120} height={220} fetchPriority="high" /> : null}
    </div>
  );
}

function ProfileIdentity({ profile, showBio = false }: { profile: PublicProfile; showBio?: boolean }) {
  const where = locationLabel(profile.neighborhood, profile.city);
  return (
    <div className="profile-identity">
      <Avatar src={avatarUrl(profile.avatar_path)} name={profile.display_name} size={96} />
      <div className="profile-name-row">
        <h1 className="profile-name">{profile.display_name}</h1>
        {profile.is_demo ? <DemoChip /> : null}
      </div>
      {profile.verification_level === 'merchant_verified' ? (
        <div style={{ marginTop: 6 }}>
          <VerifiedBadge />
        </div>
      ) : null}
      <p className="profile-handle">
        @{profile.handle}
        {where ? (
          <>
            {' · '}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'bottom' }}>
              <IconPin width={15} height={15} />
              {where}
            </span>
          </>
        ) : null}
      </p>
      {showBio && profile.bio.trim() ? <p className="profile-bio prewrap">{profile.bio}</p> : null}
      <div className="stats">
        <div className="stat">
          <span className="stat-value">{formatCount(profile.products_count)}</span>
          <span className="stat-label">{plural(profile.products_count, 'Article', 'Articles')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatCount(profile.followers_count)}</span>
          <span className="stat-label">{plural(profile.followers_count, 'Abonné', 'Abonnés')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatCount(profile.following_count)}</span>
          <span className="stat-label">{plural(profile.following_count, 'Abonnement', 'Abonnements')}</span>
        </div>
      </div>
    </div>
  );
}

function PostItem({ post }: { post: PostRow }) {
  const media = sortMedia(post.post_media).filter((m) => m.bucket === 'public-media');
  const first = media[0];
  const thumb = first ? publicMediaUrl(first.kind === 'image' ? first.storage_path : first.poster_path) : null;
  const body = post.body.trim();
  return (
    <Link href={`/post/${post.id}`} className="card post-item">
      <div style={{ minWidth: 0 }}>
        {post.pinned_at ? <PinnedChip /> : null}
        <p className="post-item-body">{body || (media.length ? 'Publication avec médias' : 'Publication')}</p>
        <div className="meta-row">
          <span>{timeAgo(post.created_at)}</span>
          <span aria-label={`${post.upvote_count} ${post.upvote_count > 1 ? 'votes' : 'vote'} pour`}>
            <IconUpvote /> {formatCount(post.upvote_count)}
          </span>
          <span aria-label={`${post.comment_count} commentaires`}>
            <IconComment /> {formatCount(post.comment_count)}
          </span>
        </div>
      </div>
      {first ? (
        <div className="post-item-thumb">
          {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" width={76} height={76} /> : null}
          {first.kind === 'video' ? (
            <span className="media-badge" style={{ top: 4, left: 4 }}>
              <IconPlay />
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
