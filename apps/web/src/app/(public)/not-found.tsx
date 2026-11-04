import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container">
      <div className="message-page">
        <span className="code">404</span>
        <h1>Cette page est introuvable</h1>
        <p>
          Le lien est peut-être incorrect, ou le contenu n’est plus disponible&nbsp;: il a pu être retiré par son auteur,
          réservé à ses abonnés ou masqué par la modération.
        </p>
        <Link className="btn btn-dark" href="/">
          Découvrir Jëfëli
        </Link>
      </div>
    </div>
  );
}
