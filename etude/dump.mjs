import fs from 'fs'; import { createSql } from '/home/claude/pick-du-soir/lib/db.js';
const SP='/tmp/claude-0/-home-claude/ec6b2660-d6dd-5972-b5e1-16e673822b04/scratchpad';
const sql = createSql(fs.readFileSync(SP+'/db_url','utf8').trim());
const nba = await sql.query(`SELECT pg.player_id pid, pg.game_id gid, pg.team_id tm, pg.opp_team_id opp, g.game_date::text d, (g.home_team_id = pg.team_id)::int home, pg.minutes min, pg.pts, pg.reb, pg.ast, pg.stl, pg.blk, pg.tpm FROM player_games pg JOIN games g ON g.id=pg.game_id WHERE pg.minutes>0 AND g.status=3 AND g.game_type IS DISTINCT FROM 'pre' ORDER BY g.game_date`);
fs.writeFileSync(SP+'/bt/nba.json', JSON.stringify(nba)); console.log('nba', nba.length);
const nhl = await sql.query(`SELECT player_id pid, game_id gid, team tm, opp, game_date::text d, (home::text IN ('true','t','1'))::int home, toi, goals g, assists a, points p, sog FROM nhl_player_games WHERE toi>0 AND game_type IN (2,3) ORDER BY game_date`);
fs.writeFileSync(SP+'/bt/nhl.json', JSON.stringify(nhl)); console.log('nhl', nhl.length);
