// Pages « Matchs NBA/NHL ce soir » : programme du prochain soir de matchs en heure de Paris, avec un lien vers chaque page match.
// Stats informatives : pas de cotes, pas d'opérateur.
import { sql } from './jobs.js';
import { usDate } from './ttfl.js';
import { nightBoard, headLine } from './lignes.js';
import { NBA_NAMES } from './emblems.js';
import { NHL_TEAMS } from './nhl.js';
import { matchList, matchUrl } from './match-pages.js';
import { page, esc, tc, hourFR, dayFR } from './site.js';

export const PROG_URL = { nba: '/matchs-nba-ce-soir', nhl: '/matchs-nhl-ce-soir' };
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const NAME = { nba: (t) => NBA_NAMES[t] || [t, t], nhl: (t) => (NHL_TEAMS[t] ? NHL_TEAMS[t].slice(0, 2) : [t, t]) };
const color = (lg, t) => (lg === 'nhl' ? (NHL_TEAMS[t] || [])[2] || '#2C86B8' : tc(t)[0]);
// Jour (date de Paris) d'un coup d'envoi, ex. « dimanche 15 novembre »
const parisDay = (iso) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
const parisYmd = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(iso));

const CSS = `<style>.prog{display:flex;flex-direction:column;gap:8px;margin:10px 0 6px}.prog a{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:12px 14px;color:inherit;text-decoration:none}
.prog .h{flex:0 0 58px;font:800 20px/1 var(--disp)}.prog .h small{display:block;font:600 11px/1.3 var(--body,inherit);opacity:.7;margin-top:3px}
.prog .m{flex:1;min-width:0}.prog .m b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prog .m span{font-size:12.5px;opacity:.75}
.prog .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:1px}.prog .go{font-size:13px;font-weight:800;opacity:.85;white-space:nowrap}</style>`;

// Prochain soir de matchs (date US), comme la page Lignes
async function nextDay(lg) {
  const [d] = await sql.query(lg === 'nhl'
    ? `SELECT min(game_date)::text AS day FROM nhl_games WHERE game_date >= $1 AND start_utc > now() - interval '3 hours' AND game_type IN (2, 3)`
    : `SELECT min(game_date)::text AS day FROM games WHERE game_date >= $1 AND coalesce(status, 1) < 3 AND game_type IS DISTINCT FROM 'pre'`, [usDate()]);
  return d?.day || null;
}

function list(lg, ms, counts) {
  return `<div class="prog">${ms.map((m) => {
    const [ac, an] = NAME[lg](m.away), [hc, hn] = NAME[lg](m.home), n = counts.get(m.gid) || 0;
    return `<a href="${matchUrl(lg, m)}"><span class="h">${hourFR(m.start_utc)}<small>${esc(parisDay(m.start_utc).split(' ')[0].slice(0, 3))}.</small></span>
    <span class="m"><b><i class="dot" style="background:${color(lg, m.away)}"></i>${esc(an)} @ <i class="dot" style="background:${color(lg, m.home)}"></i>${esc(hn)}</b><span>${esc(ac)} chez ${esc(hc)}${n ? ` · ${n} joueur${n > 1 ? 's' : ''} avec une ligne` : ''}</span></span>
    <span class="go">Stats ›</span></a>`;
  }).join('')}</div>`;
}

async function lineCounts(lg, day) {
  const all = await nightBoard(lg, day).catch(() => []), c = new Map();
  for (const r of all) if (headLine(r)) c.set(String(r.game_id), (c.get(String(r.game_id)) || 0) + 1);
  return c;
}

export async function programmePage(lg, origin) {
  const L = lg.toUpperCase(), url = origin + PROG_URL[lg], other = lg === 'nhl' ? 'nba' : 'nhl';
  const day = await nextDay(lg);
  const ms = day ? await matchList(lg, day, day).catch(() => []) : [];
  const counts = ms.length ? await lineCounts(lg, day) : new Map();
  const after = day ? await matchList(lg, addDays(day, 1), addDays(day, 1)).catch(() => []) : [];
  const tonight = day === usDate();
  const what = lg === 'nhl' ? 'tirs cadrés' : 'points, rebonds, passes, tirs à 3 pts';
  let intro;
  if (ms.length) {
    const first = ms[0].start_utc, last = ms[ms.length - 1].start_utc, d1 = parisDay(first), d2 = parisDay(last);
    const span = parisYmd(last) > day ? `dans la nuit du ${dayFR(day).split(' ')[0]} au ${d2}` : `le ${d1}`; // matchs après minuit à Paris
    intro = `${ms.length} match${ms.length > 1 ? 's' : ''} ${L} ${span}, de ${hourFR(first)} à ${hourFR(last)} (heure de Paris).`;
  } else intro = `Pas de match ${L} au programme pour l'instant.`;
  const h1 = tonight || !ms.length ? `Matchs ${L} ce soir` : `Prochains matchs ${L} : ${dayFR(day)}`;
  const body = `${CSS}<section class="intro"><p class="kick">${L} · Programme${day ? ' · ' + esc(dayFR(day)) : ''}</p>
  <h1>${esc(h1)} : programme et heures françaises</h1>
  <p class="lede">${esc(intro)} Touchez un match pour voir les stats de chaque joueur (${what}) : ligne au demi-point, côté Plus ou Moins et projection.</p></section>
  ${ms.length ? list(lg, ms, counts) : `<p class="empty">Le programme apparaît ici dès que le calendrier ${L} propose des matchs.</p>`}
  ${after.length ? `<h2>Le soir suivant : ${esc(dayFR(after[0].d))}</h2>${list(lg, after, new Map())}` : ''}
  <a class="band" href="/algo${lg === 'nhl' ? '?sport=nhl' : ''}"><span><b>Les lignes ${L} du soir</b><span>La sélection du modèle et ses résultats publics.</span></span><span class="go">Voir</span></a>
  <a class="band" href="${PROG_URL[other]}"><span><b>Matchs ${other.toUpperCase()} ce soir</b><span>Le programme ${other.toUpperCase()} en heure française.</span></span><span class="go">Voir</span></a>
  <p class="tip">Horaires officiels convertis en heure de Paris ; un match peut être décalé. Stats informatives, pas un conseil de pari.</p>`;
  const crumbs = [['Pick du Soir', origin + '/'], [`Matchs ${L} ce soir`, url]];
  return page({
    title: `Matchs ${L} ce soir : programme et heures françaises${day ? ` (${dayFR(day)})` : ''} | Pick du Soir`,
    description: ms.length ? `${intro} Les stats des joueurs de chaque match : ${what}. Stats informatives.` : `Le programme des matchs ${L} en heure de Paris, avec les stats des joueurs de chaque match.`,
    canonical: url, nav: lg === 'nhl' ? 'nhl' : 'soir',
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, item], k) => ({ '@type': 'ListItem', position: k + 1, name, item })) },
    body,
  });
}

// Bandeau pour l'accueil NBA / NHL
export const progBand = (lg) => `<a class="band" href="${PROG_URL[lg]}"><span><b>Matchs ${lg.toUpperCase()} ce soir</b><span>Le programme en heure française et les stats de chaque match.</span></span><span class="go">Voir</span></a>`;
