// Compositions probables NBA (page publique RotoWire) : sert uniquement de FILTRE négatif (joueur incertain/absent).
import { slugify } from './ttfl.js';
const URL_ = 'https://www.rotowire.com/basketball/nba-lineups.php';
export async function syncLineups(sql) {
  const r = await fetch(URL_, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; PickDuSoir)' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('lineups ' + r.status);
  const t = await r.text();
  const rows = [];
  for (const box of t.split('<div class="lineup__box">').slice(1)) {
    for (const chunk of box.split(/<ul class="lineup__list[^"]*"/).slice(1)) {
      const cut = chunk.search(/lineup__title/);
      const re = /<li class="lineup__player is-pct-play-(\d+)"[^>]*>[\s\S]*?<a title="([^"]+)"/g;
      let m;
      while ((m = re.exec(chunk))) rows.push([slugify(m[2].replace(/&#039;|&#x27;/g, "'")), m[2], Number(m[1]), cut < 0 || m.index < cut]);
    }
  }
  await sql.query(`CREATE TABLE IF NOT EXISTS lineups (slug text PRIMARY KEY, name text, pct int, starter boolean, updated_at timestamptz DEFAULT now())`);
  if (rows.length < 20) return { lineups: rows.length, skipped: 'page inattendue' };
  const dedup = [...new Map(rows.map((x) => [x[0], x])).values()];
  await sql.query(`DELETE FROM lineups`);
  await sql.query(`INSERT INTO lineups (slug, name, pct, starter) SELECT * FROM unnest($1::text[], $2::text[], $3::int[], $4::boolean[]) ON CONFLICT DO NOTHING`, [dedup.map((x) => x[0]), dedup.map((x) => x[1]), dedup.map((x) => x[2]), dedup.map((x) => x[3])]);
  return { lineups: dedup.length, doubtful: dedup.filter((x) => x[2] <= 50).length };
}
