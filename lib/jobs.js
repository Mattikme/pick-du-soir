import { createSql } from './db.js';
import { SCHEDULE_URL, INJURIES_URL, boxUrl, getJson, gameType, seasonFromId, pool } from './nba.js';
import { fantasyScore, parseMinutes, slugify, usDate } from './ttfl.js';
import { STATS, bestLine } from './trends.js';
import { syncLineups } from './lineups.js';

const sql = createSql(process.env.DATABASE_URL);
const KEPT_TYPES = new Set(['pre', 'reg', 'cup', 'playin', 'po']);

async function upsertTeams(rows) {
  if (!rows.length) return;
  const c = cols(rows, 4);
  await sql.query(
    `INSERT INTO teams (id, tricode, city, name)
     SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[])
     ON CONFLICT (id) DO UPDATE SET tricode = EXCLUDED.tricode, city = EXCLUDED.city, name = EXCLUDED.name`, c);
}

async function upsertGames(rows) {
  if (!rows.length) return;
  const c = cols(rows, 10);
  await sql.query(
    `INSERT INTO games (id, season, game_type, game_date, start_utc, home_team_id, away_team_id, status, home_score, away_score)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::date[], $5::timestamptz[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[])
     ON CONFLICT (id) DO UPDATE SET game_date = EXCLUDED.game_date, start_utc = EXCLUDED.start_utc,
       status = EXCLUDED.status, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score, updated_at = now()`, c);
}

function cols(rows, n) {
  const out = Array.from({ length: n }, () => []);
  for (const r of rows) for (let i = 0; i < n; i++) out[i].push(r[i] ?? null);
  return out;
}

// 1) Calendrier complet de la saison en cours
export async function syncSchedule() {
  const data = await getJson(SCHEDULE_URL);
  const teams = new Map();
  const games = [];
  for (const day of data.leagueSchedule.gameDates) {
    for (const g of day.games) {
      const type = gameType(g.gameId);
      if (!KEPT_TYPES.has(type) || !g.homeTeam?.teamId || !g.awayTeam?.teamId) continue;
      for (const t of [g.homeTeam, g.awayTeam]) teams.set(t.teamId, [t.teamId, t.teamTricode, t.teamCity, t.teamName]);
      games.push([g.gameId, seasonFromId(g.gameId), type, g.gameDateEst.slice(0, 10), g.gameDateTimeUTC,
        g.homeTeam.teamId, g.awayTeam.teamId, g.gameStatus, g.homeTeam.score ?? null, g.awayTeam.score ?? null]);
    }
  }
  await upsertTeams([...teams.values()]);
  for (let i = 0; i < games.length; i += 500) await upsertGames(games.slice(i, i + 500));
  return { teams: teams.size, games: games.length, season: data.leagueSchedule.seasonYear };
}

// 2) Feuilles de match (box scores) -> stats joueurs + score fantasy
export async function ingestBoxscores(gameIds) {
  const results = await pool(gameIds, 8, async (id) => getJson(boxUrl(id)));
  const teams = new Map(), games = [], players = new Map(), lines = [];
  let skipped = 0;
  results.forEach((data, i) => {
    const g = data?.game;
    if (!g || g.gameStatus !== 3) { skipped++; return; }
    const type = gameType(g.gameId);
    const date = (g.gameEt || g.gameTimeUTC).slice(0, 10);
    for (const t of [g.homeTeam, g.awayTeam]) teams.set(t.teamId, [t.teamId, t.teamTricode, t.teamCity, t.teamName]);
    games.push([g.gameId, seasonFromId(g.gameId), type, date, g.gameTimeUTC,
      g.homeTeam.teamId, g.awayTeam.teamId, 3, g.homeTeam.score, g.awayTeam.score]);
    for (const [team, opp] of [[g.homeTeam, g.awayTeam], [g.awayTeam, g.homeTeam]]) {
      for (const p of team.players || []) {
        const prev = players.get(p.personId);
        if (!prev || prev[5] <= date) players.set(p.personId, [p.personId, p.name, slugify(p.name), team.teamId, p.position || null, date]);
        if (p.played !== '1') continue;
        const s = p.statistics;
        const st = { pts: s.points, reb: s.reboundsTotal, ast: s.assists, stl: s.steals, blk: s.blocks, tov: s.turnovers,
          fgm: s.fieldGoalsMade, fga: s.fieldGoalsAttempted, tpm: s.threePointersMade, tpa: s.threePointersAttempted,
          ftm: s.freeThrowsMade, fta: s.freeThrowsAttempted };
        lines.push([g.gameId, p.personId, team.teamId, opp.teamId, date, type, parseMinutes(s.minutes),
          st.pts, st.reb, st.ast, st.stl, st.blk, st.tov, st.fgm, st.fga, st.tpm, st.tpa, st.ftm, st.fta, fantasyScore(st)]);
      }
    }
  });
  await upsertTeams([...teams.values()]);
  await upsertGames(games);
  const pl = [...players.values()];
  if (pl.length) {
    await sql.query(
      `INSERT INTO players (id, name, slug, team_id, position, last_game_date)
       SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::int[], $5::text[], $6::date[])
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug,
         team_id = CASE WHEN players.last_game_date IS NULL OR EXCLUDED.last_game_date >= players.last_game_date
                        THEN EXCLUDED.team_id ELSE players.team_id END,
         position = COALESCE(EXCLUDED.position, players.position),
         last_game_date = GREATEST(players.last_game_date, EXCLUDED.last_game_date), updated_at = now()`, cols(pl, 6));
  }
  for (let i = 0; i < lines.length; i += 1000) {
    await sql.query(
      `INSERT INTO player_games (game_id, player_id, team_id, opp_team_id, game_date, game_type, minutes,
         pts, reb, ast, stl, blk, tov, fgm, fga, tpm, tpa, ftm, fta, ttfl)
       SELECT * FROM unnest($1::text[], $2::int[], $3::int[], $4::int[], $5::date[], $6::text[], $7::numeric[],
         $8::int[], $9::int[], $10::int[], $11::int[], $12::int[], $13::int[], $14::int[], $15::int[], $16::int[],
         $17::int[], $18::int[], $19::int[], $20::int[])
       ON CONFLICT (game_id, player_id) DO UPDATE SET minutes = EXCLUDED.minutes, pts = EXCLUDED.pts, reb = EXCLUDED.reb,
         ast = EXCLUDED.ast, stl = EXCLUDED.stl, blk = EXCLUDED.blk, tov = EXCLUDED.tov, fgm = EXCLUDED.fgm,
         fga = EXCLUDED.fga, tpm = EXCLUDED.tpm, tpa = EXCLUDED.tpa, ftm = EXCLUDED.ftm, fta = EXCLUDED.fta, ttfl = EXCLUDED.ttfl`,
      cols(lines.slice(i, i + 1000), 20));
  }
  return { requested: gameIds.length, games: games.length, skipped, lines: lines.length };
}

// Matchs terminés (ou passés) sans stats en base
export async function ingestPending(limit = 60) {
  const rows = await sql.query(
    `SELECT g.id FROM games g
     WHERE g.game_date <= $1 AND NOT EXISTS (SELECT 1 FROM player_games pg WHERE pg.game_id = g.id)
     ORDER BY g.game_date DESC LIMIT $2`, [usDate(), limit]);
  if (!rows.length) return { requested: 0 };
  return ingestBoxscores(rows.map((r) => r.id));
}

// Historique : saison régulière d'une saison passée (ex. season=2025 -> 2025-26), par tranches
export async function backfill(season, from, to) {
  const yy = String(season % 100).padStart(2, '0');
  const ids = [];
  for (let n = from; n <= to; n++) ids.push(`002${yy}${String(n).padStart(5, '0')}`);
  return ingestBoxscores(ids);
}

// 3) Blessures (ESPN)
export async function syncInjuries() {
  const data = await getJson(INJURIES_URL);
  const teamRows = await sql.query(`SELECT tricode, city || ' ' || name AS full FROM teams`);
  const byName = new Map(teamRows.map((t) => [t.full, t.tricode]));
  const rows = [];
  const seen = new Set();
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
    sql.q('DELETE FROM injuries'),
    sql.q(
      `INSERT INTO injuries (player_name, team_tricode, status, detail, player_slug)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])`, cols(rows, 5)),
    sql.q(`UPDATE injuries i SET player_id = p.id FROM players p WHERE p.slug = i.player_slug`),
  ]);
  return { injuries: rows.length };
}

// 4) Picks du soir : forme récente × matchup, blessés exclus
export async function buildPicks(date) {
  let day = date || usDate();
  if (!date) {
    const next = await sql.query(`SELECT min(game_date)::text d FROM games WHERE game_date >= $1`, [day]);
    if (next[0]?.d) day = next[0].d;
  }
  const picks = await sql.query(
    `WITH tonight AS (
       SELECT id AS game_id, home_team_id, away_team_id FROM games WHERE game_date = $1
     ), roster AS (
       SELECT p.id AS player_id, p.team_id, t.game_id,
              CASE WHEN p.team_id = t.home_team_id THEN t.away_team_id ELSE t.home_team_id END AS opp
       FROM players p JOIN tonight t ON p.team_id IN (t.home_team_id, t.away_team_id)
     ), recent AS (
       SELECT player_id, ttfl, minutes,
              row_number() OVER (PARTITION BY player_id ORDER BY game_date DESC) AS rn
       FROM player_games WHERE game_type IN ('reg','cup','playin','po') AND minutes > 0
     ), form AS (
       SELECT player_id, avg(ttfl) FILTER (WHERE rn <= 5) AS l5, avg(ttfl) AS l15,
              avg(minutes) FILTER (WHERE rn <= 10) AS min10, count(*) AS n
       FROM recent WHERE rn <= 15 GROUP BY player_id
     ), allowed AS (
       SELECT opp_team_id AS team_id, sum(ttfl)::numeric / count(DISTINCT game_id) AS per_game
       FROM player_games WHERE game_type IN ('reg','cup') AND game_date > $1::date - 400 GROUP BY opp_team_id
     ), lg AS (SELECT avg(per_game) AS avg_pg FROM allowed)
     SELECT r.player_id, r.game_id, r.opp, round(f.l5, 1) AS l5, round(f.l15, 1) AS l15, round(f.min10, 1) AS min10,
            round(coalesce(a.per_game / lg.avg_pg, 1), 3) AS opp_factor, i.status AS inj,
            round((0.4 * f.l5 + 0.6 * f.l15) * least(greatest(coalesce(a.per_game / lg.avg_pg, 1), 0.9), 1.1), 1) AS proj
     FROM roster r JOIN form f USING (player_id)
     LEFT JOIN allowed a ON a.team_id = r.opp CROSS JOIN lg
     LEFT JOIN injuries i ON i.player_id = r.player_id
     WHERE f.n >= 3 AND coalesce(i.status, '') <> 'Out'
     ORDER BY proj DESC LIMIT 30`, [day]);
  const rows = picks.map((p, idx) => {
    const pct = Math.round((p.opp_factor - 1) * 100);
    const reason = `Forme 5 derniers : ${p.l5}, 15 derniers : ${p.l15}, ${p.min10} min, défense adverse ${pct >= 0 ? '+' : ''}${pct} %` +
      (p.inj ? `, statut : ${p.inj}` : '');
    return [day, idx + 1, p.player_id, p.game_id, p.proj, reason, p.l5, p.l15, p.min10, p.opp_factor, p.inj || null];
  });
  await sql.transaction([
    sql.q('DELETE FROM picks WHERE pick_date = $1', [day]),
    sql.q(
      `INSERT INTO picks (pick_date, rank, player_id, game_id, projected, reason, l5, l15, min10, opp_factor, inj)
       SELECT * FROM unnest($1::date[], $2::int[], $3::int[], $4::text[], $5::numeric[], $6::text[],
         $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::text[])`, cols(rows, 11)),
  ]);
  return { date: day, picks: rows.length };
}

// 5) Séries du soir : pour chaque joueur qui joue, sa meilleure série par stat
export async function buildTrends(date) {
  let day = date || usDate();
  try { await syncLineups(sql); } catch {}
  await sql.query(`CREATE TABLE IF NOT EXISTS lineups (slug text PRIMARY KEY, name text, pct int, starter boolean, updated_at timestamptz DEFAULT now())`);
  if (!date) {
    const next = await sql.query(`SELECT min(game_date)::text d FROM games WHERE game_date >= $1`, [day]);
    if (next[0]?.d) day = next[0].d;
  }
  const rows = await sql.query(
    `WITH tonight AS (SELECT id AS game_id, home_team_id, away_team_id FROM games WHERE game_date = $1),
     roster AS (
       SELECT p.id AS player_id, t.game_id, CASE WHEN p.team_id = t.home_team_id THEN t.away_team_id ELSE t.home_team_id END AS opp
       FROM players p JOIN tonight t ON p.team_id IN (t.home_team_id, t.away_team_id)
       WHERE NOT EXISTS (SELECT 1 FROM injuries i WHERE i.player_id = p.id AND i.status = 'Out')
         AND NOT EXISTS (SELECT 1 FROM lineups l WHERE l.slug = p.slug AND l.pct <= 25)
         AND (SELECT count(*) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND g2.game_date < $1 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 4) tg
              JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes >= 12) >= 2),
     g AS (
       SELECT pg.player_id, pg.game_date, pg.opp_team_id, pg.minutes, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk,
              row_number() OVER (PARTITION BY pg.player_id ORDER BY pg.game_date DESC) AS rn
       FROM player_games pg JOIN roster r USING (player_id)
       WHERE pg.game_type IN ('reg','cup','playin','po') AND pg.minutes > 0)
     SELECT r.player_id, r.game_id, r.opp, g.rn, g.opp_team_id, g.minutes, g.pts, g.reb, g.ast, g.tpm, g.stl, g.blk
     FROM roster r JOIN g USING (player_id)
     WHERE g.rn <= 20 OR g.opp_team_id = r.opp
     ORDER BY r.player_id, g.rn`, [day]);
  const byPlayer = new Map();
  for (const r of rows) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, { game_id: r.game_id, opp: r.opp, games: [] });
    byPlayer.get(r.player_id).games.push({ rn: Number(r.rn), opp_team_id: r.opp_team_id, minutes: Number(r.minutes), pts: r.pts, reb: r.reb, ast: r.ast, tpm: r.tpm, stl: r.stl, blk: r.blk });
  }
  const lines = [];
  for (const [pid, p] of byPlayer) {
    const recent10 = p.games.filter((g) => g.rn <= 10);
    if (recent10.length < 10) continue;
    const mins = recent10.reduce((s, g) => s + g.minutes, 0) / recent10.length;
    if (mins < 18) continue;
    for (const key of Object.keys(STATS)) {
      const b = bestLine(p.games, key, p.opp);
      if (!b) continue;
      const avg10 = recent10.reduce((s, g) => s + STATS[key].val(g), 0) / 10;
      lines.push({ pid, game_id: p.game_id, opp: p.opp, key, avg10: Math.round(avg10 * 10) / 10, ...b });
    }
  }
  lines.sort((a, b) => b.score - a.score || b.threshold - a.threshold);
  const out = lines.map((l, i) => [day, i + 1, l.pid, l.game_id, l.opp, l.key, l.threshold, l.l5, l.n5, l.l10, l.n10, l.l20, l.n20, l.h2h, l.nh2h, l.streak, l.avg10, l.score]);
  await sql.transaction([
    sql.q('DELETE FROM trends WHERE day = $1', [day]),
    sql.q(`INSERT INTO trends (day, rank, player_id, game_id, opp_team_id, stat, threshold, l5, n5, l10, n10, l20, n20, h2h, nh2h, streak, avg10, score)
           SELECT * FROM unnest($1::date[], $2::int[], $3::int[], $4::text[], $5::int[], $6::text[], $7::int[], $8::int[], $9::int[],
             $10::int[], $11::int[], $12::int[], $13::int[], $14::int[], $15::int[], $16::int[], $17::numeric[], $18::numeric[])`, cols(out, 18)),
  ]);
  let matchups = null;
  try { matchups = await (await import('./matchup.js')).buildMatchups(day); } catch (e) { matchups = { error: String(e).slice(0, 200) }; }
  return { date: day, players: byPlayer.size, trends: out.length, matchups };
}

// Amorçage automatique, une étape par appel : calendrier -> historique 2025-26 -> matchs récents -> blessures -> picks
export async function bootstrap() {
  const [{ n }] = await sql.query(`SELECT count(*)::int AS n FROM games WHERE season = '2026-27'`);
  if (!n) return { step: 'schedule', ...(await syncSchedule()) };
  const [{ last }] = await sql.query(
    `SELECT coalesce(max(substr(id, 6)::int), 0) AS last FROM games WHERE id LIKE '00225%' AND status = 3`);
  if (last < 1230) {
    const from = last + 1, to = Math.min(last + 150, 1230);
    return { step: 'backfill', from, to, ...(await backfill(2025, from, to)) };
  }
  const pending = await ingestPending(80);
  const injuries = await syncInjuries();
  const trends = await buildTrends();
  return { step: 'done', pending, injuries, trends };
}

export async function log(job, ok, detail) {
  await sql.query('INSERT INTO ingest_log (job, ok, detail) VALUES ($1, $2, $3)', [job, ok, JSON.stringify(detail).slice(0, 4000)]);
}

export { sql };
