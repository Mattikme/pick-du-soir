// Lignes du soir : pour chaque joueur, une ligne de référence au demi-point (24,5 points…) et la probabilité « Plus » ou « Moins ».
// Même calcul que l'étude etude/lignes.py : toute modification ici doit être refaite là-bas (et inversement).
import { sql } from './jobs.js';
import { STATS } from './trends.js';
import MODELS from './lignes-model.js';

const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const over = (a, L) => (a.length ? a.filter((v) => v > L).length / a.length : 0);

// Niveau habituel du joueur : médianes des 40, 20 et 10 derniers matchs (v : du plus ancien au plus récent)
export const level = (v) => 0.4 * median(v.slice(-40)) + 0.3 * median(v.slice(-20)) + 0.3 * median(v.slice(-10));

// Ligne de référence : le demi-point qui coupe le mieux en deux ses matchs récents
export function refLine(v, mC = level(v)) {
  let best = null;
  for (const L of [Math.floor(mC) - 0.5, Math.floor(mC) + 0.5, Math.floor(mC) + 1.5]) {
    if (L < 0.5) continue;
    const d = Math.abs(0.4 * over(v.slice(-40), L) + 0.3 * over(v.slice(-20), L) + 0.3 * over(v.slice(-10), L) - 0.5);
    if (!best || d < best[0] - 1e-9) best = [d, L];
  }
  return best[1];
}

// Score du modèle pour « Plus de L » (positif = Plus probable). c : { home, rest (jours depuis le dernier match), oppr (défense adverse, 1 = moyenne) }
function score(M, v, mins, L, mC, c) {
  const m20 = mean(mins.slice(-20));
  const f = {
    r_a10: clip(mean(v.slice(-10)) / L, 0, 3), r_a20: clip(mean(v.slice(-20)) / L, 0, 3), r_a40: clip(mean(v.slice(-40)) / L, 0, 3), r_last: clip(v[v.length - 1] / L, 0, 3),
    minr3: clip(mean(mins.slice(-3)) / m20, 0.3, 2), minr: clip(mean(mins.slice(-5)) / m20, 0.3, 2), oppr: clip(c.oppr ?? 1, 0.7, 1.3), logL: Math.log(L),
    h5: over(v.slice(-5), L), h20: over(v.slice(-20), L), gap: clip((mC - L) / Math.sqrt(L), -2, 2), b2b: c.rest === 1 ? 1 : 0, home: c.home ? 1 : 0,
  };
  let z = M.intercept;
  M.feats.forEach((k, i) => { z += M.coef[i] * ((f[k] - M.mu[i]) / M.sd[i]); });
  return M.platt[0] * z + M.platt[1];
}
const sig = (z) => 1 / (1 + Math.exp(-z));
export const probPlus = (M, v, mins, L, c) => sig(score(M, v, mins, L, level(v), c));

// Une stat d'un joueur : sa ligne, la probabilité Plus, et notre projection (la valeur où Plus et Moins sont à égalité)
export function evalStat(M, v, mins, minLine, c) {
  const mC = level(v), line = refLine(v, mC);
  if (line < minLine) return null;
  const step = Math.max(1, Math.round(0.08 * line)), z0 = score(M, v, mins, line, mC, c);
  const zn = score(M, v, mins, z0 >= 0 ? line + step : Math.max(0.5, line - step), mC, c); // ligne voisine, du côté de la projection
  const slope = Math.abs(z0 - zn) / step || 1;
  const proj = line + clip(z0 / slope, -1.5 * step, 1.5 * step);
  return { line, pPlus: sig(z0), proj: Math.max(0, Math.round(proj * 10) / 10) };
}

// La meilleure ligne d'un joueur parmi ses stats, dans la fourchette de confiance du modèle (ni trop facile, ni pile ou face)
// Joueur assez installé pour que le modèle ait du sens (même filtre que l'étude)
export const eligible = (M, mins, c) => !(mins.length < 15 || c.rest > 12 || mean(mins.slice(-5)) < M.minT || mean(mins.slice(-20)) < M.minT20);

export function bestOf(M, statVals, mins, c) {
  if (!eligible(M, mins, c)) return null;
  let best = null;
  for (const [stat, v] of Object.entries(statVals)) {
    const e = evalStat(M, v, mins, M.minLine[stat], { ...c, oppr: c.oppr?.[stat] });
    if (!e) continue;
    const side = e.pPlus >= 0.5 ? 'plus' : 'moins', p = Math.max(e.pPlus, 1 - e.pPlus);
    if (p > M.hi || p < (side === 'plus' ? M.loPlus : M.lo)) continue;
    if (!best || p > best.p) {
      const hit = (a) => a.filter((x) => (side === 'plus' ? x > e.line : x < e.line)).length;
      best = { stat, line: e.line, threshold: e.line, side, p, proj: e.proj, vals: v.slice(-10), avg10: mean(v.slice(-10)), l5: hit(v.slice(-5)), n5: Math.min(5, v.length), l10: hit(v.slice(-10)), n10: Math.min(10, v.length), l20: hit(v.slice(-20)), n20: Math.min(20, v.length) };
    }
  }
  return best;
}

// Toutes les lignes d'un joueur (fiche joueur, page match) : même calcul, sans le filtre de confiance
export function allOf(M, statVals, mins, c) {
  if (!eligible(M, mins, c)) return [];
  const out = [];
  for (const [stat, v] of Object.entries(statVals)) {
    const e = evalStat(M, v, mins, M.minLine[stat], { ...c, oppr: c.oppr?.[stat] });
    if (!e) continue;
    const side = e.pPlus >= 0.5 ? 'plus' : 'moins', hit = (a) => a.filter((x) => (side === 'plus' ? x > e.line : x < e.line)).length;
    out.push({ stat, line: e.line, threshold: e.line, side, p: Math.max(e.pPlus, 1 - e.pPlus), proj: e.proj, vals: v.slice(-10), avg10: mean(v.slice(-10)), l5: hit(v.slice(-5)), n5: Math.min(5, v.length), l10: hit(v.slice(-10)), n10: Math.min(10, v.length), l20: hit(v.slice(-20)), n20: Math.min(20, v.length) });
  }
  return out;
}

// Sélection du soir : un joueur = une ligne, la moitié de « Plus » quand c'est possible, pas plus de maxStat lignes par stat
export function chooseNight(cands, n, maxStat) {
  const c = [...cands].sort((a, b) => b.p - a.p), keep = [], k = {};
  const take = (pool, limit) => { for (const r of pool) { if (keep.length >= limit) break; if (keep.includes(r) || (k[r.stat] || 0) >= maxStat) continue; keep.push(r); k[r.stat] = (k[r.stat] || 0) + 1; } };
  take(c.filter((r) => r.side === 'plus'), Math.ceil(n / 2)); take(c, n);
  return keep.sort((a, b) => b.p - a.p);
}

// Défense adverse : ce que chaque équipe concède par match sur ses 15 derniers matchs, rapporté à la moyenne de la ligue
function oppRatios(rows, stats) {
  const out = {};
  for (const [stat, val] of Object.entries(stats)) {
    const lg = rows.length >= 100 ? mean(rows.slice(0, 450).map(val)) : 0, by = new Map();
    for (const r of rows) { const a = by.get(r.def) || []; if (a.length < 15) { a.push(val(r)); by.set(r.def, a); } }
    out[stat] = {};
    if (lg) for (const [def, a] of by) if (a.length >= 8) out[stat][def] = mean(a) / lg;
  }
  return out;
}
const days = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const notStarted = (r) => !r.start_utc || new Date(r.start_utc).getTime() > Date.now() + 20 * 6e4;

const NBA_KEYS = ['pts', 'reb', 'ast', 'tpm', 'pra', 'pr', 'pa', 'ra'];
export async function nbaLines(day, { limit = 12, maxStat = 3, future = false, refs = false, board = false } = {}) {
  if (!day) return [];
  const M = MODELS.nba;
  let pool = await sql.query(
    `SELECT pl.id AS player_id, g.id AS game_id, pl.name, pl.slug, t.tricode AS team, o.tricode AS opp, o.id AS opp_id, (g.home_team_id = pl.team_id) AS home, g.start_utc
     FROM games g JOIN players pl ON pl.team_id IN (g.home_team_id, g.away_team_id)
     JOIN teams t ON t.id = pl.team_id JOIN teams o ON o.id = CASE WHEN g.home_team_id = pl.team_id THEN g.away_team_id ELSE g.home_team_id END
     WHERE g.game_date = $1 AND g.game_type IS DISTINCT FROM 'pre' AND NOT EXISTS (SELECT 1 FROM injuries i WHERE i.player_id = pl.id)
       AND NOT EXISTS (SELECT 1 FROM lineups l WHERE l.slug = pl.slug AND l.pct <= 50)`, [day]);
  if (future) pool = pool.filter(notStarted);
  if (!pool.length) return [];
  const ids = pool.map((r) => r.player_id);
  // « joue vraiment » : présent dans au moins 3 des 5 derniers matchs de son équipe
  const ok = new Set((await sql.query(`SELECT p.id AS pid FROM players p WHERE p.id = ANY($1) AND (SELECT count(*) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND g2.game_date < $2 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 5) tg
      JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes > 0) >= 3`, [ids, day])).map((r) => r.pid));
  const [hist, def] = await Promise.all([
    sql.query(`SELECT pg.player_id, g.game_date::text AS d, pg.minutes, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk FROM player_games pg JOIN games g ON g.id = pg.game_id
     WHERE pg.player_id = ANY($1) AND pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' AND g.game_date < $2 ORDER BY pg.player_id, g.game_date, g.id`, [ids, day]),
    sql.query(`SELECT pg.opp_team_id AS def, sum(pg.pts)::int AS pts, sum(pg.reb)::int AS reb, sum(pg.ast)::int AS ast, sum(pg.tpm)::int AS tpm FROM player_games pg JOIN games g ON g.id = pg.game_id
     WHERE pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' AND g.game_date < $1 GROUP BY pg.opp_team_id, g.game_date, g.id ORDER BY g.game_date DESC, g.id DESC LIMIT 1500`, [day]),
  ]);
  const opp = oppRatios(def, Object.fromEntries(NBA_KEYS.map((k) => [k, STATS[k].val])));
  const by = new Map();
  for (const h of hist) { if (!by.has(h.player_id)) by.set(h.player_id, []); by.get(h.player_id).push(h); }
  const cands = []; cands.refs = [];
  for (const r of pool) {
    const gs = by.get(r.player_id);
    if (!gs || !ok.has(r.player_id)) continue;
    const sv = Object.fromEntries(NBA_KEYS.map((k) => [k, gs.map(STATS[k].val)])), mins = gs.map((g) => +g.minutes),
      c = { home: r.home, rest: days(day, gs[gs.length - 1].d), oppr: Object.fromEntries(NBA_KEYS.map((k) => [k, opp[k][r.opp_id]])) };
    if (board) { const all = allOf(M, sv, mins, c); if (all.length) cands.push({ ...r, lines: all, best: bestOf(M, sv, mins, c) }); continue; }
    const b = bestOf(M, sv, mins, c);
    if (b) cands.push({ ...r, ...b });
    if (refs && gs.length >= 15) { const v = gs.map(STATS.pts.val); cands.refs.push({ ...r, stat: 'pts', line: refLine(v), avg10: mean(v.slice(-10)) }); }
  }
  return board ? cands : refs ? cands.refs : chooseNight(cands, limit, maxStat);
}

// NHL : tirs cadrés
export async function nhlLines(day, { limit = 10, future = false, refs = false, board = false } = {}) {
  if (!day) return [];
  const M = MODELS.nhl;
  let pool = await sql.query(
    `SELECT p.id AS player_id, g.id AS game_id, p.name, p.slug, p.team, CASE WHEN p.team = g.home THEN g.away ELSE g.home END AS opp, (p.team = g.home) AS home, g.start_utc
     FROM nhl_games g JOIN nhl_players p ON p.team IN (g.home, g.away)
     WHERE g.game_date = $1 AND g.game_type IN (2, 3) AND p.on_roster AND p.position <> 'G' AND NOT EXISTS (SELECT 1 FROM nhl_injuries i WHERE i.player_id = p.id)`, [day]);
  if (future) pool = pool.filter(notStarted);
  if (!pool.length) return [];
  const ids = pool.map((r) => r.player_id);
  const [hist, def] = await Promise.all([
    sql.query(`SELECT player_id, game_date::text AS d, toi, sog FROM nhl_player_games WHERE player_id = ANY($1) AND game_type IN (2, 3) AND toi > 0 AND game_date < $2 ORDER BY player_id, game_date, game_id`, [ids, day]),
    sql.query(`SELECT opp AS def, sum(sog)::int AS sog FROM nhl_player_games WHERE game_type IN (2, 3) AND toi > 0 AND game_date < $1 GROUP BY opp, game_date, game_id ORDER BY game_date DESC, game_id DESC LIMIT 1500`, [day]),
  ]);
  const opp = oppRatios(def, { sog: (r) => r.sog });
  const by = new Map();
  for (const h of hist) { if (!by.has(h.player_id)) by.set(h.player_id, []); by.get(h.player_id).push(h); }
  const cands = []; cands.refs = [];
  for (const r of pool) {
    const gs = by.get(r.player_id);
    if (!gs) continue;
    const sv = { sog: gs.map((g) => +g.sog || 0) }, mins = gs.map((g) => g.toi / 60), c = { home: r.home, rest: days(day, gs[gs.length - 1].d), oppr: { sog: opp.sog[r.opp] } };
    if (board) { const all = allOf(M, sv, mins, c); if (all.length) cands.push({ ...r, lines: all, best: bestOf(M, sv, mins, c) }); continue; }
    const b = bestOf(M, sv, mins, c);
    if (b) cands.push({ ...r, ...b });
    if (refs && gs.length >= 15) { const v = gs.map((g) => +g.sog || 0); cands.refs.push({ ...r, stat: 'sog', line: refLine(v), avg10: mean(v.slice(-10)) }); }
  }
  return board ? cands : refs ? cands.refs : chooseNight(cands, limit, limit);
}

// Tableau du soir : toutes les lignes de tous les joueurs d'une journée, gardé 10 min en mémoire (fiches joueur et pages match)
const BOARD = new Map();
export function nightBoard(league, day) {
  if (!day) return Promise.resolve([]);
  const key = league + '|' + day, hit = BOARD.get(key);
  if (hit && Date.now() - hit.t < 10 * 6e4) return hit.p;
  const p = (league === 'nhl' ? nhlLines(day, { board: true }) : nbaLines(day, { board: true })).catch((e) => { BOARD.delete(key); throw e; });
  BOARD.set(key, { t: Date.now(), p });
  if (BOARD.size > 8) BOARD.delete(BOARD.keys().next().value);
  return p;
}
// Ligne mise en avant pour un joueur : celle du modèle si elle existe, sinon la stat principale (points / tirs cadrés), sinon la plus nette
export const headLine = (e) => e.best || e.lines.find((l) => l.stat === 'pts' || l.stat === 'sog') || [...e.lines].sort((a, b) => b.p - a.p)[0];

// ---------- libellés ----------
const NAMES = { pts: 'points', reb: 'rebonds', ast: 'passes', tpm: 'tirs à 3 pts', pra: 'pts + reb + pas', pr: 'pts + reb', pa: 'pts + pas', ra: 'reb + pas', sog: 'tirs cadrés' };
export const fr1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const SING = { pts: 'point', reb: 'rebond', ast: 'passe', tpm: 'tir à 3 pts', sog: 'tir cadré' };
// n : la valeur qui précède le mot ; en français le pluriel ne commence qu'à 2 (« 1,5 tir cadré »)
export const statName = (stat, n) => (n != null && Math.abs(n) < 2 && SING[stat]) || NAMES[stat] || stat;
export const lineText = (r) => `${r.side === 'moins' ? 'Moins' : 'Plus'} de ${fr1(r.line ?? r.threshold)} ${statName(r.stat, r.line ?? r.threshold)}`;
export const won = (side, value, line) => (side === 'moins' ? value < Number(line) : value >= Number(line)); // ligne au demi-point : jamais d'égalité
export const pct5 = (p) => Math.round(p * 20) * 5;
export { MODELS };
