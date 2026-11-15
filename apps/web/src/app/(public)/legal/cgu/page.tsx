import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation',
  description: 'Conditions générales d’utilisation de Jëfëli (projet en cours de validation).',
  alternates: { canonical: '/legal/cgu' },
};

const TOC = [
  { id: 'objet', label: 'Objet du service' },
  { id: 'editeur', label: 'Éditeur et contact' },
  { id: 'acceptation', label: 'Acceptation et modifications' },
  { id: 'acces', label: 'Conditions d’accès (18 ans et plus)' },
  { id: 'compte', label: 'Compte, profil et boutique' },
  { id: 'contenus', label: 'Contenus publiés par les membres' },
  { id: 'interdits', label: 'Articles et contenus interdits' },
  { id: 'echanges', label: 'Annonces, offres et échanges entre membres' },
  { id: 'paiement', label: 'Absence de paiement et de séquestre' },
  { id: 'rencontres', label: 'Rencontres et sécurité' },
  { id: 'avis', label: 'Avis' },
  { id: 'verification', label: 'Badge «\u00A0Vendeur vérifié\u00A0»' },
  { id: 'moderation', label: 'Signalements, modération et contestations' },
  { id: 'fin', label: 'Suppression du compte et suspension' },
  { id: 'responsabilite', label: 'Responsabilité' },
  { id: 'pi', label: 'Propriété intellectuelle' },
  { id: 'donnees', label: 'Données personnelles' },
  { id: 'droit', label: 'Droit applicable et litiges' },
];

export default function CguPage() {
  return (
    <LegalPage current="cgu" title="Conditions générales d’utilisation" version="Projet de travail — version pilote, novembre 2026" toc={TOC}>
      <h2 id="objet">1. Objet du service</h2>
      <p>
        Jëfëli est un réseau social dédié au commerce au Sénégal. Il permet à ses membres de créer un profil, de publier
        des photos, des vidéos, des statuts de 24 heures et des lives, d’échanger des messages, et de proposer des
        articles neufs, d’occasion ou reconditionnés à la vente ou à l’échange (troc). La boutique d’un membre est
        générée automatiquement à partir de ses annonces&nbsp;: ce n’est pas un site marchand indépendant.
      </p>
      <p>
        Jëfëli est un intermédiaire technique. Jëfëli ne vend, n’achète ni ne stocke aucun article, n’est partie à aucun
        accord conclu entre membres et ne traite aucun paiement.
      </p>
      <p>
        Le service est actuellement en <strong>phase pilote</strong> à Dakar&nbsp;: certaines fonctionnalités peuvent
        évoluer, être suspendues ou retirées. Dans les environnements de test, les comptes et contenus fictifs sont
        signalés par la mention «&nbsp;DÉMO&nbsp;».
      </p>

      <h2 id="editeur">2. Éditeur et contact</h2>
      <p>
        Le service est édité par <Todo>raison sociale, forme juridique</Todo>, <Todo>adresse du siège</Todo>,
        immatriculée sous le numéro <Todo>RCCM / NINEA</Todo>. Directeur de la publication&nbsp;: <Todo>nom</Todo>.
      </p>
      <p>
        Contact&nbsp;: <Todo>adresse e-mail de contact — à définir par le propriétaire</Todo>. Les signalements de contenus se
        font de préférence directement depuis l’application.
      </p>

      <h2 id="acceptation">3. Acceptation et modifications</h2>
      <p>
        L’inscription vaut acceptation des présentes conditions, de la{' '}
        <Link href="/legal/confidentialite">politique de confidentialité</Link> et des{' '}
        <Link href="/legal/regles">règles de la communauté</Link>. Jëfëli peut modifier ces conditions&nbsp;; les membres
        sont informés des changements importants dans l’application avant leur entrée en vigueur. Continuer à utiliser
        le service après cette date vaut acceptation de la nouvelle version.
      </p>

      <h2 id="acces">4. Conditions d’accès</h2>
      <ul>
        <li>
          Le service est réservé aux personnes <strong>âgées de 18 ans révolus</strong>. Chaque membre le confirme lors
          de l’inscription. Un compte ouvert par une personne mineure sera fermé dès que l’équipe en a connaissance.
        </li>
        <li>Un compte correspond à une seule personne physique ou à une activité commerciale réelle.</li>
        <li>
          Les informations fournies doivent être exactes. Le membre est responsable de la confidentialité de ses
          identifiants et de toute activité réalisée depuis son compte.
        </li>
        <li>L’accès nécessite une connexion internet dont les coûts restent à la charge du membre.</li>
      </ul>

      <h2 id="compte">5. Compte, profil et boutique</h2>
      <p>
        Le profil (nom affiché, nom d’utilisateur, photo, bio, ville ou quartier facultatifs) est public, sauf si le
        membre choisit un compte privé&nbsp;: seuls ses abonnés acceptés voient alors ses publications et sa boutique.
        L’adresse e-mail et le numéro de téléphone ne sont jamais affichés sur le profil.
      </p>
      <p>
        Il est interdit d’usurper l’identité d’une personne, d’une marque ou d’une organisation, ou de choisir un nom
        d’utilisateur trompeur. Certains noms d’utilisateur sont réservés.
      </p>

      <h2 id="contenus">6. Contenus publiés par les membres</h2>
      <p>
        Le membre reste propriétaire des contenus qu’il publie. Il accorde à Jëfëli, pour la durée de leur publication
        et le temps technique nécessaire à leur suppression des sauvegardes, une licence gratuite, non exclusive et
        mondiale pour héberger, reproduire, adapter techniquement (formats, tailles) et afficher ces contenus, dans le
        seul but de faire fonctionner et de faire connaître le service — par exemple lorsqu’un lien est partagé.
      </p>
      <p>
        Le membre garantit disposer des droits nécessaires sur les contenus publiés (photos, musiques, marques) et que
        ceux-ci respectent la loi et les règles de la communauté.
      </p>

      <h2 id="interdits">7. Articles et contenus interdits</h2>
      <p>Sont notamment interdits à la vente, à l’échange ou à la promotion&nbsp;:</p>
      <ul>
        <li>les armes, munitions, explosifs et leurs pièces&nbsp;;</li>
        <li>les drogues et stupéfiants, ainsi que les médicaments soumis à ordonnance, dont le tramadol&nbsp;;</li>
        <li>la fausse monnaie et les faux billets&nbsp;;</li>
        <li>les espèces protégées, vivantes ou non, et leurs produits (ivoire, peaux, écailles…)&nbsp;;</li>
        <li>les documents officiels (carte d’identité, passeport, permis, diplômes) et les faux documents&nbsp;;</li>
        <li>les biens volés ou d’origine douteuse&nbsp;;</li>
        <li>les contenus et objets pour adultes&nbsp;;</li>
        <li>les contrefaçons et copies de produits de marque.</li>
      </ul>
      <p>
        La liste complète et les règles de comportement figurent dans les{' '}
        <Link href="/legal/regles">règles de la communauté</Link>. Un filtre automatique bloque certains termes à la
        publication&nbsp;; il ne remplace pas la responsabilité du membre ni la modération humaine.
      </p>

      <h2 id="echanges">8. Annonces, offres et échanges entre membres</h2>
      <ul>
        <li>
          L’annonce doit décrire fidèlement l’article (photos réelles, état, prix en francs CFA, disponibilité). Le
          vendeur indique «&nbsp;Réservé&nbsp;» ou «&nbsp;Vendu&nbsp;» dès que c’est le cas.
        </li>
        <li>
          Les offres et propositions d’échange se font dans la messagerie. Un «&nbsp;accord&nbsp;» enregistré dans l’application
          est une déclaration entre deux membres&nbsp;; Jëfëli n’y est pas partie et n’en garantit pas l’exécution.
        </li>
        <li>
          Les vendeurs professionnels restent seuls responsables de leurs obligations légales, commerciales et
          fiscales (information du consommateur, garanties, facturation).
        </li>
      </ul>

      <h2 id="paiement">9. Absence de paiement et de séquestre</h2>
      <p>
        Jëfëli <strong>ne détient aucun fonds</strong>, ne propose aucun paiement intégré, aucun séquestre ni aucune
        garantie de paiement, de livraison ou de conformité. Le règlement (espèces, mobile money ou autre) se fait
        directement entre membres et sous leur responsabilité. Jëfëli ne vous demandera jamais un code de paiement, un
        code secret ou un code reçu par SMS.
      </p>

      <h2 id="rencontres">10. Rencontres et sécurité</h2>
      <p>
        Pour une remise en main propre, privilégiez un lieu public et fréquenté, en journée, idéalement accompagné(e).
        Vérifiez l’article avant de payer, évitez les paiements d’avance à des inconnus et signalez tout comportement
        suspect. Des conseils détaillés figurent dans les <Link href="/legal/regles#rencontres">règles de la communauté</Link>.
      </p>

      <h2 id="avis">11. Avis</h2>
      <p>
        Un avis ne peut être laissé qu’après un échange déclaré terminé par les deux membres. Il doit être sincère et
        porter sur l’échange. Les faux avis, les avis achetés ou obtenus sous pression sont interdits et peuvent être
        retirés. La note moyenne affichée est calculée sur les avis publiés.
      </p>

      <h2 id="verification">12. Badge «&nbsp;Vendeur vérifié&nbsp;»</h2>
      <p>
        Le badge est attribué uniquement par un administrateur de Jëfëli, après examen des informations fournies par le
        vendeur. Il <strong>ne garantit pas</strong> les produits, les prix, les paiements ni la livraison. Il peut être
        retiré à tout moment, notamment en cas de manquement aux règles.
      </p>

      <h2 id="moderation">13. Signalements, modération et contestations</h2>
      <p>
        Tout profil, publication, commentaire, annonce, statut, message, live ou avis peut être signalé depuis
        l’application. Les signalements sont examinés par l’équipe de modération, qui peut&nbsp;: avertir le membre, masquer
        ou supprimer un contenu, retirer le badge vendeur, ou suspendre un compte. Les cas graves (sécurité d’un mineur,
        menaces) peuvent entraîner une suspension immédiate et, si la loi l’exige, un signalement aux autorités.
      </p>
      <p>
        Le membre concerné est informé de la décision et de son motif. Il peut la <strong>contester</strong> depuis
        l’application&nbsp;; la contestation est réexaminée et la réponse lui est notifiée. Toutes les décisions sont
        conservées dans un journal interne non modifiable. Délai de traitement visé&nbsp;: <Todo>à définir</Todo>.
      </p>

      <h2 id="fin">14. Suppression du compte et suspension</h2>
      <p>
        Le membre peut supprimer son compte à tout moment depuis les réglages de l’application&nbsp;; il peut auparavant
        exporter ses données. Jëfëli peut suspendre ou fermer un compte en cas de manquement grave ou répété aux
        présentes conditions, après information du membre sauf urgence. Les modalités de conservation après
        suppression figurent dans la <Link href="/legal/confidentialite#conservation">politique de confidentialité</Link>.
      </p>

      <h2 id="responsabilite">15. Responsabilité</h2>
      <p>
        Pendant la phase pilote, le service est fourni en l’état&nbsp;; Jëfëli s’efforce d’en assurer la disponibilité sans
        pouvoir la garantir. Jëfëli n’est pas responsable des transactions, rencontres ou litiges entre membres, ni des
        contenus publiés par les membres, sous réserve de son obligation de retirer promptement les contenus
        manifestement illicites qui lui sont signalés. Rien dans ces conditions n’exclut la responsabilité de Jëfëli
        lorsqu’elle ne peut légalement l’être.
      </p>

      <h2 id="pi">16. Propriété intellectuelle</h2>
      <p>
        Le nom Jëfëli, ses logos, l’application et le site sont protégés. Toute reproduction non autorisée est
        interdite, à l’exception du partage de liens vers des pages publiques.
      </p>

      <h2 id="donnees">17. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <Link href="/legal/confidentialite">politique de confidentialité</Link>, conformément à la loi n° 2008-12 du
        25 janvier 2008 sur la protection des données à caractère personnel.
      </p>

      <h2 id="droit">18. Droit applicable et litiges</h2>
      <p>
        Les présentes conditions sont soumises au droit sénégalais. En cas de différend, les parties recherchent
        d’abord une solution amiable en écrivant à <Todo>adresse e-mail de contact</Todo>. À défaut, compétence est
        attribuée aux juridictions de Dakar, sous réserve des règles impératives applicables aux consommateurs.{' '}
        <Todo>à confirmer par le conseil juridique</Todo>
      </p>
    </LegalPage>
  );
}
