// Modèle de match-up : score de contexte 0-100 pour chaque série du soir (NBA).
// Informatif : ce n'est ni une probabilité ni un conseil de pari.
import { sql } from './jobs.js';
import { STATS } from './trends.js';

const GRP = { PG: 'G', SG: 'G', G: 'G', 'G-F': 'G', SF: 'F', PF: 'F', F: 'F', 'F-G': 'F', 'F-C': 'F', C: 'C', 'C-F': 'C' };
const POS_FR = { G: 'meneurs et arrières', F: 'ailiers', C: 'pivots' };
const clip = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const W = { forme: 0.3, def: 0.2, min: 0.15, pace: 0.1, abs: 0.1, h2h: 0.05, loc: 0.05, rest: 0.05 };

export async function ensureMatchupTable() {
  await sql.query(`CREATE TABLE IF NOT EXISTS matchups (day date, player_id int, stat text, score int, dvp_rank int, dvp_grp text, pace numeric, min_proj numeric, b2b boolean, reasons jsonb, PRIMARY KEY (day, player_id, stat))`);
}

export async function buildMatchups(day) {
  await ensureMatchupTable();
  const tr = await sql.query(`SELECT tr.player_id, tr.stat, tr.threshold, tr.l5, tr.n5, tr.l10, tr.n10, tr.l20, tr.n20, tr.h2h, tr.nh2h, tr.opp_team_id, tr.game_id,
      pl.team_id, pl.position, g.home_team_id, o.tricode AS opp
    FROM trends tr JOIN players pl ON pl.id = tr.player_id JOIN games g ON g.id = tr.game_id LEFT JOIN teams o ON o.id = tr.opp_team_id WHERE tr.day = $1`, [day]);
  if (!tr.length) return { n: 0 };
  const rows = await sql.query(`SELECT pg.game_id, pg.player_id, pg.team_id, pg.opp_team_id, pg.game_date::text AS d, pg.minutes::float AS min, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk, pg.tov, pg.fga, pg.fta,
      pl.position, gg.home_team_id
    FROM player_games pg JOIN players pl ON pl.id = pg.player_id JOIN games gg ON gg.id = pg.game_id
    WHERE pg.game_type IN ('reg','po','cup','playin') AND pg.minutes > 0 AND pg.game_date >= $1::date - 400 AND pg.game_date < $1::date`, [day]);
  const [yest, outs] = await Promise.all([
    sql.query(`SELECT home_team_id, away_team_id FROM games WHERE game_date = $1::date - 1`, [day]),
    sql.query(`SELECT i.player_id, i.player_name, p.team_id FROM injuries i JOIN players p ON p.id = i.player_id WHERE i.status = 'Out'`),
  ]);
  const b2bTeams = new Set(yest.flatMap((g) => [g.home_team_id, g.away_team_id]));

  // matchs par équipe (les 15 derniers) pour la défense, les 10 derniers pour le rythme
  const gameDate = new Map(), gameTeams = new Map();
  for (const r of rows) { gameDate.set(r.game_id, r.d); if (!gameTeams.has(r.game_id)) gameTeams.set(r.game_id, new Set()); gameTeams.get(r.game_id).add(r.team_id); }
  const teamGames = new Map();
  for (const [gid, ts] of gameTeams) for (const t of ts) { if (!teamGames.has(t)) teamGames.set(t, []); teamGames.get(t).push(gid); }
  for (const [t, a] of teamGames) a.sort((x, y) => (gameDate.get(y) > gameDate.get(x) ? 1 : -1));
  const recent = (t, n) => new Set((teamGames.get(t) || []).slice(0, n));

  // rythme : possessions estimées par match
  const poss = new Map();
  for (const r of rows) poss.set(r.game_id, (poss.get(r.game_id) || 0) + (r.fga + 0.44 * r.fta + r.tov));
  const gamePoss = (gid) => (poss.get(gid) || 0) / 2;
  const pace = new Map();
  for (const [t, a] of teamGames) pace.set(t, avg(a.slice(0, 10).map(gamePoss)));
  const lgPace = avg([...pace.values()]);

  // défense par poste : stat par 36 min concédée aux joueurs d'un poste, sur les 15 derniers matchs de l'équipe
  const dvpCache = new Map();
  const dvp = (stat, grp) => {
    const key = stat + grp;
    if (dvpCache.has(key)) return dvpCache.get(key);
    const val = STATS[stat].val, byTeam = new Map();
    const rec = new Map([...teamGames.keys()].map((t) => [t, recent(t, 15)]));
    for (const r of rows) {
      if (r.min < 12 || GRP[r.position] !== grp || !rec.get(r.opp_team_id)?.has(r.game_id)) continue;
      if (!byTeam.has(r.opp_team_id)) byTeam.set(r.opp_team_id, []);
      byTeam.get(r.opp_team_id).push((val(r) / r.min) * 36);
    }
    const list = [...byTeam].filter(([, a]) => a.length >= 8).map(([t, a]) => [t, avg(a)]).sort((a, b) => b[1] - a[1]);
    const m = new Map(list.map(([t], i) => [t, { rank: i + 1, of: list.length }]));
    dvpCache.set(key, m);
    return m;
  };

  const byPlayer = new Map();
  for (const r of rows) { if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []); byPlayer.get(r.player_id).push(r); }
  for (const a of byPlayer.values()) a.sort((x, y) => (y.d > x.d ? 1 : -1));
  const min10 = (pid) => avg((byPlayer.get(pid) || []).slice(0, 10).map((r) => r.min));

  const out = [];
  for (const t of tr) {
    const games = byPlayer.get(t.player_id) || [];
    if (games.length < 5) continue;
    const val = STATS[t.stat].val, reasons = [];
    const grp = GRP[t.position] || null;
    const hr = 0.5 * (t.l5 / Math.max(1, t.n5)) + 0.3 * (t.l10 / Math.max(1, t.n10)) + 0.2 * (t.l20 / Math.max(1, t.n20));
    // défense
    let xDef = 0.5, rank = null;
    if (grp) { const d = dvp(t.stat, grp).get(t.opp_team_id); if (d) { rank = d.rank; xDef = (d.of - d.rank) / (d.of - 1); } }
    if (rank && rank <= 10) reasons.push({ t: `${t.opp} défend mal contre les ${POS_FR[grp]} (${rank}e défense la plus permissive sur ${dvp(t.stat, grp).get(t.opp_team_id).of})`, s: 1, w: W.def * (xDef - 0.5) });
    else if (rank && rank >= 21) reasons.push({ t: `${t.opp} défend bien contre les ${POS_FR[grp]} (${dvp(t.stat, grp).get(t.opp_team_id).of - rank + 1}e meilleure défense sur ${dvp(t.stat, grp).get(t.opp_team_id).of})`, s: -1, w: W.def * (xDef - 0.5) });
    // minutes
    const L5 = avg(games.slice(0, 5).map((r) => r.min)), L10 = avg(games.slice(0, 10).map((r) => r.min)), L20 = avg(games.slice(0, 20).map((r) => r.min));
    let freed = 0; const names = [];
    for (const o of outs) if (o.team_id === t.team_id && o.player_id !== t.player_id) { const m = min10(o.player_id); if (m >= 18) { const share = GRP[(byPlayer.get(o.player_id)?.[0] || {}).position] === grp ? 0.5 : 0.2; freed += m * share; names.push([m, o.player_name]); } }
    freed = Math.min(freed, 10);
    const minProj = 0.6 * L5 + 0.4 * L10 + freed * 0.3, ratio = L20 ? minProj / L20 : 1;
    const xMin = clip((ratio - 0.8) / 0.4);
    if (freed >= 4) reasons.push({ t: `Plus de minutes possibles (absence de ${names.sort((a, b) => b[0] - a[0]).slice(0, 2).map((n) => n[1]).join(', ')})`, s: 1, w: W.min * (xMin - 0.5) + 0.04 });
    else if (ratio >= 1.08) reasons.push({ t: `Minutes en hausse (${Math.round(minProj)} min attendues)`, s: 1, w: W.min * (xMin - 0.5) });
    else if (ratio <= 0.92) reasons.push({ t: `Minutes en baisse (${Math.round(minProj)} min attendues)`, s: -1, w: W.min * (xMin - 0.5) });
    const xAbs = 0.3 + 0.7 * clip(freed / 8);
    // rythme
    const pA = pace.get(t.team_id), pB = pace.get(t.opp_team_id);
    const fPace = pA && pB && lgPace ? (pA + pB) / 2 / lgPace : 1, xPace = clip((fPace - 0.94) / 0.12);
    if (fPace >= 1.03) reasons.push({ t: 'Match à rythme rapide', s: 1, w: W.pace * (xPace - 0.5) });
    else if (fPace <= 0.97) reasons.push({ t: 'Match à rythme lent', s: -1, w: W.pace * (xPace - 0.5) });
    // domicile / extérieur
    const home = t.home_team_id === t.team_id;
    const same = games.filter((r) => (r.home_team_id === r.team_id) === home).slice(0, 30), other = games.filter((r) => (r.home_team_id === r.team_id) !== home).slice(0, 30);
    const sh = same.filter((r) => val(r) >= t.threshold).length, oh = other.filter((r) => val(r) >= t.threshold).length;
    const xLoc = (sh + 3 * hr) / (same.length + 3);
    if (same.length >= 6 && other.length >= 6 && Math.abs(sh / same.length - oh / other.length) >= 0.2)
      reasons.push({ t: `${home ? 'À domicile' : 'À l\'extérieur'} : ${sh}/${same.length} (contre ${oh}/${other.length} ${home ? 'à l\'extérieur' : 'à domicile'})`, s: sh / same.length > oh / other.length ? 1 : -1, w: W.loc * (xLoc - 0.5) });
    // face à face
    const xH2h = (t.h2h + 3 * hr) / (t.nh2h + 3);
    if (t.nh2h >= 2) reasons.push({ t: `Face à ${t.opp} : ${t.h2h}/${t.nh2h}`, s: t.h2h / t.nh2h >= 0.5 ? 1 : -1, w: W.h2h * (xH2h - 0.5) });
    // repos
    const b2b = b2bTeams.has(t.team_id), xRest = b2b ? (home ? 0.5 : 0.3) : 1;
    if (b2b) reasons.push({ t: '2e soir de back-to-back', s: -1, w: W.rest * (xRest - 1) });
    if (t.l10 >= 9) reasons.push({ t: `Série solide : ${t.l10}/${t.n10} sur ses 10 derniers`, s: 1, w: W.forme * (hr - 0.5) });
    const score = Math.round(100 * (W.forme * hr + W.def * xDef + W.min * xMin + W.pace * xPace + W.abs * xAbs + W.h2h * xH2h + W.loc * xLoc + W.rest * xRest));
    reasons.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
    out.push([day, t.player_id, t.stat, score, rank, grp, Math.round(fPace * 1000) / 1000, Math.round(minProj * 10) / 10, b2b, JSON.stringify(reasons.slice(0, 3).map(({ t, s }) => ({ t, s })))]);
  }
  await sql.query(`DELETE FROM matchups WHERE day = $1`, [day]);
  for (let i = 0; i < out.length; i += 100) {
    const ch = out.slice(i, i + 100), ph = ch.map((_, k) => `(${Array.from({ length: 10 }, (_, j) => `$${k * 10 + j + 1}`).join(',')})`).join(',');
    await sql.query(`INSERT INTO matchups (day, player_id, stat, score, dvp_rank, dvp_grp, pace, min_proj, b2b, reasons) VALUES ${ph} ON CONFLICT DO NOTHING`, ch.flat());
  }
  return { n: out.length };
}
