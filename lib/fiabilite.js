// Page publique « Fiabilité » : toutes les séries publiées sur X, enregistrées avant les matchs, avec leur résultat.
import { sql } from './jobs.js';
import { STATS } from './trends.js';
import { page, esc, shortDay } from './site.js';
import { won, lineText } from './lignes.js';

const NHL_COL = { g: ['goals', 'but'], a: ['assists', 'passe'], p: ['points', 'point'], sog: ['sog', 'tir'] };

// items : { name, ok (true|false|null = n'a pas joué), val, short, thr, side ('plus'|'moins' pour une ligne du soir, sinon vide) }
export async function settle(league, picks) {
  // une seule requête pour tous les matchs demandés
  const gids = picks.map((k) => String(k.gid)), pids = picks.map((k) => Number(k.pid));
  const rows = !picks.length ? [] : league === 'nba'
    ? await sql.query(`SELECT pg.game_id::text AS gid, pg.player_id AS pid, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk FROM player_games pg JOIN unnest($1::text[], $2::int[]) AS k(gid, pid) ON pg.game_id = k.gid AND pg.player_id = k.pid WHERE pg.minutes > 0`, [gids, pids])
    : await sql.query(`SELECT pg.game_id::text AS gid, pg.player_id AS pid, pg.goals, pg.assists, pg.points, pg.sog FROM nhl_player_games pg JOIN unnest($1::text[], $2::int[]) AS k(gid, pid) ON pg.game_id::text = k.gid AND pg.player_id = k.pid`, [gids, pids]);
  const by = new Map(rows.map((g) => [`${g.gid}-${g.pid}`, g]));
  return picks.map((k) => {
    const g = by.get(`${k.gid}-${k.pid}`);
    if (!g) return { name: k.name, stat: k.stat, thr: k.thr, side: k.side, ok: null };
    if (league === 'nba') { const v = STATS[k.stat].val(g); return { name: k.name, ok: won(k.side, v, k.thr), val: v, short: STATS[k.stat].short, thr: k.thr, stat: k.stat, side: k.side }; }
    const [col, w] = NHL_COL[k.stat], v = g[col];
    return { name: k.name, ok: won(k.side, v, k.thr), val: v, short: v > 1 ? w + 's' : w, thr: k.thr, stat: k.stat, side: k.side };
  });
}

export function wilson(h, n) {
  if (!n) return null;
  const z = 1.96, p = h / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

let cache = { t: 0, rows: null };
async function load() {
  if (cache.rows && Date.now() - cache.t < 600000) return cache.rows;
  // séries publiées en cartes (une ligne par thème) + ancien format tableau, sans doublon joueur/stat/palier
  let cards = [];
  try { cards = await sql.query(`SELECT league, day::text AS day, jsonb_agg(e) AS picks, min(tweet_id) AS tweet_id FROM x_cards, jsonb_array_elements(picks) e WHERE day < current_date GROUP BY league, day`); } catch {}
  const old = await sql.query(`SELECT league, day::text AS day, picks, tweet_id FROM x_posts WHERE picks IS NOT NULL AND slot IS NOT NULL AND day < current_date`);
  const key = (p) => p.league + p.day;
  const have = new Set(cards.map(key));
  const posts = [...cards, ...old.filter((p) => !have.has(key(p)))].sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : x.league < y.league ? -1 : 1));
  for (const p of posts) { const seen = new Set(); p.picks = p.picks.filter((k) => { const id = `${k.pid}-${k.stat}-${k.thr}`; return !seen.has(id) && seen.add(id); }); }
  // tous les résultats en deux requêtes (une par ligue), puis on redistribue par publication
  const res = {};
  for (const lg of ['nba', 'nhl']) res[lg] = await settle(lg, posts.filter((p) => p.league === lg).flatMap((p) => p.picks));
  const at = { nba: 0, nhl: 0 };
  const rows = posts.map((p) => ({ league: p.league, day: p.day, tweet: p.tweet_id, items: res[p.league].slice(at[p.league], (at[p.league] += p.picks.length)) }));
  cache = { t: Date.now(), rows };
  return rows;
}

const pct = (x) => `${Math.round(x * 100)} %`;

export async function fiabilitePage(origin) {
  const rows = await load();
  // kind : 'ligne' = lignes du soir (Plus/Moins), 'serie' = séries « palier atteint »
  const tot = (kind, lg) => { let h = 0, m = 0, v = 0; for (const r of rows) if (!lg || r.league === lg) for (const i of r.items) { if ((kind === 'ligne') !== !!i.side) continue; if (i.ok === null) v++; else if (i.ok) h++; else m++; } return { h, m, v, n: h + m }; };
  const card = (label, t, kind) => { const w = wilson(t.h, t.n); return `<div class="fk"><span>${label}</span><b>${t.n ? pct(t.h / t.n) : '–'}</b><small>${t.h}/${t.n} ${kind === 'ligne' ? 'lignes réussies' : 'séries tenues'}${t.v ? ` · ${t.v} annulée${t.v > 1 ? 's' : ''}` : ''}${w ? `<br>intervalle à 95 % : ${pct(w[0])} à ${pct(w[1])}` : ''}</small></div>`; };
  const days = rows.slice(0, 40).map((r) => `<div class="fd"><b>${r.league.toUpperCase()} ${esc(shortDay(r.day))}</b>${r.items.map((i) => `<span>${i.ok === null ? '➖' : i.ok ? '✅' : '❌'} ${esc(i.name)} <em>${i.side ? esc(lineText({ side: i.side, line: i.thr, stat: i.stat })) + ' : ' : ''}${i.ok === null ? "n'a pas joué" : i.side ? i.val : `${i.val} (${i.thr}+)`}</em></span>`).join('')}</div>`).join('');
  const css = `.fk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:14px 0}.fk{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px}.fk span{font-size:13px;opacity:.8}.fk b{display:block;font-size:40px;line-height:1.1}.fk small{opacity:.75}.fd{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin:8px 0;display:flex;flex-direction:column;gap:3px;font-size:14px}.fd em{opacity:.7;font-style:normal}.fp h2{margin-top:26px}`;
  const body = `<section class="fp"><p class="kick">Transparence</p><h1>Résultats</h1><p>Chaque série publiée sur X est enregistrée <b>avant</b> le match, puis comparée au résultat réel. Rien n'est modifié ni supprimé : les ratés restent affichés.</p>
  <div class="fk-grid">${card('Lignes du soir (Plus/Moins)', tot('ligne'), 'ligne')}${card('Séries NBA', tot('serie', 'nba'))}${card('Séries NHL', tot('serie', 'nhl'))}</div>
  <h2>Historique</h2>${days || '<p>Les premiers bilans arrivent après les matchs du jour.</p>'}
  <p><a href="/fiabilite.csv">Télécharger tout l'historique (CSV)</a></p>
  <h2>Méthode</h2><p>Une ligne du soir est « réussie » si le joueur finit du côté annoncé (Plus ou Moins) de la ligne ; ces lignes existent depuis le 14 novembre 2026, il faut donc quelques semaines avant que leur pourcentage soit parlant. Une série est « tenue » si le joueur atteint le palier annoncé (par exemple 1+ but) dans le match du soir. Un joueur qui ne joue pas est marqué « annulé » et exclu du taux, mais reste visible. L'intervalle de Wilson à 95 % indique l'incertitude : avec peu de séries, il est large. Ce sont des fréquences passées, pas des probabilités ni des conseils de pari.</p></section><style>${css}</style>`;
  return page({ title: 'Résultats des séries publiées | Pick du Soir', description: 'Le taux de réussite public de toutes les séries publiées par Pick du Soir, ratés compris.', canonical: origin + '/fiabilite', nav: 'fiabilite', body });
}

export async function fiabiliteCsv() {
  const rows = await load();
  const lines = ['date,ligue,joueur,stat,palier,sens,resultat,valeur'];
  for (const r of rows) for (const i of r.items) lines.push([r.day, r.league, `"${String(i.name).replace(/"/g, '""')}"`, i.stat, i.thr, i.side || 'palier', i.ok === null ? 'annule' : i.ok ? 'tenue' : 'ratee', i.val ?? ''].join(','));
  return lines.join('\n');
}
