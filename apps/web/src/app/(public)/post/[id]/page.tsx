import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deepLinks, formatCount, plural, shareUrls, timeAgo } from '@jefeli/shared';
import { OpenInApp } from '@/components/OpenInApp';
import { ShareActions } from '@/components/ShareActions';
import { IconComment, IconUpvote } from '@/components/icons';
import { Avatar, DemoChip, StatusOverlay, VerifiedBadge, priceLabel } from '@/components/ui';
import { env } from '@/lib/env';
import { avatarUrl, firstStill, publicMediaUrl, sortMedia } from '@/lib/media';
import { getPost } from '@/lib/public-data';

export const revalidate = 60;

// No paths at build time: each share page is rendered on first visit, then cached (ISR, 60 s).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: 'Publication introuvable', robots: { index: false } };
  const author = post.author?.display_name ?? 'Un membre';
  const url = shareUrls.post(env.siteUrl, post.id);
  const title = post.body.trim() ? `${author}\u00A0: «\u00A0${excerpt(post.body, 60)}\u00A0»` : `Publication de ${author}`;
  const description = post.body.trim() ? excerpt(post.body, 200) : `Publication de ${author} sur Jëfëli.`;
  const media = sortMedia(post.post_media).filter((m) => m.bucket === 'public-media');
  const image = firstStill(media) ?? avatarUrl(post.author?.avatar_path);
  const images = [{ url: image ?? '/og-default.png', alt: title }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title, description, siteName: 'Jëfëli', locale: 'fr_SN', images, publishedTime: post.created_at },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const author = post.author;
  const media = sortMedia(post.post_media).filter((m) => m.bucket === 'public-media');
  const products = post.post_products.map((pp) => pp.products).filter((p) => p !== null);
  const shareUrl = shareUrls.post(env.siteUrl, post.id);

  return (
    <div className="container-narrow">
      <article className="card post-card">
        <header className="post-head">
          <Avatar src={avatarUrl(author?.avatar_path)} name={author?.display_name ?? 'Membre'} size={44} />
          <div style={{ minWidth: 0 }}>
            {author ? (
              <Link href={`/${author.handle}`} className="post-head-name">
                {author.display_name}
                {author.verification_level === 'merchant_verified' ? <VerifiedBadge label={false} interactive={false} /> : null}
                {author.is_demo ? <DemoChip /> : null}
              </Link>
            ) : (
              <span className="post-head-name">Membre Jëfëli</span>
            )}
            <p className="muted small">
              {author ? `@${author.handle} · ` : ''}
              <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
              {post.edited_at ? ' · modifié' : ''}
            </p>
          </div>
        </header>

        {post.body.trim() ? <p className="post-body prewrap">{post.body}</p> : null}

        {media.length > 0 ? (
          <div className="post-media">
            {media.map((m, i) =>
              m.kind === 'video' ? (
                <video
                  key={m.storage_path}
                  src={publicMediaUrl(m.storage_path) ?? undefined}
                  poster={publicMediaUrl(m.poster_path) ?? undefined}
                  controls
                  playsInline
                  preload="none"
                  aria-label={`Vidéo ${i + 1} de la publication`}
                />
              ) : (
                <img
                  key={m.storage_path}
                  src={publicMediaUrl(m.storage_path) ?? ''}
                  alt={`Photo ${i + 1} de la publication de ${author?.display_name ?? 'ce membre'}`}
                  width={m.width ?? 1080}
                  height={m.height ?? 1080}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              ),
            )}
          </div>
        ) : null}

        <div className="post-foot">
          <div className="meta-row">
            <span>
              <IconUpvote /> {formatCount(post.upvote_count)} {plural(post.upvote_count, 'vote pour', 'votes pour')}
            </span>
            <span>
              <IconComment /> {formatCount(post.comment_count)} {plural(post.comment_count, 'commentaire', 'commentaires')}
            </span>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="post-products">
            <p className="eyebrow">Articles de la publication</p>
            {products.map((p) => {
              const still = firstStill(p.product_media);
              return (
                <Link key={p.id} href={`/p/${p.id}`} className="card mini-product">
                  <span className="mini-product-thumb">
                    {still ? <img src={still} alt="" loading="lazy" decoding="async" width={64} height={64} /> : null}
                    <StatusOverlay status={p.status} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="mini-product-title" style={{ display: 'block' }}>
                      {p.title}
                    </span>
                    <span className="mini-product-price" style={{ display: 'block' }}>
                      {priceLabel(p)}
                    </span>
                  </span>
                  <span className="chip">Voir</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </article>

      <div className="stack-12" style={{ marginTop: 20 }}>
        <OpenInApp href={deepLinks.post(post.id)} label="Ouvrir dans l’app pour réagir" />
        <ShareActions url={shareUrl} text={`Publication de ${author?.display_name ?? 'un membre'} sur Jëfëli`} />
      </div>
    </div>
  );
}
