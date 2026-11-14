// Interface sobre : liste des séries (photo, palier, 10 derniers matchs réels, taux), styles communs.
import { sql } from './jobs.js';
import { STATS } from './trends.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NHL_COL = { g: 'goals', a: 'assists', p: 'points', sog: 'sog' };

// Valeurs des 10 derniers matchs (du plus ancien au plus récent) avant `day`, pour chaque ligne (player_id + stat)
export async function lastTen(league, rows, day) {
  const ids = [...new Set(rows.map((r) => r.player_id))];
  const out = new Map();
  if (!ids.length) return out;
  try {
    const games = league === 'nba'
      ? await sql.query(`SELECT * FROM (SELECT pg.player_id, pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk,
          row_number() OVER (PARTITION BY pg.player_id ORDER BY g.game_date DESC) rn
          FROM player_games pg JOIN games g ON g.id = pg.game_id
          WHERE pg.player_id = ANY($1) AND pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' AND g.game_date < $2) x WHERE rn <= 10 ORDER BY player_id, rn DESC`, [ids, day])
      : await sql.query(`SELECT * FROM (SELECT pg.player_id, pg.goals, pg.assists, pg.points, pg.sog,
          row_number() OVER (PARTITION BY pg.player_id ORDER BY pg.game_date DESC) rn
          FROM nhl_player_games pg WHERE pg.player_id = ANY($1) AND pg.game_type IN (2, 3) AND pg.toi > 0 AND pg.game_date < $2) x WHERE rn <= 10 ORDER BY player_id, rn DESC`, [ids, day]);
    const by = new Map();
    for (const g of games) { if (!by.has(g.player_id)) by.set(g.player_id, []); by.get(g.player_id).push(g); }
    for (const r of rows) {
      const gs = by.get(r.player_id) || [];
      const v = league === 'nba' ? (STATS[r.stat] ? gs.map((g) => STATS[r.stat].val(g)) : null) : (NHL_COL[r.stat] ? gs.map((g) => +g[NHL_COL[r.stat]] || 0) : null);
      if (v) out.set(`${r.player_id}-${r.stat}`, v);
    }
  } catch (e) { console.error('lastTen', e); }
  return out;
}

const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const rateCls = (h, n) => (n && h / n >= 0.9 ? 'hi' : n && h / n >= 0.7 ? 'mid' : 'lo');

// r : ligne de séries ; o : { href, color, photoHtml, line, meta, vals }
export function seriesRow(r, o) {
  const vals = Array.isArray(o.vals) && o.vals.length >= 5 ? o.vals.slice(-10) : null;
  const pills = vals
    ? vals.map((v) => `<i class="${v >= r.threshold ? 'y' : 'n'}" title="${v}"></i>`).join('')
    : Array.from({ length: r.n10 || 10 }, (_, k) => `<i class="${k < r.l10 ? 'y' : 'n'}"></i>`).join('');
  const last = vals ? vals[vals.length - 1] : null;
  return `<a class="sr" href="${o.href}" style="--c1:${o.color}">
<span class="av"><span class="ini">${esc(initials(r.name))}</span>${o.photoHtml || ''}</span>
<span class="who"><b class="nm">${esc(r.name)}</b><span class="mt">${o.meta}</span></span>
${r.prob != null ? `<span class="hr ${r.prob >= 0.75 ? 'hi' : 'mid'}"><b>${Math.round(r.prob * 20) * 5}</b>%<small>chances</small></span>` : `<span class="hr ${rateCls(r.l10, r.n10)}"><b>${r.l10}</b>/${r.n10}</span>`}
<span class="ln">${esc(o.line)}</span>
<span class="pl" aria-label="${r.l10} matchs sur ${r.n10} au-dessus du palier">${pills}</span>
<span class="ex">${r.prob != null ? `<em>${r.l10}/${r.n10}</em>` : r.streak >= 3 ? `<em>${r.streak} de suite</em>` : ''}${last != null ? `Dernier : ${last}` : ''}</span></a>`;
}

// Ligne du soir : r = { name, stat, line, side, p, proj, vals, l10, n10 } ; o : { href, color, photoHtml, meta, text (ex. « 24,5 points ») }
export function lineRow(r, o) {
  const plus = r.side !== 'moins', vals = (r.vals || []).slice(-10), last = vals.length ? vals[vals.length - 1] : null, fr = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  const pills = vals.map((v) => `<i class="${(plus ? v > r.line : v < r.line) ? 'y' : 'n'}" title="${v}"></i>`).join('');
  return `<a class="sr lr ${plus ? 'plus' : 'moins'}" href="${o.href}" style="--c1:${o.color}">
<span class="av"><span class="ini">${esc(initials(r.name))}</span>${o.photoHtml || ''}</span>
<span class="who"><b class="nm">${esc(r.name)}</b><span class="mt">${o.meta}</span></span>
<span class="hr"><b>${Math.round(r.p * 100)}</b>%<small>estimé</small></span>
<span class="ln"><span class="sd">${plus ? 'Plus de' : 'Moins de'}</span> ${esc(o.text)}${r.proj != null ? `<span class="pj">Projection ${fr(r.proj)}</span>` : ''}</span>
<span class="pl" aria-label="${r.l10} de ses ${r.n10} derniers matchs ${plus ? 'au-dessus' : 'en dessous'} de la ligne">${pills}</span>
<span class="ex"><em>${r.l10}/${r.n10} ${plus ? 'au-dessus' : 'en dessous'}</em>${last != null ? `Dernier match : ${last}` : ''}</span></a>`;
}

export const UI_CSS = `
body{padding-bottom:0;background-image:none}
.wrap{max-width:1040px}
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--night) 92%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);margin:0 -16px;padding:12px 16px;border-bottom:1px solid var(--edge);gap:12px}
.mainnav{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}.mainnav::-webkit-scrollbar{display:none}
.mainnav a{padding:7px 9px;border-radius:9px;font-size:14px;font-weight:600;color:var(--mute);white-space:nowrap}
.mainnav a.on{color:var(--ink);background:rgba(255,255,255,.08)}
.mainnav a.defi{color:var(--ball)}
.mainnav a.algo{color:#4ADE80}
.dock{display:none!important}
.intro{padding:22px 0 6px}
.logo{white-space:nowrap;font-size:20px}
.kick{font:700 13px/1 var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--ball);margin:0 0 10px}
.intro h1{font:800 clamp(30px,7vw,46px)/1 var(--disp);margin:0 0 10px}
.intro .lede{margin:0 0 4px}
.howto{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--mute);background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:7px 11px;margin:8px 0 14px}
.howto b{color:var(--ink)}
.slist{display:grid;grid-template-columns:1fr;gap:8px;margin:12px 0}
@media(min-width:860px){.slist{grid-template-columns:1fr 1fr;gap:10px}}
@media(max-width:620px){.top{flex-wrap:wrap;row-gap:8px;padding:10px 16px 8px}.mainnav{flex:1 0 100%;justify-content:space-between}.mainnav a{padding:6px 8px;font-size:14px}.logo{font-size:18px}}
.sr{--c1:#333;display:grid;grid-template-columns:46px 1fr auto;grid-template-areas:"av who hr" "ln ln ln" "pl pl ex";column-gap:12px;row-gap:8px;align-items:center;background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:12px 14px;position:relative;overflow:hidden;transition:border-color .15s}
.sr:hover{border-color:rgba(255,255,255,.22)}
.sr::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c1)}
.av{grid-area:av;position:relative;width:46px;height:46px;border-radius:50%;overflow:hidden;background:color-mix(in srgb,var(--c1) 70%,#000);display:grid;place-items:center}
.av .ini{font:700 15px var(--ui);color:rgba(255,255,255,.85)}
.av .ph{position:absolute;left:-22%;top:3px;width:144%;height:auto;max-width:none}
.av .ph.nhl{left:0;top:0;width:100%}
.who{grid-area:who;min-width:0}
.nm{display:block;font-size:16px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt{display:block;font-size:13px;color:var(--mute);margin-top:2px}
.hr{grid-area:hr;font:600 15px/1 var(--ui);color:var(--mute);text-align:right}
.hr b{font:800 30px/1 var(--disp);color:var(--ink)}
.hr.hi b{color:#4ADE80}.hr.mid b{color:#FCD34D}
.hr small{display:block;font:600 11px/1.2 var(--ui);letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin-top:2px}
.algo-hero{background:linear-gradient(135deg,rgba(255,138,87,.16),rgba(124,58,237,.12));border:1px solid var(--edge);border-radius:16px;padding:18px 18px 14px;margin:12px 0 16px}.algo-hero h2{margin:0 0 8px;font:800 20px/1.2 var(--disp)}.algo-hero p{margin:6px 0;font-size:14.5px;color:var(--mute)}.algo-hero b{color:var(--ink)}.algo-stats{display:flex;gap:10px;margin:12px 0 4px;flex-wrap:wrap}.algo-stats div{flex:1 1 140px;background:var(--card);border:1px solid var(--edge);border-radius:12px;padding:10px 12px}.algo-stats b{display:block;font:800 26px/1 var(--disp);color:#4ADE80}.algo-stats span{font-size:12.5px;color:var(--mute)}.algo-stats .bad b{color:var(--mute)}
.ln{grid-area:ln;font-size:15px;font-weight:700}
.pl{grid-area:pl;display:flex;gap:4px}
.pl i{flex:1;height:8px;border-radius:3px;max-width:26px}
.pl i.y{background:#4ADE80}.pl i.n{background:rgba(255,255,255,.14)}
.ex{grid-area:ex;font-size:12px;color:var(--mute);white-space:nowrap;text-align:right}
.ex em{font-style:normal;color:var(--ball);font-weight:700;margin-right:8px}
.lr{grid-template-areas:"av who hr" "ln ln ln" "pl pl pl" "ex ex ex"}
.lr .ex{text-align:left}.lr .pl i{max-width:none}
.lr .ln{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sd{font:800 12px/1 var(--ui);letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border-radius:7px;background:#4ADE80;color:#052e16}
.lr.moins .sd{background:#7DD3FC;color:#082f49}
.lr.moins .pl i.y{background:#7DD3FC}
.lr .hr b{color:var(--ink)}
.pj{margin-left:auto;font-size:12.5px;font-weight:600;color:var(--mute)}
.h1b{font:800 26px/1.1 var(--disp);margin:6px 0 8px}
.intro+.slist+.band{margin-bottom:30px}
.chips{margin:4px 0 6px}
.sect{display:flex;justify-content:space-between;align-items:baseline;margin:26px 0 4px}
.sect h2{margin:0}
.sect span{font-size:13px;color:var(--mute)}
.band{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:14px 16px;margin:18px 0}
.band b{display:block;font-size:16px}.band span{font-size:13px;color:var(--mute)}
.band .go{flex:none;background:var(--ink);color:var(--night);font-weight:700;font-size:14px;padding:9px 14px;border-radius:10px}
.flinks{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0 0 14px;font-size:13px}
.flinks a{color:var(--ink);opacity:.8}
.about p{max-width:62ch}
`;
// Fiche joueur : le bandeau « prochain match » passe en bas de la carte pour ne pas cacher le visage
export const HERO_FIX_CSS = `.hero{min-height:440px!important;text-align:center;background:radial-gradient(120% 70% at 50% 38%,color-mix(in srgb,var(--c2) 38%,var(--c1)),var(--c1) 55%,color-mix(in srgb,var(--c1) 40%,#05060C))!important}.hero::before{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 34px,transparent 34px 92px)}.hero .ph{left:50%!important;right:auto!important;transform:translateX(-50%);width:92%!important;bottom:58px!important;-webkit-mask-image:linear-gradient(#000 85%,transparent);mask-image:linear-gradient(#000 85%,transparent)}.hero .ph.nhl{width:80%!important}.hero .art{opacity:.28}.hero .first-n,.hero .last-n,.hero .team{text-shadow:0 2px 10px rgba(0,0,0,.55)}.hero .next{position:absolute;left:14px;right:14px;bottom:14px;margin:0;z-index:3;background:rgba(6,8,16,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}`;
