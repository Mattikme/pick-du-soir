// Page publique « Fiabilité » : toutes les séries publiées sur X, enregistrées avant les matchs, avec leur résultat.
import { sql } from './jobs.js';
import { STATS } from './trends.js';
import { page, esc, shortDay } from './site.js';

const NHL_COL = { g: ['goals', 'but'], a: ['assists', 'passe'], p: ['points', 'point'] };

// items : { name, ok (true|false|null = n'a pas joué), val, short, thr }
export async function settle(league, picks) {
  const items = [];
  for (const k of picks) {
    let g;
    if (league === 'nba') [g] = await sql.query(`SELECT pts, reb, ast, tpm, stl, blk FROM player_games WHERE game_id = $1 AND player_id = $2 AND minutes > 0`, [k.gid, k.pid]);
    else [g] = await sql.query(`SELECT goals, assists, points FROM nhl_player_games WHERE game_id = $1 AND player_id = $2`, [k.gid, k.pid]);
    if (!g) { items.push({ name: k.name, stat: k.stat, thr: k.thr, ok: null }); continue; }
    if (league === 'nba') { const v = STATS[k.stat].val(g); items.push({ name: k.name, ok: v >= k.thr, val: v, short: STATS[k.stat].short, thr: k.thr, stat: k.stat }); }
    else { const [col, w] = NHL_COL[k.stat]; const v = g[col]; items.push({ name: k.name, ok: v >= k.thr, val: v, short: v > 1 ? w + 's' : w, thr: k.thr, stat: k.stat }); }
  }
  return items;
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
  const rows = [];
  for (const p of posts) rows.push({ league: p.league, day: p.day, tweet: p.tweet_id, items: await settle(p.league, p.picks) });
  cache = { t: Date.now(), rows };
  return rows;
}

const pct = (x) => `${Math.round(x * 100)} %`;

export async function fiabilitePage(origin) {
  const rows = await load();
  const tot = (lg) => { let h = 0, m = 0, v = 0; for (const r of rows) if (!lg || r.league === lg) for (const i of r.items) { if (i.ok === null) v++; else if (i.ok) h++; else m++; } return { h, m, v, n: h + m }; };
  const card = (label, t) => { const w = wilson(t.h, t.n); return `<div class="fk"><span>${label}</span><b>${t.n ? pct(t.h / t.n) : '–'}</b><small>${t.h}/${t.n} séries tenues${t.v ? ` · ${t.v} annulée${t.v > 1 ? 's' : ''}` : ''}${w ? `<br>intervalle à 95 % : ${pct(w[0])} à ${pct(w[1])}` : ''}</small></div>`; };
  const days = rows.slice(0, 40).map((r) => `<div class="fd"><b>${r.league.toUpperCase()} ${esc(shortDay(r.day))}</b>${r.items.map((i) => `<span>${i.ok === null ? '➖' : i.ok ? '✅' : '❌'} ${esc(i.name)} <em>${i.ok === null ? "n'a pas joué" : `${i.val} (${i.thr}+)`}</em></span>`).join('')}</div>`).join('');
  const css = `.fk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:14px 0}.fk{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px}.fk span{font-size:13px;opacity:.8}.fk b{display:block;font-size:40px;line-height:1.1}.fk small{opacity:.75}.fd{background:rgba(255,255,255,.05);border-radius:12px;padding:10px 12px;margin:8px 0;display:flex;flex-direction:column;gap:3px;font-size:14px}.fd em{opacity:.7;font-style:normal}.fp h2{margin-top:26px}`;
  const body = `<section class="fp"><p class="kick">Transparence</p><h1>Résultats</h1><p>Chaque série publiée sur X est enregistrée <b>avant</b> le match, puis comparée au résultat réel. Rien n'est modifié ni supprimé : les ratés restent affichés.</p>
  <div class="fk-grid">${card('Toutes séries', tot())}${card('NBA', tot('nba'))}${card('NHL', tot('nhl'))}</div>
  <h2>Historique</h2>${days || '<p>Les premiers bilans arrivent après les matchs du jour.</p>'}
  <p><a href="/fiabilite.csv">Télécharger tout l'historique (CSV)</a></p>
  <h2>Méthode</h2><p>Une série est « tenue » si le joueur atteint le palier annoncé (par exemple 1+ but) dans le match du soir. Un joueur qui ne joue pas est marqué « annulé » et exclu du taux, mais reste visible. L'intervalle de Wilson à 95 % indique l'incertitude : avec peu de séries, il est large. Ce sont des fréquences passées, pas des probabilités ni des conseils de pari.</p></section><style>${css}</style>`;
  return page({ title: 'Résultats des séries publiées | Pick du Soir', description: 'Le taux de réussite public de toutes les séries publiées par Pick du Soir, ratés compris.', canonical: origin + '/fiabilite', nav: 'fiabilite', body });
}

export async function fiabiliteCsv() {
  const rows = await load();
  const lines = ['date,ligue,joueur,stat,palier,resultat,valeur'];
  for (const r of rows) for (const i of r.items) lines.push([r.day, r.league, `"${String(i.name).replace(/"/g, '""')}"`, i.stat, i.thr, i.ok === null ? 'annule' : i.ok ? 'tenue' : 'ratee', i.val ?? ''].join(','));
  return lines.join('\n');
}
