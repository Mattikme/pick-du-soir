// Point d'entrée Neon Function : robot de stats + API publique des picks
import { homePage, playerPage, playersIndex, ideasPage, roadmapPage, classementPage, NEWS_LIST, sitemap, notFound, visualPage, nbaVisual, dayFR, page, algoPage, tc, hourFR } from '../lib/site.js';
import { renderNews, renderPng, tweetText, recapText, xUpload, xTweet, xMe, xMetrics } from '../lib/xpost.js';
import { usDate } from '../lib/ttfl.js';
import { STATS } from '../lib/trends.js';
import { fiabilitePage, fiabiliteCsv } from '../lib/fiabilite.js';
import { nhlHome, nhlPlayer, nhlVisual, nhlVisualSource } from '../lib/nhl-site.js';
import { planSets, renderCards, cardsTweet, picksOf, loadHist, renderRecap, recapTweet, renderSingle, pollTweet, isStar, algoTweet, renderWeek } from '../lib/xcards.js';
import { algoRows, algoTables, settled, lineText } from '../lib/algo.js';
import { fr1, statName, won } from '../lib/lignes.js';
import { matchPage, saveLines } from '../lib/match-pages.js';
import { programmePage } from '../lib/programme.js';
import { teamPage } from '../lib/team-pages.js';
import { withAds, adsTxt } from '../lib/ads.js';
import { legalPage } from '../lib/legal.js';
import { NHL_TEAMS } from '../lib/nhl.js';
import { nhlSchedule, nhlPending, nhlRosters, nhlInjuries, nhlTrends, nhlBootstrap, nhlBackfill } from '../lib/nhl.js';
import { syncSchedule, ingestPending, backfill, syncInjuries, buildPicks, buildTrends, bootstrap, log, sql } from '../lib/jobs.js';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function nhlDaily() {
  const r = {};
  for (const [k, f] of [['schedule', () => nhlSchedule()], ['boxscores', () => nhlPending(80)], ['roster', nhlRosters], ['injuries', nhlInjuries], ['trends', () => nhlTrends()]]) {
    try { r[k] = await f(); } catch (e) { r[k] = { error: String(e).slice(0, 200) }; }
  }
  return r;
}


// ---- Horaire adaptatif : on teste plusieurs créneaux (heure de Paris), on mesure, on garde le meilleur ----
const SLOTS = ['17:00', '19:00', '20:30', '22:00'];
async function xTables() {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_posts (league text, day date, tweet_id text, text text, posted_at timestamptz DEFAULT now(), PRIMARY KEY (league, day))`);
  for (const c of ['slot text', 'impressions int', 'likes int', 'reposts int', 'replies int', 'bookmarks int', 'measured_at timestamptz'])
    await sql.query(`ALTER TABLE x_posts ADD COLUMN IF NOT EXISTS ${c}`);
  await sql.query(`ALTER TABLE x_posts ADD COLUMN IF NOT EXISTS picks jsonb`);
  await sql.query(`CREATE TABLE IF NOT EXISTS x_recaps (league text, day date, tweet_id text, text text, posted_at timestamptz DEFAULT now(), PRIMARY KEY (league, day))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS x_cards (league text, day date, key text, tweet_id text, text text, slot text, picks jsonb, posted_at timestamptz DEFAULT now(), impressions int, likes int, reposts int, replies int, bookmarks int, measured_at timestamptz, PRIMARY KEY (league, day, key))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS x_plan (league text, day date, slot text, mode text, PRIMARY KEY (league, day))`);
}
const parisParts = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
function slotMs(day, slot) {
  const [y, m, d] = day.split('-').map(Number), [h, mi] = slot.split(':').map(Number);
  for (const off of [2, 1]) { const t = Date.UTC(y, m - 1, d, h, mi) - off * 36e5; const p = parisParts(t); if (+p.hour % 24 === h && +p.minute === mi) return t; }
  return Date.UTC(y, m - 1, d, h, mi) - 2 * 36e5;
}
const score = (r) => (r.imp || 0) + 25 * ((r.likes || 0) + 2 * (r.reposts || 0) + 2 * (r.replies || 0) + (r.bookmarks || 0));
async function xStats() {
  const rows = await sql.query(`SELECT slot, count(*)::int n, avg(impressions)::float imp, avg(likes)::float likes, avg(reposts)::float reposts, avg(replies)::float replies, avg(bookmarks)::float bookmarks FROM x_posts WHERE slot IS NOT NULL AND measured_at IS NOT NULL GROUP BY slot`);
  return Object.fromEntries(rows.map((r) => [r.slot, { ...r, score: score(r) }]));
}
async function chooseSlot(league, src) {
  const earliest = Math.min(...src.top.map((r) => (r.start ? new Date(r.start).getTime() : Infinity)));
  let allowed = SLOTS.filter((sl) => slotMs(src.day, sl) < earliest - 45 * 6e4);
  if (!allowed.length) allowed = [SLOTS[0]];
  const st = await xStats();
  const n = (sl) => st[sl]?.n || 0;
  const least = allowed.slice().sort((a, b) => n(a) - n(b) || (a < b ? -1 : 1));
  const day = Math.floor(Date.parse(src.day) / 864e5);
  if (n(least[0]) < 2) return { slot: least.filter((sl) => n(sl) === n(least[0]))[day % least.filter((sl) => n(sl) === n(least[0])).length], mode: 'exploration' };
  if (Math.random() < 0.2) return { slot: least[0], mode: 'exploration' };
  const best = allowed.slice().sort((a, b) => (st[b]?.score || 0) - (st[a]?.score || 0))[0];
  return { slot: best, mode: 'meilleur' };
}
async function xCollect() {
  const rows = await sql.query(`SELECT tweet_id FROM x_posts WHERE measured_at IS NULL AND posted_at < now() - interval '20 hours' AND posted_at > now() - interval '7 days' LIMIT 50`);
  if (!rows.length) return { measured: 0 };
  const data = await xMetrics(rows.map((r) => r.tweet_id), process.env);
  for (const t of data) {
    const m = t.public_metrics || {};
    await sql.query(`UPDATE x_posts SET impressions=$2, likes=$3, reposts=$4, replies=$5, bookmarks=$6, measured_at=now() WHERE tweet_id=$1`,
      [t.id, m.impression_count ?? 0, m.like_count ?? 0, m.retweet_count ?? 0, m.reply_count ?? 0, m.bookmark_count ?? 0]);
  }
  return { measured: data.length };
}
async function xCollectCards() {
  const rows = await sql.query(`SELECT tweet_id FROM x_cards WHERE measured_at IS NULL AND posted_at < now() - interval '20 hours' AND posted_at > now() - interval '7 days' LIMIT 50`);
  if (!rows.length) return { measured: 0 };
  const data = await xMetrics(rows.map((r) => r.tweet_id), process.env);
  for (const t of data) {
    const m = t.public_metrics || {};
    await sql.query(`UPDATE x_cards SET impressions=$2, likes=$3, reposts=$4, replies=$5, bookmarks=$6, measured_at=now() WHERE tweet_id=$1`,
      [t.id, m.impression_count ?? 0, m.like_count ?? 0, m.retweet_count ?? 0, m.reply_count ?? 0, m.bookmark_count ?? 0]);
  }
  return { measured: data.length };
}
// Une réponse par jour avec le lien du site, sous le premier tweet en cartes (un tweet avec lien coûte plus cher : 1 seul/jour)
const LINK_TXT = [
  '👉 Toutes les séries du soir, joueur par joueur, avec les 5/10/20 derniers matchs : https://www.pickdusoir.fr',
  '📊 Les autres séries NBA et NHL de ce soir sont sur le site (gratuit) : https://www.pickdusoir.fr',
  '📈 Les lignes du soir, Plus ou Moins, avec la projection de chaque joueur (gratuit) : https://www.pickdusoir.fr/algo',
];
async function xReplyLink(tweetId, day) {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_reply (day date PRIMARY KEY, tweet_id text, parent text, ts timestamptz DEFAULT now())`);
  const [done] = await sql.query(`SELECT 1 FROM x_reply WHERE day = $1`, [day]);
  if (done) return 'déjà fait';
  const text = LINK_TXT[Math.floor(Date.parse(day) / 864e5) % LINK_TXT.length];
  const id = await xTweet(text, null, process.env, tweetId);
  await sql.query(`INSERT INTO x_reply (day, tweet_id, parent) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [day, id, tweetId]);
  return { reply: id };
}
// Sondage du soir (19h, heure de Paris) : « plus ou moins ? » sur la ligne de référence d'un joueur connu, NBA en priorité
const POLL_COLS = `ALTER TABLE x_poll ADD COLUMN IF NOT EXISTS league text, ADD COLUMN IF NOT EXISTS stat text, ADD COLUMN IF NOT EXISTS thr numeric, ADD COLUMN IF NOT EXISTS gid text, ADD COLUMN IF NOT EXISTS line text, ADD COLUMN IF NOT EXISTS answer_id text, ADD COLUMN IF NOT EXISTS kind text`;
async function xPoll(dry) {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_poll (day date PRIMARY KEY, tweet_id text, pid int, name text, ts timestamptz DEFAULT now())`);
  await sql.query(POLL_COLS);
  const today = usDate();
  const [done] = await sql.query(`SELECT 1 FROM x_poll WHERE day = $1`, [today]);
  if (done && !dry) return 'déjà fait';
  const [cfg] = await sql.query(`SELECT bool_or(enabled) AS on FROM x_config`);
  if (!dry && !cfg?.on) return 'désactivé';
  const recent = new Set((await sql.query(`SELECT pid FROM x_poll WHERE day >= $1::date - 4`, [today])).map((r) => r.pid)); // pas le même joueur deux fois de suite
  for (const lg of ['nba', 'nhl']) {
    const pool = (await algoRows(today, { league: lg, refs: true })).filter((c) => isStar(lg, c.name) && c.start_utc && new Date(c.start_utc).getTime() > Date.now() + 60 * 6e4)
      .sort((a, b) => recent.has(a.player_id) - recent.has(b.player_id) || b.avg10 - a.avg10);
    const c = pool[0];
    if (!c) continue;
    const { text, options } = pollTweet({ name: c.name, league: lg, team: c.team, text: `${fr1(c.line)} ${statName(c.stat, c.line)}`, avg: c.avg10 });
    if (dry) return { dry: true, text, options };
    const id = await xTweet(text, null, process.env, null, { options, duration_minutes: 300 });
    await sql.query(`INSERT INTO x_poll (day, tweet_id, pid, name, league, stat, thr, gid, line, kind) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pm') ON CONFLICT DO NOTHING`, [today, id, c.player_id, c.name, lg, c.stat, c.line, String(c.game_id), `${fr1(c.line)} ${statName(c.stat, c.line)}`]);
    return { tweet: id, joueur: c.name };
  }
  return 'pas de match';
}

// Réponse au sondage de la veille : qui avait raison, avec la performance réelle (en réponse au sondage)
async function xPollAnswer(dry) {
  await sql.query(POLL_COLS);
  const today = usDate();
  const rows = await sql.query(`SELECT day::text AS day, tweet_id, pid, name, league, stat, thr, gid, line, kind FROM x_poll WHERE day < $1 AND day >= $1::date - 1 AND answer_id IS NULL AND tweet_id IS NOT NULL ORDER BY day DESC`, [today]);
  const out = [];
  for (const r of rows) {
    let { league, stat, thr, gid, line } = r;
    if (!stat) { // sondages publiés avant l'ajout des colonnes : on retrouve la série dans les cartes du jour
      const [m] = await sql.query(`SELECT e, p.league FROM x_cards p, jsonb_array_elements(p.picks) e WHERE p.day = $1 AND (e->>'pid')::int = $2 LIMIT 1`, [r.day, r.pid]);
      if (!m) { out.push({ day: r.day, skip: 'série introuvable' }); continue; }
      league = m.league; stat = m.e.stat; thr = m.e.thr; gid = m.e.gid;
    }
    thr = Number(thr);
    let g, val, unit;
    if (league === 'nba') {
      [g] = await sql.query(`SELECT pts, reb, ast, tpm, stl, blk FROM player_games WHERE game_id = $1 AND player_id = $2 AND minutes > 0`, [gid, r.pid]);
      if (g) { val = STATS[stat].val(g); unit = STATS[stat].short; }
    } else {
      const [col, w] = NHL_COL[stat] || [];
      if (col) { [g] = await sql.query(`SELECT goals, assists, points, sog FROM nhl_player_games WHERE game_id = $1 AND player_id = $2`, [gid, r.pid]); if (g) { val = g[col]; unit = val > 1 ? w + 's' : w; } }
    }
    if (!g) { out.push({ day: r.day, attente: 'résultat pas encore là' }); continue; }
    const ok = val >= thr, who = String(r.name).trim().split(/\s+/).slice(-1)[0];
    const text = r.kind === 'pm'
      ? `🗳️ Réponse au sondage d'hier : ${r.name}, plus ou moins de ${line} ?\n\n${ok ? '📈 Les « Plus » avaient raison' : '📉 Les « Moins » avaient raison'} : ${who} termine avec ${val} ${statName(stat, val)}.\n\nNouveau sondage ce soir.\n\nStats informatives, pas un conseil de pari.`
      : `🗳️ Réponse au sondage d'hier : ${r.name}${line ? ' : ' + line : ''} ?\n\n${ok ? '✅ Les « Oui » avaient raison' : '❌ Les « Non » avaient raison'} : ${who} termine avec ${val} ${unit} (palier ${thr}+).\n\n${ok ? 'Bravo à ceux qui y ont cru.' : 'Bien vu pour ceux qui ont voté Non.'} Nouveau sondage ce soir.\n\nStats informatives, pas un conseil de pari.`;
    if (dry) { out.push({ dry: true, day: r.day, text }); continue; }
    const id = await xTweet(text, null, process.env, r.tweet_id);
    await sql.query(`UPDATE x_poll SET answer_id = $2 WHERE day = $1`, [r.day, id]);
    out.push({ day: r.day, tweet: id });
  }
  return out.length ? out : 'rien à répondre';
}

// ---- Lignes du soir : un visuel par ligue et par jour, et le bilan du lendemain ----
const ALGO_SLOT = { nba: '18:00', nhl: '20:00' }; // heure de Paris
const shortName = (n) => String(n).trim().split(/\s+/).slice(1).join(' ') || n;
const algoCardsOf = (rows, league) => rows.map((r) => {
  const nhl = league === 'nhl', [c1, c2] = nhl ? (NHL_TEAMS[r.team] || []).slice(2, 4) : tc(r.team);
  return { name: r.name, c1, c2, league, photo: nhl ? `https://assets.nhle.com/mugs/nhl/latest/${r.player_id}.png` : `https://cdn.nba.com/headshots/nba/latest/1040x760/${r.player_id}.png`,
    photo2: nhl ? `https://assets.nhle.com/mugs/nhl/20252026/${r.team}/${r.player_id}.png` : null, team: r.team, opp: r.opp, home: r.home, hour: hourFR(r.start_utc), start: r.start_utc,
    stat: r.stat, thr: r.line, side: r.side, line: lineText(r), short: lineText(r), l10: r.l10, n10: r.n10, l5: r.l5, n5: r.n5, l20: r.l20, n20: r.n20, streak: 0, avg: r.avg10, proj: r.proj, prob: r.p, pid: r.player_id, gid: String(r.game_id), hist: r.vals };
});
async function xAlgo(league, dry) {
  await xTables(); await algoTables();
  const [cfg] = await sql.query(`SELECT enabled FROM x_config WHERE league = $1`, [league]);
  if (!dry && !cfg?.enabled) return 'désactivé';
  const today = usDate(), slot = ALGO_SLOT[league];
  const [done] = await sql.query(`SELECT 1 FROM x_cards WHERE league = $1 AND day = $2 AND key = 'algo'`, [league, today]);
  if (done && !dry) return 'déjà fait';
  if (!dry && Date.now() < slotMs(today, slot)) return `prévu à ${slot}`;
  if (!dry && Date.now() > slotMs(today, slot) + 4 * 3600e3) return 'créneau passé'; // pas de tweet en pleine nuit si le créneau a été manqué
  const rows = await algoRows(today, { league, limit: 4, future: true });
  if (rows.length < 3) return `pas assez de lignes (${rows.length})`;
  const st = { league, key: 'algo', title: 'Plus ou moins ?', tag: league === 'nhl' ? 'TIRS CADRÉS' : `${rows.length} LIGNES DU SOIR`, footer: 'TOUTES LES LIGNES · PICKDUSOIR.FR', slot, cards: algoCardsOf(rows, league), dateTxt: dayFR(today) };
  const text = algoTweet(st);
  const png = await renderCards(st);
  if (dry) return { dry: true, bytes: png.length, text, lignes: st.cards.map((c) => `${c.name} : ${c.line} (${Math.round(c.prob * 100)} %, projection ${c.proj})`) };
  const id = await xTweet(text, await xUpload(png, process.env), process.env);
  await sql.query(`INSERT INTO x_cards (league, day, key, tweet_id, text, slot, picks) VALUES ($1,$2,'algo',$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [league, today, id, text, slot, JSON.stringify(picksOf(st))]);
  for (const [i, c] of st.cards.entries()) await sql.query(`INSERT INTO algo_picks (day, rank, pid, name, stat, thr, p, gid, side, league) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [today, i + 1, c.pid, c.name, c.stat, c.thr, c.prob, c.gid, c.side, league]);
  let lien = null;
  try { // une seule réponse avec lien par jour (un tweet avec lien est moins diffusé)
    const [r0] = await sql.query(`SELECT 1 FROM x_reply WHERE day = $1`, [today]);
    if (!r0) { const rid = await xTweet(`👉 Toutes les lignes du soir, avec la projection de chaque joueur et nos résultats publics (gratuit) : https://www.pickdusoir.fr/algo${league === 'nhl' ? '?sport=nhl' : ''}`, null, process.env, id); await sql.query(`INSERT INTO x_reply (day, tweet_id, parent) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [today, rid, id]); lien = rid; }
  } catch (e) { lien = { error: String(e).slice(0, 200) }; }
  return { tweet: id, lien };
}
// Bilan des lignes de la veille : image ✅/❌ + total depuis le lancement, ratés compris
async function xAlgoRecap(league, dry) {
  await algoTables();
  const today = usDate();
  const [row] = await sql.query(`SELECT p.day::text AS day, bool_or(p.side IS NULL) AS old FROM algo_picks p WHERE p.league = $2 AND p.day < $1 AND p.day >= $1::date - 3 AND NOT EXISTS (SELECT 1 FROM algo_recaps r WHERE r.day = p.day AND r.league = p.league) GROUP BY p.day ORDER BY p.day DESC LIMIT 1`, [today, league]);
  if (!row) return 'rien à résumer';
  const [picks, all, [cnt]] = await Promise.all([settled({ day: row.day, old: true }), settled({ old: row.old }), sql.query(`SELECT count(*)::int AS n FROM algo_picks WHERE day = $1 AND league = $2`, [row.day, league])]);
  const mine = picks.filter((k) => k.league === league);
  if (mine.length < Math.min(3, cnt.n)) return { attente: 'résultats incomplets', n: mine.length };
  const label = (k) => (k.side ? lineText({ side: k.side, line: k.thr, stat: k.stat }) : `${Number(k.thr)}+ ${STATS[k.stat]?.short || k.stat}`);
  const ok = mine.filter((k) => k.ok).length, tot = all.filter((k) => k.league === league && (row.old ? !k.side : !!k.side));
  const tok = tot.filter((k) => k.ok).length, emoji = league === 'nhl' ? '🏒' : '🏀', tags = league === 'nhl' ? '#NHL #TeamParieur' : '#NBA #TeamParieur';
  const total = tot.length >= 8 ? `Depuis le lancement : ${tok}/${tot.length} (${Math.round(tok / tot.length * 100)} %), ratés compris.` : `Depuis le lancement : ${tok}/${tot.length}, ratés compris.`;
  let text = '';
  for (const full of [true, false]) {
    const lines = mine.map((k) => `${k.ok ? '✅' : '❌'} ${full ? shortName(k.name) : shortName(k.name).split(' ').slice(-1)[0]} : ${label(k)} → ${k.val}`);
    text = `${emoji} Bilan des lignes ${league.toUpperCase()} d'hier : ${ok}/${mine.length}\n\n${lines.join('\n')}\n\n${total}\nStats informatives, pas un conseil de pari.\n${tags}`;
    if (text.length <= 275) break;
  }
  const items = mine.map((k) => ({ name: k.name, ok: k.ok, val: k.val, short: statName(k.stat, k.val), goal: label(k) }));
  let png = null; try { png = await renderRecap(league, items, dayFR(row.day), null, null, ['LIGNES', 'RÉUSSIES', 'LES LIGNES DU SOIR'], row.old ? null : { ok: tok, n: tot.length }); } catch (e) { console.error('bilan lignes', e); }
  if (dry) return { dry: true, day: row.day, text, longueur: text.length, bytes: png?.length };
  const id = await xTweet(text, png ? await xUpload(png, process.env) : null, process.env);
  await sql.query(`INSERT INTO algo_recaps (day, league, tweet_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [row.day, league, id]);
  return { tweet: id };
}
// Bilan de la semaine (le lundi, heure de Paris) : toutes les lignes des 7 derniers jours, NBA et NHL, jour par jour
const parisDate = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(t));
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
async function xAlgoWeek(dry, force) {
  await algoTables();
  await sql.query(`CREATE TABLE IF NOT EXISTS algo_weeks (week date PRIMARY KEY, tweet_id text, ts timestamptz DEFAULT now())`);
  const today = parisDate();
  if (!dry && !force && new Date(today + 'T12:00:00Z').getUTCDay() !== 1) return 'le lundi seulement';
  const from = addDays(today, -7), to = addDays(today, -1);
  const [done] = await sql.query(`SELECT 1 FROM algo_weeks WHERE week = $1`, [from]);
  if (done && !dry) return 'déjà fait';
  const [cfg] = await sql.query(`SELECT bool_or(enabled) AS on FROM x_config`);
  if (!dry && !cfg?.on) return 'désactivé';
  const all = await settled(), rows = all.filter((r) => r.day >= from && r.day <= to);
  if (rows.length < 8) return `pas assez de lignes cette semaine (${rows.length})`;
  const cnt = (a) => ({ ok: a.filter((r) => r.ok).length, n: a.length }), week = cnt(rows), total = cnt(all), nba = cnt(rows.filter((r) => r.league === 'nba')), nhl = cnt(rows.filter((r) => r.league === 'nhl'));
  const byDay = new Map(); for (const r of [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.league < b.league ? -1 : a.league > b.league ? 1 : a.rank - b.rank))) { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r.ok); }
  const days = [...byDay].map(([d, marks]) => ({ label: new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00Z')), marks }));
  const parts = [nba.n ? `🏀 NBA ${nba.ok}/${nba.n}` : '', nhl.n ? `🏒 NHL ${nhl.ok}/${nhl.n}` : ''].filter(Boolean).join(' · ');
  const text = `📊 Bilan de la semaine : ${week.ok}/${week.n} lignes réussies (${Math.round(week.ok / week.n * 100)} %)\n\n${parts}\n\nChaque ligne est publiée avant le match, puis vérifiée. Les ratés restent affichés.\n\nStats informatives, pas un conseil de pari.\n#NBA #NHL #TeamParieur`;
  let png = null; try { png = await renderWeek(days, week, total, `${dayFR(from).split(' ').slice(1).join(' ')} – ${dayFR(to).split(' ').slice(1).join(' ')}`); } catch (e) { console.error('bilan semaine', e); }
  if (dry) return { dry: true, semaine: `${from} → ${to}`, text, longueur: text.length, bytes: png?.length, jours: days.map((d) => `${d.label} ${d.marks.filter(Boolean).length}/${d.marks.length}`) };
  const id = await xTweet(text, png ? await xUpload(png, process.env) : null, process.env);
  await sql.query(`INSERT INTO algo_weeks (week, tweet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [from, id]);
  return { tweet: id };
}
// Tweets en cartes : une image 2x2 par thème, créneaux fixes (heure de Paris)
async function xCards(league, dry, only) {
  await xTables();
  await sql.query(`CREATE TABLE IF NOT EXISTS x_config (league text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, test_once boolean NOT NULL DEFAULT false)`);
  const [cfg] = await sql.query(`SELECT enabled, test_once FROM x_config WHERE league = $1`, [league]);
  if (!dry && !cfg?.enabled && !cfg?.test_once) return 'désactivé';
  const today = usDate();
  const src = league === 'nba' ? await nbaVisual() : await nhlVisualSource();
  if (src.day !== today) return `pas de match (prochain : ${src.day})`;
  const done = await sql.query(`SELECT key FROM x_cards WHERE league = $1 AND day = $2`, [league, today]);
  const sets = planSets(league, src.cards).filter((st) => !done.some((d) => d.key === st.key) && (!only || only === st.key));
  const out = {};
  for (const st of sets) {
    if (!dry && Date.now() < slotMs(today, st.slot)) { out[st.key] = `prévu à ${st.slot}`; continue; }
    st.dateTxt = dayFR(today);
    const text = cardsTweet(st);
    if (dry) { try { await loadHist(sql, league, st.cards, STATS); } catch {} const png = await renderCards(st); out[st.key] = { dry: true, bytes: png.length, text, joueurs: st.cards.map((c) => c.name) }; continue; }
    // une seule publication par passage du cron (évite les rafales)
    try { await loadHist(sql, league, st.cards, STATS); } catch {}
    const png = await renderCards(st);
    const id = await xTweet(text, await xUpload(png, process.env), process.env);
    try { out.lien = await xReplyLink(id, today); } catch (e) { out.lien = { error: String(e).slice(0, 200) }; }
    await sql.query(`INSERT INTO x_cards (league, day, key, tweet_id, text, slot, picks) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [league, today, st.key, id, text, st.slot, JSON.stringify(picksOf(st))]);
    if (cfg?.test_once) await sql.query(`UPDATE x_config SET test_once = false WHERE league = $1`, [league]);
    out[st.key] = { tweet: id };
    break;
  }
  return Object.keys(out).length ? out : 'rien à publier';
}

const NHL_COL = { g: ['goals', 'but'], a: ['assists', 'passe'], p: ['points', 'point'], sog: ['sog', 'tir'] };
async function xRecap(league, dry) {
  const today = usDate();
  let [row] = await sql.query(`SELECT p.day::text AS day, jsonb_agg(e) AS picks FROM x_cards p, jsonb_array_elements(p.picks) e WHERE p.league = $1 AND p.key <> 'algo' AND p.day < $2 AND NOT EXISTS (SELECT 1 FROM x_recaps r WHERE r.league = p.league AND r.day = p.day) GROUP BY p.day ORDER BY p.day DESC LIMIT 1`, [league, today]);
  if (!row) [row] = await sql.query(`SELECT p.day::text AS day, p.picks FROM x_posts p WHERE p.league = $1 AND p.picks IS NOT NULL AND p.day < $2 AND NOT EXISTS (SELECT 1 FROM x_recaps r WHERE r.league = p.league AND r.day = p.day) ORDER BY p.day DESC LIMIT 1`, [league, today]);
  if (!row) return 'rien à résumer';
  const items = [];
  for (const k of row.picks) {
    let g;
    if (league === 'nba') [g] = await sql.query(`SELECT pts, reb, ast, tpm, stl, blk FROM player_games WHERE game_id = $1 AND player_id = $2 AND minutes > 0`, [k.gid, k.pid]);
    else [g] = await sql.query(`SELECT goals, assists, points FROM nhl_player_games WHERE game_id = $1 AND player_id = $2`, [k.gid, k.pid]);
    if (!g) { items.push({ name: k.name, ok: null }); continue; }
    if (league === 'nba') { const v = STATS[k.stat].val(g); items.push({ name: k.name, ok: v >= k.thr, val: v, short: STATS[k.stat].short, unit: STATS[k.stat].short, thr: k.thr }); }
    else { const [col, w] = NHL_COL[k.stat]; const v = g[col]; items.push({ name: k.name, ok: v >= k.thr, val: v, short: v > 1 ? w + 's' : w, unit: k.thr > 1 ? w + 's' : w, thr: k.thr }); }
  }
  const played = items.filter((i) => i.ok !== null).length;
  if (played < 3) return { attente: 'résultats incomplets', played };
  const text = recapTweet(league, items);
  let png = null; try { png = await renderRecap(league, items, dayFR(row.day)); } catch (e) { console.error('bilan image', e); }
  if (dry) return { dry: true, day: row.day, text, bytes: png?.length };
  const id = await xTweet(text, png ? await xUpload(png, process.env) : null, process.env);
  await sql.query(`INSERT INTO x_recaps (league, day, tweet_id, text) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [league, row.day, id, text]);
  return { tweet: id, text };
}
async function xNews(dry) {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_news (key text PRIMARY KEY, tweet_id text, ts timestamptz DEFAULT now())`);
  const posted = await sql.query(`SELECT key, ts FROM x_news ORDER BY ts DESC`);
  const item = NEWS_LIST.find((n) => !posted.some((p) => p.key === n.key));
  if (!item) return 'rien en attente';
  const h = new Date().getUTCHours(), last = posted[0] ? Date.now() - new Date(posted[0].ts).getTime() : Infinity;
  const today = posted.filter((p) => Date.now() - new Date(p.ts).getTime() < 24 * 36e5).length;
  const png = await renderNews(item);
  const text = item.tweet.length <= 250 ? item.tweet + '\n#NBA #NHL' : item.tweet;
  if (dry) return { dry: true, next: item.key, bytes: png.length, text, attente_h: Math.max(0, 4 - last / 36e5) };
  if (h < (item.minUtc ?? 9) || h > 20) return 'hors créneau';
  if (last < 4 * 36e5) return 'trop tôt (espacement 4 h)';
  if (today >= 2) return 'quota du jour atteint (2)';
  const id = await xTweet(text, await xUpload(png, process.env), process.env);
  await sql.query(`INSERT INTO x_news (key, tweet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [item.key, id]);
  return { tweet: id, key: item.key };
}
// Tweet quotidien du Défi du soir (une fois par jour, avant les matchs) : donne envie de s'inscrire
const DEFI_TWEETS = [
  '🃏 Le Défi du soir est ouvert.\n\nChoisis ton niveau : Commun (Plus/Moins), Rare, Épique, Légendaire, ou Ultra légendaire si tu trouves le chiffre pile. Plus c\'est précis, plus la carte est rare.\n\n100 % gratuit, sans mise. Lien en bio 👇\n#TeamParieur #NBA #DéfiPickDuSoir',
  '🎯 Peux-tu trouver le chiffre exact ?\n\nDans le Défi du soir, un pronostic pile sur les points, rebonds ou passes d\'un joueur = carte Ultra légendaire.\n\nGratuit, sans mise, des pronostics chaque jour. Lien en bio 👇\n#TeamParieur #NBA #DéfiPickDuSoir',
  '🏀🏒 Ce soir : des pronostics NBA et NHL à poser sur le Défi du soir.\n\nPlus ta prédiction est serrée, plus ta carte est rare. Commun, Rare, Épique, Légendaire, Ultra.\n\nGratuit, sans mise. Lien en bio 👇\n#TeamParieur #NBA #DéfiPickDuSoir',
  '🃏 Une carte à collectionner par pronostic juste.\n\nTu annonces 10 rebonds ? En Rare, 7 à 13 rebonds suffisent. En Légendaire, la marge est bien plus serrée.\n\nLe Défi du soir est gratuit, sans mise. Lien en bio 👇\n#TeamParieur #NBA #DéfiPickDuSoir',
  '🔥 Qui va réussir son Ultra légendaire ce soir ?\n\nLe Défi du soir : pose tes pronostics avant le début des matchs, récupère tes cartes demain matin.\n\nGratuit, sans mise, sans e-mail. Lien en bio 👇\n#TeamParieur #NBA #DéfiPickDuSoir',
];
async function xDefi(dry) {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_defi (day date PRIMARY KEY, tweet_id text, ts timestamptz DEFAULT now())`);
  const today = usDate();
  const [done] = await sql.query(`SELECT tweet_id FROM x_defi WHERE day = $1`, [today]);
  if (done) return 'déjà publié';
  const src = await nbaVisual();
  const nh = await nhlVisualSource().catch(() => null);
  if (src.day !== today && nh?.day !== today) return 'pas de match aujourd\'hui';
  const n = Math.floor(Date.parse(today) / 864e5);
  const text = DEFI_TWEETS[n % DEFI_TWEETS.length];
  const item = NEWS_LIST.find((x) => x.key.startsWith('defi-'));
  const png = await renderNews(item);
  if (dry) return { dry: true, text, bytes: png.length };
  const h = new Date().getUTCHours();
  if (h < 15 || h > 20) return 'hors créneau (15h-20h UTC)';
  const id = await xTweet(text, await xUpload(png, process.env), process.env);
  await sql.query(`INSERT INTO x_defi (day, tweet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [today, id]);
  return { tweet: id };
}
// Rythme quotidien (nov. 2026) : moins de tweets, mieux ciblés. Par ligue : 1 visuel « lignes du soir » + 1 bilan le lendemain ; 1 sondage Plus/Moins
// et sa réponse. Les cartes de séries (3 par jour et par ligue : beaucoup d'impressions, presque aucune réaction) ne partent plus toutes seules ;
// elles restent disponibles à la main avec /run?job=xcards-nba.
async function xTick() {
  await xTables();
  const out = {}, h = new Date().getUTCHours();
  const run = async (key, f) => { try { out[key] = await f(); } catch (e) { out[key] = { error: String(e).slice(0, 300) }; } };
  await run('collect', xCollect);
  await run('collect_cards', xCollectCards);
  if (h >= 8) for (const league of ['nba', 'nhl']) {
    await run('bilan_series_' + league, async () => ((await sql.query(`SELECT enabled FROM x_config WHERE league = $1`, [league]))[0]?.enabled ? xRecap(league, false) : 'désactivé')); // solde des dernières cartes de séries
    await run('bilan_lignes_' + league, () => xAlgoRecap(league, false));
  }
  if (h >= 8) await run('reponse_sondage', () => xPollAnswer(false));
  if (h >= 9) await run('news', () => xNews(false));
  if (h >= 10) await run('bilan_semaine', () => xAlgoWeek(false));
  for (const league of ['nba', 'nhl']) await run('lignes_' + league, () => xAlgo(league, false));
  if (h >= 18) await run('sondage', () => xPoll(false));
  return out;
}

// Publication X du Top 5 du soir (une fois par jour et par ligue, activable dans x_config)
async function xPost(league, dry, slot) {
  await sql.query(`CREATE TABLE IF NOT EXISTS x_config (league text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, test_once boolean NOT NULL DEFAULT false)`);
  await xTables();
  const [cfg] = await sql.query(`SELECT enabled, test_once FROM x_config WHERE league = $1`, [league]);
  if (!dry && !cfg?.enabled && !cfg?.test_once) return { skipped: 'publication désactivée' };
  const fresh = {};
  try { if (league === 'nba') { fresh.injuries = await syncInjuries(); fresh.trends = await buildTrends(); } else { fresh.injuries = await nhlInjuries(); fresh.trends = await nhlTrends(); } }
  catch (e) { fresh.error = String(e).slice(0, 200); }
  const src = league === 'nba' ? await nbaVisual() : await nhlVisualSource();
  if (src.day !== usDate()) return { skipped: `pas de match ${league} aujourd'hui (prochain : ${src.day})` };
  const now = Date.now();
  src.top = src.top.filter((r) => !r.start || new Date(r.start).getTime() > now);
  if (src.top.length < 3) return { skipped: 'moins de 3 séries avant le début des matchs' };
  const [done] = await sql.query(`SELECT tweet_id FROM x_posts WHERE league = $1 AND day = $2`, [league, src.day]);
  if (done && !dry) return { skipped: 'déjà publié', tweet: done.tweet_id };
  src.dateTxt = dayFR(src.day);
  const png = await renderPng(src, 'post');
  const text = tweetText(src);
  if (dry) return { dry: true, day: src.day, bytes: png.length, text, fresh };
  const media = await xUpload(png, process.env);
  const id = await xTweet(text, media, process.env);
  await sql.query(`INSERT INTO x_posts (league, day, tweet_id, text, slot, picks) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`, [league, src.day, id, text, slot || null, JSON.stringify(src.top.map((r) => ({ name: r.name, cat: r.cat, pid: r.pid, stat: r.stat, thr: r.thr, gid: r.gid })))]);
  if (cfg?.test_once) await sql.query(`UPDATE x_config SET test_once = false WHERE league = $1`, [league]);
  return { tweet: id, media, bytes: png.length, text };
}

// Fige les lignes des matchs à venir (ce soir) pour les pages match (résultat réel comparé à la ligne d'avant-match)
async function freezeLines() {
  const out = {};
  for (const lg of ['nba', 'nhl']) { try { out[lg] = await saveLines(lg); } catch (e) { out[lg] = { error: String(e) }; } }
  return out;
}

async function runJob(job, q) {
  const out = {};
  if (job === 'daily') {            // matin (heure FR) : résultats de la nuit + picks
    out.schedule = await syncSchedule();
    out.boxscores = await ingestPending(80);
    out.injuries = await syncInjuries();
    out.trends = await buildTrends();
    out.nhl = await nhlDaily();
    out.lines = await freezeLines();
  } else if (job === 'evening') {   // avant les matchs : blessures à jour + séries recalculées
    out.injuries = await syncInjuries();
    out.trends = await buildTrends();
    out.nhl = { injuries: await nhlInjuries(), trends: await nhlTrends() };
    out.lines = await freezeLines();
  }
  else if (job === 'lines') out.lines = await freezeLines();
  else if (job === 'nhlboot') Object.assign(out, await nhlBootstrap());
  else if (job === 'nhlback') { out.back = await nhlBackfill(+q.get('season'), +q.get('from'), +q.get('to')); out.trends = await nhlTrends(); }
  else if (job === 'nhldaily') out.nhl = await nhlDaily();
  else if (job === 'nhltrends') out.nhl = await nhlTrends(); else if (job === 'bootstrap') Object.assign(out, await bootstrap());
  else if (job === 'schedule') out.schedule = await syncSchedule();
  else if (job === 'boxscores') out.boxscores = await ingestPending(+q.get('limit') || 60);
  else if (job === 'backfill') out.backfill = await backfill(+q.get('season'), +q.get('from'), +q.get('to'));
  else if (job === 'injuries') out.injuries = await syncInjuries();
  else if (job === 'picks') out.picks = await buildPicks(q.get('date') || undefined);
  else if (job === 'trends') out.trends = await buildTrends(q.get('date') || undefined);
  else if (job === 'pagecheck') {   // rend les pages principales et note leur taille (contrôle)
    const o = 'https://check', e = new URLSearchParams();
    out.home = (await homePage(o, e)).length;
    for (const st of ['pts', 'reb', 'pra']) out['home_' + st] = (await homePage(o, new URLSearchParams({ stat: st }))).length;
    const top = await sql.query(`SELECT p.slug FROM trends t JOIN players p ON p.id = t.player_id ORDER BY t.day DESC, t.rank LIMIT 3`);
    for (const { slug } of top) for (const st of ['pts', 'ast', 'tpm']) out[slug + '_' + st] = (await playerPage(slug, o, new URLSearchParams({ stat: st })))?.length || 0;
    out.players = (await playersIndex(o)).length; out.players_nhl = (await playersIndex(o, new URLSearchParams({ sport: 'nhl' }))).length;
    out.nhl_home = (await nhlHome(o, e)).length;
    out.nhl_vis = (await nhlVisual(o, e)).length;
    const nt = await sql.query(`SELECT p.slug FROM nhl_trends t JOIN nhl_players p ON p.id = t.player_id ORDER BY t.day DESC, t.rank LIMIT 2`);
    for (const { slug } of nt) for (const st of ['g', 'p']) out['nhl_' + slug + '_' + st] = (await nhlPlayer(slug, o, new URLSearchParams({ stat: st })))?.length || 0;
  }
  else if (job === 'xtick') out.x = await xTick();
  else if (/^xcards-(nba|nhl)$/.test(job)) out.cards = await xCards(job.slice(7), q.get('post') !== '1', q.get('set') || undefined);
  else if (job === 'xplan') { await xTables(); for (const lg of ['nba', 'nhl']) { const src = lg === 'nba' ? await nbaVisual() : await nhlVisualSource(); out[lg] = { day: src.day, first: src.top.map((r) => r.start).sort()[0], ...(await chooseSlot(lg, src)) }; } }
  else if (/^xrecap-(nba|nhl)$/.test(job)) { await xTables(); out.recap = await xRecap(job.slice(7), q.get('post') !== '1'); }
  else if (job === 'gsettle') { out.defi = await (await import('../lib/game.js')).settleGame(); }
  else if (job === 'xpoll') { out.poll = await xPoll(q.get('post') !== '1'); }
  else if (job === 'xalgo') { out.algo = await xAlgo(q.get('league') === 'nhl' ? 'nhl' : 'nba', q.get('post') !== '1'); }
  else if (job === 'xalgoweek') { out.week = await xAlgoWeek(q.get('post') !== '1', q.get('force') === '1'); }
  else if (job === 'xalgorecap') { out.algo = await xAlgoRecap(q.get('league') === 'nhl' ? 'nhl' : 'nba', q.get('post') !== '1'); }
  else if (job === 'xpollanswer') { out.answer = await xPollAnswer(q.get('post') !== '1'); }
  else if (job === 'xdefi') { out.defi = await xDefi(q.get('post') !== '1'); }
  else if (job === 'xnews') { out.news = await xNews(q.get('post') !== '1'); }
  else if (job === 'lineups') { const { syncLineups } = await import('../lib/lineups.js'); out.lineups = await syncLineups(sql); out.sample = await sql.query(`SELECT name, pct, starter FROM lineups WHERE pct <= 50 LIMIT 12`); }
  else if (job === 'xstats') { await xTables(); out.stats = await xStats(); out.collect = await xCollect(); }
  else if (job === 'xme') out.me = (await xMe(process.env)).data;
  else if (/^x(post|dry)-(nba|nhl)$/.test(job)) { const [, mode, lg] = job.match(/^x(post|dry)-(nba|nhl)$/); out.x = await xPost(lg, mode === 'dry'); }
  else throw new Error(`job inconnu : ${job}`);
  return out;
}

async function picksApi(q) {
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
  return json({ date: rows[0]?.date || date || null, picks: rows }, 200, { 'cache-control': 'public, max-age=300' });
}

let visCache = { t: 0, html: '' };
async function withVis(body) {
  if (Date.now() - visCache.t > 60000) {
    try {
      const [d] = await sql.query(`SELECT count(DISTINCT ih)::int AS n FROM page_views WHERE NOT bot AND ih IS NOT NULL AND day = current_date`);
      const [m] = await sql.query(`SELECT count(DISTINCT ih)::int AS n FROM page_views WHERE NOT bot AND ih IS NOT NULL AND day >= date_trunc('month', current_date)`);
      visCache = { t: Date.now(), html: `<span>👀 ${d.n} visiteur${d.n > 1 ? 's' : ''} aujourd'hui</span><span>📅 ${m.n} ce mois-ci</span>` };
    } catch { visCache = { t: Date.now(), html: '' }; }
  }
  return body.replace('<!--VIS-->', visCache.html);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const q = url.searchParams;
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Déclencheurs planifiés Neon : POST /cron/<job>
    if (request.method === 'POST' && path.startsWith('/cron/')) {
      if (!request.headers.get('x-neon-trigger-invocation-id')) return json({ error: 'forbidden' }, 403);
      const job = path.slice(6);
      try {
        const out = await runJob(job, q);
        await log(job, true, out);
        console.log(`cron ${job} ok`, JSON.stringify(out));
        return json({ ok: true, job, ...out });
      } catch (e) {
        await log(job, false, { error: String(e) }).catch(() => {});
        console.error(`cron ${job} failed`, e);
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // Photos des joueurs servies depuis notre domaine (nécessaire pour les effets WebGL)
    const ph = path.match(/^\/ph\/(nba|nhl)\/(?:([A-Z]{2,3})\/)?(\d{3,9})\.png$/);
    if (ph) {
      const urls = ph[1] === 'nba' ? [`https://cdn.nba.com/headshots/nba/latest/1040x760/${ph[3]}.png`] : [`https://assets.nhle.com/mugs/nhl/latest/${ph[3]}.png`, ...(ph[2] ? [`https://assets.nhle.com/mugs/nhl/20252026/${ph[2]}/${ph[3]}.png`] : [])];
      for (const u of urls) {
        const r = await fetch(u).catch(() => null);
        if (r && r.ok) return new Response(r.body, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800, immutable', 'access-control-allow-origin': '*' } });
      }
      return new Response('not found', { status: 404 });
    }

    // Lancement manuel protégé : GET /run?job=...&key=...
    if (path === '/run') {
      if (!process.env.CRON_SECRET || q.get('key') !== process.env.CRON_SECRET) return json({ error: 'unauthorized' }, 401);
      const job = q.get('job') || 'daily';
      try {
        const out = await runJob(job, q);
        await log(job, true, out);
        return json({ ok: true, job, ...out });
      } catch (e) {
        await log(job, false, { error: String(e) }).catch(() => {});
        return json({ ok: false, job, error: String(e) }, 500);
      }
    }

    // Recherche de joueur : GET /api/search?q=...
    if (path === '/api/search') {
      const s = (q.get('q') || '').trim().slice(0, 40);
      if (s.length < 2) return json([]);
      const pat = '%' + s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[%_]/g, '') + '%';
      const [nba, nhl] = await Promise.all([
        sql.query(`SELECT p.name, p.slug, t.tricode AS team FROM players p LEFT JOIN teams t ON t.id = p.team_id
                   WHERE p.last_game_date >= current_date - 400 AND (lower(p.slug) LIKE replace($1, ' ', '-') OR lower(p.name) LIKE $1)
                   ORDER BY p.last_game_date DESC NULLS LAST LIMIT 6`, [pat]),
        sql.query(`SELECT DISTINCT ON (slug) name, slug, team FROM nhl_players WHERE (lower(slug) LIKE replace($1, ' ', '-') OR lower(name) LIKE $1)
                   ORDER BY slug, on_roster DESC, last_game_date DESC NULLS LAST LIMIT 6`, [pat]),
      ]);
      const out = [...nba.map((r) => ({ name: r.name, team: r.team, sport: 'nba', url: `/joueur/${r.slug}` })), ...nhl.map((r) => ({ name: r.name, team: r.team, sport: 'nhl', url: `/nhl/joueur/${r.slug}` }))].slice(0, 8);
      return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' } });
    }

    // Aperçu protégé du visuel X : GET /xpng?league=nba&key=...
    if (path === '/xpng') {
      if (!process.env.CRON_SECRET || q.get('key') !== process.env.CRON_SECRET) return json({ error: 'unauthorized' }, 401);
      const src = q.get('league') === 'nhl' ? await nhlVisualSource() : await nbaVisual();
      src.dateTxt = dayFR(src.day);
      return new Response(await renderPng(src, 'post'), { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
    }
    if (path === '/stats') {
      if (!process.env.CRON_SECRET || q.get('key') !== process.env.CRON_SECRET) return json({ error: 'unauthorized' }, 401);
      const days = await sql.query(`SELECT day::text, count(*)::int AS vues, count(DISTINCT ih)::int AS visiteurs FROM page_views WHERE NOT bot AND ih IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 14`);
      const pages = await sql.query(`SELECT path, count(*)::int AS vues FROM page_views WHERE NOT bot AND day >= current_date - 7 GROUP BY path ORDER BY vues DESC LIMIT 15`);
      const refs = await sql.query(`SELECT coalesce(ref,'direct') AS source, count(*)::int AS vues FROM page_views WHERE NOT bot AND day >= current_date - 7 GROUP BY 1 ORDER BY vues DESC LIMIT 10`);
      return json({ days, pages, refs });
    }
    if (request.method === 'GET' && !path.startsWith('/api') && !/\.(xml|txt|png|ico|svg|js|css)$/.test(path)) {
      try {
        const ua = request.headers.get('user-agent') || '';
        const bot = !ua || /bot|crawl|spider|slurp|preview|facebookexternal|curl|python|node|headless|monitor|uptime|go-http/i.test(ua);
        const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
        const day = new Date().toISOString().slice(0, 10);
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${process.env.CRON_SECRET || ''}`));
        const vh = [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
        let ref = null; try { ref = new URL(request.headers.get('referer') || '').host || null; } catch {}
        if (ref && ref.endsWith(url.host.replace(/^www\./, ''))) ref = null;
        await sql.query(`CREATE TABLE IF NOT EXISTS page_views (id bigserial PRIMARY KEY, ts timestamptz DEFAULT now(), day date DEFAULT current_date, path text, ref text, vh text, bot boolean)`);
        await sql.query(`ALTER TABLE page_views ADD COLUMN IF NOT EXISTS ih text`);
        await sql.query(`INSERT INTO page_views (path, ref, vh, bot, ih) VALUES ($1,$2,$3,$4,$3)`, [path, ref, vh, bot]);
      } catch (e) { console.error('views', String(e).slice(0, 120)); }
    }
    // Défi du soir arrêté (14 nov. 2026) : ses pages renvoient vers les lignes du soir. Le code du jeu reste dans lib/game.js.
    if (path === '/defi' || path.startsWith('/defi/') || path === '/collection' || path === '/album') return new Response(null, { status: 302, headers: { location: '/algo' } });
    if (path === '/idees') {
      await sql.query(`CREATE TABLE IF NOT EXISTS ideas (id bigserial PRIMARY KEY, ts timestamptz DEFAULT now(), idea text, contact text, vh text)`);
      if (request.method === 'POST') {
        const f = await request.formData(); const idea = String(f.get('idea') || '').trim(), contact = String(f.get('contact') || '').trim().slice(0, 120);
        const ok = !f.get('site') && idea.length >= 10 && idea.length <= 500;
        if (ok) {
          const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
          const [n] = await sql.query(`SELECT count(*)::int AS n FROM ideas WHERE vh = $1 AND ts > now() - interval '1 hour'`, [ip.slice(0, 64)]);
          if (n.n < 3) await sql.query(`INSERT INTO ideas (idea, contact, vh) VALUES ($1,$2,$3)`, [idea, contact || null, ip.slice(0, 64)]);
        }
        return new Response(null, { status: 303, headers: { location: ok ? '/idees?ok=1' : '/idees?err=1' } });
      }
      return new Response(ideasPage('https://' + url.host, q.get('ok') ? 'ok' : q.get('err') ? 'err' : ''), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (path === '/ideesdump') {
      if (!process.env.CRON_SECRET || q.get('key') !== process.env.CRON_SECRET) return json({ error: 'unauthorized' }, 401);
      return json(await sql.query(`SELECT ts, idea, contact FROM ideas ORDER BY id DESC LIMIT 50`));
    }
    if (path === '/api/picks') return picksApi(q);

    const origin = 'https://' + url.host;
    const html = async (body, status = 200) => new Response(await withAds(await withVis(body)), { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
    if (path === '/') return html(await homePage(origin, q));
    if (path === '/algo') return html(await algoPage(origin, q));
    if (path === '/mentions-legales' || path === '/confidentialite') return html(await legalPage(path, origin));
    if (path === '/ads.txt') return new Response(await adsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
    if (path === '/roadmap') return html(roadmapPage(origin));
    if (path === '/classement') return html(await classementPage(origin, q));
    if (path === '/fiabilite') return html(await fiabilitePage(origin));
    const mc = path.match(/^\/carte\/(nba|nhl)\/([a-z0-9-]+)\.png$/);
    if (mc) {
      const src = mc[1] === 'nba' ? await nbaVisual() : await nhlVisualSource();
      const want = url.searchParams.get('stat');
      const c = src.cards.filter((x) => x.slug === mc[2]).sort((a, b) => (b.stat === want) - (a.stat === want) || b.l10 / b.n10 - a.l10 / a.n10)[0];
      if (!c) return new Response('Pas de série ce soir pour ce joueur.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      try { await loadHist(sql, mc[1], [c], STATS); } catch {}
      const png = await renderSingle(c, 'pts');
      return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=900', 'content-disposition': `inline; filename="pickdusoir-${mc[2]}.png"` } });
    }
    if (path === '/resultats') return new Response(null, { status: 301, headers: { location: '/fiabilite' } });
    if (path === '/a-propos') return html(page({ title: 'À propos | Pick du Soir', description: 'Qui fait Pick du Soir, comment les séries sont calculées, et ce que le site ne fait pas.', canonical: origin + '/a-propos', nav: 'apropos',
      body: `<section class="intro about"><p class="kick">À propos</p><h1>Un site de stats, fait par un fan</h1>
<p>Pick du Soir est fait par Matthieu, fan de NBA et de NHL, en France. L'idée : voir en un coup d'œil quels joueurs sont réguliers en ce moment, sans passer une heure dans les feuilles de match.</p>
<h2>Les lignes du soir</h2><p>L'onglet Lignes donne, pour chaque joueur, une ligne au demi-point et le côté (Plus ou Moins) que notre modèle juge le plus probable. Le modèle, une régression logistique, a appris sur les matchs de la saison 2025-26 et du début de 2026-27, puis a été testé comme en vrai : il apprend jusqu'à un mois donné, on le teste sur le mois suivant, et on recommence. Il regarde la forme sur 5, 10, 20 et 40 matchs, les minutes récentes, la défense adverse, le lieu du match et les matchs deux soirs de suite. La ligne est une ligne de référence maison, pas celle d'un opérateur. Les résultats réels sont publiés chaque matin dans les <a href="/fiabilite"><u>Résultats</u></a>.</p>
<h2>Comment c'est calculé</h2><p>Chaque jour, le site récupère les feuilles de match officielles et compte, pour chaque joueur qui joue le soir, combien de fois il a atteint un palier (par exemple 20+ points) sur ses 5, 10 et 20 derniers matchs. Les joueurs blessés ou absents sont retirés.</p>
<h2>Ce que le site ne fait pas</h2><p>Pick du Soir ne propose aucun pari, ne donne pas de cotes et n'est lié à aucun opérateur. Une série passée ne dit pas ce qui va se passer ce soir. Toutes les séries publiées sur X sont suivies publiquement dans les <a href="/fiabilite"><u>Résultats</u></a>, ratés compris.</p>
<h2>Contact</h2><p>Une idée, une erreur dans une stat ? Écris-nous sur X : <a href="https://x.com/PickDuSoir"><u>@PickDuSoir</u></a>, ou via la page <a href="/idees"><u>Proposer une idée</u></a>.</p></section>` }));
    if (path === '/fiabilite.csv') return new Response(await fiabiliteCsv(), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename=pickdusoir-historique.csv', 'cache-control': 'public, max-age=600' } });
    if (path === '/joueurs') return html(await playersIndex(origin, q));
    if (path === '/nhl') return html(await nhlHome(origin, q));
    if (path === '/nhl/visuel') return new Response(await nhlVisual(origin, q), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (path === '/matchs-nba-ce-soir' || path === '/matchs-nhl-ce-soir') return html(await programmePage(path.includes('nhl') ? 'nhl' : 'nba', origin));
    const tp = path.match(/^(\/nhl)?\/equipe\/([a-z0-9-]+)$/);
    if (tp) { const out = await teamPage(tp[1] ? 'nhl' : 'nba', tp[2], origin); return out ? html(out) : html(notFound(), 404); }
    const mp = path.match(/^(\/nhl)?\/match\/(.+)$/);
    if (mp) { const out = await matchPage(mp[1] ? 'nhl' : 'nba', mp[2], origin); return out ? html(out) : html(notFound(), 404); }
    if (path.startsWith('/nhl/joueur/')) {
      const out = await nhlPlayer(decodeURIComponent(path.slice(12)), origin, q);
      return out ? html(out) : html(notFound(), 404);
    }
    if (path === '/visuel') return new Response(await visualPage(origin, q), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    if (path.startsWith('/joueur/')) {
      const out = await playerPage(decodeURIComponent(path.slice(8)), origin, q);
      return out ? html(out) : html(notFound(), 404);
    }
    if (path === '/sitemap.xml') return new Response(await sitemap(origin), { headers: { 'content-type': 'application/xml' } });
    if (path === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nDisallow: /run\nSitemap: ${origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
    return html(notFound(), 404);
  },
};
