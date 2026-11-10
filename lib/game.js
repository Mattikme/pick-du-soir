// Le Défi du soir : jeu gratuit de pronostics « Plus de / Moins de », récompensé par des cartes à collectionner.
// Aucune mise, aucun gain matériel : les cartes n'ont aucune valeur et ne s'échangent pas.
import { sql } from './jobs.js';
import { usDate } from './ttfl.js';
import { STATS } from './trends.js';
import { page, esc, hourFR, dayFR, tc, TCG_CSS, TCG_JS, pickCard } from './site.js';
import { NHL_TEAMS } from './nhl.js';

const NHL_ST = { p: { label: 'points', val: (g) => g.points }, g: { label: 'buts', val: (g) => g.goals }, a: { label: 'passes décisives', val: (g) => g.assists }, sog: { label: 'tirs cadrés', val: (g) => g.sog } };
const SP = {
  nba: {
    name: 'NBA', stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ra'], ST: STATS, base: { pts: 'rar', reb: 'rar', ast: 'rar' },
    colors: (t) => tc(t),
    day: `SELECT min(game_date)::text AS d FROM games WHERE game_date >= $1 AND start_utc > now()`,
    tonight: `SELECT pl.id, pl.name, t.tricode AS team, g.id AS gid, g.start_utc, o.tricode AS opp FROM players pl JOIN teams t ON t.id = pl.team_id JOIN games g ON g.game_date = $2 AND pl.team_id IN (g.home_team_id, g.away_team_id) JOIN teams o ON o.id = CASE WHEN g.home_team_id = pl.team_id THEN g.away_team_id ELSE g.home_team_id END WHERE pl.id = $1 AND g.start_utc > now()`,
    search: `SELECT DISTINCT pl.id, pl.name, t.tricode AS team, g.start_utc FROM players pl JOIN teams t ON t.id = pl.team_id JOIN games g ON g.game_date = $1 AND pl.team_id IN (g.home_team_id, g.away_team_id) WHERE g.start_utc > now() AND unaccent_lower(pl.name) LIKE '%' || unaccent_lower($2) || '%' ORDER BY pl.name LIMIT 15`,
    hot: `SELECT pl.id, pl.name, t.tricode AS team, g.start_utc FROM (SELECT DISTINCT ON (player_id) player_id, score FROM trends WHERE day = $1 ORDER BY player_id, score DESC) tr JOIN players pl ON pl.id = tr.player_id JOIN teams t ON t.id = pl.team_id JOIN games g ON g.game_date = $1 AND pl.team_id IN (g.home_team_id, g.away_team_id) WHERE g.start_utc > now() ORDER BY tr.score DESC LIMIT 8`,
    last: `SELECT pts, reb, ast, tpm, stl, blk FROM player_games WHERE player_id = $1 AND minutes > 0 AND game_type IN ('reg','cup','playin','po') ORDER BY game_date DESC LIMIT 20`,
    who: `SELECT pl.name, t.tricode AS team FROM players pl LEFT JOIN teams t ON t.id = pl.team_id WHERE pl.id = p.player_id`,
    thumb: (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,
  },
  nhl: {
    name: 'NHL', stats: ['p', 'g', 'a', 'sog'], ST: NHL_ST, base: { p: 'rar', sog: 'rar' },
    colors: (t) => (NHL_TEAMS[t] ? [NHL_TEAMS[t][2], NHL_TEAMS[t][3]] : ['#3A4170', '#8B93B5']),
    day: `SELECT min(game_date)::text AS d FROM nhl_games WHERE game_date >= $1 AND start_utc > now()`,
    tonight: `SELECT pl.id, pl.name, pl.team, g.id::text AS gid, g.start_utc, CASE WHEN g.home = pl.team THEN g.away ELSE g.home END AS opp FROM nhl_players pl JOIN nhl_games g ON g.game_date = $2 AND pl.team IN (g.home, g.away) WHERE pl.id = $1 AND g.start_utc > now() AND coalesce(pl.position, '') <> 'G' AND (SELECT avg(toi) FROM (SELECT toi FROM nhl_player_games x WHERE x.player_id = pl.id AND x.toi > 0 ORDER BY x.game_date DESC LIMIT 10) z) >= 720`,
    search: `SELECT DISTINCT pl.id, pl.name, pl.team, g.start_utc FROM nhl_players pl JOIN nhl_games g ON g.game_date = $1 AND pl.team IN (g.home, g.away) WHERE g.start_utc > now() AND coalesce(pl.position, '') <> 'G' AND pl.on_roster IS NOT FALSE AND unaccent_lower(pl.name) LIKE '%' || unaccent_lower($2) || '%' ORDER BY pl.name LIMIT 15`,
    hot: `SELECT pl.id, pl.name, pl.team, g.start_utc FROM (SELECT DISTINCT ON (player_id) player_id, score FROM nhl_trends WHERE day = $1 ORDER BY player_id, score DESC) tr JOIN nhl_players pl ON pl.id = tr.player_id JOIN nhl_games g ON g.game_date = $1 AND pl.team IN (g.home, g.away) WHERE g.start_utc > now() ORDER BY tr.score DESC LIMIT 8`,
    last: `SELECT goals, assists, points, sog FROM nhl_player_games WHERE player_id = $1 AND game_type = 2 AND toi > 0 ORDER BY game_date DESC LIMIT 20`,
    who: `SELECT pl.name, pl.team FROM nhl_players pl WHERE pl.id = p.player_id`,
    thumb: (id) => `https://assets.nhle.com/mugs/nhl/latest/${id}.png`,
  },
};
const STAR = {
  pts: 22, reb: 10, ast: 7, tpm: 3, stl: 1.8, blk: 1.8, pra: 38, pr: 30, pa: 28, ra: 15,
  p: 1.1, g: 0.5, a: 0.7, sog: 3.5,
};
const sp = (k) => SP[k === 'nhl' ? 'nhl' : 'nba'];

const BASE = { pts: 'rar', reb: 'rar', ast: 'rar' }; // le reste = épique
const RAR = { vsn: ['vsn', 'VISION'], ulm: ['ulm', 'ULTIME'], imp: ['imp', 'IMPOSSIBLE'], com: ['com', 'COMMUN'], rar: ['rar', 'RARE'], epi: ['epi', 'ÉPIQUE'], leg: ['leg', 'LÉGENDAIRE'], ult: ['ult', 'ULTRA LÉGENDAIRE'] };
const GSTATS = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ra'];

// Marges d'erreur acceptées par niveau : [Rare, Épique, Légendaire]. null = niveau non proposé (marge identique au niveau du dessous).
const MARG = {
  pts: [6, 4, 2], reb: [3, 2, 1], ast: [3, 2, 1], tpm: [2, 1, null], stl: [2, 1, null], blk: [2, 1, null],
  pra: [8, 5, 3], pr: [7, 4, 2], pa: [7, 4, 2], ra: [4, 3, 1],
  p: [null, null, null], g: [null, null, null], a: [null, null, null], sog: [2, 1, null],
};
const TIERS = [['rar', 0], ['epi', 1], ['leg', 2]];
const tierTol = (st, k) => { const i = TIERS.find((t) => t[0] === k)?.[1]; return i === undefined ? null : (MARG[st]?.[i] ?? null); };
// Quotas par jour et par sport : de quoi essayer plusieurs fois, sans banaliser les niveaux élevés
const QUOTA = { com: 5, rar: 3, epi: 2, leg: 1, ult: 1, vsn: 1, ulm: 1, imp: 1 };
const COMBO = ['vsn', 'ulm', 'imp']; // cartes multi-stats (NBA) : 1 par jour
const CKS = { nba: ['pts', 'reb', 'ast', 'stl', 'blk'], nhl: ['g', 'a', 'sog'] };
const CKALL = ['pts', 'reb', 'ast', 'stl', 'blk', 'g', 'a', 'sog'], CL = { pts: 'pts', reb: 'reb', ast: 'pas', stl: 'int', blk: 'ctr', g: 'but', a: 'pas', sog: 'tirs' };
const comboTxt = (o) => CKALL.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => `${o[k]} ${CL[k]}`).join(' · ');

let ready = false;
async function tables() {
  if (ready) return;
  await sql.query(`CREATE TABLE IF NOT EXISTS g_users (id serial PRIMARY KEY, pseudo text UNIQUE NOT NULL, pin_hash text NOT NULL, salt text NOT NULL, created timestamptz DEFAULT now(), fails int DEFAULT 0, locked_until timestamptz)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS g_sessions (token text PRIMARY KEY, user_id int NOT NULL, created timestamptz DEFAULT now())`);
  await sql.query(`CREATE TABLE IF NOT EXISTS g_picks (id bigserial PRIMARY KEY, user_id int NOT NULL, day date NOT NULL, sport text DEFAULT 'nba', player_id int NOT NULL, game_id text NOT NULL, stat text NOT NULL, dir text NOT NULL, line numeric NOT NULL, rarity text NOT NULL, status text, val numeric, created timestamptz DEFAULT now(), UNIQUE (user_id, day, player_id, stat))`);
  await sql.query(`ALTER TABLE g_picks ADD COLUMN IF NOT EXISTS bonus boolean NOT NULL DEFAULT false`);
  await sql.query(`ALTER TABLE g_picks ADD COLUMN IF NOT EXISTS tol numeric NOT NULL DEFAULT 0`);
  await sql.query(`ALTER TABLE g_picks ADD COLUMN IF NOT EXISTS vals jsonb`);
  await sql.query(`ALTER TABLE g_picks ADD COLUMN IF NOT EXISTS res jsonb`);
  await sql.query(`ALTER TABLE g_picks DROP CONSTRAINT IF EXISTS g_picks_user_id_day_player_id_stat_key`);
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS g_picks_uniq ON g_picks (user_id, day, player_id, stat, bonus)`);
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS g_picks_bonus1 ON g_picks (user_id, day, sport) WHERE bonus`);
  await sql.query(`CREATE TABLE IF NOT EXISTS g_daily (sport text NOT NULL, day date NOT NULL, player_id int NOT NULL, game_id text NOT NULL, stat text NOT NULL, line numeric NOT NULL, PRIMARY KEY (sport, day))`);
  await sql.query(`CREATE EXTENSION IF NOT EXISTS unaccent`).catch(() => {});
  await sql.query(`CREATE OR REPLACE FUNCTION unaccent_lower(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(public.unaccent($1)) $$`).catch(() => {});
  ready = true;
}

// ---------- sécurité ----------
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
const rnd = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const cookie = (req) => (req.headers.get('cookie') || '').match(/(?:^|;\s*)pds=([a-f0-9]{64})/)?.[1];
async function me(req) {
  const t = cookie(req);
  if (!t) return null;
  const [u] = await sql.query(`SELECT u.id, u.pseudo FROM g_sessions s JOIN g_users u ON u.id = s.user_id WHERE s.token = $1`, [t]);
  return u || null;
}
const go = (loc, extra = {}) => new Response(null, { status: 303, headers: { location: loc, 'cache-control': 'no-store', ...extra } });
const setCookie = (t) => `pds=${t}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
const htmlR = (h) => new Response(h, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

// ---------- données de jeu ----------
async function gameDay(S) {
  const [d] = await sql.query(S.day, [usDate()]);
  return d?.d || usDate();
}
// Ligne « équilibrée » : le palier X,5 où le joueur passe au-dessus environ 1 match sur 2 ; ligne haute : ≤ 30 % des matchs.
function lines(games, stat, S) {
  const v = games.slice(0, 10).map((g) => S.ST[stat].val(g));
  const all = games.map((g) => S.ST[stat].val(g));
  const share = (L) => v.filter((x) => x > L).length / v.length;
  const top = Math.max(...v);
  const star = v.reduce((a, b) => a + b, 0) / v.length >= STAR[stat];
  const target = star ? 0.38 : 0.5;
  let base = 0.5, best = 9;
  for (let L = 0.5; L <= top + 0.5; L += 1) { const d = Math.abs(share(L) - target); if (d < best - 1e-9) { best = d; base = L; } }
  let high = base + 1;
  while (share(high) > (star ? 0.2 : 0.3) && high < top + 0.5) high += 1;
  return { star, base, high, avg: v.reduce((a, b) => a + b, 0) / v.length, n: all.length, hits: (x) => all.filter((y) => y > x).length };
}
async function lastGames(pid, S) { return sql.query(S.last, [pid]); }
const fmt = (n) => String(n).replace('.', ',');
// Rareté = difficulté réelle : probabilité estimée sur les 20 derniers matchs (lissée).
function prob(L, dir) { const n = L.n, h = dir === 'moins' ? n - L.hits(L.at) : L.hits(L.at); return (h + 1) / (n + 2); }
function rarityP(p, kind, star) { return kind === 'exact' ? 'ult' : p <= (star ? 0.42 : 0.33) ? 'leg' : p <= (star ? 0.65 : 0.55) ? 'epi' : 'rar'; }
const tooEasy = (star) => (star ? 0.66 : 0.78);
function pickLabel(p) {
  if (p.dir === 'combo') return `Pile : ${comboTxt(p.vals || {})}`;
  const L = sp(p.sport).ST[p.stat].label;
  if (p.dir === 'range') return `${fmt(Number(p.line))} ${L} (±${fmt(Number(p.tol))})`;
  return p.dir === 'exact' ? `Pile ${fmt(Number(p.line))} ${L}` : `${p.dir === 'plus' ? 'Plus de' : 'Moins de'} ${fmt(Number(p.line))} ${L}`;
}

// ---------- Pick imposé du soir (le même pour tous) ----------
async function dailyPick(sk, day) {
  const S = SP[sk];
  let [d] = await sql.query(`SELECT d.*, d.day::text AS day FROM g_daily d WHERE sport = $1 AND day = $2`, [sk, day]);
  if (!d) {
    const tt = sk === 'nhl' ? 'nhl_trends tr JOIN nhl_games g ON g.id::text = tr.game_id::text' : 'trends tr JOIN games g ON g.id = tr.game_id';
    const cand = await sql.query(`SELECT tr.player_id, tr.game_id::text AS game_id, tr.stat, g.start_utc FROM ${tt} WHERE tr.day = $1 AND g.start_utc > now() ORDER BY (g.start_utc > now() + interval '2 hours') DESC, tr.score DESC LIMIT 15`, [day]);
    for (const c of cand) {
      if (!S.stats.includes(c.stat)) continue;
      const [pl] = await sql.query(S.tonight, [c.player_id, day]);
      if (!pl) continue;
      const games = await lastGames(c.player_id, S);
      if (games.length < 8) continue;
      const L = lines(games, c.stat, S);
      await sql.query(`INSERT INTO g_daily (sport, day, player_id, game_id, stat, line) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [sk, day, c.player_id, String(pl.gid), c.stat, L.base]);
      [d] = await sql.query(`SELECT d.*, d.day::text AS day FROM g_daily d WHERE sport = $1 AND day = $2`, [sk, day]);
      break;
    }
  }
  if (!d) return null;
  const [pl] = await sql.query(`SELECT w.name, w.team FROM (SELECT $1::int AS player_id) p CROSS JOIN LATERAL (${S.who}) w`, [d.player_id]);
  const [g] = await sql.query(sk === 'nhl' ? `SELECT start_utc FROM nhl_games WHERE id::text = $1` : `SELECT start_utc FROM games WHERE id = $1`, [d.game_id]);
  const L = lines(await lastGames(d.player_id, S), d.stat, S);
  return { ...d, ...pl, start_utc: g?.start_utc, open: g && new Date(g.start_utc) > new Date(), L: { ...L, at: Number(d.line) } };
}

// ---------- règlement (appelé par les jobs du matin et du soir) ----------
export async function settleGame() {
  await tables();
  let won = 0, lost = 0, voided = 0, n = 0;
  const open = [
    ...(await sql.query(`SELECT p.* FROM g_picks p JOIN games g ON g.id = p.game_id WHERE p.sport = 'nba' AND p.status IS NULL AND g.status = 3`)),
    ...(await sql.query(`SELECT p.* FROM g_picks p JOIN nhl_games g ON g.id::text = p.game_id WHERE p.sport = 'nhl' AND p.status IS NULL AND g.state IN ('OFF', 'FINAL')`)),
  ];
  for (const p of open) {
    n++;
    const [g] = p.sport === 'nhl'
      ? await sql.query(`SELECT goals, assists, points, sog, toi AS minutes FROM nhl_player_games WHERE game_id::text = $1 AND player_id = $2`, [p.game_id, p.player_id])
      : await sql.query(`SELECT pts, reb, ast, tpm, stl, blk, minutes FROM player_games WHERE game_id = $1 AND player_id = $2`, [p.game_id, p.player_id]);
    let st, val = null;
    if (!g || !(Number(g.minutes) > 0)) { st = 'void'; voided++; }
    else {
      if (p.dir === 'combo') {
        const r = {}; if (p.sport === 'nhl') { r.g = Number(g.goals); r.a = Number(g.assists); r.sog = Number(g.sog); } else for (const k of CKS.nba) r[k] = Number(g[k]);
        const ok = Object.entries(p.vals || {}).every(([k, v]) => r[k] === Number(v));
        st = ok ? 'won' : 'lost'; ok ? won++ : lost++;
        await sql.query(`UPDATE g_picks SET status = $1, val = $2, res = $3 WHERE id = $4`, [st, Object.keys(p.vals || {}).length, JSON.stringify(r), p.id]);
        continue;
      }
      val = sp(p.sport).ST[p.stat].val(g); const l = Number(p.line);
      const ok = p.dir === 'plus' ? val > l : p.dir === 'moins' ? val < l : p.dir === 'range' ? Math.abs(val - l) <= Number(p.tol) : val === l;
      st = ok ? 'won' : 'lost'; ok ? won++ : lost++;
    }
    await sql.query(`UPDATE g_picks SET status = $1, val = $2 WHERE id = $3`, [st, val, p.id]);
  }
  return { settled: n, won, lost, voided };
}

// ---------- rendu ----------
const CSS = `<style>${TCG_CSS}
.gm h1{margin:0 0 4px}.gm .sub{opacity:.8;margin:0 0 14px}.gm form{margin:0}
.gbox{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:14px;margin:12px 0}
.gbox input[type=text],.gbox input[type=password],.gbox input[type=number],.gbox input[type=search]{width:100%;box-sizing:border-box;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:12px;font:inherit;margin:6px 0}
.gbtn{display:inline-block;background:#FF8A57;color:#0D1020;font:inherit;font-weight:800;border:0;border-radius:12px;padding:11px 16px;text-decoration:none;cursor:pointer}
.gbtn.alt{background:rgba(255,255,255,.12);color:inherit}.gbtn.sm{padding:7px 11px;font-size:13px}
.gerr{background:#E5484D;color:#fff;border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:700}.gok{background:#30A46C;color:#fff;border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:700}
.gpl{display:flex;align-items:center;gap:10px;padding:10px 4px;border-top:1px solid rgba(255,255,255,.1);color:inherit;text-decoration:none}.gpl img{width:46px;height:34px;object-fit:cover;border-radius:6px;background:rgba(255,255,255,.08)}.gpl small{opacity:.7;display:block}
.gst{border-top:1px solid rgba(255,255,255,.1);padding:10px 0}.gst b{display:block;margin-bottom:6px}.gst .opts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.rb{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;border-radius:999px;padding:2px 7px;margin-left:4px;vertical-align:1px}
.rb.com{background:#C98A5A;color:#1a0f06}.rb.vsn{background:linear-gradient(90deg,#fff,#9fb4d4,#fff);color:#0D1020}.rb.ulm{background:#0a0a0a;color:#ffd36b;border:1px solid #ffd36b}.rb.imp{background:#000;color:#ff3b6b;border:1px solid #00e5ff}.rb.rar{background:#E2E8F0;color:#0D1020}.rb.epi{background:#8B5CF6;color:#fff}.rb.leg{background:#F5C542;color:#0D1020}.rb.ult{background:linear-gradient(90deg,#ff7773,#ffed5f,#83fff7,#d875ff);color:#0D1020}
.gmine{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-top:1px solid rgba(255,255,255,.1)}.gmine .s{font-size:12.5px;opacity:.8}
.st-won{color:#4ADE80;font-weight:800}.st-lost{color:#F87171;font-weight:800}.st-void{opacity:.7}
.coll{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.coll .tc{flex:none;max-width:none;min-width:0;padding:5px;animation:deal .5s both}.coll .tc-top{min-width:0}.coll .tc-in{min-height:0}.coll .tc-art{height:120px;margin:0 6px}.coll .tc-top{padding:7px 8px 6px}.coll .tc-name{font-size:14px}.coll .tc-rar{font-size:8px;padding:2px 5px;letter-spacing:.03em}
.coll .tc-atk{margin:6px;padding:7px 8px}.coll .tc-atk b{font:800 14px/1.1 var(--disp)}.coll .tc-ft{padding:6px 8px 7px;font-size:9px}
.cnt{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.cnt span{background:rgba(255,255,255,.08);border-radius:10px;padding:6px 9px;font-size:13px}
.gsm{font-size:12.5px;opacity:.75;margin-top:16px}</style>`;

function miniCard(p) {
  const S = sp(p.sport);
  if (p.dir === 'combo') return pickCard({ rar: p.rarity, name: p.name, team: p.team, player_id: p.player_id, sport: p.sport, stat: 'combo', colors: S.colors(p.team), big: Object.keys(p.vals || {}).length, label: pickLabel(p), sub: `Résultat : ${comboTxt(p.res || {})}`, day: dayFR(p.day), bonus: p.bonus });
  const st = S.ST[p.stat];
  return pickCard({ rar: p.rarity, name: p.name, team: p.team, player_id: p.player_id, sport: p.sport, stat: p.stat, colors: S.colors(p.team), big: fmt(Number(p.val)), label: pickLabel(p), sub: `Résultat : ${fmt(Number(p.val))} ${st.label}`, day: dayFR(p.day), bonus: p.bonus });
}

function shell(title, body, canonical) {
  return page({ title: `${title} – Pick du Soir`, description: 'Le Défi du soir : des pronostics gratuits chaque jour sur les joueurs NBA et NHL, et des cartes à collectionner.', canonical, nav: 'defi', body: `${CSS}<section class="gm">${body}</section>` });
}

function loginView(msg) {
  return `<h1>Le Défi du soir</h1>
  <p class="sub">Chaque soir, des pronostics NBA et NHL sur les joueurs qui jouent. Pronostic juste = une carte à collectionner. Tu choisis le niveau de la carte que tu vises : plus ta prédiction est précise, plus la carte est rare.</p>
  ${msg ? `<div class="gerr">${esc(msg)}</div>` : ''}
  <div class="gbox"><b>Créer mon compte</b>
  <form method="post" action="/defi/signup"><input type="text" name="pseudo" placeholder="Pseudo (3 à 16 caractères)" maxlength="16" required autocomplete="username">
  <input type="password" name="pin" inputmode="numeric" pattern="[0-9]{6}" placeholder="Code secret à 6 chiffres" required autocomplete="new-password">
  <label style="display:block;font-size:13px;margin:6px 0 10px"><input type="checkbox" name="age" required> J'ai 15 ans ou plus et j'accepte que mon pseudo soit enregistré.</label>
  <input type="text" name="site" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off"><button class="gbtn">Créer mon compte</button></form></div>
  <div class="gbox"><b>J'ai déjà un compte</b>
  <form method="post" action="/defi/login"><input type="text" name="pseudo" placeholder="Pseudo" required autocomplete="username">
  <input type="password" name="pin" inputmode="numeric" pattern="[0-9]{6}" placeholder="Code à 6 chiffres" required autocomplete="current-password"><button class="gbtn">Me connecter</button></form></div>
  <p class="gsm">Jeu 100 % gratuit : aucune mise, aucun gain, aucun achat. Les cartes n'ont aucune valeur et ne s'échangent pas. Pas d'e-mail demandé : seuls ton pseudo et tes pronostics sont enregistrés. Garde bien ton code, il ne peut pas être récupéré.</p>`;
}

async function defiView(u, q) {
  const sk = q.get('s') === 'nhl' ? 'nhl' : 'nba', S = SP[sk], sq = sk === 'nhl' ? '&s=nhl' : '';
  const day = await gameDay(S);
  const mine = await sql.query(`SELECT p.*, w.name, w.team FROM g_picks p CROSS JOIN LATERAL (${S.who}) w WHERE p.user_id = $1 AND p.day = $2 AND p.sport = $3 AND NOT p.bonus ORDER BY p.created`, [u.id, day, sk]);
  const left = 99;
  const msg = q.get('ok') ? `<div class="gok">Pronostic enregistré !</div>` : q.get('e') ? `<div class="gerr">${esc(q.get('e'))}</div>` : '';
  let pick = '';
  const pid = Number(q.get('p'));
  if (pid && left > 0) {
    const [pl] = await sql.query(S.tonight, [pid, day]);
    const games = pl ? await lastGames(pid, S) : [];
    if (!pl) pick = `<div class="gerr">Ce joueur ne joue pas ce soir, ou son match a déjà commencé.</div>`;
    else if (games.length < 5) pick = `<div class="gerr">Pas assez de matchs récents pour ${esc(pl.name)}.</div>`;
    else {
      const used = (k) => mine.filter((m) => m.rarity === k).length;
      const hid = (st) => `<input type="hidden" name="sp" value="${sk}"><input type="hidden" name="p" value="${pid}"><input type="hidden" name="s" value="${st}">`;
      const rows = S.stats.map((st) => {
        const L = lines(games, st, S), lab = S.ST[st].label;
        const cmKo = used('com') >= QUOTA.com;
        const cm = (dir) => `<form method="post" action="/defi/pick" style="display:inline">${hid(st)}<input type="hidden" name="d" value="${dir}"><button class="gbtn sm alt"${cmKo ? ' disabled style="opacity:.4"' : ''} name="k" value="base">${dir === 'plus' ? 'Plus' : 'Moins'} de ${fmt(L.base)} <span class="rb com">COMMUN</span></button></form>`;
        const tb = TIERS.map(([k]) => { const t = tierTol(st, k); if (t === null) return ''; const ko = used(k) >= QUOTA[k]; return `<button class="gbtn sm alt"${ko ? ' disabled style="opacity:.4"' : ''} name="k" value="${k}">±${t} <span class="rb ${k}">${RAR[k][1]}</span></button>`; }).join('');
        const ult = used('ult') >= QUOTA.ult;
        return `<div class="gst"><b>${esc(lab[0].toUpperCase() + lab.slice(1))} <small style="opacity:.6;font-weight:400">· moyenne ${fmt(L.avg.toFixed(1))} sur 10 matchs${L.star ? ' · ★ star : palier relevé' : ''}</small></b>
          <div class="opts">${cm('plus')}${cm('moins')}</div>
          ${sk === 'nhl' && st !== 'sog' ? '' : `<form method="post" action="/defi/pick" class="opts" style="margin-top:6px">${hid(st)}<input type="number" name="v" min="0" max="99" inputmode="numeric" placeholder="Ton chiffre" required style="width:96px;margin:0;padding:7px">${tb}<button class="gbtn sm alt"${ult ? ' disabled style="opacity:.4"' : ''} name="k" value="ult">Pile <span class="rb ult">ULTRA</span></button></form>`}
        </div>`;
      }).join('');
      const CKu = CKS[sk];
      const cbTxt = sk === 'nba' ? 'Trouve les chiffres exacts. 2 stats parmi points, rebonds, passes = Vision. Points + rebonds + passes = Ultime. Les 5 stats = Impossible.' : 'Trouve les chiffres exacts. Buts + passes = Vision. Buts + passes + tirs cadrés = Ultime. Il faut annoncer au moins 1 but ou 1 passe (un 0-0 est refusé).';
      const combo = `<div class="gst" style="border-top:2px solid rgba(255,255,255,.25)"><b>Carte spéciale <span class="rb vsn">VISION</span> <span class="rb ulm">ULTIME</span>${sk === 'nba' ? ' <span class="rb imp">IMPOSSIBLE</span>' : ''}</b><form method="post" action="/defi/pick">${hid('combo')}<input type="hidden" name="k" value="combo"><div class="opts" style="margin-bottom:6px">${CKu.map((k) => `<label style="font-size:12px">${S.ST[k].label}<input type="number" name="v_${k}" min="0" max="99" inputmode="numeric" style="width:62px;margin:2px 0 0;padding:6px;display:block"></label>`).join('')}</div><small style="opacity:.75;display:block;margin-bottom:6px">${cbTxt} 1 carte de chaque niveau spécial par jour.</small><button class="gbtn sm">Poser ma carte spéciale</button></form></div>`;
      pick = `<div class="gbox"><b>${esc(pl.name)}</b> <small style="opacity:.75">${esc(pl.team)} vs ${esc(pl.opp)} · ${hourFR(pl.start_utc)}</small>${rows}${combo}<p class="gsm">Commun : Plus ou Moins du palier. Rare, Épique, Légendaire : donne ton chiffre, tu gagnes si le résultat tombe dans la marge (±). Ultra légendaire : le chiffre pile. Quotas par jour et par sport : 5 Communs, 3 Rares, 2 Épiques, 1 Légendaire, 1 Ultra légendaire, et 1 carte de chaque niveau spécial. En NHL, les niveaux Rare à Ultra se jouent sur les tirs cadrés. Les pronostics se ferment au début du match.</p></div>`;
    }
  }
  let search = '';
  if (left > 0) {
    const s = (q.get('q') || '').trim();
    const found = await sql.query(s.length >= 2 ? S.search : S.hot, s.length >= 2 ? [day, s] : [day]).catch(() => []);
    search = `<div class="gbox"><form method="get" action="/defi">${sk === 'nhl' ? '<input type="hidden" name="s" value="nhl">' : ''}<input type="search" name="q" value="${esc(s)}" placeholder="Chercher un joueur ${S.name} qui joue ce soir"></form>
      ${s.length >= 2 ? '' : '<small style="opacity:.7">En forme ce soir :</small>'}
      ${found.map((f) => `<a class="gpl" href="/defi?p=${f.id}${sq}${s ? `&q=${encodeURIComponent(s)}` : ''}"><img alt="" loading="lazy" src="${S.thumb(f.id)}" onerror="this.style.visibility='hidden'"><span><b>${esc(f.name)}</b><small>${esc(f.team)} · ${hourFR(f.start_utc)}</small></span></a>`).join('') || (s ? '<p class="gsm">Aucun joueur trouvé ce soir.</p>' : '<p class="gsm">Pas de match ce soir.</p>')}</div>`;
  }
  const list = mine.map((p) => `<div class="gmine"><span><b>${esc(p.name)}</b> <span class="rb ${p.rarity}">${RAR[p.rarity][1]}</span><br><span class="s">${esc(pickLabel(p))}</span></span>
    ${p.status ? `<span class="st-${p.status}">${p.status === 'won' ? 'Gagné' : p.status === 'lost' ? 'Perdu' : 'Annulé'}</span>` : `<form method="post" action="/defi/del"><input type="hidden" name="sp" value="${sk}"><input type="hidden" name="id" value="${p.id}"><button class="gbtn sm alt">Retirer</button></form>`}</div>`).join('');
  let bonusBox = '';
  const dp = await dailyPick(sk, day);
  if (dp) {
    const [mineB] = await sql.query(`SELECT * FROM g_picks WHERE user_id = $1 AND day = $2 AND sport = $3 AND bonus`, [u.id, day, sk]);
    const [vt] = await sql.query(`SELECT count(*) FILTER (WHERE dir = 'plus')::int AS plus, count(*)::int AS n FROM g_picks WHERE day = $1 AND sport = $2 AND bonus`, [day, sk]);
    const lab = `${fmt(Number(dp.line))} ${S.ST[dp.stat].label}`;
    const btn = (dir) => { const pr = prob(dp.L, dir), r = rarityP(pr, 'base', dp.L.star); return `<form method="post" action="/defi/bonus" style="display:inline"><input type="hidden" name="sp" value="${sk}"><input type="hidden" name="d" value="${dir}"><button class="gbtn sm${dir === 'moins' ? ' alt' : ''}">${dir === 'plus' ? 'Plus' : 'Moins'} de ${lab} <span class="rb ${r}">${RAR[r][1]}</span></button></form>`; };
    const pct = vt.n ? Math.round((100 * vt.plus) / vt.n) : null;
    const votes = vt.n ? `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700"><span>Plus ${pct} %</span><span>${vt.n} vote${vt.n > 1 ? 's' : ''}</span><span>Moins ${100 - pct} %</span></div><div style="height:8px;border-radius:4px;background:#F87171;overflow:hidden;margin-top:4px"><div style="height:100%;width:${pct}%;background:#4ADE80"></div></div></div>` : '';
    bonusBox = `<div class="gbox" style="border-color:rgba(255,201,74,.55);background:linear-gradient(135deg,rgba(255,201,74,.14),rgba(216,117,255,.10))">
      <b>Le Pick du soir · le même pour tous</b><p style="margin:6px 0 10px;font-size:14px"><b>${esc(dp.name)}</b> (${esc(dp.team)}${dp.start_utc ? ' · ' + hourFR(dp.start_utc) : ''}) fera-t-il plus ou moins de <b>${lab}</b> ?</p>
      ${mineB ? `<div class="gok" style="margin:0">Ton choix : ${mineB.dir === 'plus' ? 'Plus' : 'Moins'} de ${lab}${mineB.status ? ` · ${mineB.status === 'won' ? 'Gagné' : mineB.status === 'lost' ? 'Perdu' : 'Annulé'}` : ''}</div>${votes}`
        : dp.open ? `<div class="opts" style="display:flex;gap:6px;flex-wrap:wrap">${btn('plus')}${btn('moins')}</div><p class="gsm" style="margin-top:8px">Carte bonus en plus de tes pronostics. Le vote des autres s'affiche après ton choix.</p>`
        : `<p class="gsm">Le match a commencé.</p>${votes}`}</div>`;
  }
  const tabs = `<nav class="chips" style="margin:6px 0 4px"><a href="/defi" class="${sk === 'nba' ? 'on' : ''}">NBA</a><a href="/defi?s=nhl" class="${sk === 'nhl' ? 'on' : ''}">NHL</a></nav>`;
  return `<h1>Le Défi du soir</h1>
  <p class="sub">Salut <b>${esc(u.pseudo)}</b> · ${esc(dayFR(day))} </p><p style="margin:0 0 8px"><a class="gbtn sm" href="/collection">🃏 Ma collection et mes résultats</a> <a class="gbtn sm alt" href="/album">📒 Mon album</a></p>${tabs}
  ${msg}${bonusBox}<p class="sub" style="margin-top:6px"><b>${mine.length}</b> pronostic${mine.length > 1 ? 's' : ''} ${S.name} ce soir · Communs ${mine.filter((m) => m.rarity === 'com').length}/${QUOTA.com}, Rares ${mine.filter((m) => m.rarity === 'rar').length}/${QUOTA.rar}, Épiques ${mine.filter((m) => m.rarity === 'epi').length}/${QUOTA.epi}</p>
  ${mine.length ? `<div class="gbox"><b>Mes pronostics ${S.name}</b>${list}</div>` : ''}
  ${pick}${search}
  <div class="gbox"><b>Les 5 niveaux de cartes</b><p style="margin:6px 0 0;font-size:13.5px;line-height:1.7"><span class="rb com">COMMUN</span> Plus ou Moins du palier · <span class="rb rar">RARE</span> ton chiffre, marge large · <span class="rb epi">ÉPIQUE</span> marge réduite · <span class="rb leg">LÉGENDAIRE</span> marge très serrée (1 par jour et par sport) · <span class="rb ult">ULTRA LÉGENDAIRE</span> le chiffre pile (1 par jour et par sport). Cartes spéciales NBA (1 par jour) : Vision (2 stats exactes), Ultime (points + rebonds + passes), Impossible (points, rebonds, passes, interceptions, contres). Exemple : tu annonces 10 rebonds en Rare (±3) : 7 à 13 rebonds, c'est gagné.</p></div>
  <form method="post" action="/defi/logout"><button class="gbtn sm alt">Me déconnecter</button></form>
  <p class="gsm">Jeu gratuit, sans mise ni gain. Stats informatives, pas un conseil de pari.</p>`;
}

async function collectionView(u) {
  const cards = await sql.query(`SELECT p.*, p.day::text AS day, coalesce(a.name, b.name) AS name, coalesce(t.tricode, b.team) AS team FROM g_picks p
    LEFT JOIN players a ON p.sport = 'nba' AND a.id = p.player_id LEFT JOIN teams t ON t.id = a.team_id
    LEFT JOIN nhl_players b ON p.sport = 'nhl' AND b.id = p.player_id
    WHERE p.user_id = $1 AND p.status = 'won' ORDER BY p.day DESC, p.id DESC LIMIT 200`, [u.id]);
  const [st] = await sql.query(`SELECT count(*) FILTER (WHERE status = 'won')::int AS w, count(*) FILTER (WHERE status = 'lost')::int AS l FROM g_picks WHERE user_id = $1`, [u.id]);
  const hist = await sql.query(`SELECT p.*, p.day::text AS day, coalesce(a.name, b.name) AS name FROM g_picks p
    LEFT JOIN players a ON p.sport = 'nba' AND a.id = p.player_id LEFT JOIN nhl_players b ON p.sport = 'nhl' AND b.id = p.player_id
    WHERE p.user_id = $1 ORDER BY p.day DESC, p.id DESC LIMIT 60`, [u.id]);
  const stT = (x) => (x === 'won' ? '<span class="st-won">Gagné</span>' : x === 'lost' ? '<span class="st-lost">Perdu</span>' : x === 'void' ? '<span class="st-void">Annulé</span>' : '<span class="st-void">En attente</span>');
  const resT = (p) => (p.dir === 'combo' ? (p.res ? comboTxt(p.res) : '') : p.val !== null && p.val !== undefined ? `${fmt(Number(p.val))} ${sp(p.sport).ST[p.stat]?.label || ''}` : '');
  const histHtml = hist.length ? `<div class="gbox"><b>Mes derniers pronostics</b>${hist.map((p) => `<div class="gmine"><span><b>${esc(p.name || '')}</b> <span class="rb ${p.rarity}">${(RAR[p.rarity] || ['', p.rarity])[1]}</span><br><span class="s">${esc(dayFR(p.day))} · ${sp(p.sport).name} · ${esc(pickLabel(p))}${resT(p) ? ' · résultat : ' + esc(resT(p)) : ''}</span></span>${stT(p.status)}</div>`).join('')}</div>` : '';
  const by = (k) => cards.filter((c) => c.rarity === k).length;
  return `<h1>Ma collection</h1><p class="sub"><b>${esc(u.pseudo)}</b> · ${cards.length} carte${cards.length > 1 ? 's' : ''} · ${st.w} gagnés, ${st.l} perdus · <a href="/album">Mon album</a> · <a href="/defi">Retour au défi</a></p>
  <div class="cnt"><span><span class="rb ult">ULTRA LÉGENDAIRE</span> ${by('ult')}</span><span><span class="rb leg">LÉGENDAIRE</span> ${by('leg')}</span><span><span class="rb epi">ÉPIQUE</span> ${by('epi')}</span><span><span class="rb rar">RARE</span> ${by('rar')}</span><span><span class="rb com">COMMUN</span> ${by('com')}</span><span><span class="rb vsn">VISION</span> ${by('vsn')}</span><span><span class="rb ulm">ULTIME</span> ${by('ulm')}</span><span><span class="rb imp">IMPOSSIBLE</span> ${by('imp')}</span></div>
  ${cards.length ? `<div class="coll">${cards.map(miniCard).join('')}</div>${TCG_JS}` : '<div class="gbox">Pas encore de carte. Pose tes pronostics ce soir : chaque pronostic juste te donne une carte demain matin.</div>'}
  ${histHtml}`;
}


// ---------- album (façon Panini) : une case par niveau et par joueur ----------
const SLOTS = { nba: ['com', 'rar', 'epi', 'leg', 'ult', 'vsn', 'ulm', 'imp'], nhl: ['com', 'rar', 'epi', 'leg', 'ult', 'vsn', 'ulm'] };
const SLOT_COL = { com: '#C98A5A', rar: '#E2E8F0', epi: '#8B5CF6', leg: '#F5C542', ult: 'linear-gradient(135deg,#ff7773,#ffed5f,#83fff7,#d875ff)', vsn: '#cfe0ff', ulm: '#ffd36b', imp: '#ff3b6b' };
async function albumView(u, q) {
  const t = RAR[q.get('t')] ? q.get('t') : 'all';
  const cards = await sql.query(`SELECT p.*, p.day::text AS day, coalesce(a.name, b.name) AS name, coalesce(tm.tricode, b.team) AS team FROM g_picks p
    LEFT JOIN players a ON p.sport = 'nba' AND a.id = p.player_id LEFT JOIN teams tm ON tm.id = a.team_id
    LEFT JOIN nhl_players b ON p.sport = 'nhl' AND b.id = p.player_id
    WHERE p.user_id = $1 AND p.status = 'won' ORDER BY p.day DESC, p.id DESC`, [u.id]);
  const tabs = `<nav class="chips" style="margin:8px 0">${[['all', 'Par joueur'], ...Object.keys(RAR).sort((a, b) => ['com', 'rar', 'epi', 'leg', 'ult', 'vsn', 'ulm', 'imp'].indexOf(a) - ['com', 'rar', 'epi', 'leg', 'ult', 'vsn', 'ulm', 'imp'].indexOf(b)).map((k) => [k, RAR[k][1][0] + RAR[k][1].slice(1).toLowerCase()])].map(([k, l]) => `<a href="/album${k === 'all' ? '' : '?t=' + k}" class="${k === t ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav>`;
  const head = `<h1>Mon album</h1><p class="sub"><b>${esc(u.pseudo)}</b> · ${cards.length} carte${cards.length > 1 ? 's' : ''} · <a href="/collection">Ma collection</a> · <a href="/defi">Le Défi</a></p>${tabs}`;
  if (!cards.length) return head + '<div class="gbox">Ton album est vide. Gagne ta première carte dans le Défi du soir : chaque joueur a une case par niveau à remplir.</div>';
  if (t !== 'all') {
    const seen = new Set(), list = cards.filter((c) => c.rarity === t && !seen.has(c.sport + c.player_id) && seen.add(c.sport + c.player_id));
    return head + `<p class="sub">${list.length} joueur${list.length > 1 ? 's' : ''} avec une carte <b>${(RAR[t] || ['', t])[1]}</b></p>` + (list.length ? `<div class="coll">${list.map(miniCard).join('')}</div>${TCG_JS}` : `<div class="gbox">Aucune carte ${(RAR[t] || ['', t])[1]} pour l'instant. Continue à jouer !</div>`);
  }
  const by = new Map();
  for (const c of cards) { const k = c.sport + ':' + c.player_id; if (!by.has(k)) by.set(k, { name: c.name, team: c.team, sport: c.sport, r: new Set() }); by.get(k).r.add(c.rarity); }
  const rows = [...by.values()].sort((a, b) => b.r.size - a.r.size || String(a.name).localeCompare(String(b.name)));
  const total = rows.reduce((n, r) => n + r.r.size, 0);
  return head + `<p class="sub">${rows.length} joueur${rows.length > 1 ? 's' : ''} · ${total} case${total > 1 ? 's' : ''} remplie${total > 1 ? 's' : ''}</p>` + rows.map((r) => {
    const sl = SLOTS[r.sport] || SLOTS.nba;
    return `<div class="gbox" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b>${esc(r.name || '')}</b><span style="font-weight:800">${[...r.r].filter((k) => sl.includes(k)).length}/${sl.length}</span></div><small style="opacity:.7">${esc(r.team || '')} · ${sp(r.sport).name}</small><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${sl.map((k) => `<span title="${RAR[k][1]}" style="width:30px;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;${r.r.has(k) ? `background:${SLOT_COL[k]};color:#0D1020;box-shadow:0 0 8px rgba(255,255,255,.35)` : 'background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.25);color:rgba(255,255,255,.3)'}">${RAR[k][1].slice(0, 3)}</span>`).join('')}</div></div>`;
  }).join('');
}

// ---------- routes ----------
export async function handleGame(request, url) {
  await tables();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams, origin = 'https://' + url.host;
  const u = await me(request);
  if (request.method === 'POST') {
    const f = await request.formData();
    if (path === '/defi/signup') {
      const pseudo = String(f.get('pseudo') || '').trim(), pin = String(f.get('pin') || '');
      if (f.get('site')) return go('/defi');
      if (!/^[\p{L}0-9_.-]{3,16}$/u.test(pseudo)) return go('/defi?e=' + encodeURIComponent('Pseudo : 3 à 16 lettres, chiffres, _ . -'));
      if (!/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || pin === '123456') return go('/defi?e=' + encodeURIComponent('Code : 6 chiffres, pas trop simple.'));
      if (!f.get('age')) return go('/defi?e=' + encodeURIComponent('Il faut cocher la case.'));
      const salt = rnd(16), h = await hashPin(pin, salt);
      const [nu] = await sql.query(`INSERT INTO g_users (pseudo, pin_hash, salt) VALUES ($1, $2, $3) ON CONFLICT (pseudo) DO NOTHING RETURNING id`, [pseudo, h, salt]);
      if (!nu) return go('/defi?e=' + encodeURIComponent('Ce pseudo est déjà pris.'));
      const t = rnd(32); await sql.query(`INSERT INTO g_sessions (token, user_id) VALUES ($1, $2)`, [t, nu.id]);
      return go('/defi', { 'set-cookie': setCookie(t) });
    }
    if (path === '/defi/login') {
      const pseudo = String(f.get('pseudo') || '').trim(), pin = String(f.get('pin') || '');
      const [x] = await sql.query(`SELECT * FROM g_users WHERE lower(pseudo) = lower($1)`, [pseudo]);
      if (!x) return go('/defi?e=' + encodeURIComponent('Pseudo ou code incorrect.'));
      if (x.locked_until && new Date(x.locked_until) > new Date()) return go('/defi?e=' + encodeURIComponent('Trop d\'essais. Réessaie dans 15 minutes.'));
      if ((await hashPin(pin, x.salt)) !== x.pin_hash) {
        await sql.query(`UPDATE g_users SET fails = fails + 1, locked_until = CASE WHEN fails + 1 >= 5 THEN now() + interval '15 minutes' END WHERE id = $1`, [x.id]);
        return go('/defi?e=' + encodeURIComponent('Pseudo ou code incorrect.'));
      }
      await sql.query(`UPDATE g_users SET fails = 0, locked_until = NULL WHERE id = $1`, [x.id]);
      const t = rnd(32); await sql.query(`INSERT INTO g_sessions (token, user_id) VALUES ($1, $2)`, [t, x.id]);
      return go('/defi', { 'set-cookie': setCookie(t) });
    }
    if (path === '/defi/logout') { const t = cookie(request); if (t) await sql.query(`DELETE FROM g_sessions WHERE token = $1`, [t]); return go('/defi', { 'set-cookie': 'pds=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' }); }
    if (!u) return go('/defi');
    const sk = f.get('sp') === 'nhl' ? 'nhl' : 'nba', S = SP[sk], sq = sk === 'nhl' ? '&s=nhl' : '';
    if (path === '/defi/del') {
      const gt = sk === 'nhl' ? 'nhl_games g WHERE g.id::text = p.game_id' : 'games g WHERE g.id = p.game_id';
      await sql.query(`DELETE FROM g_picks p USING ${gt} AND p.id = $1 AND p.user_id = $2 AND g.start_utc > now() AND p.status IS NULL`, [Number(f.get('id')), u.id]);
      return go('/defi' + (sk === 'nhl' ? '?s=nhl' : ''));
    }
    if (path === '/defi/bonus') {
      const dir = String(f.get('d'));
      if (!['plus', 'moins'].includes(dir)) return go('/defi' + (sq ? '?s=nhl' : ''));
      const day = await gameDay(S), dp = await dailyPick(sk, day);
      if (!dp || !dp.open) return go(`/defi?e=${encodeURIComponent('Le Pick du soir est fermé.')}${sq}`);
      const r = rarityP(prob(dp.L, dir), 'base', dp.L.star);
      await sql.query(`INSERT INTO g_picks (user_id, day, sport, player_id, game_id, stat, dir, line, rarity, bonus) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) ON CONFLICT DO NOTHING`, [u.id, day, sk, dp.player_id, dp.game_id, dp.stat, dir, dp.line, r]);
      return go('/defi?ok=1' + sq);
    }
    if (path === '/defi/pick') {
      const pid = Number(f.get('p')), st = String(f.get('s')); let kind = String(f.get('k'));
      const back = (e) => go(`/defi?p=${pid}${sq}&e=${encodeURIComponent(e)}`);
      if (kind !== 'combo' && !S.stats.includes(st)) return back('Choix invalide.');
      if (!['base', 'rar', 'epi', 'leg', 'ult', 'combo'].includes(kind)) return back('Choix invalide.');
      if (sk === 'nhl' && kind !== 'base' && kind !== 'combo' && st !== 'sog') return back('En NHL, ce niveau se joue sur les tirs cadrés.');
      const day = await gameDay(S);
      const mineP = await sql.query(`SELECT rarity FROM g_picks WHERE user_id = $1 AND day = $2 AND sport = $3 AND NOT bonus`, [u.id, day, sk]);
      const [g] = await sql.query(S.tonight, [pid, day]);
      if (!g) return back('Match commencé ou joueur absent ce soir.');
      const games = await lastGames(pid, S);
      if (games.length < 5) return back('Pas assez de matchs récents.');
      let dir, line, tol = 0, vals = null;
      if (kind === 'combo') {
        vals = {};
        for (const k of CKS[sk]) { const raw = f.get('v_' + k); if (raw === null || raw === '') continue; const v = Number(raw); if (!Number.isInteger(v) || v < 0 || v > 99) return back('Les chiffres doivent être des entiers.'); vals[k] = v; }
        const ks = Object.keys(vals);
        dir = 'combo'; line = 0;
        if (sk === 'nba') {
          const main = ['pts', 'reb', 'ast'].every((k) => k in vals);
          if (ks.length === 5) kind = 'imp';
          else if (ks.length === 3 && main) kind = 'ulm';
          else if (ks.length === 2 && ks.every((k) => ['pts', 'reb', 'ast'].includes(k))) kind = 'vsn';
          else return back('Combinaison invalide : 2 stats (points, rebonds, passes), les 3 (points, rebonds, passes) ou les 5.');
        } else {
          if (!('g' in vals) || !('a' in vals)) return back('En NHL : buts + passes (Vision), ou buts + passes + tirs cadrés (Ultime).');
          if (vals.g + vals.a < 1) return back('Annonce au moins 1 but ou 1 passe (un 0-0 est refusé).');
          kind = ks.length === 3 ? 'ulm' : ks.length === 2 ? 'vsn' : null;
          if (!kind) return back('Combinaison invalide.');
        }
      } else if (kind === 'base') {
        dir = String(f.get('d'));
        if (!['plus', 'moins'].includes(dir)) return back('Choix invalide.');
        line = lines(games, st, S).base;
      } else {
        const v = Number(f.get('v'));
        if (f.get('v') === '' || !Number.isInteger(v) || v < 0 || v > 99) return back('Indique un nombre entier.');
        line = v;
        if (kind === 'ult') dir = 'exact';
        else { tol = tierTol(st, kind); if (tol === null) return back('Ce niveau n\'existe pas pour cette stat.'); dir = 'range'; }
      }
      const rarity = kind === 'base' ? 'com' : kind;
      if (mineP.filter((m) => m.rarity === rarity).length >= QUOTA[rarity]) return back(`Tu as déjà utilisé tous tes ${RAR[rarity][1].toLowerCase()}s du jour (${QUOTA[rarity]}).`);
      const stSave = vals ? 'combo' : st;
      const r = await sql.query(`INSERT INTO g_picks (user_id, day, sport, player_id, game_id, stat, dir, line, rarity, tol, vals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING RETURNING id`, [u.id, day, sk, pid, String(g.gid), stSave, dir, line, rarity, tol, vals ? JSON.stringify(vals) : null]);
      if (!r.length) return back('Tu as déjà un pronostic sur cette stat pour ce joueur.');
      return go('/defi?ok=1' + sq);
    }
    return go('/defi');
  }
  if (path === '/album') return u ? htmlR(shell('Mon album', await albumView(u, q), origin + '/album')) : go('/defi');
  if (path === '/collection') return u ? htmlR(shell('Ma collection', await collectionView(u), origin + '/collection')) : go('/defi');
  return htmlR(shell('Le Défi du soir', u ? await defiView(u, q) : loginView(q.get('e')), origin + '/defi'));
}
