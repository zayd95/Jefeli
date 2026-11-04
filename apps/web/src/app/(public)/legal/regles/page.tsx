import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Règles de la communauté',
  description: 'Ce qui est permis et interdit sur Jëfëli, conseils de sécurité, signalement et contestation (projet).',
  alternates: { canonical: '/legal/regles' },
};

const TOC = [
  { id: 'esprit', label: 'L’esprit de Jëfëli' },
  { id: 'qui', label: 'Qui peut utiliser Jëfëli' },
  { id: 'comportements', label: 'Comportements interdits' },
  { id: 'articles', label: 'Articles interdits' },
  { id: 'annonces', label: 'Des annonces honnêtes' },
  { id: 'avis', label: 'Avis et réputation' },
  { id: 'lives', label: 'Lives' },
  { id: 'paiements', label: 'Paiements\u00A0: les bons réflexes' },
  { id: 'rencontres', label: 'Rencontres en personne' },
  { id: 'verification', label: 'Le badge «\u00A0Vendeur vérifié\u00A0»' },
  { id: 'signaler', label: 'Signaler' },
  { id: 'mesures', label: 'Ce que fait l’équipe' },
  { id: 'contester', label: 'Contester une décision' },
];

export default function RulesPage() {
  return (
    <LegalPage current="regles" title="Règles de la communauté" version="Projet de travail — version pilote, novembre 2026" toc={TOC}>
      <h2 id="esprit">1. L’esprit de Jëfëli</h2>
      <p>
        Jëfëli est un espace pour découvrir, partager et vendre entre personnes qui se respectent. Trois principes
        guident ces règles&nbsp;: <strong>le respect</strong> des autres membres, <strong>l’honnêteté</strong> dans ce que
        l’on montre et ce que l’on vend, et <strong>la sécurité</strong> de chacun, en ligne comme lors des rencontres.
      </p>

      <h2 id="qui">2. Qui peut utiliser Jëfëli</h2>
      <ul>
        <li>Les personnes de 18 ans et plus.</li>
        <li>Sous leur véritable identité ou celle de leur activité réelle&nbsp;: pas de faux profil, pas d’usurpation.</li>
        <li>Un membre suspendu ne doit pas créer un autre compte pour contourner la décision.</li>
      </ul>

      <h2 id="comportements">3. Comportements interdits</h2>
      <ul>
        <li>Harcèlement, intimidation, insultes, menaces ou appels à la violence.</li>
        <li>Propos haineux visant une personne ou un groupe (origine, ethnie, religion, sexe, handicap…).</li>
        <li>Nudité, contenus sexuels ou sollicitations sexuelles.</li>
        <li>
          Tout contenu mettant en danger un mineur&nbsp;: tolérance zéro, suppression immédiate et signalement aux autorités
          compétentes.
        </li>
        <li>Arnaques, fraudes, hameçonnage, faux concours ou fausses promotions.</li>
        <li>Spam, messages en masse non sollicités, faux engagement (abonnés, mentions «&nbsp;J’aime&nbsp;» ou avis achetés).</li>
        <li>Publication des données personnelles d’autrui (numéro, adresse, photos) sans son accord.</li>
      </ul>

      <h2 id="articles">4. Articles interdits à la vente ou à l’échange</h2>
      <ul>
        <li>
          <strong>Armes</strong> : armes à feu, armes blanches destinées à blesser, munitions, explosifs et leurs pièces.
        </li>
        <li>
          <strong>Drogues</strong> : stupéfiants (dont le cannabis, ou «&nbsp;yamba&nbsp;»), et{' '}
          <strong>médicaments soumis à ordonnance</strong>, en particulier le <strong>tramadol</strong>.
        </li>
        <li>
          <strong>Fausse monnaie</strong> et faux billets, ainsi que le matériel servant à en fabriquer.
        </li>
        <li>
          <strong>Espèces protégées</strong> et leurs produits&nbsp;: ivoire, peaux, écailles, animaux sauvages vivants.
        </li>
        <li>
          <strong>Documents officiels</strong> : cartes d’identité, passeports, permis, cartes grises, diplômes — vrais
          ou faux.
        </li>
        <li>
          <strong>Biens volés</strong> ou dont vous ne pouvez pas justifier l’origine.
        </li>
        <li>
          <strong>Contenus et objets pour adultes</strong>.
        </li>
        <li>
          <strong>Contrefaçons</strong> : copies de marques, «&nbsp;répliques&nbsp;» et produits portant une marque sans
          autorisation.
        </li>
      </ul>
      <p>
        Un filtre automatique bloque certains de ces articles à la publication. Il ne voit pas tout&nbsp;: l’équipe retire
        les annonces interdites qui lui sont signalées, et le compte peut être sanctionné.
      </p>

      <h2 id="annonces">5. Des annonces honnêtes</h2>
      <ul>
        <li>Utilisez vos propres photos et vidéos de l’article réellement proposé.</li>
        <li>Indiquez l’état exact (neuf, comme neuf, très bon état, bon état, état correct, reconditionné).</li>
        <li>Affichez le vrai prix en francs CFA&nbsp;; pas de prix d’appel trompeur.</li>
        <li>Passez l’annonce en «&nbsp;Réservé&nbsp;» ou «&nbsp;Vendu&nbsp;» dès que c’est le cas.</li>
        <li>Pour un troc, décrivez honnêtement ce que vous proposez et respectez l’accord conclu.</li>
      </ul>

      <h2 id="avis">6. Avis et réputation</h2>
      <p>
        Un avis n’est possible qu’après un échange déclaré terminé par les deux membres. Il doit être sincère et porter
        sur l’échange. Il est interdit d’acheter, d’échanger ou d’exiger des avis, et de menacer quelqu’un d’un mauvais
        avis.
      </p>

      <h2 id="lives">7. Lives</h2>
      <p>
        Les mêmes règles s’appliquent en direct. L’hôte est responsable de son live et des articles qu’il présente. La
        mention «&nbsp;EN DIRECT&nbsp;» n’apparaît que lorsqu’un live est réellement en cours.
      </p>

      <h2 id="paiements">8. Paiements&nbsp;: les bons réflexes</h2>
      <ul>
        <li>
          <strong>Jëfëli ne détient aucun fonds</strong> et ne propose ni paiement intégré ni séquestre. Le paiement se
          fait directement entre vous.
        </li>
        <li>Méfiez-vous des demandes de paiement d’avance, surtout de la part d’un compte récent ou sans avis.</li>
        <li>
          Ne communiquez jamais un code secret, un code reçu par SMS ou un code de retrait mobile money. Personne chez
          Jëfëli ne vous le demandera.
        </li>
        <li>Méfiez-vous des liens de paiement inconnus et des captures d’écran de «&nbsp;paiement effectué&nbsp;».</li>
      </ul>

      <h2 id="rencontres">9. Rencontres en personne</h2>
      <ul>
        <li>Choisissez un lieu public et fréquenté, de préférence en journée.</li>
        <li>Venez accompagné(e) si possible et prévenez un proche du lieu et de l’heure.</li>
        <li>Vérifiez l’article (état, fonctionnement, accessoires) avant de payer.</li>
        <li>Évitez de transporter de grosses sommes en espèces.</li>
        <li>Si quelque chose vous semble anormal, renoncez à l’échange et signalez le membre.</li>
      </ul>

      <h2 id="verification">10. Le badge «&nbsp;Vendeur vérifié&nbsp;»</h2>
      <p>
        Il signifie que l’équipe Jëfëli a examiné les informations fournies par le vendeur. Il{' '}
        <strong>ne garantit pas</strong> les produits, les prix, le paiement ni la livraison&nbsp;: gardez les mêmes réflexes
        de prudence. Un badge peut être retiré à tout moment.
      </p>

      <h2 id="signaler">11. Signaler</h2>
      <p>
        Depuis l’application, chaque profil, publication, commentaire, annonce, statut, message, live ou avis peut être
        signalé, avec un motif et des précisions. Le membre signalé ne sait pas qui l’a signalé. Une copie du contenu est
        jointe au signalement pour que l’équipe puisse l’examiner même s’il est supprimé ensuite. Les signalements
        abusifs ou répétés de mauvaise foi peuvent eux-mêmes être sanctionnés.
      </p>
      <p>
        En cas de danger immédiat, contactez d’abord les services d’urgence. <Todo>numéros utiles à confirmer</Todo>
      </p>

      <h2 id="mesures">12. Ce que fait l’équipe</h2>
      <p>Selon la gravité et les antécédents, l’équipe de modération peut&nbsp;:</p>
      <ol>
        <li>envoyer un avertissement&nbsp;;</li>
        <li>masquer un contenu (il n’est plus visible des autres membres)&nbsp;;</li>
        <li>supprimer un contenu&nbsp;;</li>
        <li>retirer le badge «&nbsp;Vendeur vérifié&nbsp;»&nbsp;;</li>
        <li>suspendre le compte.</li>
      </ol>
      <p>
        Chaque décision est motivée, notifiée au membre concerné et inscrite dans un journal interne qui ne peut être ni
        modifié ni effacé.
      </p>

      <h2 id="contester">13. Contester une décision</h2>
      <p>
        Si vous pensez qu’une décision vous concernant est une erreur, vous pouvez la contester depuis la notification
        reçue dans l’application, en expliquant pourquoi. La contestation est réexaminée par l’équipe&nbsp;; si elle est
        acceptée, la mesure est levée (contenu rétabli, compte réactivé ou badge rendu). La réponse vous est notifiée.
        Voir aussi les <Link href="/legal/cgu#moderation">conditions d’utilisation</Link>.
      </p>
    </LegalPage>
  );
}
