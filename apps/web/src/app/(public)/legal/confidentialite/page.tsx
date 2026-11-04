import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Comment Jëfëli traite les données personnelles de ses membres (projet en cours de validation).',
  alternates: { canonical: '/legal/confidentialite' },
};

const TOC = [
  { id: 'responsable', label: 'Responsable du traitement' },
  { id: 'donnees', label: 'Données collectées' },
  { id: 'visibilite', label: 'Ce qui est public, ce qui ne l’est pas' },
  { id: 'finalites', label: 'Pourquoi nous utilisons ces données' },
  { id: 'destinataires', label: 'Destinataires et prestataires' },
  { id: 'conservation', label: 'Durées de conservation' },
  { id: 'droits', label: 'Vos droits' },
  { id: 'suppression', label: 'Suppression du compte et export' },
  { id: 'mineurs', label: 'Mineurs' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'cookies', label: 'Cookies du site web' },
  { id: 'cdp', label: 'Autorité de contrôle (CDP)' },
  { id: 'modifications', label: 'Modifications' },
];

export default function PrivacyPage() {
  return (
    <LegalPage current="confidentialite" title="Politique de confidentialité" version="Projet de travail — version pilote, novembre 2026" toc={TOC}>
      <p>
        Cette politique explique quelles données personnelles Jëfëli traite, pourquoi, pendant combien de temps et
        comment exercer vos droits, conformément à la <strong>loi n° 2008-12 du 25 janvier 2008</strong> sur la
        protection des données à caractère personnel et à ses textes d’application.
      </p>

      <h2 id="responsable">1. Responsable du traitement</h2>
      <p>
        <Todo>Raison sociale, adresse, RCCM / NINEA</Todo>. Contact pour toute question relative aux données
        personnelles&nbsp;: <Todo>adresse e-mail dédiée — à définir par le propriétaire</Todo>. Référent données personnelles&nbsp;:{' '}
        <Todo>nom ou fonction</Todo>.
      </p>

      <h2 id="donnees">2. Données collectées</h2>
      <h3>Compte</h3>
      <ul>
        <li>Adresse e-mail ou numéro de téléphone, selon le mode de connexion choisi.</li>
        <li>Mot de passe, conservé uniquement sous forme chiffrée (hachée) par notre prestataire d’authentification.</li>
        <li>Date à laquelle vous avez confirmé avoir 18 ans ou plus.</li>
      </ul>
      <h3>Profil</h3>
      <ul>
        <li>Nom affiché, nom d’utilisateur, photo de profil et de couverture, bio.</li>
        <li>Ville et quartier, uniquement si vous choisissez de les indiquer.</li>
        <li>Centres d’intérêt (catégories) choisis pour personnaliser le fil.</li>
      </ul>
      <h3>Contenus et activité</h3>
      <ul>
        <li>Publications, statuts, lives, commentaires, annonces, photos et vidéos, avis.</li>
        <li>Abonnements, amis, blocages et comptes mis en sourdine&nbsp;; articles et publications enregistrés.</li>
        <li>Signalements que vous faites ou qui vous concernent, et décisions de modération.</li>
      </ul>
      <h3>Messages</h3>
      <ul>
        <li>Messages privés, pièces jointes, messages vocaux, offres et accords conclus dans la messagerie.</li>
      </ul>
      <h3>Données techniques</h3>
      <ul>
        <li>Jeton de notification push et type d’appareil (iOS ou Android), si vous activez les notifications.</li>
        <li>
          Journaux techniques et de sécurité de nos serveurs (dont l’adresse IP) et compteurs anti-abus (nombre
          d’actions par période).
        </li>
      </ul>
      <h3>Ce que nous ne collectons pas</h3>
      <ul>
        <li>
          <strong>Aucune position GPS précise.</strong> Seule la ville ou le quartier que vous déclarez est utilisé,
          par exemple pour l’onglet «&nbsp;À proximité&nbsp;».
        </li>
        <li>Aucune donnée de paiement&nbsp;: Jëfëli ne traite aucun paiement.</li>
        <li>
          Pas d’accès à votre carnet d’adresses. Si une fonction «&nbsp;retrouver mes contacts&nbsp;» est proposée un jour, elle
          sera facultative et soumise à votre consentement explicite.
        </li>
      </ul>

      <h2 id="visibilite">3. Ce qui est public, ce qui ne l’est pas</h2>
      <ul>
        <li>
          Votre profil, vos publications publiques et vos annonces sont visibles par tous, y compris sans compte via un
          lien partagé — sauf si votre compte est privé.
        </li>
        <li>Votre adresse e-mail et votre numéro de téléphone ne sont jamais affichés publiquement.</li>
        <li>
          Les statuts et publications réservés à vos abonnés ou amis ne sont visibles que par eux&nbsp;; les fichiers
          correspondants sont servis par des liens temporaires.
        </li>
        <li>
          Les messages privés ne sont visibles que par les participants à la conversation. L’équipe de modération n’y a
          pas accès, sauf pour un message qui lui est signalé&nbsp;: une copie de ce message est alors jointe au
          signalement.
        </li>
      </ul>

      <h2 id="finalites">4. Pourquoi nous utilisons ces données</h2>
      <ul>
        <li>
          <strong>Fournir le service</strong> (compte, profil, fil, boutique, messagerie, offres, lives)&nbsp;: exécution des
          conditions d’utilisation.
        </li>
        <li>
          <strong>Sécurité et modération</strong> (lutte contre les arnaques, le spam et les contenus illicites,
          traitement des signalements et contestations)&nbsp;: intérêt légitime de Jëfëli et de ses membres, et obligations
          légales.
        </li>
        <li>
          <strong>Notifications</strong> : avec votre accord, modifiable à tout moment dans les réglages de
          l’application et de votre téléphone.
        </li>
        <li>
          <strong>Amélioration du service</strong> à partir de statistiques agrégées, sans revente ni publicité ciblée.
        </li>
      </ul>
      <p>Jëfëli ne vend pas vos données personnelles.</p>

      <h2 id="destinataires">5. Destinataires et prestataires</h2>
      <p>
        Les données sont accessibles aux seules personnes qui en ont besoin&nbsp;: vous, les membres selon vos réglages de
        visibilité, et l’équipe Jëfëli habilitée (accès limité et journalisé). Nous faisons appel à des prestataires
        techniques agissant sur nos instructions&nbsp;:
      </p>
      <ul>
        <li>
          Hébergement de la base de données, authentification et stockage des fichiers&nbsp;: Supabase —{' '}
          <Todo>région d’hébergement à préciser</Todo>.
        </li>
        <li>Notifications push&nbsp;: Expo, Apple (APNs) et Google (FCM).</li>
        <li>
          Diffusion des lives et envoi de SMS de connexion, uniquement lorsque ces fonctions seront activées&nbsp;:{' '}
          <Todo>prestataires à confirmer</Todo>.
        </li>
      </ul>
      <p>
        Certains prestataires sont situés hors du Sénégal. Ces transferts seront encadrés conformément à la loi
        n° 2008-12 et, lorsque c’est requis, soumis à l’autorisation préalable de la CDP.{' '}
        <Todo>liste et garanties à valider</Todo>
      </p>

      <h2 id="conservation">6. Durées de conservation</h2>
      <ul>
        <li>Compte et profil&nbsp;: tant que le compte est actif.</li>
        <li>
          Après suppression du compte&nbsp;: effacement ou anonymisation sous <Todo>30 jours</Todo>, sauf données à conserver
          pour une obligation légale ou un litige en cours.
        </li>
        <li>
          Statuts&nbsp;: visibles 24 heures, puis supprimés, sauf si vous les ajoutez à vos «&nbsp;à la une&nbsp;».
        </li>
        <li>Messages&nbsp;: jusqu’à la suppression du compte de l’expéditeur ou de la conversation, selon les cas.</li>
        <li>
          Signalements, décisions de modération et contestations&nbsp;: <Todo>durée à définir, par ex. 3 ans</Todo>, pour
          traiter les récidives et les contestations.
        </li>
        <li>Journaux techniques et de sécurité&nbsp;: <Todo>durée à définir, par ex. 12 mois</Todo>.</li>
      </ul>

      <h2 id="droits">7. Vos droits</h2>
      <p>Conformément à la loi n° 2008-12, vous disposez des droits suivants&nbsp;:</p>
      <ul>
        <li>droit d’être informé(e) des traitements vous concernant&nbsp;;</li>
        <li>droit d’accès à vos données et d’en obtenir une copie&nbsp;;</li>
        <li>droit de rectification des données inexactes (la plupart se modifient directement dans l’application)&nbsp;;</li>
        <li>droit à l’effacement, notamment en supprimant votre compte&nbsp;;</li>
        <li>droit d’opposition, pour des motifs légitimes, à certains traitements.</li>
      </ul>
      <p>
        Pour les exercer&nbsp;: depuis les réglages de l’application, ou par écrit à <Todo>adresse e-mail dédiée</Todo>.
        Une justification d’identité peut être demandée. Réponse sous <Todo>délai à préciser</Todo>.
      </p>

      <h2 id="suppression">8. Suppression du compte et export des données</h2>
      <p>
        Depuis les réglages de l’application, vous pouvez <strong>exporter vos données</strong> (profil, publications,
        annonces, messages envoyés, offres, avis, signalements déposés…) dans un fichier lisible, puis{' '}
        <strong>supprimer votre compte</strong>. La suppression retire votre profil, votre boutique et vos contenus
        publics.
      </p>

      <h2 id="mineurs">9. Mineurs</h2>
      <p>
        Jëfëli est réservé aux personnes de 18 ans et plus. Si nous apprenons qu’un compte appartient à une personne
        mineure, il est fermé et ses données supprimées, sous réserve des obligations légales.
      </p>

      <h2 id="securite">10. Sécurité</h2>
      <p>
        Les échanges sont chiffrés en transit (HTTPS). L’accès aux données est contrôlé ligne par ligne dans la base de
        données selon vos réglages de visibilité et vos blocages&nbsp;; les fichiers privés ne sont servis que par des liens
        temporaires&nbsp;; les accès de l’équipe de modération sont restreints et journalisés. Aucun système n’étant
        infaillible, nous vous informerons en cas d’incident affectant vos données, conformément à la loi.
      </p>

      <h2 id="cookies">11. Cookies du site web</h2>
      <p>
        Les pages publiques du site (profils, articles, publications partagés) ne déposent aucun cookie publicitaire ni
        de mesure d’audience. La console réservée à l’équipe de modération utilise un cookie de session strictement
        nécessaire à la connexion.
      </p>

      <h2 id="cdp">12. Autorité de contrôle</h2>
      <p>
        L’autorité compétente au Sénégal est la <strong>Commission de Protection des Données Personnelles (CDP)</strong>.
        Vous pouvez la saisir si vous estimez que vos droits ne sont pas respectés, après nous avoir contactés si
        possible. Les formalités préalables auprès de la CDP (déclaration ou demande d’autorisation) seront accomplies
        avant le lancement public. <Todo>numéro de récépissé à ajouter</Todo>
      </p>

      <h2 id="modifications">13. Modifications</h2>
      <p>
        Nous pouvons mettre à jour cette politique. En cas de changement important, vous serez informé(e) dans
        l’application avant son entrée en vigueur. Voir aussi les{' '}
        <Link href="/legal/cgu">conditions d’utilisation</Link> et les <Link href="/legal/regles">règles de la communauté</Link>.
      </p>
    </LegalPage>
  );
}
