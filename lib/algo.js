// Algorithme Pick du Soir : les « lignes du soir » (ligne au demi-point + côté Plus ou Moins), et leur suivi public.
// Le calcul est dans lib/lignes.js ; ici, la sélection publiée et la comparaison aux résultats réels.
import { sql } from './jobs.js';
import { STATS } from './trends.js';
import { nbaLines, nhlLines, lineText, won, pct5, MODELS } from './lignes.js';

// Les lignes du soir d'une ligue. 4 lignes (publication X) : une seule ligne par stat ; liste du site : 3 par stat au plus.
export const algoRows = (day, { league = 'nba', limit = 12, future = false, refs = false } = {}) =>
  (league === 'nhl' ? nhlLines(day, { limit, future, refs }) : nbaLines(day, { limit, maxStat: limit <= 4 ? 1 : 3, future, refs }));

// Tables du suivi (les colonnes side / league viennent de migrations/2026-11-14-lignes.sql)
export async function algoTables() {
  await sql.query(`CREATE TABLE IF NOT EXISTS algo_picks (day date, rank int, pid int, name text, stat text, thr numeric, p numeric, gid text, side text, league text NOT NULL DEFAULT 'nba', PRIMARY KEY (day, pid))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS algo_recaps (day date, league text NOT NULL DEFAULT 'nba', tweet_id text, ts timestamptz DEFAULT now(), PRIMARY KEY (day, league))`);
}

// Lignes publiées et terminées, avec la valeur réelle du joueur. opt.day : un seul jour ; opt.old : anciennes séries comprises.
export async function settled({ day = null, old = false } = {}) {
  await algoTables();
  const [nba, nhl] = await Promise.all([
    sql.query(`SELECT a.day::text AS day, a.rank, a.league, a.pid, a.name, a.stat, a.thr, a.p, a.side, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk
      FROM algo_picks a JOIN player_games pg ON pg.game_id = a.gid AND pg.player_id = a.pid AND pg.minutes > 0
      WHERE a.league = 'nba' AND ($1::date IS NULL OR a.day = $1) AND ($2 OR a.side IS NOT NULL)`, [day, old]),
    sql.query(`SELECT a.day::text AS day, a.rank, a.league, a.pid, a.name, a.stat, a.thr, a.p, a.side, pg.sog
      FROM algo_picks a JOIN nhl_player_games pg ON pg.game_id::text = a.gid AND pg.player_id = a.pid AND pg.toi > 0
      WHERE a.league = 'nhl' AND ($1::date IS NULL OR a.day = $1) AND ($2 OR a.side IS NOT NULL)`, [day, old]),
  ]);
  return [...nba, ...nhl].map((r) => { const val = r.league === 'nhl' ? +r.sog : STATS[r.stat].val(r); return { ...r, val, ok: won(r.side, val, r.thr) }; })
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.rank - b.rank));
}

// Suivi public de la nouvelle méthode : réussite totale et par ligue
export async function algoTrack() {
  const rows = await settled();
  const t = (lg) => { const r = rows.filter((x) => !lg || x.league === lg); return { ok: r.filter((x) => x.ok).length, n: r.length }; };
  return { ...t(), nba: t('nba'), nhl: t('nhl'), since: rows.length ? rows[rows.length - 1].day : null };
}

export { lineText, pct5, MODELS };
