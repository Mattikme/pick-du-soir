// Pages NHL : séries du soir, fiche joueur, visuel réseaux (même design que la partie NBA)
import { sql } from './jobs.js';
import { usDate } from './ttfl.js';
import { page, esc, num, hourFR, dayFR, shortDay, splitName, artColor, INJ, visualPage, tcgCard, TCG_CSS, TCG_JS, SEARCH, avatarSvg, avatar, photo, pickTop, pickCategories, serieLine } from './site.js';
import { NHL_TEAMS, NHL_STATS, nhlLine, nhlLadder, nhlBestLine } from './nhl.js';
import { rateClass, cellClass } from './series-pages.js';
import { injuryFR } from './injury-fr.js';
import { seriesRow, lastTen } from './ui.js';
import { AD } from './ads.js';

const ntc = (t) => (NHL_TEAMS[t] ? [NHL_TEAMS[t][2], NHL_TEAMS[t][3]] : ['#3A4170', '#8B93B5']);
const frac = (h, n) => `${h}/${n}`;
const TABS = [['all', 'Toutes'], ['g', 'Buts'], ['a', 'Passes déc.'], ['p', 'Points'], ['streak', 'Streak']];
const injChip = (s) => (!s ? '' : `<span class="chip ${/Out|Reserve|IR/.test(s) ? 'out' : 'warn'}">${esc(INJ[s] || (/Reserve|IR/.test(s) ? 'Absent' : s))}</span>`);
const vs = (r) => `${r.home ? 'vs' : '@'} ${esc(r.opp)}`;
// Le numéro de maillot en filigrane remplace la silhouette (pas d'image de joueur)
const jersey = (n, c2) => (n || n === 0 ? `<span class="jn" style="--jc:${artColor(c2)}">${n}</span>` : '');
const NHL_CSS = `<style>
.pc .jn,.hero .jn{position:absolute;z-index:-1;font:900 var(--disp);line-height:.8;color:transparent;-webkit-text-stroke:3px var(--jc);opacity:.38;letter-spacing:-.04em}
.pc .jn{right:-4%;top:18%;font-size:170px}.hero .jn{right:2%;top:8%;font-size:190px;opacity:.28}
</style>`;

async function nextDay() {
  const [d] = await sql.query(`SELECT (SELECT max(day) FROM nhl_trends)::text AS day`);
  return d?.day;
}
async function trendRows(day, stat, limit) {
  return sql.query(
    `SELECT tr.*, pl.name, pl.slug, pl.position, pl.number, pl.team, (g.home = pl.team) AS home, g.start_utc, g.game_type, i.status AS inj
     FROM nhl_trends tr JOIN nhl_players pl ON pl.id = tr.player_id JOIN nhl_games g ON g.id = tr.game_id
     LEFT JOIN nhl_injuries i ON i.player_id = tr.player_id
     WHERE tr.day = $1 AND ($2 = 'all' OR ($2 = 'streak' AND tr.streak >= 3) OR tr.stat = $2)
     ORDER BY ${stat === 'streak' ? 'tr.streak DESC, ' : ''}(tr.l10::float / NULLIF(tr.n10, 0)) DESC NULLS LAST, tr.score DESC, tr.threshold DESC LIMIT ${stat === 'streak' ? 300 : limit}`, [day, stat]).then((rows) => {
      if (stat !== 'streak') return rows;
      const seen = new Set(); const out = rows.filter((r) => !seen.has(r.player_id) && seen.add(r.player_id)).slice(0, limit);
      out.forEach((r, i) => { r.rank = i + 1; }); return out;
    });
}

function card(r, first) {
  const [c1, c2] = ntc(r.team);
  const [fn, ln] = splitName(r.name);
  const badge = r.l10 === r.n10 ? ['10 sur 10', 'elite'] : r.l5 === r.n5 ? ['5 sur 5', 'top'] : ['Régulier', 'solid'];
  return `<a class="pc${first ? ' first' : ''}${badge[1] === 'elite' ? ' foil' : ''}" href="/nhl/joueur/${esc(r.slug)}?stat=${r.stat}" style="--c1:${c1};--c2:${c2}">${avatarSvg('nhl', r.player_id, artColor(c2), c1, r.number)}${photo('nhl', r.player_id, r.team)}
  <div class="row"><span class="rank">№ ${String(r.rank).padStart(2, '0')}</span><span class="tier ${badge[1]}">${badge[1] === 'elite' ? '✦ ' : ''}${badge[0]}</span></div>
  <div class="mt"><b>${esc(r.team)} ${vs(r)}</b> · ${hourFR(r.start_utc)}${injChip(r.inj)}${r.streak >= 3 ? ` · Série ${r.streak}` : ''}</div>
  <span class="line">${esc(nhlLine(r.stat, r.threshold))}</span>
  <div class="score">${r.l10}<small>/${r.n10}</small></div><div class="unit">sur ses 10 derniers matchs</div>
  <div class="rates"><span>5 derniers<b>${frac(r.l5, r.n5)}</b></span><span>20 derniers<b>${frac(r.l20, r.n20)}</b></span>${r.nh2h ? `<span>vs ${esc(r.opp)}<b>${frac(r.h2h, r.nh2h)}</b></span>` : ''}</div>
  <span class="first-n">${esc(fn)}</span><span class="last-n">${esc(ln)}</span></a>`;
}

export async function nhlHome(origin, q) {
  const stat = NHL_STATS[q?.get('stat')] || q?.get('stat') === 'streak' ? q.get('stat') : 'all';
  const day = await nextDay();
  const rows = day ? await trendRows(day, stat, 60) : [];
  const tabs = `<nav class="chips" aria-label="Filtrer par stat">${TABS.map(([k, l]) => `<a href="${k === 'all' ? '/nhl' : `/nhl?stat=${k}`}" class="${k === stat ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  if (!rows.length) {
    return page({ title: 'Séries NHL du soir | Pick du Soir', description: 'Les séries de stats des joueurs NHL qui jouent ce soir.', canonical: origin + '/nhl', nav: 'nhl',
      body: `<h1>Pas de série NHL ce soir</h1>${tabs}<p class="empty">Les séries apparaissent ici dès que le calendrier propose des matchs.</p>` });
  }
  rows.forEach((r, i) => { r.rank = i + 1; });
  const seen = new Set(), top = [];
  for (const r of rows) { if (!seen.has(r.player_id)) { seen.add(r.player_id); top.push(r); } if (top.length === 5) break; }
  const topIds = new Set(top.map((r) => `${r.player_id}-${r.stat}`));
  const rest = rows.filter((r) => !topIds.has(`${r.player_id}-${r.stat}`));
  const [info] = await sql.query(`SELECT count(*)::int AS n, min(start_utc) AS first FROM nhl_games WHERE game_date = $1`, [day]);
  const longest = [...rows].sort((a, b) => b.streak - a.streak)[0];
  const scorers = rows.filter((r) => r.stat === 'g').length;
  const hist = await lastTen('nhl', rows, day);
  const items = rows.map((r) => seriesRow(r, { href: `/nhl/joueur/${esc(r.slug)}?stat=${r.stat}`, color: ntc(r.team)[0], photoHtml: photo('nhl', r.player_id, r.team),
    line: nhlLine(r.stat, r.threshold), meta: `${esc(r.team)} ${r.home ? 'vs' : '@'} ${esc(r.opp)} · ${hourFR(r.start_utc)}${injChip(r.inj)}`, vals: hist.get(`${r.player_id}-${r.stat}`) }));
  void longest; void scorers; void rest;
  const seenP = new Set(), main = [], others = [];
  rows.forEach((r, i) => { if (main.length < 12 && !seenP.has(r.player_id)) { seenP.add(r.player_id); main.push(items[i]); } else others.push(items[i]); });
  const body = `${NHL_CSS}<section class="intro"><p class="kick">NHL · ${esc(dayFR(day))}</p><h1>Les joueurs en série ce soir</h1>
  <p class="lede">${info.n} match${info.n > 1 ? 's' : ''} ce soir, premier à ${hourFR(info.first)}. Du plus régulier au moins régulier.</p>
  <div class="howto"><span><b>8/10</b> = palier atteint dans 8 de ses 10 derniers matchs. Barres : ses 10 derniers matchs, en vert quand le palier est atteint.</span></div></section>
  ${SEARCH}
  ${tabs}
  <div class="slist">${main.join('')}</div>
  ${AD('milieu')}
  <a class="band" href="/algo?sport=nhl"><span><b>Les lignes NHL du soir</b><span>Plus ou moins de tirs cadrés, joueur par joueur.</span></span><span class="go">Voir</span></a>
  ${others.length ? `<div class="sect"><h2>Les autres séries</h2><span>${others.length}</span></div><div class="slist">${others.join('')}</div>` : ''}
  <p class="tip">Une série passée ne garantit pas le prochain match : temps de glace, blessures et adversaire comptent.</p>`;
  return page({ title: `Séries NHL du ${dayFR(day)} : buts, passes, points | Pick du Soir`,
    description: `${top[0].name} : ${nhlLine(top[0].stat, top[0].threshold)} dans ${top[0].l10} de ses 10 derniers matchs. Toutes les séries des joueurs NHL du soir.`,
    canonical: origin + '/nhl', body, nav: 'nhl' });
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export async function nhlPlayer(slug, origin, q) {
  const stat = NHL_STATS[q?.get('stat')] ? q.get('stat') : 'p';
  const [p] = await sql.query(`SELECT * FROM nhl_players WHERE slug = $1 ORDER BY on_roster DESC, last_game_date DESC NULLS LAST LIMIT 1`, [slug]);
  if (!p) return null;
  const [next] = p.team ? await sql.query(
    `SELECT start_utc, game_date::text AS d, game_type, (home = $1) AS home, CASE WHEN home = $1 THEN away ELSE home END AS opp
     FROM nhl_games WHERE (home = $1 OR away = $1) AND game_date >= $2 AND state NOT IN ('FINAL', 'OFF') ORDER BY start_utc LIMIT 1`, [p.team, usDate()]) : [];
  const [games, inj] = await Promise.all([
    sql.query(`SELECT * FROM (SELECT game_date::text AS d, opp, home, toi, goals, assists, points, sog,
                 row_number() OVER (ORDER BY game_date DESC) AS rn FROM nhl_player_games WHERE player_id = $1 AND game_type IN (2, 3)) x
               WHERE rn <= 20 OR opp = $2 ORDER BY rn`, [p.id, next?.opp || '']),
    sql.query(`SELECT status, detail FROM nhl_injuries WHERE player_id = $1 LIMIT 1`, [p.id]),
  ]);
  for (const g of games) g.rn = Number(g.rn);
  const i = inj[0];
  const [c1, c2] = ntc(p.team);
  const [fn, ln] = splitName(p.name);
  const st = NHL_STATS[stat];
  const lad = nhlLadder(games, stat, next?.opp);
  const best = nhlBestLine(games, stat, next?.opp, false);
  const recent = games.filter((g) => g.rn <= 10);
  const vals = recent.map(st.val);
  const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  const mark = best ? best.threshold : 1;
  const last10 = recent.slice().reverse();
  const max = Math.max(mark * 1.6, ...last10.map(st.val), 1);
  const bars = last10.map((g) => { const v = st.val(g); return `<div><span>${v}</span><b class="${v >= mark ? 'ok' : 'ko'}" style="height:${Math.max(4, Math.round((v / max) * 110))}px" title="${esc(shortDay(g.d))}"></b><em>${esc(g.opp || '')}</em></div>`; }).join('');
  const markPx = Math.round((mark / max) * 110) + 22;
  const tabs = `<nav class="chips" aria-label="Choisir une stat">${TABS.filter(([k]) => k !== 'all' && k !== 'streak').map(([k, l]) => `<a href="/nhl/joueur/${esc(p.slug)}?stat=${k}" class="${k === stat ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  const grid = lad.slice().reverse().map((r) => `<tr><td class="t">${r.threshold}+</td>
    <td><span class="cell ${cellClass(r.l5, r.n5)}">${frac(r.l5, r.n5)}</span></td>
    <td><span class="cell ${cellClass(r.l10, r.n10)}">${frac(r.l10, r.n10)}</span></td>
    <td><span class="cell ${cellClass(r.l20, r.n20)}">${frac(r.l20, r.n20)}</span></td>
    ${next ? `<td>${r.nh2h ? `<span class="cell ${cellClass(r.h2h, r.nh2h)}">${frac(r.h2h, r.nh2h)}</span>` : '–'}</td>` : ''}</tr>`).join('');
  const log = games.filter((g) => g.rn <= 15).map((x) => `<tr><td>${esc(shortDay(x.d))}</td><td>${x.home ? 'vs' : '@'} ${esc(x.opp)}</td>
    <td class="n">${x.goals}</td><td class="n">${x.assists}</td><td class="n sc">${x.points}</td><td class="n">${x.sog}</td><td class="n">${mmss(x.toi)}</td></tr>`).join('');
  const POS = { C: 'centre', L: 'ailier gauche', R: 'ailier droit', D: 'défenseur', G: 'gardien' };
  const team = NHL_TEAMS[p.team];
  const [hc] = await sql.query(`SELECT 1 AS x FROM nhl_trends WHERE day = (SELECT max(day) FROM nhl_trends) AND player_id = $1 LIMIT 1`, [p.id]).catch(() => []);
  const hasCard = !!hc && !!next;
  const rows0 = lad.slice().reverse(), cr = best || rows0.find((x) => x.n10 >= 5 && x.l10 >= 6) || rows0.find((x) => x.n10 >= 3 && x.l10 >= 5) || rows0.find((x) => x.n10 >= 3) || null;
  const card = cr && next ? tcgCard({ ...cr, stat, name: p.name, team: p.team, player_id: p.id, slug: p.slug, opp: next.opp, home: next.home, start_utc: next.start_utc, rank: 1, inj: i?.status }, 1, 'nhl', null, { solo: true, colors: [c1, c2], label: nhlLine(stat, cr.threshold) }) : '';
  const body = `${NHL_CSS}${(void card, null) ? `<style>${TCG_CSS}</style><div class="solo">${card}</div>${TCG_JS}<section class="hero mini"><div class="team">${team ? `${esc(team[0])} ${esc(team[1])}` : esc(p.team || '')}${i ? injChip(i.status) : ''}</div><div class="next">Prochain match ${next.home ? 'contre' : 'à'} <b>${esc(next.opp)}</b>, ${esc(dayFR(next.d))} à ${hourFR(next.start_utc)}</div></section>` : `<section class="hero" style="--c1:${c1};--c2:${c2}">${avatarSvg('nhl', p.id, artColor(c2), c1, p.number)}${photo('nhl', p.id, p.team)}
    <span class="first-n">${esc(fn)}</span><span class="last-n">${esc(ln)}</span>
    <div class="team">${team ? `${esc(team[0])} ${esc(team[1])}` : esc(p.team || '')}${p.position ? `, ${esc(POS[p.position] || p.position)}` : ''}${i ? injChip(i.status) : ''}</div>
    <div class="next">${next ? `Prochain match ${next.home ? 'contre' : 'à'} <b>${esc(next.opp)}</b>, ${esc(dayFR(next.d))} à ${hourFR(next.start_utc)}${next.game_type === 1 ? ' (présaison)' : ''}` : 'Pas de match programmé'}</div>
  </section>`}
  ${hasCard ? `<a class="band" href="/carte/nhl/${esc(p.slug)}.png?stat=${stat}" download><span><b>La carte du soir de ${esc(p.name)}</b><span>Image à télécharger et partager sur X, Insta ou WhatsApp.</span></span><span class="go">Télécharger</span></a>` : ''}
  ${i?.detail ? `<p class="note" style="margin-top:12px"><b>Dernière info :</b> ${esc(injuryFR(i.detail, i.status))}</p>` : ''}
  <h2>Ses séries</h2>${tabs}
  ${best ? `<p class="lede">Meilleure série : <b>${esc(nhlLine(stat, best.threshold))}</b> dans ${best.l10} de ses 10 derniers matchs${best.streak >= 3 ? `, ${best.streak} matchs de suite` : ''}. Moyenne sur 10 matchs : ${num(avg, 2)}.</p>` : `<p class="lede">Moyenne sur ses 10 derniers matchs : ${num(avg, 2)} ${esc(st.plural)}.</p>`}
  <div class="grid"><table><thead><tr><th>Palier</th><th>5 derniers</th><th>10 derniers</th><th>20 derniers</th>${next ? `<th>vs ${esc(next.opp)}</th>` : ''}</tr></thead><tbody>${grid}</tbody></table></div>
  <h2>Ses 10 derniers matchs</h2>
  <div class="chart"><div class="bars">${bars}<i class="line-mark" style="bottom:${markPx}px"></i></div><p class="legend">Barres vertes : ${esc(nhlLine(stat, mark))} atteint.</p></div>
  <h2>Match par match</h2>
  <div class="tbl"><table><thead><tr><th>Date</th><th>Match</th><th class="n">B</th><th class="n">A</th><th class="n">Pts</th><th class="n">Tirs</th><th class="n">Min</th></tr></thead><tbody>${log}</tbody></table></div>
  <p class="legend">B : buts · A : passes décisives · Min : temps de jeu.</p>`;
  const m = (k) => recent.length ? (recent.reduce((t, g) => t + (+g[k] || 0), 0) / recent.length).toFixed(2).replace('.', ',') : '0';
  return page({ title: `${p.name} : stats des 10 derniers matchs (buts, passes, points) | Pick du Soir`,
    description: `${p.name} (${p.team || ''}) sur ses 10 derniers matchs : ${m('goals')} but, ${m('assists')} passe et ${m('points')} point par match en moyenne. Séries sur 5, 10 et 20 matchs${next ? `, prochain match face à ${next.opp}` : ''}.`,
    canonical: `${origin}/nhl/joueur/${p.slug}`, body, nav: 'nhl' });
}

// Visuel « 5 séries du soir » NHL : même rendu que la NBA, numéro de maillot à la place de la silhouette
export async function nhlVisualSource() {
  const day = await nextDay();
  let rows = day ? (await trendRows(day, 'all', 80)).filter((r) => !r.inj) : [];
  // Filtre « joue vraiment » : 12 min de temps de glace en moyenne et 4 matchs joués sur les 5 derniers
  if (rows.length) {
    const ok = await sql.query(`SELECT pid FROM (SELECT pg.player_id AS pid, pg.toi AS sec,
      row_number() OVER (PARTITION BY pg.player_id ORDER BY gg.start_utc DESC) AS rn FROM nhl_player_games pg JOIN nhl_games gg ON gg.id = pg.game_id
      WHERE pg.player_id = ANY($1) AND gg.start_utc < now() AND pg.toi IS NOT NULL) x WHERE rn <= 5 GROUP BY pid HAVING count(*) FILTER (WHERE sec > 0) >= 4 AND avg(sec) >= 720`, [[...new Set(rows.map((r) => r.player_id))]]);
    const set = new Set(ok.map((r) => r.pid));
    rows = rows.filter((r) => set.has(r.player_id));
  }
  const cats = [
    { label: 'BUTS', test: (r) => r.stat === 'g' },
    { label: 'PASSES', test: (r) => r.stat === 'a' },
    { label: 'POINTS', test: (r) => r.stat === 'p' },
    { label: 'SÉRIE', prio: 4, test: () => true, sort: (a, b) => (b.streak || 0) - (a.streak || 0) },
    { label: 'SPÉCIAL', prio: 3, test: (r) => r.threshold >= 2, sort: (a, b) => b.threshold - a.threshold },
  ];
  const top = pickCategories(rows, cats).map((r) => {
    const [c1, c2] = ntc(r.team);
    const ph1 = `https://assets.nhle.com/mugs/nhl/latest/${r.player_id}.png`, art = `<img class="vart" style="opacity:1;height:112%;bottom:0" alt="" src="${ph1}">`;
    return { name: r.name, cat: r.cat, c1, c2, art, league: 'nhl', photo: ph1, photo2: `https://assets.nhle.com/mugs/nhl/20252026/${r.team}/${r.player_id}.png`, line: serieLine(r, nhlLine(r.stat, r.threshold)), meta: `${r.team} ${r.home ? 'vs' : '@'} ${r.opp} · ${hourFR(r.start_utc)}`, l10: r.l10, n10: r.n10, start: r.start_utc, pid: r.player_id, stat: r.stat, thr: r.threshold, gid: r.game_id };
  });
  const cards = rows.map((r) => { const [c1, c2] = ntc(r.team); return { name: r.name, slug: r.slug, c1, c2, league: 'nhl', photo: `https://assets.nhle.com/mugs/nhl/latest/${r.player_id}.png`, photo2: `https://assets.nhle.com/mugs/nhl/20252026/${r.team}/${r.player_id}.png`, team: r.team, opp: r.opp, home: r.home, hour: hourFR(r.start_utc), start: r.start_utc, stat: r.stat, thr: r.threshold, line: nhlLine(r.stat, r.threshold), l10: r.l10, n10: r.n10, l5: r.l5, n5: r.n5, l20: r.l20, n20: r.n20, streak: r.streak || 0, avg: r.avg10 != null ? +r.avg10 : null, score: r.score, pid: r.player_id, gid: r.game_id }; });
  return { day, top, cards, kicker: 'NHL · Ce soir', league: 'NHL', emoji: '🏒', tags: '#NHL #NHLPicks #TeamParieur', base: '/nhl/visuel', file: 'nhl' };
}
export const nhlVisual = (origin, q) => visualPage(origin, q, nhlVisualSource);
