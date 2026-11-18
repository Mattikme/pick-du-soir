// Pages légales : mentions légales, confidentialité et cookies.
// Les textes « éditeur » et « hébergeur » se complètent sans toucher au code : table site_config, clés editeur et hebergeur.
import { page, esc } from './site.js';
import { siteConfig, adsOn } from './ads.js';

const EDITEUR = 'Matthieu, particulier résidant en France (éditeur non professionnel). Contact : @PickDuSoir sur X, ou la page « Proposer une idée ».';
const HEBERGEUR = 'Site hébergé par Neon, Inc. (États-Unis, neon.com), sur des serveurs situés dans l\'Union européenne (Francfort, Allemagne). Nom de domaine : OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.';

export async function legalPage(path, origin) {
  const cfg = await siteConfig(), ads = await adsOn();
  if (path === '/mentions-legales') {
    return page({ title: 'Mentions légales | Pick du Soir', description: 'Éditeur, hébergeur et conditions d\'utilisation du site Pick du Soir.', canonical: origin + path, nav: 'legal',
      body: `<section class="intro about"><p class="kick">Informations légales</p><h1>Mentions légales</h1>
<h2>Éditeur du site</h2><p>${esc(cfg.editeur || EDITEUR)}</p><p>Directeur de la publication : Matthieu.</p>
<h2>Hébergement</h2><p>${esc(cfg.hebergeur || HEBERGEUR)}</p>
<h2>Nature du site</h2><p>Pick du Soir publie des statistiques sportives (NBA, NHL) à titre informatif. Le site ne propose aucun pari, n'affiche aucune cote, n'encaisse aucune mise et n'est lié à aucun opérateur de jeux. Les pourcentages et projections sont des estimations calculées à partir de matchs passés : ils ne garantissent aucun résultat et ne constituent pas un conseil de pari.</p>
<p>Les jeux d'argent sont interdits aux mineurs. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).</p>
<h2>Propriété intellectuelle</h2><p>Les noms, logos et photos des joueurs, des équipes et des ligues appartiennent à leurs propriétaires respectifs ; ils sont utilisés pour identifier les joueurs. Pick du Soir est un site indépendant, sans lien avec la NBA, la NHL ni leurs équipes. Pour toute demande de retrait d'un contenu, écrivez-nous : il sera retiré rapidement.</p>
<h2>Responsabilité</h2><p>Les statistiques viennent des feuilles de match officielles et sont mises à jour automatiquement. Malgré le soin apporté, une erreur ou un retard reste possible. Chacun reste seul responsable de l'usage qu'il fait de ces informations.</p>
<p><a href="/confidentialite"><u>Confidentialité et cookies</u></a></p></section>` });
  }
  return page({ title: 'Confidentialité et cookies | Pick du Soir', description: 'Quelles données Pick du Soir utilise, pourquoi, et comment gérer vos choix.', canonical: origin + path, nav: 'legal',
    body: `<section class="intro about"><p class="kick">Vos données</p><h1>Confidentialité et cookies</h1>
<p>En bref : le site se consulte sans compte, sans e-mail, et ne vend aucune donnée.</p>
<h2>Mesure d'audience</h2><p>Pour compter les visites, le site enregistre la page vue, le site d'origine et une empreinte chiffrée de l'adresse IP, qui ne permet pas de retrouver l'adresse ni de suivre une personne d'un site à l'autre. Aucun cookie n'est déposé pour cela.</p>
<h2>Défi du soir</h2><p>Le Défi du soir est arrêté depuis le 14 novembre 2026. Les profils créés pour y jouer (pseudo, pronostics, cartes) ne sont plus utilisés ; vous pouvez demander leur suppression à tout moment.</p>
<h2>Boîte à idées</h2><p>Quand vous envoyez une idée, le site garde votre message, le contact que vous choisissez de laisser et votre adresse IP, uniquement pour limiter les abus.</p>
<h2 id="cookies">Publicité</h2>${ads
    ? `<p>Le site affiche des annonces Google AdSense. Avec votre accord, Google et ses partenaires peuvent déposer des cookies pour personnaliser les annonces et en mesurer l'audience ; sans accord, les annonces ne sont pas personnalisées. Votre choix vous est demandé à la première visite et reste modifiable à tout moment.</p>
<p><button type="button" class="go" style="border:0;cursor:pointer;background:var(--ink);color:var(--night);font-weight:700;padding:10px 14px;border-radius:10px" onclick="(window.googlefc=window.googlefc||{}).callbackQueue=googlefc.callbackQueue||[];googlefc.callbackQueue.push(function(){googlefc.showRevocationMessage()})">Modifier mes choix de cookies</button></p>
<p>En savoir plus : <a href="https://policies.google.com/technologies/partner-sites?hl=fr" rel="noopener"><u>comment Google utilise les données des sites partenaires</u></a>.</p>`
    : `<p>Le site n'affiche pas de publicité pour l'instant et ne dépose aucun cookie publicitaire. Si cela change, votre accord sera demandé avant tout dépôt de cookie, et cette page sera mise à jour.</p>`}
<h2>Vos droits</h2><p>Vous pouvez demander l'accès, la rectification ou la suppression des données vous concernant en nous écrivant sur X (<a href="https://x.com/PickDuSoir"><u>@PickDuSoir</u></a>) ou via la page <a href="/idees"><u>Proposer une idée</u></a>. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
<p><a href="/mentions-legales"><u>Mentions légales</u></a></p></section>` });
}
