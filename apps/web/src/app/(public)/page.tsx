import Link from 'next/link';
import { PLATFORM_DISCLAIMER } from '@jefeli/shared';
import { Wordmark } from '@/components/ui';
import { IconShield } from '@/components/icons';
import { env } from '@/lib/env';

export const revalidate = 3600;

export default function Home() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div>
            <h1 id="hero-title">
              <Wordmark />
            </h1>
            <p className="hero-tagline">Découvre. Partage. Vends.</p>
            <p className="hero-sub">Le réseau social du commerce sénégalais</p>
          </div>
          <div>
            <p className="hero-lead">
              Jëfëli réunit publications, statuts, lives et annonces dans un même réseau social. Chaque membre a un
              profil, et sa boutique se crée toute seule à partir de ses annonces&nbsp;: neuf, occasion ou troc, on
              discute et on s’arrange directement entre membres.
            </p>
            {env.appUrl ? (
              <div className="stack-12" style={{ marginTop: 20 }}>
                <a className="btn btn-primary btn-block" href={env.appUrl}>
                  Ouvrir Jëfëli
                </a>
                <p className="pilot-note">
                  <span className="pilot-dot" aria-hidden />
                  <span>
                    <strong>Version bêta.</strong> Jëfëli s’ouvre dans votre navigateur&nbsp;: rien à télécharger.
                  </span>
                </p>
              </div>
            ) : (
              <p className="pilot-note">
                <span className="pilot-dot" aria-hidden />
                <span>
                  <strong>Phase pilote à Dakar.</strong> L’application est en test auprès d’un premier groupe de membres.
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="pillars" aria-label="Ce que l’on fait sur Jëfëli">
        <article className="card pillar">
          <span className="pillar-num">01</span>
          <h2>Découvre</h2>
          <p>
            Un fil de publications de personnes et de vendeurs que tu suis, des articles près de chez toi, les
            occasions et le troc.
          </p>
        </article>
        <article className="card pillar">
          <span className="pillar-num">02</span>
          <h2>Partage</h2>
          <p>
            Photos, vidéos, statuts de 24 h et lives. Un profil ou un article se partage en un lien sur WhatsApp,
            Facebook ou TikTok.
          </p>
        </article>
        <article className="card pillar">
          <span className="pillar-num">03</span>
          <h2>Vends</h2>
          <p>
            Publie une annonce et ta boutique apparaît sur ton profil. Prix en F CFA, offres et propositions
            d’échange dans la messagerie.
          </p>
        </article>
      </section>

      <section className="split" aria-label="Informations">
        <div className="card">
          <h2>Tu as reçu un lien&nbsp;?</h2>
          <p style={{ marginTop: 8 }}>
            Les profils, articles et publications partagés s’ouvrent ici, sans installer d’application.
            {env.appUrl
              ? ' Pour écrire à un vendeur, faire une offre ou suivre un compte, ouvrez Jëfëli dans votre navigateur.'
              : ' Pour écrire à un vendeur, faire une offre ou suivre un compte, il faut l’application Jëfëli.'}
          </p>
        </div>
        <div className="card dark-card">
          <h2>Nos engagements</h2>
          <ul>
            <li>Aucun chiffre inventé&nbsp;: abonnés, avis et mentions «&nbsp;En direct&nbsp;» reflètent la réalité.</li>
            <li>Le badge «&nbsp;Vendeur vérifié&nbsp;» n’est attribué qu’après examen par l’équipe.</li>
            <li>Signalement possible sur chaque profil, article, message ou live.</li>
          </ul>
        </div>
      </section>

      <div className="safety" style={{ marginTop: 16 }}>
        <IconShield />
        <p>
          {PLATFORM_DISCLAIMER} <Link href="/legal/regles">Règles de la communauté</Link>
        </p>
      </div>
    </div>
  );
}
