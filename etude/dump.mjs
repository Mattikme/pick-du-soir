// Export de l'historique pour l'étude : écrit nba.json et nhl.json dans le dossier courant.
// Usage : DATABASE_URL=... node etude/dump.mjs   (lecture seule ; l'adresse de la base ne doit jamais être écrite dans le dépôt)
import fs from 'fs';
import { createSql } from '../lib/db.js';
const sql = createSql(process.env.DATABASE_URL);
const nba = await sql.query(`SELECT pg.player_id pid, pg.game_id gid, pg.team_id tm, pg.opp_team_id opp, g.game_date::text d, (g.home_team_id = pg.team_id)::int home, pg.minutes min, pg.pts, pg.reb, pg.ast, pg.stl, pg.blk, pg.tpm
  FROM player_games pg JOIN games g ON g.id = pg.game_id WHERE pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' ORDER BY g.game_date, g.id`);
fs.writeFileSync('nba.json', JSON.stringify(nba)); console.log('nba', nba.length);
const nhl = await sql.query(`SELECT player_id pid, game_id gid, team tm, opp, game_date::text d, home::int home, toi, goals g, assists a, points p, sog
  FROM nhl_player_games WHERE toi > 0 AND game_type IN (2, 3) ORDER BY game_date, game_id`);
fs.writeFileSync('nhl.json', JSON.stringify(nhl)); console.log('nhl', nhl.length);
