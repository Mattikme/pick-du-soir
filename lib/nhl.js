// NHL : données (API publique api-web.nhle.com + blessures ESPN) et calcul des séries buts / passes / points
import { createSql } from './db.js';
import { getJson, pool } from './nba.js';
import { slugify, usDate } from './ttfl.js';

const sql = createSql(process.env.DATABASE_URL);
const API = 'https://api-web.nhle.com/v1';
const NHL_INJURIES_URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';

// abréviation -> [ville, nom, couleur principale, couleur secondaire]
export const NHL_TEAMS = {
  ANA: ['Anaheim', 'Ducks', '#F47A38', '#B9975B'], BOS: ['Boston', 'Bruins', '#2B2B2B', '#FFB81C'],
  BUF: ['Buffalo', 'Sabres', '#003087', '#FFB81C'], CGY: ['Calgary', 'Flames', '#C8102E', '#F1BE48'],
  CAR: ['Carolina', 'Hurricanes', '#CE1126', '#A2AAAD'], CHI: ['Chicago', 'Blackhawks', '#CF0A2C', '#FFD100'],
  COL: ['Colorado', 'Avalanche', '#6F263D', '#6CACE4'], CBJ: ['Columbus', 'Blue Jackets', '#002654', '#CE1126'],
  DAL: ['Dallas', 'Stars', '#006847', '#A8B2B5'], DET: ['Detroit', 'Red Wings', '#CE1126', '#FFFFFF'],
  EDM: ['Edmonton', 'Oilers', '#041E42', '#FF4C00'], FLA: ['Florida', 'Panthers', '#041E42', '#C8102E'],
  LAK: ['Los Angeles', 'Kings', '#1A1A1A', '#A2AAAD'], MIN: ['Minnesota', 'Wild', '#154734', '#DDCBA4'],
  MTL: ['Montréal', 'Canadiens', '#AF1E2D', '#4A6FD1'], NSH: ['Nashville', 'Predators', '#041E42', '#FFB81C'],
  NJD: ['New Jersey', 'Devils', '#CE1126', '#FFFFFF'], NYI: ['New York', 'Islanders', '#00539B', '#F47D30'],
  NYR: ['New York', 'Rangers', '#0038A8', '#CE1126'], OTT: ['Ottawa', 'Senators', '#C52032', '#C2912C'],
  PHI: ['Philadelphia', 'Flyers', '#F74902', '#FFFFFF'], PIT: ['Pittsburgh', 'Penguins', '#1A1A1A', '#FCB514'],
  SJS: ['San Jose', 'Sharks', '#006D75', '#EA7200'], SEA: ['Seattle', 'Kraken', '#001628', '#99D9D9'],
  STL: ['St. Louis', 'Blues', '#002F87', '#FCB514'], TBL: ['Tampa Bay', 'Lightning', '#002868', '#FFFFFF'],
  TOR: ['Toronto', 'Maple Leafs', '#00205B', '#FFFFFF'], UTA: ['Utah', 'Mammoth', '#0B162A', '#6CACE4'],
  VAN: ['Vancouver', 'Canucks', '#00205B', '#00843D'], VGK: ['Vegas', 'Golden Knights', '#333F42', '#B4975A'],
  WSH: ['Washington', 'Capitals', '#041E42', '#C8102E'], WPG: ['Winnipeg', 'Jets', '#041E42', '#AC162C'],
};

// Séries NHL : paliers simples, critère adapté (un but par match est déjà rare)
export const NHL_STATS = {
  g: { label: 'but', plural: 'buts', short: 'but', ladder: [1, 2], min: 0.5, bonus: 0.12, val: (x) => x.goals },
  a: { label: 'passe décisive', plural: 'passes décisives', short: 'passe', ladder: [1, 2], min: 0.6, bonus: 0.05, val: (x) => x.assists },
  p: { label: 'point', plural: 'points', short: 'point', ladder: [1, 2, 3], min: 0.7, bonus: 0, val: (x) => x.points },
};
export const nhlLine = (stat, t) => { const s = NHL_STATS[stat]; return `${t}+ ${t > 1 ? s.plural : s.label}`; };

export function nhlLadder(games, statKey, opp, custom) {
  const st = NHL_STATS[statKey];
  const recent = games.filter((g) => !g.rn || Number(g.rn) <= 20);
  const v = recent.map(st.val);
  const vs = games.filter((g) => opp && g.opp === opp).slice(0, 6).map(st.val);
  const rate = (arr, t) => [arr.filter((x) => x >= t).length, arr.length];
  return (custom || st.ladder).map((t) => {
    let streak = 0;
    for (const x of v) { if (x >= t) streak++; else break; }
    const [l5, n5] = rate(v.slice(0, 5), t), [l10, n10] = rate(v.slice(0, 10), t), [l20, n20] = rate(v.slice(0, 20), t), [h2h, nh2h] = rate(vs, t);
    return { threshold: t, l5, n5, l10, n10, l20, n20, h2h, nh2h, streak };
  });
}

// Palier le plus haut tenu assez souvent sur 10 matchs (seuil propre à chaque stat)
export function nhlBestLine(games, statKey, opp, strict = true) {
  const st = NHL_STATS[statKey];
  let lad = nhlLadder(games, statKey, opp);
  if (strict) {
    // ligne de référence : 0,5 pour la plupart des joueurs, 1,5 pour ceux qui dépassent ~1 par match
    const v = games.filter((g) => !g.rn || Number(g.rn) <= 40).map(st.val);
    if (v.length < 10) return null;
    const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const e = 0.6 * m(v) + 0.4 * m(v.slice(0, 10));
    const t = statKey === 'g' ? (e >= 1.1 ? 2 : 1) : (e >= 0.95 ? 2 : 1);
    lad = nhlLadder(games, statKey, opp, [t]);
  }
  for (const r of lad.slice().reverse()) {
    if (r.n10 < (strict ? 10 : 1)) continue;
    const r10 = r.l10 / r.n10, r5 = r.l5 / Math.max(1, r.n5), r20 = r.l20 / Math.max(1, r.n20);
    // fiche joueur : le palier le plus haut tenu au moins une fois sur deux, sinon le premier palier
    if (strict ? (r10 < st.min || r5 < st.min) : (r10 < 0.5 && r.threshold > st.ladder[0])) continue;
    const score = 0.45 * r10 + 0.25 * r5 + 0.3 * r20 + st.bonus + (r.threshold - 1) * 0.15 + Math.min(r.streak, 10) * 0.004;
    return { ...r, score: Math.round(score * 1000) / 1000 };
  }
  return null;
}

function cols(rows, n) {
  const out = Array.from({ length: n }, () => []);
  for (const r of rows) for (let i = 0; i < n; i++) out[i].push(r[i] ?? null);
  return out;
}
const toiSec = (s) => { if (!s) return 0; const [m, sec] = String(s).split(':').map(Number); return (m || 0) * 60 + (sec || 0); };
const DONE = new Set(['FINAL', 'OFF']);

async function upsertGames(rows) {
  if (!rows.length) return;
  await sql.query(
    `INSERT INTO nhl_games (id, season, game_type, game_date, start_utc, home, away, state, home_score, away_score)
     SELECT * FROM unnest($1::bigint[], $2::int[], $3::int[], $4::date[], $5::timestamptz[], $6::text[], $7::text[], $8::text[], $9::int[], $10::int[])
     ON CONFLICT (id) DO UPDATE SET game_date = EXCLUDED.game_date, start_utc = EXCLUDED.start_utc, state = EXCLUDED.state,
       home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score, updated_at = now()`, cols(rows, 10));
}

// Calendrier : la semaine passée + les 2 prochaines semaines
export async function nhlSchedule(from) {
  const start = from ? new Date(from + 'T12:00:00Z') : new Date(Date.now() - 7 * 864e5);
  const games = [];
  for (let w = 0; w < (from ? 6 : 3); w++) {
    const d = new Date(start.getTime() + w * 7 * 864e5).toISOString().slice(0, 10);
    const data = await getJson(`${API}/schedule/${d}`);
    for (const day of data?.gameWeek || []) {
      for (const g of day.games || []) {
        if (![1, 2, 3].includes(g.gameType)) continue;
        games.push([g.id, g.season, g.gameType, day.date, g.startTimeUTC, g.homeTeam?.abbrev, g.awayTeam?.abbrev,
          g.gameState, g.homeTeam?.score ?? null, g.awayTeam?.score ?? null]);
      }
    }
  }
  const uniq = [...new Map(games.map((g) => [g[0], g])).values()];
  await upsertGames(uniq);
  return { games: uniq.length };
}

// Feuilles de match -> lignes de stats joueurs
export async function nhlBoxscores(ids) {
  const results = await pool(ids, 8, (id) => getJson(`${API}/gamecenter/${id}/boxscore`));
  const games = [], lines = [], players = new Map();
  let skipped = 0;
  results.forEach((b) => {
    if (!b?.id || !DONE.has(b.gameState) || !b.playerByGameStats) { skipped++; return; }
    const date = b.gameDate;
    const home = b.homeTeam.abbrev, away = b.awayTeam.abbrev;
    games.push([b.id, b.season, b.gameType, date, b.startTimeUTC, home, away, b.gameState, b.homeTeam.score, b.awayTeam.score]);
    for (const [side, team, opp, isHome] of [['homeTeam', home, away, true], ['awayTeam', away, home, false]]) {
      const t = b.playerByGameStats[side] || {};
      for (const grp of ['forwards', 'defense']) {
        for (const p of t[grp] || []) {
          const toi = toiSec(p.toi);
          const prev = players.get(p.playerId);
          if (!prev || prev[6] <= date) players.set(p.playerId, [p.playerId, p.name?.default || String(p.playerId), slugify(p.name?.default || String(p.playerId)), team, p.position || null, p.sweaterNumber ?? null, date]);
          if (!toi) continue;
          lines.push([b.id, p.playerId, team, opp, isHome, date, b.gameType, toi, p.goals ?? 0, p.assists ?? 0, p.points ?? ((p.goals ?? 0) + (p.assists ?? 0)), p.sog ?? p.shots ?? 0]);
        }
      }
    }
  });
  await upsertGames(games);
  const pl = [...players.values()];
  if (pl.length) {
    // Les joueurs inconnus sont créés avec le nom court de la feuille de match ; le nom complet vient des effectifs
    await sql.query(
      `INSERT INTO nhl_players (id, name, slug, team, position, number, last_game_date)
       SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::date[])
       ON CONFLICT (id) DO UPDATE SET
         team = CASE WHEN nhl_players.on_roster THEN nhl_players.team WHEN nhl_players.last_game_date IS NULL OR EXCLUDED.last_game_date >= nhl_players.last_game_date THEN EXCLUDED.team ELSE nhl_players.team END,
         number = COALESCE(nhl_players.number, EXCLUDED.number),
         last_game_date = GREATEST(nhl_players.last_game_date, EXCLUDED.last_game_date), updated_at = now()`, cols(pl, 7));
  }
  for (let i = 0; i < lines.length; i += 1000) {
    await sql.query(
      `INSERT INTO nhl_player_games (game_id, player_id, team, opp, home, game_date, game_type, toi, goals, assists, points, sog)
       SELECT * FROM unnest($1::bigint[], $2::int[], $3::text[], $4::text[], $5::boolean[], $6::date[], $7::int[], $8::int[], $9::int[], $10::int[], $11::int[], $12::int[])
       ON CONFLICT (game_id, player_id) DO UPDATE SET toi = EXCLUDED.toi, goals = EXCLUDED.goals, assists = EXCLUDED.assists, points = EXCLUDED.points, sog = EXCLUDED.sog`,
      cols(lines.slice(i, i + 1000), 12));
  }
  return { requested: ids.length, games: games.length, skipped, lines: lines.length };
}

export async function nhlPending(limit = 80) {
  const rows = await sql.query(
    `SELECT g.id FROM nhl_games g WHERE g.game_date <= $1 AND g.game_type IN (2, 3)
       AND NOT EXISTS (SELECT 1 FROM nhl_player_games pg WHERE pg.game_id = g.id)
     ORDER BY g.game_date DESC LIMIT $2`, [usDate(), limit]);
  return rows.length ? nhlBoxscores(rows.map((r) => r.id)) : { requested: 0 };
}

// Historique d'une saison régulière (ex. 2025 -> matchs 2025020001…)
export async function nhlBackfill(season, from, to) {
  const ids = [];
  for (let n = from; n <= to; n++) ids.push(Number(`${season}02${String(n).padStart(4, '0')}`));
  return nhlBoxscores(ids);
}

// Effectifs actuels : noms complets, numéros, postes, équipe
export async function nhlRosters() {
  const abbrevs = Object.keys(NHL_TEAMS);
  const res = await pool(abbrevs, 8, (t) => getJson(`${API}/roster/${t}/current`));
  const rows = [];
  res.forEach((r, i) => {
    for (const grp of ['forwards', 'defensemen', 'goalies']) {
      for (const p of r?.[grp] || []) {
        const name = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim();
        rows.push([p.id, name, slugify(name), abbrevs[i], p.positionCode || null, p.sweaterNumber ?? null]);
      }
    }
  });
  if (!rows.length) return { roster: 0 };
  // homonymes (ex. deux Sebastian Aho) : on ajoute l'équipe à l'adresse
  const count = {};
  for (const r of rows) count[r[2]] = (count[r[2]] || 0) + 1;
  for (const r of rows) if (count[r[2]] > 1) r[2] = `${r[2]}-${r[3].toLowerCase()}`;
  await sql.transaction([
    sql.q(`UPDATE nhl_players SET on_roster = false`),
    sql.q(`INSERT INTO nhl_players (id, name, slug, team, position, number, on_roster)
           SELECT a, b, c, d, e, f, true FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[]) AS t(a, b, c, d, e, f)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, team = EXCLUDED.team,
             position = EXCLUDED.position, number = EXCLUDED.number, on_roster = true, updated_at = now()`, cols(rows, 6)),
  ]);
  return { roster: rows.length };
}

export async function nhlInjuries() {
  const data = await getJson(NHL_INJURIES_URL);
  const byName = new Map(Object.entries(NHL_TEAMS).map(([k, v]) => [`${v[0]} ${v[1]}`.replace('Montréal', 'Montreal'), k]));
  const rows = [], seen = new Set();
  for (const team of data?.injuries || []) {
    const tri = byName.get(team.displayName) || team.abbreviation || team.displayName;
    for (const inj of team.injuries || []) {
      const name = inj.athlete?.displayName;
      if (!name || seen.has(name + tri)) continue;
      seen.add(name + tri);
      rows.push([name, tri, inj.status || null, inj.shortComment || inj.longComment || null, slugify(name)]);
    }
  }
  await sql.transaction([
    sql.q('DELETE FROM nhl_injuries'),
    sql.q(`INSERT INTO nhl_injuries (player_name, team, status, detail, player_slug)
           SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`, cols(rows, 5)),
    sql.q(`UPDATE nhl_injuries i SET player_id = p.id FROM nhl_players p
           WHERE p.on_roster AND p.team = i.team AND (p.slug = i.player_slug OR p.slug = i.player_slug || '-' || lower(i.team))`),
  ]);
  return { injuries: rows.length };
}

// Séries du prochain soir de matchs
export async function nhlTrends(date) {
  let day = date || usDate();
  if (!date) {
    // prochain soir dont au moins un match n'a pas encore commencé
    const next = await sql.query(`SELECT min(game_date)::text d FROM nhl_games WHERE game_date >= $1 AND start_utc > now()`, [day]);
    if (next[0]?.d) day = next[0].d;
  }
  const rows = await sql.query(
    `WITH tonight AS (SELECT id AS game_id, home, away FROM nhl_games WHERE game_date = $1),
     roster AS (
       SELECT p.id AS player_id, t.game_id, CASE WHEN p.team = t.home THEN t.away ELSE t.home END AS opp_t
       FROM nhl_players p JOIN tonight t ON p.team IN (t.home, t.away)
       WHERE p.on_roster AND p.position <> 'G'
         AND NOT EXISTS (SELECT 1 FROM nhl_injuries i WHERE i.player_id = p.id AND i.status IN ('Out', 'Injured Reserve', 'Long-Term IR'))),
     g AS (
       SELECT pg.*, row_number() OVER (PARTITION BY pg.player_id ORDER BY pg.game_date DESC) AS rn
       FROM nhl_player_games pg JOIN roster r USING (player_id) WHERE pg.game_type IN (2, 3))
     SELECT r.player_id, r.game_id, r.opp_t, g.rn, g.opp, g.toi, g.goals, g.assists, g.points
     FROM roster r JOIN g USING (player_id) WHERE g.rn <= 20 OR g.opp = r.opp_t ORDER BY r.player_id, g.rn`, [day]);
  const byPlayer = new Map();
  for (const r of rows) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, { game_id: r.game_id, opp: r.opp_t, games: [] });
    byPlayer.get(r.player_id).games.push({ rn: Number(r.rn), opp: r.opp, toi: Number(r.toi), goals: r.goals, assists: r.assists, points: r.points });
  }
  const lines = [];
  for (const [pid, p] of byPlayer) {
    const last10 = p.games.filter((g) => g.rn <= 10);
    if (last10.length < 10) continue;
    if (last10.reduce((s, g) => s + g.toi, 0) / 10 < 600) continue; // moins de 10 min de jeu en moyenne
    for (const key of Object.keys(NHL_STATS)) {
      const b = nhlBestLine(p.games, key, p.opp);
      if (!b) continue;
      const avg10 = last10.reduce((s, g) => s + NHL_STATS[key].val(g), 0) / 10;
      lines.push({ pid, game_id: p.game_id, opp: p.opp, key, avg10: Math.round(avg10 * 100) / 100, ...b });
    }
  }
  lines.sort((a, b) => b.score - a.score || b.threshold - a.threshold);
  const out = lines.map((l, i) => [day, i + 1, l.pid, l.game_id, l.opp, l.key, l.threshold, l.l5, l.n5, l.l10, l.n10, l.l20, l.n20, l.h2h, l.nh2h, l.streak, l.avg10, l.score]);
  await sql.transaction([
    sql.q('DELETE FROM nhl_trends WHERE day = $1', [day]),
    sql.q(`INSERT INTO nhl_trends (day, rank, player_id, game_id, opp, stat, threshold, l5, n5, l10, n10, l20, n20, h2h, nh2h, streak, avg10, score)
           SELECT * FROM unnest($1::date[], $2::int[], $3::int[], $4::bigint[], $5::text[], $6::text[], $7::int[], $8::int[], $9::int[],
             $10::int[], $11::int[], $12::int[], $13::int[], $14::int[], $15::int[], $16::int[], $17::numeric[], $18::numeric[])`, cols(out, 18)),
  ]);
  return { date: day, players: byPlayer.size, trends: out.length };
}

// Amorçage NHL, une étape par appel : saison 2025-26 par tranches, puis 2026-27, effectifs, blessures, séries
export async function nhlBootstrap() {
  const [{ last }] = await sql.query(`SELECT coalesce(max(id % 10000), 0)::int AS last FROM nhl_games WHERE id BETWEEN 2025020001 AND 2025029999 AND state IN ('FINAL','OFF')`);
  const [{ tried }] = await sql.query(`SELECT count(*)::int AS tried FROM ingest_log WHERE job = 'nhlboot' AND detail LIKE '%"step":"backfill"%'`);
  if (last < 1312 && tried < 12) {
    const from = last + 1, to = Math.min(last + 120, 1312);
    return { step: 'backfill', from, to, ...(await nhlBackfill(2025, from, to)) };
  }
  const schedule = await nhlSchedule('2026-10-01');
  const pending = await nhlPending(120);
  const roster = await nhlRosters();
  const injuries = await nhlInjuries();
  const trends = await nhlTrends();
  return { step: 'done', schedule, pending, roster, injuries, trends };
}
