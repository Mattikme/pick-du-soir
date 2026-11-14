// Pages « match du soir » (une par match, lignes des deux équipes) et bloc « ligne du soir » des fiches joueur.
// Les lignes viennent de lib/lignes.js (nightBoard). Stats informatives : pas de cotes, pas d'opérateur.
import { sql } from './jobs.js';
import { usDate } from './ttfl.js';
import { nightBoard, headLine, fr1, statName } from './lignes.js';
import { NBA_NAMES } from './emblems.js';
import { NHL_TEAMS } from './nhl.js';
import { lineRow } from './ui.js';
import { page, esc, tc, photo, hourFR, dayFR } from './site.js';

const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const NAME = { nba: (t) => NBA_NAMES[t] || [t, t], nhl: (t) => (NHL_TEAMS[t] ? NHL_TEAMS[t].slice(0, 2) : [t, t]) };
const color = (lg, t) => (lg === 'nhl' ? (NHL_TEAMS[t] || [])[2] || '#2C86B8' : tc(t)[0]);
const base = (lg) => (lg === 'nhl' ? '/nhl' : '');
export const matchUrl = (lg, m) => `${base(lg)}/match/${m.d}/${m.away.toLowerCase()}-${m.home.toLowerCase()}`;
const sideTxt = (l) => `${l.side === 'moins' ? 'Moins' : 'Plus'} de ${fr1(l.line)} ${statName(l.stat, l.line)}`;
const playerHref = (lg, slug, stat) => (lg === 'nhl' ? `/nhl/joueur/${esc(slug)}` : `/joueur/${esc(slug)}?stat=${stat}`);

// Matchs d'une ligue entre deux dates (US) : { gid, d, home, away, start_utc }
export async function matchList(lg, from, to) {
  return lg === 'nhl'
    ? sql.query(`SELECT id::text AS gid, game_date::text AS d, home, away, start_utc FROM nhl_games WHERE game_date BETWEEN $1 AND $2 AND game_type IN (2, 3) ORDER BY start_utc`, [from, to])
    : sql.query(`SELECT g.id::text AS gid, g.game_date::text AS d, h.tricode AS home, a.tricode AS away, g.start_utc FROM games g JOIN teams h ON h.id = g.home_team_id JOIN teams a ON a.id = g.away_team_id
                 WHERE g.game_date BETWEEN $1 AND $2 AND g.game_type IS DISTINCT FROM 'pre' ORDER BY g.start_utc`, [from, to]);
}

// Liens vers les matchs d'un jour (page Lignes du soir)
export async function matchChips(lg, day) {
  if (!day) return '';
  const ms = await matchList(lg, day, day).catch(() => []);
  if (!ms.length) return '';
  return `<h2>Les matchs du soir</h2><nav class="chips" aria-label="Matchs du soir">${ms.map((m) => `<a href="${matchUrl(lg, m)}">${esc(m.away)} @ ${esc(m.home)}</a>`).join('')}</nav>`;
}

// Page d'un match : /match/AAAA-MM-JJ/ext-dom (NBA) ou /nhl/match/... (NHL)
export async function matchPage(lg, rest, origin) {
  const mm = rest.match(/^(\d{4}-\d{2}-\d{2})\/([a-z]{2,4})-([a-z]{2,4})$/);
  if (!mm) return null;
  const [, d, away, home] = mm;
  const [m] = (await matchList(lg, d, d)).filter((x) => x.away.toLowerCase() === away && x.home.toLowerCase() === home);
  if (!m) return null;
  const all = await nightBoard(lg, d).catch(() => []);
  const mine = all.filter((r) => String(r.game_id) === m.gid);
  const [hc, hn] = NAME[lg](m.home), [ac, an] = NAME[lg](m.away);
  const tonight = d === usDate(), when = tonight ? 'ce soir' : `le ${dayFR(d)}`;
  const team = (t) => {
    const rows = mine.filter((r) => r.team === t).map((r) => ({ r, l: headLine(r) })).filter((x) => x.l).sort((a, b) => b.l.p - a.l.p);
    if (!rows.length) return `<p class="empty">Pas encore de ligne pour cette équipe : elles apparaissent quand les compositions sont connues.</p>`;
    return `<div class="slist">${rows.map(({ r, l }) => lineRow({ ...l, name: r.name }, { href: playerHref(lg, r.slug, l.stat), color: color(lg, r.team), photoHtml: photo(lg, r.player_id, r.team), text: `${fr1(l.line)} ${statName(l.stat, l.line)}`, meta: `${esc(r.team)} ${r.home ? 'vs' : '@'} ${esc(r.opp)} · ${hourFR(r.start_utc)}` })).join('')}</div>`;
  };
  const what = lg === 'nhl' ? 'tirs cadrés' : 'points, rebonds, passes, tirs à 3 pts';
  const body = `<section class="intro"><p class="kick">${lg.toUpperCase()} · ${esc(dayFR(d))} · ${hourFR(m.start_utc)}</p>
  <h1>${esc(an)} – ${esc(hn)} : stats des joueurs ${esc(when)}</h1>
  <p class="lede">${esc(ac)} se déplace à ${esc(hc)}. Pour chaque joueur, une ligne au demi-point (${what}), le côté Plus ou Moins que notre modèle juge le plus probable et sa projection.</p></section>
  <h2>${esc(ac)} ${esc(an)}</h2>${team(m.away)}
  <h2>${esc(hc)} ${esc(hn)}</h2>${team(m.home)}
  <a class="band" href="/algo${lg === 'nhl' ? '?sport=nhl' : ''}"><span><b>Toutes les lignes ${lg.toUpperCase()} du soir</b><span>La sélection du modèle et ses résultats publics.</span></span><span class="go">Voir</span></a>
  <p class="tip">La ligne est une ligne de référence maison, pas celle d'un opérateur. Minutes, blessures de dernière minute et scénario du match peuvent tout changer. Stats informatives, pas un conseil de pari.</p>`;
  const url = origin + matchUrl(lg, m);
  return page({
    title: `${an} – ${hn} ${tonight ? 'ce soir' : dayFR(d)} : stats des joueurs, Plus ou Moins | Pick du Soir`,
    description: `${ac} ${an} – ${hc} ${hn} (${dayFR(d)}, ${hourFR(m.start_utc)}) : les lignes ${what} de chaque joueur, côté Plus ou Moins et projection. Stats informatives.`,
    canonical: url, nav: lg === 'nhl' ? 'nhl' : 'algo',
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Pick du Soir', origin + '/'], [`Lignes ${lg.toUpperCase()} du soir`, origin + '/algo' + (lg === 'nhl' ? '?sport=nhl' : '')], [`${an} – ${hn}`, url]].map(([name, item], k) => ({ '@type': 'ListItem', position: k + 1, name, item })) },
    body,
  });
}

// URLs du sitemap : matchs de J-3 à J+2
export async function matchSitemap() {
  const t = usDate(), out = [];
  for (const lg of ['nba', 'nhl']) { try { for (const m of await matchList(lg, addDays(t, -3), addDays(t, 2))) out.push(matchUrl(lg, m)); } catch {} }
  return out;
}

// Fiche joueur : ligne du soir du joueur (si son prochain match est aujourd'hui ou demain). Renvoie { html, line, match } ou null.
export async function playerTonight(lg, pid, d) {
  if (!d || d > addDays(usDate(), 1)) return null;
  const all = await nightBoard(lg, d).catch(() => []);
  const e = all.find((r) => String(r.player_id) === String(pid));
  if (!e) return null;
  const l = headLine(e);
  if (!l) return null;
  const [m] = (await matchList(lg, d, d).catch(() => [])).filter((x) => x.gid === String(e.game_id));
  const others = e.lines.filter((x) => x !== l);
  const row = lineRow({ ...l, name: e.name }, { href: m ? matchUrl(lg, m) : '#', color: color(lg, e.team), photoHtml: photo(lg, e.player_id, e.team), text: `${fr1(l.line)} ${statName(l.stat, l.line)}`, meta: `${esc(e.team)} ${e.home ? 'vs' : '@'} ${esc(e.opp)} · ${hourFR(e.start_utc)}` });
  const tbl = others.length ? `<div class="tbl"><table><thead><tr><th>Stat</th><th class="n">Ligne</th><th>Côté</th><th class="n">Projection</th><th class="n">10 derniers</th></tr></thead><tbody>${others.map((x) => `<tr><td>${esc(statName(x.stat))}</td><td class="n">${fr1(x.line)}</td><td>${x.side === 'moins' ? 'Moins' : 'Plus'}</td><td class="n">${fr1(x.proj)}</td><td class="n">${x.l10}/${x.n10}</td></tr>`).join('')}</tbody></table></div>` : '';
  const tonight = d === usDate(), when = tonight ? 'ce soir' : 'demain';
  const html = `<h2>Sa ligne ${tonight ? 'du soir' : 'de demain'}</h2><div class="slist">${row}</div>${tbl}
  <p class="legend">Ligne de référence maison (le demi-point qui coupe en deux ses matchs récents), côté jugé le plus probable par notre modèle et projection. ${m ? `<a href="${matchUrl(lg, m)}"><u>Toutes les lignes du match ${esc(m.away)} @ ${esc(m.home)}</u></a>. ` : ''}Stats informatives, pas un conseil de pari.</p>`;
  return { html, when, line: l, title: e.lines.find((x) => x.stat === 'pts') || l, sideText: sideTxt(l), opp: e.opp, home: e.home }; // title : la ligne de points d'abord (recherches « plus ou moins points »)
}
