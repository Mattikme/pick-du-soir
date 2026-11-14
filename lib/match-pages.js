// Pages « match du soir » (une par match, lignes des deux équipes) et bloc « ligne du soir » des fiches joueur.
// Les lignes viennent de lib/lignes.js (nightBoard). Stats informatives : pas de cotes, pas d'opérateur.
import { sql } from './jobs.js';
import { usDate } from './ttfl.js';
import { nightBoard, headLine, fr1, statName, won } from './lignes.js';
import { STATS } from './trends.js';
import { NBA_NAMES } from './emblems.js';
import { NHL_TEAMS } from './nhl.js';
import { lineRow } from './ui.js';
import { page, esc, tc, photo, hourFR, dayFR } from './site.js';
import { teamUrl } from './team-pages.js';

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
    ? sql.query(`SELECT id::text AS gid, game_date::text AS d, home, away, start_utc, state IN ('FINAL', 'OFF') AS done, home_score AS hs, away_score AS vs FROM nhl_games WHERE game_date BETWEEN $1 AND $2 AND game_type IN (2, 3) ORDER BY start_utc`, [from, to])
    : sql.query(`SELECT g.id::text AS gid, g.game_date::text AS d, h.tricode AS home, a.tricode AS away, g.start_utc, g.status = 3 AS done, g.home_score AS hs, g.away_score AS vs FROM games g JOIN teams h ON h.id = g.home_team_id JOIN teams a ON a.id = g.away_team_id
                 WHERE g.game_date BETWEEN $1 AND $2 AND g.game_type IS DISTINCT FROM 'pre' ORDER BY g.start_utc`, [from, to]);
}

// Liens vers les matchs d'un jour (page Lignes du soir)
export async function matchChips(lg, day) {
  if (!day) return '';
  const ms = await matchList(lg, day, day).catch(() => []);
  if (!ms.length) return '';
  return `<h2>Les matchs du soir</h2><nav class="chips" aria-label="Matchs du soir">${ms.map((m) => `<a href="${matchUrl(lg, m)}">${esc(m.away)} @ ${esc(m.home)}</a>`).join('')}</nav>`;
}

// Match terminé : stats réelles de chaque joueur (Map player_id → ligne de stats ; minutes à 0 = n'a pas joué)
async function boxScore(lg, gid) {
  const rows = lg === 'nhl'
    ? await sql.query(`SELECT player_id, toi AS minutes, sog FROM nhl_player_games WHERE game_id::text = $1`, [gid])
    : await sql.query(`SELECT player_id, minutes, pts, reb, ast, tpm FROM player_games WHERE game_id::text = $1`, [gid]);
  return new Map(rows.map((r) => [String(r.player_id), r]));
}
const realVal = (lg, stat, g) => (lg === 'nhl' ? +g.sog || 0 : STATS[stat].val(g));
// Pastille résultat d'une ligne : valeur obtenue, ligne réussie ou ratée
function resultHtml(lg, l, g) {
  if (!g || !(+g.minutes > 0)) return { html: `<span class="rs dnp">N'a pas joué</span>`, ok: null };
  const v = realVal(lg, l.stat, g), ok = won(l.side, v, l.line);
  return { html: `<span class="rs ${ok ? 'ok' : 'ko'}">Résultat : ${v} · ${ok ? 'réussie' : 'ratée'}</span>`, ok };
}

// Lignes figées avant le match : chaque passage du cron (matin, soir) enregistre la ligne mise en avant de chaque joueur
// des matchs pas encore commencés ; une fois le match terminé, la page affiche ces lignes-là (et non un recalcul).
const LINES_TABLE = `CREATE TABLE IF NOT EXISTS match_lines (league text NOT NULL, game_id text NOT NULL, player_id text NOT NULL, data jsonb NOT NULL, saved_at timestamptz DEFAULT now(), PRIMARY KEY (league, game_id, player_id))`;
export async function saveLines(lg, day = usDate()) {
  await sql.query(LINES_TABLE);
  const now = Date.now(), all = await nightBoard(lg, day);
  const rows = all.filter((r) => r.start_utc && new Date(r.start_utc).getTime() > now).map((r) => ({ r, l: headLine(r) })).filter((x) => x.l)
    .map(({ r, l }) => [String(r.game_id), String(r.player_id), JSON.stringify({ name: r.name, slug: r.slug, team: r.team, opp: r.opp, home: r.home, start_utc: r.start_utc, player_id: r.player_id, game_id: r.game_id, l })]);
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await sql.query(`INSERT INTO match_lines (league, game_id, player_id, data) SELECT $1, x.g, x.p, x.d::jsonb FROM unnest($2::text[], $3::text[], $4::text[]) AS x(g, p, d)
      ON CONFLICT (league, game_id, player_id) DO UPDATE SET data = EXCLUDED.data, saved_at = now()`, [lg, part.map((x) => x[0]), part.map((x) => x[1]), part.map((x) => x[2])]);
  }
  // un joueur retiré depuis (blessure annoncée) : sa ligne figée disparaît, tant que le match n'a pas commencé
  const games = [...new Set(all.filter((r) => r.start_utc && new Date(r.start_utc).getTime() > now).map((r) => String(r.game_id)))];
  if (games.length) await sql.query(`DELETE FROM match_lines WHERE league = $1 AND game_id = ANY($2) AND NOT (player_id = ANY($3))`, [lg, games, rows.map((x) => x[1])]);
  return { day, saved: rows.length };
}
async function frozenLines(lg, gid) {
  try { return (await sql.query(`SELECT data FROM match_lines WHERE league = $1 AND game_id = $2`, [lg, gid])).map((x) => x.data); } catch { return []; }
}

// Page d'un match : /match/AAAA-MM-JJ/ext-dom (NBA) ou /nhl/match/... (NHL)
export async function matchPage(lg, rest, origin) {
  const mm = rest.match(/^(\d{4}-\d{2}-\d{2})\/([a-z]{2,4})-([a-z]{2,4})$/);
  if (!mm) return null;
  const [, d, away, home] = mm;
  const [m] = (await matchList(lg, d, d)).filter((x) => x.away.toLowerCase() === away && x.home.toLowerCase() === home);
  if (!m) return null;
  const frozen = m.done ? await frozenLines(lg, m.gid) : [];
  const mine = frozen.length ? frozen : (await nightBoard(lg, d).catch(() => [])).filter((r) => String(r.game_id) === m.gid);
  const lineOf = (r) => r.l || headLine(r);
  const [hc, hn] = NAME[lg](m.home), [ac, an] = NAME[lg](m.away);
  const tonight = d === usDate(), when = tonight ? 'ce soir' : `le ${dayFR(d)}`;
  const box = m.done ? await boxScore(lg, m.gid).catch(() => null) : null;
  let nOk = 0, nTot = 0;
  const team = (t) => {
    const rows = mine.filter((r) => r.team === t).map((r) => ({ r, l: lineOf(r) })).filter((x) => x.l).sort((a, b) => b.l.p - a.l.p);
    if (!rows.length) return box ? `<p class="empty">Pas de ligne calculée pour cette équipe.</p>` : `<p class="empty">Pas encore de ligne pour cette équipe : elles apparaissent quand les compositions sont connues.</p>`;
    return `<div class="slist">${rows.map(({ r, l }) => {
      const res = box ? resultHtml(lg, l, box.get(String(r.player_id))) : null;
      if (res && res.ok != null) { nTot++; if (res.ok) nOk++; }
      return lineRow({ ...l, name: r.name }, { href: playerHref(lg, r.slug, l.stat), color: color(lg, r.team), photoHtml: photo(lg, r.player_id, r.team), text: `${fr1(l.line)} ${statName(l.stat, l.line)}`, meta: `${esc(r.team)} ${r.home ? 'vs' : '@'} ${esc(r.opp)} · ${hourFR(r.start_utc)}`, result: res && res.html });
    }).join('')}</div>`;
  };
  const what = lg === 'nhl' ? 'tirs cadrés' : 'points, rebonds, passes, tirs à 3 pts';
  const awayHtml = team(m.away), homeHtml = team(m.home); // avant l'intro : remplit nOk / nTot
  const score = box && m.vs != null && m.hs != null ? `${esc(ac)} ${m.vs} – ${m.hs} ${esc(hc)}` : '';
  const body = `<section class="intro"><p class="kick">${lg.toUpperCase()} · ${esc(dayFR(d))} · ${box ? 'Terminé' : hourFR(m.start_utc)}</p>
  <h1>${esc(an)} – ${esc(hn)} : ${box ? `stats des joueurs et résultats du ${esc(dayFR(d))}` : `stats des joueurs ${esc(when)}`}</h1>
  <p class="lede">${box
    ? `${score ? `Score final : ${score}. ` : ''}Pour chaque joueur, la ligne au demi-point (${what}) calculée avant le match, le côté Plus ou Moins jugé le plus probable, puis la valeur réellement obtenue.${nTot ? ` Bilan : <b>${nOk} ligne${nOk > 1 ? 's' : ''} réussie${nOk > 1 ? 's' : ''} sur ${nTot}</b>.` : ''}`
    : `${esc(ac)} se déplace à ${esc(hc)}. Pour chaque joueur, une ligne au demi-point (${what}), le côté Plus ou Moins que notre modèle juge le plus probable et sa projection.`}</p></section>
  <h2><a href="${teamUrl(lg, m.away)}">${esc(ac)} ${esc(an)}</a></h2>${awayHtml}
  <h2><a href="${teamUrl(lg, m.home)}">${esc(hc)} ${esc(hn)}</a></h2>${homeHtml}
  <a class="band" href="/algo${lg === 'nhl' ? '?sport=nhl' : ''}"><span><b>Toutes les lignes ${lg.toUpperCase()} du soir</b><span>La sélection du modèle et ses résultats publics.</span></span><span class="go">Voir</span></a>
  <p class="tip">La ligne est une ligne de référence maison, pas celle d'un opérateur. Minutes, blessures de dernière minute et scénario du match peuvent tout changer. Stats informatives, pas un conseil de pari.</p>`;
  const url = origin + matchUrl(lg, m);
  return page({
    title: box ? `${an} – ${hn} ${dayFR(d)} : stats des joueurs et résultats | Pick du Soir` : `${an} – ${hn} ${tonight ? 'ce soir' : dayFR(d)} : stats des joueurs, Plus ou Moins | Pick du Soir`,
    description: box
      ? `${ac} ${an} – ${hc} ${hn} (${dayFR(d)})${m.vs != null ? ` : ${m.vs}-${m.hs}` : ''}. Les lignes ${what} de chaque joueur et la valeur réellement obtenue${nTot ? ` : ${nOk} réussies sur ${nTot}` : ''}. Stats informatives.`
      : `${ac} ${an} – ${hc} ${hn} (${dayFR(d)}, ${hourFR(m.start_utc)}) : les lignes ${what} de chaque joueur, côté Plus ou Moins et projection. Stats informatives.`,
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
