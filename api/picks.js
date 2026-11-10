import { sql } from '../lib/jobs.js';

// Picks publics du soir (utilisés par le site et les visuels)
export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const date = q.get('date');
  const rows = await sql.query(
    `WITH d AS (SELECT coalesce($1::date, (SELECT max(pick_date) FROM picks)) AS day)
     SELECT p.pick_date::text AS date, p.rank, pl.name, pl.slug, t.tricode AS team, o.tricode AS opp,
            (g.home_team_id = pl.team_id) AS home, g.start_utc, p.projected, p.reason
     FROM picks p JOIN d ON p.pick_date = d.day
     JOIN players pl ON pl.id = p.player_id
     JOIN games g ON g.id = p.game_id
     LEFT JOIN teams t ON t.id = pl.team_id
     LEFT JOIN teams o ON o.id = CASE WHEN g.home_team_id = pl.team_id THEN g.away_team_id ELSE g.home_team_id END
     ORDER BY p.rank`, [date || null]);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ date: rows[0]?.date || date || null, picks: rows });
}
