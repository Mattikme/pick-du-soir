// Pages équipe : /equipe/raptors (NBA) et /nhl/equipe/kraken (NHL).
// Bilan de la saison, derniers résultats et prochains matchs (liens vers les pages match), stats des joueurs (liens vers les fiches).
// Stats informatives : pas de cotes, pas d'opérateur.
import { sql } from './jobs.js';
import { NBA_NAMES } from './emblems.js';
import { NHL_TEAMS } from './nhl.js';
import { matchUrl } from './match-pages.js';
import { page, esc, tc, hourFR, dayFR } from './site.js';

const NAME = { nba: (t) => NBA_NAMES[t] || [t, t], nhl: (t) => (NHL_TEAMS[t] ? NHL_TEAMS[t].slice(0, 2) : [t, t]) };
const TEAMS = { nba: () => Object.keys(NBA_NAMES), nhl: () => Object.keys(NHL_TEAMS) };
const color = (lg, t) => (lg === 'nhl' ? (NHL_TEAMS[t] || [])[2] || '#2C86B8' : tc(t)[0]);
const slug = (lg, t) => NAME[lg](t)[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const teamUrl = (lg, t) => `${lg === 'nhl' ? '/nhl' : ''}/equipe/${slug(lg, t)}`;
export const teamUrls = () => ['nba', 'nhl'].flatMap((lg) => TEAMS[lg]().map((t) => teamUrl(lg, t)));
const f1 = (x) => (x == null ? '–' : String(Math.round(x * 10) / 10).replace('.', ','));

const CSS = `<style>.tm-rec{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 4px}.tm-rec span{background:var(--card);border:1px solid var(--edge);border-radius:12px;padding:10px 14px;font-size:13px;opacity:.9}.tm-rec b{display:block;font:800 22px/1 var(--disp);margin-bottom:4px}
.tm-g{display:flex;flex-direction:column;gap:8px;margin:10px 0}.tm-g a{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:11px 14px;color:inherit;text-decoration:none}
.tm-g .r{flex:0 0 30px;height:30px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:14px;background:rgba(255,255,255,.08)}.tm-g .r.v{background:rgba(74,222,128,.18);color:#4ADE80}.tm-g .r.d{background:rgba(248,113,113,.18);color:#F87171}
.tm-g .m{flex:1;min-width:0}.tm-g .m b{display:block;font-size:15px}.tm-g .m span{font-size:12.5px;opacity:.75}.tm-g .go{font-size:13px;font-weight:800;opacity:.85;white-space:nowrap}
.tm-t td a{color:inherit;text-decoration:underline;text-underline-offset:2px}</style>`;

async function season(lg) {
  const [r] = await sql.query(lg === 'nhl'
    ? `SELECT max(season) AS s FROM nhl_games WHERE game_type = 2 AND state IN ('FINAL', 'OFF')`
    : `SELECT max(season) AS s FROM games WHERE game_type = 'reg' AND status = 3`);
  return r?.s;
}

// Matchs de l'équipe sur la saison : { gid, d, home, away, start_utc, done, hs, vs }
function games(lg, t, s) {
  return lg === 'nhl'
    ? sql.query(`SELECT id::text AS gid, game_date::text AS d, home, away, start_utc, state IN ('FINAL', 'OFF') AS done, home_score AS hs, away_score AS vs FROM nhl_games
                 WHERE season = $2 AND game_type IN (2, 3) AND $1 IN (home, away) ORDER BY start_utc`, [t, s])
    : sql.query(`SELECT g.id::text AS gid, g.game_date::text AS d, h.tricode AS home, a.tricode AS away, g.start_utc, g.status = 3 AS done, g.home_score AS hs, g.away_score AS vs
                 FROM games g JOIN teams h ON h.id = g.home_team_id JOIN teams a ON a.id = g.away_team_id
                 WHERE g.season = $2 AND g.game_type = 'reg' AND $1 IN (h.tricode, a.tricode) ORDER BY g.start_utc`, [t, s]);
}

// Stats des joueurs de l'équipe cette saison (matchs joués avec l'équipe)
function roster(lg, t, s) {
  return lg === 'nhl'
    ? sql.query(`SELECT p.name, p.slug, count(*)::int AS gp, sum(pg.goals)::int AS g, sum(pg.assists)::int AS a, sum(pg.points)::int AS pts, avg(pg.sog) AS sog, avg(pg.toi) / 60 AS toi
                 FROM nhl_player_games pg JOIN nhl_games g ON g.id = pg.game_id JOIN nhl_players p ON p.id = pg.player_id
                 WHERE pg.team = $1 AND g.season = $2 AND pg.game_type = 2 AND pg.toi > 0 AND p.position <> 'G' AND p.team = $1
                 GROUP BY p.id, p.name, p.slug ORDER BY sum(pg.points) DESC, avg(pg.sog) DESC`, [t, s])
    : sql.query(`SELECT p.name, p.slug, count(*)::int AS gp, avg(pg.minutes) AS min, avg(pg.pts) AS pts, avg(pg.reb) AS reb, avg(pg.ast) AS ast, avg(pg.tpm) AS tpm
                 FROM player_games pg JOIN games g ON g.id = pg.game_id JOIN players p ON p.id = pg.player_id JOIN teams tm ON tm.id = pg.team_id
                 WHERE tm.tricode = $1 AND g.season = $2 AND g.game_type = 'reg' AND pg.minutes > 0 AND p.team_id = pg.team_id
                 GROUP BY p.id, p.name, p.slug ORDER BY avg(pg.pts) DESC`, [t, s]);
}

function gameRow(lg, t, m) {
  const home = m.home === t, opp = home ? m.away : m.home, [, on] = NAME[lg](opp), where = home ? 'contre' : 'à';
  if (m.done && m.hs != null) {
    const us = home ? m.hs : m.vs, them = home ? m.vs : m.hs, v = us > them;
    return `<a href="${matchUrl(lg, m)}"><span class="r ${v ? 'v' : 'd'}">${v ? 'V' : 'D'}</span><span class="m"><b>${us} – ${them} ${where} ${esc(on)}</b><span>${esc(dayFR(m.d))} · stats et résultats des joueurs</span></span><span class="go">Voir ›</span></a>`;
  }
  return `<a href="${matchUrl(lg, m)}"><span class="r">${home ? 'Dom' : 'Ext'}</span><span class="m"><b>${home ? 'Contre' : 'À'} ${esc(on)}</b><span>${esc(dayFR(m.d))} · ${hourFR(m.start_utc)} (heure de Paris)</span></span><span class="go">Stats ›</span></a>`;
}

function table(lg, rows) {
  const href = (r) => (lg === 'nhl' ? `/nhl/joueur/${esc(r.slug)}` : `/joueur/${esc(r.slug)}`);
  const head = lg === 'nhl' ? '<th class="n">MJ</th><th class="n">Buts</th><th class="n">Passes</th><th class="n">Pts</th><th class="n">Tirs cadrés/m</th>' : '<th class="n">MJ</th><th class="n">Min</th><th class="n">Pts</th><th class="n">Reb</th><th class="n">Pas</th><th class="n">3 pts</th>';
  const row = (r) => lg === 'nhl'
    ? `<td class="n">${r.gp}</td><td class="n">${r.g}</td><td class="n">${r.a}</td><td class="n">${r.pts}</td><td class="n">${f1(r.sog)}</td>`
    : `<td class="n">${r.gp}</td><td class="n">${f1(r.min)}</td><td class="n">${f1(r.pts)}</td><td class="n">${f1(r.reb)}</td><td class="n">${f1(r.ast)}</td><td class="n">${f1(r.tpm)}</td>`;
  return `<div class="tbl tm-t"><table><thead><tr><th>Joueur</th>${head}</tr></thead><tbody>${rows.map((r) => `<tr><td><a href="${href(r)}">${esc(r.name)}</a></td>${row(r)}</tr>`).join('')}</tbody></table></div>`;
}

export async function teamPage(lg, s, origin) {
  const t = TEAMS[lg]().find((x) => slug(lg, x) === s);
  if (!t) return null;
  const L = lg.toUpperCase(), [city, nick] = NAME[lg](t), full = `${city} ${nick}`, url = origin + teamUrl(lg, t);
  const sea = await season(lg);
  const [gs, ps] = await Promise.all([games(lg, t, sea).catch(() => []), roster(lg, t, sea).catch(() => [])]);
  const done = gs.filter((m) => m.done && m.hs != null), next = gs.filter((m) => !m.done).slice(0, 3), last = done.slice(-5).reverse();
  const w = done.filter((m) => (m.home === t ? m.hs > m.vs : m.vs > m.hs)).length, l = done.length - w;
  const hw = done.filter((m) => m.home === t && m.hs > m.vs).length, hn = done.filter((m) => m.home === t).length;
  const form = done.slice(-10), fw = form.filter((m) => (m.home === t ? m.hs > m.vs : m.vs > m.hs)).length;
  const top = ps[0], what = lg === 'nhl' ? 'buts, passes, points et tirs cadrés' : 'points, rebonds, passes et tirs à 3 pts';
  const seasonTxt = lg === 'nhl' ? `${String(sea).slice(0, 4)}-${String(sea).slice(6)}` : sea;
  const lede = done.length
    ? `${full} : ${w} victoire${w > 1 ? 's' : ''} et ${l} défaite${l > 1 ? 's' : ''} en saison régulière ${seasonTxt}${form.length >= 5 ? `, ${fw} sur ${form.length} lors des derniers matchs` : ''}.${top ? ` Meilleur marqueur : ${top.name} (${lg === 'nhl' ? `${top.pts} points` : `${f1(top.pts)} points par match`}).` : ''}`
    : `${full} : la saison ${seasonTxt} commence, les stats apparaissent dès les premiers matchs.`;
  const body = `${CSS}<section class="intro"><p class="kick" style="color:${color(lg, t)}">${L} · Équipe · ${esc(t)}</p>
  <h1>${esc(full)} : stats des joueurs, matchs et résultats</h1>
  <p class="lede">${esc(lede)}</p></section>
  ${done.length ? `<div class="tm-rec"><span><b>${w}-${l}</b>Bilan ${esc(seasonTxt)}</span><span><b>${hw}-${hn - hw}</b>À domicile</span><span><b>${w - hw}-${done.length - hn - (w - hw)}</b>À l'extérieur</span>${form.length >= 5 ? `<span><b>${fw}/${form.length}</b>Derniers matchs</span>` : ''}</div>` : ''}
  ${next.length ? `<h2>Prochains matchs des ${esc(nick)}</h2><div class="tm-g">${next.map((m) => gameRow(lg, t, m)).join('')}</div>` : ''}
  ${last.length ? `<h2>Derniers résultats</h2><div class="tm-g">${last.map((m) => gameRow(lg, t, m)).join('')}</div>` : ''}
  <h2>Stats des joueurs ${esc(seasonTxt)}</h2>
  ${ps.length ? table(lg, ps) : '<p class="empty">Les stats des joueurs apparaissent dès les premiers matchs.</p>'}
  <p class="legend">Moyennes par match en saison régulière, matchs joués avec l'équipe${lg === 'nhl' ? ' (gardiens exclus)' : ''}. Touchez un joueur pour ses séries et sa ligne du soir.</p>
  <a class="band" href="${lg === 'nhl' ? '/matchs-nhl-ce-soir' : '/matchs-nba-ce-soir'}"><span><b>Matchs ${L} ce soir</b><span>Le programme en heure de Paris et les stats de chaque match.</span></span><span class="go">Voir</span></a>
  <a class="band" href="/classement${lg === 'nhl' ? '?l=nhl' : ''}"><span><b>Classement ${L}</b><span>Victoires, défaites et forme de toutes les équipes.</span></span><span class="go">Voir</span></a>
  <p class="tip">Stats calculées à partir des feuilles de match officielles. Stats informatives, pas un conseil de pari.</p>`;
  const crumbs = [['Pick du Soir', origin + '/'], [`Classement ${L}`, origin + '/classement' + (lg === 'nhl' ? '?l=nhl' : '')], [full, url]];
  return page({
    title: `${full} : stats des joueurs, matchs et résultats ${seasonTxt} | Pick du Soir`,
    description: `${lede} Prochains matchs, derniers résultats et stats de chaque joueur (${what}).`.slice(0, 300),
    canonical: url, nav: lg === 'nhl' ? 'nhl' : 'classement', hockey: lg === 'nhl',
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, item], k) => ({ '@type': 'ListItem', position: k + 1, name, item })) },
    body,
  });
}
