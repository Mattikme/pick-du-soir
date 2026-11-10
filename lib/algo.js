// Algorithme Pick du Soir : probabilité qu'une série (joueur, stat, palier) se réalise ce soir.
// Même calcul que l'étude sur l'historique : formes 3/5/10/20 matchs, moyennes vs palier, régularité, minutes, domicile.
import { sql } from './jobs.js';
import { STATS } from './trends.js';
import MODEL from './algo-model.js';

const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd0 = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const hit = (a, t) => (a.length ? a.filter((v) => v >= t).length / a.length : 0);

// Probabilité (0..1) d'une série à partir de l'historique (valeurs et minutes, du plus ancien au plus récent)
export function algoProb(v, mins, t, home) {
  const l5 = v.slice(-5), l10 = v.slice(-10), l20 = v.slice(-20), p3 = v.slice(-3);
  const m5 = mean(l5) / t, m10 = mean(l10) / t, m20 = mean(l20) / t, mall = mean(v) / t;
  const min5 = mean(mins.slice(-5)), min20 = mean(mins.slice(-20));
  const f = {
    h5: hit(l5, t), h10: hit(l10, t), h20: hit(l20, t),
    m5: clip(m5, 0, 3), m10: clip(m10, 0, 3), m20: clip(m20, 0, 3), mall: clip(mall, 0, 3),
    sd10: clip(sd0(l10) / t, 0, 3), minr: min20 ? clip(min5 / min20, 0, 3) : 1, min20,
    home: home ? 1 : 0, h3: hit(p3, t), last: clip(v[v.length - 1] / t, 0, 3),
  };
  let z = MODEL.intercept;
  MODEL.feats.forEach((k, i) => { z += MODEL.coef[i] * ((f[k] - MODEL.mu[i]) / MODEL.sd[i]); });
  const p = 1 / (1 + Math.exp(-(MODEL.platt[0] * z + MODEL.platt[1])));
  return { p, m10, h10: f.h10 };
}

// Les meilleures séries du soir (un joueur = une série), par probabilité décroissante
export async function algoRows(day, { limit = 12, future = false } = {}) {
  if (!day) return [];
  const pool = await sql.query(
    `SELECT DISTINCT ON (tr.player_id) tr.player_id, tr.game_id, pl.name, pl.slug, t.tricode AS team, o.tricode AS opp, (g.home_team_id = pl.team_id) AS home, g.start_utc
     FROM trends tr JOIN players pl ON pl.id = tr.player_id JOIN games g ON g.id = tr.game_id
     LEFT JOIN teams t ON t.id = pl.team_id LEFT JOIN teams o ON o.id = tr.opp_team_id LEFT JOIN injuries i ON i.player_id = tr.player_id
     WHERE tr.day = $1 AND i.status IS NULL AND g.game_type IS DISTINCT FROM 'pre' AND NOT EXISTS (SELECT 1 FROM lineups l WHERE l.slug = pl.slug AND l.pct <= 50)
     ORDER BY tr.player_id`, [day]);
  if (!pool.length) return [];
  const ids = pool.map((r) => r.player_id);
  // « joue vraiment » : au moins 3 des 5 derniers matchs de l'équipe et 18 min de moyenne
  const ok = new Set((await sql.query(`SELECT p.id AS pid FROM players p WHERE p.id = ANY($1) AND (SELECT count(*) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 5) tg
      JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes > 0) >= 3
      AND (SELECT avg(px.minutes) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 5) tg JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes > 0) >= 18`, [ids])).map((r) => r.pid));
  const hist = await sql.query(
    `SELECT pg.player_id, pg.minutes, pg.pts, pg.reb, pg.ast, pg.stl, pg.blk, pg.tpm FROM player_games pg JOIN games g ON g.id = pg.game_id
     WHERE pg.player_id = ANY($1) AND pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' AND g.game_date < $2 ORDER BY pg.player_id, g.game_date, g.id`, [ids, day]);
  const by = new Map();
  for (const h of hist) { if (!by.has(h.player_id)) by.set(h.player_id, []); by.get(h.player_id).push(h); }
  const out = [];
  for (const r of pool) {
    if (!ok.has(r.player_id)) continue;
    if (future && r.start_utc && new Date(r.start_utc).getTime() < Date.now() + 20 * 6e4) continue;
    const gs = by.get(r.player_id) || [];
    if (gs.length < 20) continue;
    const mins = gs.map((g) => +g.minutes);
    let best = null;
    for (const [stat, def] of Object.entries(STATS)) {
      const v = gs.map((g) => def.val(g));
      for (const t of def.ladder) {
        const l10 = v.slice(-10).filter((x) => x >= t).length;
        if (l10 < 7) continue;
        const { p, m10 } = algoProb(v, mins, t, r.home);
        if (m10 > MODEL.maxm) continue; // seuils trop faciles écartés
        if (!best || p > best.p || (p === best.p && t > best.threshold)) {
          let streak = 0; for (let k = v.length - 1; k >= 0 && v[k] >= t; k--) streak++;
          best = { ...r, stat, threshold: t, p, l5: v.slice(-5).filter((x) => x >= t).length, n5: 5, l10, n10: 10, l20: v.slice(-20).filter((x) => x >= t).length, n20: 20, streak, avg10: mean(v.slice(-10)), vals: v.slice(-10) };
        }
      }
    }
    if (best) out.push(best);
  }
  out.sort((a, b) => b.p - a.p);
  return out.slice(0, limit);
}

export const pct5 = (p) => Math.round(p * 20) * 5;

// Suivi public : séries de l'algo publiées (table algo_picks) comparées aux résultats réels
export async function algoTrack() {
  await sql.query(`CREATE TABLE IF NOT EXISTS algo_picks (day date, rank int, pid int, name text, stat text, thr numeric, p numeric, gid text, PRIMARY KEY (day, pid))`);
  const rows = await sql.query(`SELECT day::text AS day, pid, name, stat, thr, p, gid FROM algo_picks ORDER BY day DESC, rank`);
  let ok = 0, n = 0; const days = new Map();
  for (const r of rows) {
    const [g] = await sql.query(`SELECT pts, reb, ast, tpm, stl, blk FROM player_games WHERE game_id = $1 AND player_id = $2 AND minutes > 0`, [r.gid, r.pid]);
    if (!g) continue;
    const v = STATS[r.stat].val(g), won = v >= Number(r.thr); n++; if (won) ok++;
    if (!days.has(r.day)) days.set(r.day, { ok: 0, n: 0 }); const d = days.get(r.day); d.n++; if (won) d.ok++;
  }
  return { ok, n, days: [...days.entries()].map(([day, v]) => ({ day, ...v })) };
}

export const algoLine = (stat, t) => (['pra', 'pr', 'pa', 'ra'].includes(stat) ? `${t}+ ${STATS[stat].short.replace(/\+/g, ' + ')}` : `${t}+ ${STATS[stat].label}`);
