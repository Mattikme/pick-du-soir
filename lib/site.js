// Rendu HTML du site Pick du Soir — direction « cartes de joueur » (rendu serveur, sans dépendance)
import { sql } from './jobs.js';
import { algoRows, algoTrack, MODELS } from './algo.js';
import { fr1, statName } from './lignes.js';
import { NBA_NAMES } from './emblems.js';
import { AD } from './ads.js';
import { FX_SVG, FX_CSS, fxFor } from './fx.js';
import FXGL from './fxgl-client.txt';
import { NHL_TEAMS } from './nhl.js';
const teamName = (t, sport) => (sport === 'nhl' ? (NHL_TEAMS[t] || [t, '']).slice(0, 2) : NBA_NAMES[t] || [t, '']);
const FONTW = { 'Metal Mania': .491, 'Fugaz One': .659, 'Lobster': .591, 'Alfa Slab One': .783, 'Anton': .474, 'Graduate': .665, 'Racing Sans One': .613, 'Black Ops One': .707, 'Rye': .729, 'Pirata One': .416 };
const FONT = {
  nba: { ATL: 'Racing Sans One', BOS: 'Alfa Slab One', BKN: 'Anton', CHA: 'Fugaz One', CHI: 'Anton', CLE: 'Graduate', DAL: 'Rye', DEN: 'Anton', DET: 'Racing Sans One', GSW: 'Black Ops One', HOU: 'Black Ops One', IND: 'Racing Sans One', LAC: 'Fugaz One', LAL: 'Lobster', MEM: 'Alfa Slab One', MIA: 'Fugaz One', MIL: 'Graduate', MIN: 'Metal Mania', NOP: 'Pirata One', NYK: 'Graduate', OKC: 'Black Ops One', ORL: 'Fugaz One', PHI: 'Alfa Slab One', PHX: 'Racing Sans One', POR: 'Rye', SAC: 'Pirata One', SAS: 'Rye', TOR: 'Black Ops One', UTA: 'Lobster', WAS: 'Alfa Slab One' },
  nhl: { ANA: 'Fugaz One', BOS: 'Alfa Slab One', BUF: 'Fugaz One', CGY: 'Racing Sans One', CAR: 'Fugaz One', CHI: 'Anton', CBJ: 'Black Ops One', COL: 'Anton', DAL: 'Rye', DET: 'Lobster', EDM: 'Anton', FLA: 'Racing Sans One', LAK: 'Pirata One', MIN: 'Metal Mania', MTL: 'Graduate', NSH: 'Black Ops One', NJD: 'Metal Mania', NYI: 'Alfa Slab One', NYR: 'Graduate', OTT: 'Pirata One', PHI: 'Alfa Slab One', PIT: 'Fugaz One', SJS: 'Metal Mania', SEA: 'Metal Mania', STL: 'Lobster', TBL: 'Racing Sans One', TOR: 'Graduate', UTA: 'Anton', VAN: 'Black Ops One', VGK: 'Pirata One', WSH: 'Alfa Slab One', WPG: 'Racing Sans One' },
};
const mixw = (hex, t) => { const n = parseInt((hex || '#888888').slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
const typo = (t, sport, rar, c1, c2) => {
  const [city, nick] = teamName(t, sport), font = (FONT[sport] || {})[t] || 'Anton', N = nick.toUpperCase();
  const size = Math.min(74, 262 / (Math.max(N.length, 4) * (FONTW[font] || .6))), arc = Math.min(40, 18 + size * .3), id = `ar${sport[0]}${t}`;
  const light = lum(c2) > .35 && c2.toLowerCase() !== '#ffffff' ? c2 : mixw(c1, .62);
  const L = { rar: [['#000', 16], [light, 9]], epi: [['#0a1020', 16], ['#e8f0fb', 10], [light, 5]], leg: [['#3a2400', 18], ['#fff3b0', 11], ['#b8860b', 6]], ult: [['#10051f', 18], ['#fff', 12], ['#ff2fb3', 6]] }[rar] || [];
  const fill = { rar: '#fff', epi: 'url(#lgS)', leg: 'url(#lgG)', ult: 'url(#lgH)' }[rar];
  const tx = (a) => `<text font-family="'${font}',Impact,sans-serif" font-size="${size.toFixed(1)}" text-anchor="middle" ${a}><textPath href="#${id}" startOffset="50%">${esc(N)}</textPath></text>`;
  return `<svg class="tc-ty" viewBox="0 0 300 210" aria-hidden="true"><defs><path id="${id}" d="M 4 ${(120 + arc / 2).toFixed(0)} Q 150 ${(120 - arc).toFixed(0)} 296 ${(120 + arc / 2).toFixed(0)}"/><linearGradient id="lgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#aebfd8"/></linearGradient><linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c9"/><stop offset=".5" stop-color="#f0b52c"/><stop offset="1" stop-color="#a8741a"/></linearGradient><linearGradient id="lgH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".3" stop-color="#ffe86a"/><stop offset=".55" stop-color="#6bffb8"/><stop offset=".8" stop-color="#6bd6ff"/><stop offset="1" stop-color="#c77dff"/></linearGradient></defs>${L.map(([c, w]) => tx(`fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"`)).join('')}${tx(`fill="${fill}"`)}</svg>`;
};
import { usDate } from './ttfl.js';
import { STATS, ladder, bestLine } from './trends.js';
import { SERIES_CSS, STAT_TABS, rateClass, cellClass } from './series-pages.js';
import { injuryFR } from './injury-fr.js';
import { UI_CSS, HERO_FIX_CSS, seriesRow, lineRow, lastTen } from './ui.js';
import { avatarSvg, avatar } from './avatars.js';
import { HOCKEY_ART, hockeyPose, hockeyInline } from './hockey-art.js';

// Silhouettes chargées depuis la base (table art), mises en cache
let ART = {};
async function loadArt() {
  if (Object.keys(ART).length) return;
  try { const rows = await sql.query('SELECT pose, vb, d FROM art'); ART = Object.fromEntries(rows.map((r) => [r.pose, r])); } catch { ART = {}; }
}
const artDefs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ART).map(([k, a]) => `<symbol id="a-${k}" viewBox="${a.vb}"><path fill="currentColor" d="${a.d}"/></symbol>`).join('')}${Object.entries(HOCKEY_ART).map(([k, a]) => `<symbol id="h-${k}" viewBox="${a.vb}">${a.svg}</symbol>`).join('')}</defs></svg>`;
const POSES = { C: ['contre', 'dunk'], PF: ['dunk', 'contre', 'layup'], SF: ['tir', 'dunk', 'layup'], SG: ['tir', 'crossover', 'layup'], PG: ['crossover', 'layup', 'tir'] };
const poseFor = (pos, id) => { const l = POSES[pos] || Object.keys(ART); return l[Math.abs(Number(id) || 0) % l.length]; };
export const hart = (id) => { const k = hockeyPose(id), a = HOCKEY_ART[k]; return `<svg class="art" viewBox="${a.vb}" aria-hidden="true"><use href="#h-${k}"/></svg>`; };
const art = (pose = 'dunk') => { const a = ART[pose] || ART.dunk; if (!a) return ''; return `<svg class="art" viewBox="${a.vb}" aria-hidden="true"><use href="#a-${ART[pose] ? pose : 'dunk'}"/></svg>`; };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n, d = 1) => (n === null || n === undefined || n === '' ? '–' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d }));
const pct = (f) => { const p = Math.round((Number(f) - 1) * 100); return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} %`; };
const hourFR = (iso) => {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${Number(p.hour)}h${p.minute}`;
};
const dayFR = (ymd) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ymd + 'T12:00:00Z'));
const shortDay = (ymd) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(ymd.slice(0, 10) + 'T12:00:00Z'));
const INJ = { 'Out': 'Absent', 'Day-To-Day': 'Incertain', 'Questionable': 'Incertain', 'Doubtful': 'Douteux', 'Probable': 'Probable' };

// Couleurs d'équipe (primaire, secondaire)
const TEAM = {
  ATL: ['#C8102E', '#FDB927'], BOS: ['#007A33', '#BA9653'], BKN: ['#2B2B2B', '#9EA2A2'], CHA: ['#1D1160', '#00788C'], CHI: ['#CE1141', '#2B2B2B'],
  CLE: ['#860038', '#FDBB30'], DAL: ['#00538C', '#B8C4CA'], DEN: ['#0E2240', '#FEC524'], DET: ['#C8102E', '#1D42BA'], GSW: ['#1D428A', '#FFC72C'],
  HOU: ['#CE1141', '#C4CED4'], IND: ['#002D62', '#FDBB30'], LAC: ['#C8102E', '#1D428A'], LAL: ['#552583', '#FDB927'], MEM: ['#5D76A9', '#12173F'],
  MIA: ['#98002E', '#F9A01B'], MIL: ['#00471B', '#EEE1C6'], MIN: ['#0C2340', '#78BE20'], NOP: ['#0C2340', '#C8102E'], NYK: ['#006BB6', '#F58426'],
  OKC: ['#007AC1', '#EF3B24'], ORL: ['#0077C0', '#C4CED4'], PHI: ['#006BB6', '#ED174C'], PHX: ['#1D1160', '#E56020'], POR: ['#E03A3E', '#2B2B2B'],
  SAC: ['#5A2D81', '#63727A'], SAS: ['#4A4F55', '#C4CED4'], TOR: ['#CE1141', '#A1A1A4'], UTA: ['#4B2A85', '#0B0B0B'], WAS: ['#002B5C', '#E31837'],
};
const tc = (tri) => TEAM[tri] || ['#3A4170', '#8B93B5'];
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const artColor = (c2) => (lum(c2) < 0.25 ? '#FFFFFF' : c2);
const tier = (p) => (p >= 45 ? ['Élite', 'elite'] : p >= 35 ? ['Top', 'top'] : ['Solide', 'solid']);
const splitName = (n) => { const parts = n.split(' '); return parts.length > 1 ? [parts[0], parts.slice(1).join(' ')] : ['', n]; };

const CSS = `
:root{--night:#0D1020;--card:#161A2E;--card-2:#1E2340;--edge:rgba(255,255,255,.09);--ink:#F4F5FB;--mute:#8E95B8;
--ball:#FF6B2C;--elite:#FFC94A;--top:#A78BFA;--solid:#4FD1C5;--warn:#FFB547;--out:#FF5D73;
--disp:'Big Shoulders Display',Impact,sans-serif;--ui:'Bricolage Grotesque',system-ui,sans-serif}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--night);color:var(--ink);font:400 16px/1.5 var(--ui);padding-bottom:84px;
 background-image:radial-gradient(60rem 30rem at 85% -10%,rgba(255,107,44,.16),transparent 60%),radial-gradient(40rem 30rem at -10% 10%,rgba(167,139,250,.12),transparent 60%);background-repeat:no-repeat}
a{color:inherit;text-decoration:none}
a:focus-visible{outline:3px solid var(--ball);outline-offset:3px;border-radius:8px}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
.top{display:flex;align-items:center;justify-content:space-between;padding:16px 0 4px}
.logo{display:flex;align-items:center;gap:8px;font:800 22px/1 var(--disp);letter-spacing:.01em}
.logo i{width:22px;height:22px;border-radius:50%;background:var(--ball);box-shadow:0 0 18px rgba(255,107,44,.55);display:inline-block;position:relative}
.logo i::after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(90deg,transparent 46%,var(--night) 46% 54%,transparent 54%),linear-gradient(transparent 46%,var(--night) 46% 54%,transparent 54%)}
.logo i.puck{width:28px;height:14px;border-radius:50%;margin:0 0 8px;box-shadow:0 2.5px 0 var(--night),0 8px 0 var(--ball),0 8px 18px rgba(255,107,44,.5)}
.logo i.puck::after{display:none}
.date{color:var(--mute);font-size:14px}
h1{font:800 clamp(34px,9vw,52px)/.95 var(--disp);margin:18px 0 8px;letter-spacing:.005em}
.lede{color:var(--mute);margin:0 0 18px;max-width:58ch;font-size:15px}
.note{background:rgba(255,181,71,.08);border:1px solid rgba(255,181,71,.25);border-radius:14px;padding:10px 14px;font-size:14px;margin:0 0 18px;color:#FFD9A3}
.deck{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:6px 16px 14px;scrollbar-width:none}
.deck::-webkit-scrollbar{display:none}
.pc{--c1:#333;--c2:#999;scroll-snap-align:start;flex:0 0 76%;max-width:300px;position:relative;border-radius:24px;padding:16px 16px 14px;overflow:hidden;isolation:isolate;
 background:linear-gradient(160deg,var(--c1) 0%,color-mix(in srgb,var(--c1) 55%,#0D1020) 62%,#0D1020 100%);border:1px solid rgba(255,255,255,.14);transition:transform .15s ease}
.pc:active{transform:scale(.98)}
.pc.first{flex-basis:84%;max-width:340px;box-shadow:0 0 0 1px rgba(255,201,74,.35),0 12px 40px -10px color-mix(in srgb,var(--c1) 70%,transparent)}
.pc .art{position:absolute;right:-14%;top:12%;height:74%;width:auto;color:var(--ca,var(--c2));opacity:.42;z-index:-1;filter:drop-shadow(0 0 24px color-mix(in srgb,var(--ca,var(--c2)) 40%,transparent))}
.pc::after{content:'';position:absolute;left:0;right:0;top:0;height:5px;background:var(--c2)}
.pc .row{display:flex;justify-content:space-between;align-items:center}
.rank{font:800 18px/1 var(--disp);background:rgba(0,0,0,.35);border-radius:10px;padding:5px 9px}
.tier{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.35)}
.tier.elite{color:var(--elite);box-shadow:inset 0 0 0 1px rgba(255,201,74,.5)}
.tier.top{color:var(--top);box-shadow:inset 0 0 0 1px rgba(167,139,250,.5)}
.tier.solid{color:var(--solid);box-shadow:inset 0 0 0 1px rgba(79,209,197,.5)}
.pc .score{font:900 clamp(92px,26vw,124px)/.82 var(--disp);margin:22px 0 2px;letter-spacing:-.01em;text-shadow:0 4px 30px rgba(0,0,0,.35)}
.pc .unit{font-size:13px;color:rgba(255,255,255,.75)}
.pc .first-n{display:block;font-size:15px;font-weight:600;margin-top:16px;color:rgba(255,255,255,.85)}
.pc .last-n{display:block;font:800 30px/1 var(--disp);letter-spacing:.01em}
.pc .meta{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.14);font-size:13px;color:rgba(255,255,255,.85)}
.mini{display:flex;gap:3px;align-items:flex-end;height:28px;flex:none}
.mini span{width:7px;border-radius:2px;background:rgba(255,255,255,.5)}
.mini span:last-child{background:#fff}
.chip{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:1px}
.chip.warn{background:rgba(255,181,71,.16);color:var(--warn)}.chip.out{background:rgba(255,93,115,.16);color:var(--out)}
h2{font:800 28px/1 var(--disp);margin:30px 0 12px;letter-spacing:.01em}
.bento{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tile{background:var(--card);border:1px solid var(--edge);border-radius:20px;padding:14px}
.tile.wide{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px}
.tile .k{color:var(--mute);font-size:13px}
.tile .v{font:800 34px/1.05 var(--disp);margin-top:4px;white-space:nowrap}
.tile .v small{font:600 13px var(--ui);color:var(--mute)}
.tile .who{font-weight:700;font-size:16px;margin-top:2px}
.flame{color:var(--ball)}
.list{display:flex;flex-direction:column;gap:8px}
.li{--c1:#333;display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;background:var(--card);border:1px solid var(--edge);border-radius:16px;padding:10px 12px 10px 0;position:relative;overflow:hidden}
.li::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c1)}
.li .r{font:800 18px var(--disp);color:var(--mute);text-align:right}
.li .n{font-weight:700;font-size:15px;line-height:1.2}
.li .s{color:var(--mute);font-size:13px}
.pill{font:800 22px/1 var(--disp);background:var(--card-2);border-radius:12px;padding:7px 10px;min-width:52px;text-align:center}
.tip{color:var(--mute);font-size:14px;margin:20px 0 0;padding:12px 14px;border:1px dashed rgba(255,255,255,.16);border-radius:14px}
.hero{--c1:#333;--c2:#999;position:relative;border-radius:28px;padding:20px 18px;overflow:hidden;isolation:isolate;margin-top:12px;
 background:linear-gradient(160deg,var(--c1),color-mix(in srgb,var(--c1) 45%,#0D1020) 70%);border:1px solid rgba(255,255,255,.14)}
.hero .art{position:absolute;right:-6%;top:6%;height:118%;width:auto;color:var(--ca,var(--c2));opacity:.4;z-index:-1}
.hero::after{content:'';position:absolute;left:0;right:0;top:0;height:6px;background:var(--c2)}
.hero .first-n{font-weight:600;font-size:17px;color:rgba(255,255,255,.85)}
.hero .last-n{font:900 clamp(46px,13vw,72px)/.9 var(--disp);display:block}
.hero .team{font-size:14px;color:rgba(255,255,255,.85);margin-top:8px}
.hero .next{margin-top:16px;background:rgba(0,0,0,.28);border-radius:14px;padding:10px 12px;font-size:14px}
.chart{background:var(--card);border:1px solid var(--edge);border-radius:20px;padding:14px 12px 8px}
.bars{display:flex;align-items:flex-end;gap:6px;height:150px}
.bars div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}
.bars b{display:block;width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#A78BFA,#5B4BC4)}
.bars div:last-child b{background:linear-gradient(180deg,#FF8A50,#FF6B2C);box-shadow:0 0 18px rgba(255,107,44,.5)}
.bars span{font:800 14px var(--disp)}
.bars em{font:600 10px var(--ui);color:var(--mute);font-style:normal}
table{width:100%;border-collapse:collapse;font-size:14px}
.tbl{background:var(--card);border:1px solid var(--edge);border-radius:20px;overflow-x:auto}
.tbl table{min-width:540px}
th{color:var(--mute);font-weight:600;font-size:12px;text-align:left;padding:10px 8px;border-bottom:1px solid var(--edge)}
td{padding:9px 8px;border-bottom:1px solid var(--edge)}
tr:last-child td{border-bottom:0}
.n{text-align:right;font-variant-numeric:tabular-nums}
td.sc{font:800 20px var(--disp);color:var(--ball)}
.dock{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:4px;padding:6px;border-radius:999px;
 background:rgba(22,26,46,.72);backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:10}
.dock a{white-space:nowrap;padding:10px 18px;border-radius:999px;font-weight:600;font-size:15px;color:var(--mute)}
.dock a.on{background:var(--ball);color:#1A0E06}
footer{color:var(--mute);font-size:12px;padding:34px 0 20px;line-height:1.6}
.empty{padding:28px 0;color:var(--mute)}
@media (prefers-reduced-motion:no-preference){
 .deck .pc{animation:deal .55s cubic-bezier(.2,.8,.2,1) both}
 .deck .pc:nth-child(2){animation-delay:.07s}.deck .pc:nth-child(3){animation-delay:.14s}.deck .pc:nth-child(4){animation-delay:.21s}.deck .pc:nth-child(5){animation-delay:.28s}
 @keyframes deal{from{opacity:0;transform:translateX(40px) rotate(2deg)}}}
@media (min-width:700px){.pc{flex-basis:44%}.pc.first{flex-basis:50%}.bento{grid-template-columns:repeat(4,1fr)}.tile.wide{grid-column:span 2}}
`;


// Univers NHL : même direction artistique, ambiance glace (bleu glacier, givre, stalactites)
const ICE_CSS = `
:root{--night:#07111E;--card:#0E1B2E;--card-2:#15263F;--edge:rgba(190,228,255,.13);--ink:#EAF6FF;--mute:#8FA9C4;--ball:#5CC8FF;--elite:#BFE9FF;--top:#7C9BFF;--solid:#5EEAD4}
body{background-image:radial-gradient(60rem 30rem at 85% -10%,rgba(92,200,255,.20),transparent 60%),radial-gradient(40rem 30rem at -10% 10%,rgba(124,155,255,.14),transparent 60%)}
body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.10;mix-blend-mode:screen;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .75 0 0 0 0 .9 0 0 0 0 1 0 0 0 1.4 -.45'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23f)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:1}
.dock{z-index:5}
body::after{content:'';position:fixed;left:0;right:0;top:0;height:120px;z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(200,238,255,.16),transparent)}
header.top{position:relative}
header.top::before{content:'';position:absolute;left:-16px;right:-16px;top:-2px;height:16px;pointer-events:none;background:linear-gradient(180deg,rgba(225,246,255,.75),rgba(120,205,255,.15));-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/22px 100%;mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/22px 100%}
.logo{background:linear-gradient(180deg,#FFFFFF 15%,#9FE0FF 90%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 12px rgba(110,205,255,.45))}
.logo i{box-shadow:0 0 20px rgba(92,200,255,.6)}
.logo i.puck{background:linear-gradient(180deg,#DDF4FF,#5CC8FF);box-shadow:0 2.5px 0 var(--night),0 8px 0 #2C86B8,0 8px 20px rgba(92,200,255,.55)}
.dock a.on{color:#04131F}
.bars div:last-child b{background:linear-gradient(180deg,#BFEAFF,#5CC8FF);box-shadow:0 0 18px rgba(92,200,255,.5)}
h1,h2{text-shadow:0 0 18px rgba(120,205,255,.18)}
`;

export const photo = (sport, id, team) => {
  const hide = "var s=this.previousElementSibling;if(s)s.style.display='none'";
  if (sport === 'nhl') return `<img class="ph nhl" data-id="${id}" data-t="${team}" alt="" loading="lazy" referrerpolicy="no-referrer" src="https://assets.nhle.com/mugs/nhl/latest/${id}.png" onload="${hide}" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='https://assets.nhle.com/mugs/nhl/20252026/${team}/${id}.png'}else{this.remove()}">`;
  return `<img class="ph" data-id="${id}" alt="" loading="lazy" referrerpolicy="no-referrer" src="https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png" onload="${hide}" onerror="this.remove()">`;
};
export const TOPPS_CSS = '.pc{border:7px solid #F2EEE3;border-radius:20px;box-shadow:0 10px 26px -10px rgba(0,0,0,.6),inset 0 0 0 3px var(--c2)}.pc::after{display:none}.pc .ph{position:absolute;right:-17%;bottom:21%;width:70%;height:auto;z-index:-1;-webkit-mask-image:linear-gradient(#000 82%,transparent);mask-image:linear-gradient(#000 82%,transparent);filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))}.pc .first-n{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-top:12px}.pc .last-n{display:inline-block;background:var(--ca,var(--c2));color:var(--c1);padding:3px 12px;transform:skewX(-8deg);font-size:26px;margin-top:2px;box-shadow:3px 3px 0 rgba(0,0,0,.4)}.pc .meta{border-top:0;margin-top:8px;padding-top:6px}.hero .ph{position:absolute;right:-6%;bottom:-6%;width:70%;height:auto;z-index:-1;-webkit-mask-image:linear-gradient(#000 80%,transparent);mask-image:linear-gradient(#000 80%,transparent)}';
export const IDEAS_CSS = TOPPS_CSS + '.pc{min-height:520px;display:flex;flex-direction:column;aspect-ratio:auto!important}.pc.first{min-height:540px}.pc .rates span{white-space:nowrap}.pc .ctx span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.pc .last-n{align-self:flex-start;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc .ph{right:-30%;bottom:0;width:125%;max-width:none;z-index:-1;-webkit-mask-image:linear-gradient(#000 88%,transparent);mask-image:linear-gradient(#000 88%,transparent);filter:drop-shadow(0 6px 12px rgba(0,0,0,.45))}.pc .ph.nhl{right:-30%;bottom:-7%;width:132%}.pc::after{display:block!important;content:"";position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(transparent,rgba(5,8,20,.88));z-index:-1;pointer-events:none}.pc .score{margin:12px 0 0;font-size:clamp(78px,22vw,104px);text-shadow:0 4px 24px rgba(0,0,0,.6)}.pc .rates{max-width:52%}.pc .ctx{max-width:56%}.pc .first-n,.pc .last-n,.pc .meta{position:relative;z-index:1}.pc .first-n{margin-top:auto;padding-top:10px}.pc .last-n{font-size:26px}.pc .meta{padding-bottom:2px}.pc .meta{text-shadow:0 1px 6px rgba(0,0,0,.8)}.hero{min-height:360px}.hero .ph{right:-14%;bottom:0;width:100%;max-width:none;-webkit-mask-image:linear-gradient(#000 88%,transparent);mask-image:linear-gradient(#000 88%,transparent)}.hero .ph.nhl{width:110%;right:-18%;bottom:-6%}.pc .av,.hero .av{display:none}.pc .av{position:absolute;right:0;bottom:19%;height:44%;width:auto;z-index:-1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}.hero .av{position:absolute;right:-2%;bottom:-4%;height:105%;width:auto;z-index:-1}.pc{box-shadow:inset 0 0 0 5px rgba(255,255,255,.05),inset 0 0 0 6px rgba(255,255,255,.12)}.pc::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 45%,transparent 60%);transform:translateX(-120%);z-index:2}.pc.foil{box-shadow:inset 0 0 0 5px rgba(255,201,74,.12),inset 0 0 0 6px rgba(255,201,74,.55),0 10px 36px -12px rgba(255,201,74,.5)}.pc.foil::before{inset:0;transform:none;background:linear-gradient(125deg,rgba(255,0,128,.22),rgba(255,201,74,.22) 25%,rgba(0,255,200,.2) 50%,rgba(90,120,255,.22) 75%,rgba(255,0,128,.22));mix-blend-mode:soft-light;background-size:300% 300%;animation:foil 7s ease-in-out infinite}@keyframes foil{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@media(prefers-reduced-motion:reduce){.pc.foil::before{animation:none}}.ctx{margin:8px 0 0;font-size:12.5px;line-height:1.3;display:flex;flex-direction:column;gap:3px;position:relative;z-index:1}.ctx .cx{display:inline-block;align-self:flex-start;background:rgba(0,0,0,.35);border-radius:8px;padding:3px 8px}.ctx .cx.hi{background:#30A46C;color:#fff}.ctx .cx.mid{background:#FACC15;color:#1b1b1b}.ctx span{opacity:.88}.mu{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px;margin:14px 0}.mu .big{font-size:42px;font-weight:900;line-height:1}.mu li{margin:5px 0}.mu small{opacity:.7;display:block;margin-top:8px}.ic{width:1.1em;height:1.1em;vertical-align:-.18em;margin-right:2px}.mt{margin:8px 0 0;font-size:14px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6)}.mt b{font-weight:800}.defi-cta{display:block;margin:0 0 10px;padding:11px 13px;border-radius:14px;color:#0D1020;text-decoration:none;font-size:13.5px;background:linear-gradient(110deg,#FFD86B,#FF8A57 45%,#d875ff);box-shadow:0 6px 18px -8px rgba(255,138,87,.7)}.defi-cta b{display:block;font:800 17px/1.1 var(--disp)}.news{display:block;margin:0 0 10px;padding:9px 12px;border-radius:12px;font-size:13.5px;color:inherit;text-decoration:none;background:rgba(255,201,74,.12);border:1px solid rgba(255,201,74,.4)}.toplinks{display:flex;gap:10px;margin:2px 0 14px}.toplinks a{flex:1;text-align:center;font-weight:800;font-size:14px;padding:11px 8px;border-radius:12px;color:inherit;text-decoration:none;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.22)}.vis{margin:12px 0;font-size:13px;opacity:.85;display:flex;gap:14px;flex-wrap:wrap}.vis a{color:inherit;font-weight:700}.idea textarea,.idea input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px;font:inherit;margin:6px 0}.idea textarea{min-height:140px}.idea button{background:var(--ball,#FF8A57);color:#0D1020;font-weight:800;border:0;border-radius:12px;padding:12px 20px;font:inherit;font-weight:800}.idea .hp{position:absolute;left:-9999px}';
export function ideasPage(origin, state) {
  const msg = state === 'ok' ? '<p><b>Merci ! Ton idée a bien été reçue.</b></p>' : state === 'err' ? '<p><b>Oups : écris au moins 10 caractères (500 max), puis réessaie.</b></p>' : '';
  return page({ title: 'Boîte à idées – Pick du Soir', description: 'Propose une idée pour améliorer Pick du Soir.', canonical: origin + '/idees', nav: 'idees', body: `<section class="idea"><h1><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/></svg> Boîte à idées</h1><p>Une stat, un filtre, une page qui te manque ? Dis-le-nous, on lit tout.</p>${msg}<form method="post" action="/idees"><textarea name="idea" maxlength="500" required placeholder="Ton idée…"></textarea><input name="contact" maxlength="120" placeholder="Pseudo X ou e-mail (facultatif)"><input class="hp" name="site" tabindex="-1" autocomplete="off"><button type="submit">Envoyer</button></form></section><style>${IDEAS_CSS}</style>` });
}
export const CHANGELOG = [
  ['14 nov.', 'Les lignes du soir : plus ou moins ?', 'Pour chaque joueur, une ligne au demi-point (24,5 points, 7,5 rebonds…) et le côté que notre modèle juge le plus probable. Fini les paliers trop faciles : on ne garde que les lignes entre 55 et 72 %. NBA et tirs cadrés NHL, résultats publics.'],
  ['14 nov.', 'Le bilan de la semaine', 'Chaque lundi, le total des lignes de la semaine jour par jour, ratés compris, sur X et dans les Résultats.'],
  ['14 nov.', 'Moins de tweets, plus utiles', 'Un visuel « lignes du soir » par ligue, le bilan le lendemain matin et un sondage Plus/Moins chaque soir.'],
  ['14 nov.', 'Le Défi du soir s\'arrête', 'Le jeu de pronostics et ses cartes sont retirés : le site se concentre sur les lignes du soir et les stats des joueurs.'],
  ['14 nov.', 'Mentions légales et confidentialité', 'Deux nouvelles pages en bas du site : qui édite Pick du Soir, et ce que le site fait (ou non) de vos données.'],
  ['26 oct.', 'Contours lumineux sur les cartes', 'Une série de 5 matchs ou plus : la carte prend feu. Dès 3 matchs de suite, la carte prend aussi un contour selon la stat : éclair (points, buts), laser (passes), eau (rebonds), or (3 points), toxique (interceptions), glace (contres), arc-en-ciel (combos).'],
  ['26 oct.', 'Le Pick du soir', 'Dans le Défi : un pronostic imposé, le même pour tous, avec le vote de la communauté et une carte bonus.'],
  ['26 oct.', 'Le Défi du soir', 'Des pronostics NBA et NHL gratuits chaque jour. Pronostic juste = une carte à collectionner, de Commun à Ultra légendaire selon la précision.'],
  ['26 oct.', 'Nouvelles cartes brillantes', 'Cartes façon jeu de cartes à collectionner : 4 raretés, reflets holographiques qui suivent le doigt et l\'inclinaison du téléphone.'],
  ['26 oct.', 'Compositions vérifiées', 'Les joueurs absents ou incertains sont écartés des séries du soir, avec les compositions probables et la rotation réelle de chaque équipe.'],
  ['25 oct.', 'Classements NBA et NHL', 'Un nouvel onglet : victoires, défaites et forme sur 10 matchs.'],
  ['25 oct.', 'Onglet Match-up', 'Les meilleures séries du soir classées par contexte favorable.'],
  ['25 oct.', 'Cartes façon collection', 'Vrais visages des joueurs, score en grand, match et heure en haut de la carte.'],
];
export const LATEST = [CHANGELOG[0][1], '· ' + CHANGELOG[1][1].toLowerCase() + ' · compositions vérifiées'];
export const NEWS_LIST = [
  { key: 'lignes-2026-11-14', kind: 'matchup', color: '#4ADE80', title: 'PLUS OU\nMOINS ?', sub: 'Les lignes du soir : une ligne au demi-point par joueur et le côté le plus probable.', tweet: '📈📉 Nouveau sur Pick du Soir : les lignes du soir.\n\nPour chaque joueur, une ligne au demi-point (24,5 points, 7,5 rebonds…) et le côté le plus probable selon notre modèle : Plus ou Moins.\n\nRésultats publics chaque matin, ratés compris. Lien en bio 👇' },
  { key: 'defi-2026-10-26', minUtc: 17, kind: 'cards', color: '#d875ff', title: 'LE DÉFI\nDU SOIR', sub: 'Des pronostics NBA et NHL gratuits chaque jour. Pronostic juste = une carte à collectionner.', tweet: '🃏 Nouveau : le Défi du soir sur Pick du Soir.\n\nDes pronostics gratuits chaque jour sur les joueurs NBA et NHL. Pronostic juste = une carte à collectionner, de Rare à Ultra rare (le chiffre pile !).\n\n100 % gratuit, sans mise. Lien en bio 👇' },
  { key: 'feu-2026-10-26', minUtc: 19, kind: 'cards', color: '#ff7417', title: 'EN FEU', sub: 'Un joueur enchaîne 5 matchs de suite ? Sa carte prend feu. Éclair, laser, glace… chaque stat a son contour.', tweet: '🔥 Nouveau sur Pick du Soir : quand un joueur enchaîne 5 matchs de suite au-dessus de son palier, sa carte prend feu.\n\nLes séries parfaites ont aussi leur contour selon la stat : éclair pour les points, laser pour les passes, glace pour les contres…\n\nQui est en feu ce soir ? 👇' },
  { key: 'cartes-2026-10-25', kind: 'cards', color: '#FF8A57', title: 'LES CARTES\nPASSENT EN GRAND', sub: 'Le vrai visage du joueur, le score en gros, tout est lisible d\'un coup d\'œil.', tweet: '🃏 Nouveau sur Pick du Soir : les cartes passent en format collection, avec le vrai visage des joueurs et le score en gros. NBA et NHL.\n\nTa carte préférée ? 👇' },
  { key: 'matchup-2026-10-25', kind: 'matchup', color: '#30A46C', title: 'ONGLET\nMATCH-UP', sub: 'Les séries classées par contexte favorable : défense adverse, minutes, absences.', tweet: '🎯 Nouveau : l\'onglet Match-up. Les meilleures séries du soir classées par contexte (défense adverse, minutes, absences), score sur 100.\n\nÇa t\'aide ? Dis-nous 👇' },
  { key: 'classement-2026-10-25', kind: 'table', color: '#5CC8FF', title: 'CLASSEMENTS\nNBA ET NHL', sub: 'Victoires, défaites et forme sur 10 matchs, dans la barre du bas.', tweet: '📊 Nouveau : les classements NBA et NHL, avec la forme sur 10 matchs. Onglet « Classement » en bas du site.\n\nUne idée pour la suite ? Réponds ici 👇' },
];
const RMI = { ok: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>', wip: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/></svg>', soon: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', idea: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>' };
const ROADMAP = [
  ['<ICON:ok> Déjà en ligne', 'done', [
    ['Séries NBA', 'Points, rebonds, passes, 3 pts, combinés et Streak, avec une ligne de référence propre à chaque joueur.'],
    ['Séries NHL', 'Buts, passes, points et Streak, dans un univers glacé.'],
    ['Page Joueurs', 'NBA et NHL, avec classements par stat.'],
    ['Score de match-up NBA', 'Un score sur 100 par série : défense adverse, minutes, rythme, repos et absences.'],
    ['Page Fiabilité', 'Le taux de réussite public de toutes nos séries, ratés compris.'],
    ['Bilan du matin', 'Chaque matin sur X : quelles séries de la veille ont tenu.'],
    ['Boîte à idées', 'Ton avis façonne la suite.'],
    ['Classements NBA / NHL', 'Un onglet Classement en bas : victoires, défaites et forme sur 10 matchs.'],
    ['Cartes façon collection', 'Vraies photos des joueurs, cartes plein format, onglet Match-up pour voir les meilleurs contextes du soir.'],
    ['Lignes du soir', 'Plus ou moins : une ligne au demi-point par joueur, la projection du modèle et le suivi public des résultats. NBA et tirs cadrés NHL.'],
    ['Bilan de la semaine', 'Chaque lundi sur X : le total des lignes de la semaine, ratés compris.'],
    ['Mentions légales et confidentialité', 'Qui édite le site et ce qu\'il fait de vos données.'],
  ]],
  ['<ICON:wip> En cours', 'wip', [
    ['Réentraînement régulier du modèle', 'Le modèle des lignes réapprendra avec les derniers matchs, avec un contrôle avant chaque mise en ligne.'],
    ['Plus de stats NHL en lignes', 'Après les tirs cadrés : points et buts.'],
  ]],
  ['<ICON:soon> Bientôt', 'soon', [
    ['La ligne du soir sur chaque fiche joueur', 'La ligne, le côté et la projection directement sur la page du joueur.'],
    ['Match-up NHL', 'Le même score de contexte pour la NHL : gardien adverse, temps de glace.'],
    ['Comparateur de joueurs', 'Deux joueurs face à face sur leurs séries.'],
    ['Fiches équipes', 'Séries collectives et forme récente.'],
    ['Infos joueurs', 'Blessures et nouvelles directement sur la fiche du joueur, sans page news.'],
  ]],
  ['<ICON:idea> Dans les cartons', 'idea', [
    ['Autres sports', 'Football, NFL, MLB… selon vos demandes.'],
    ['Mode sombre / clair', 'Choisis ton ambiance.'],
    ['Alertes par notification', 'Être prévenu quand une grosse série démarre.'],
  ]],
];
const ROADMAP_CSS = '.rm h1{margin:0 0 6px}.rm .sub{opacity:.8;margin:0 0 18px}.rm h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;margin:24px 0 10px}.rm .it{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-left:4px solid var(--ball,#FF8A57);border-radius:14px;padding:12px 14px;margin:8px 0}.rm .it b{display:block}.rm .it span{font-size:13.5px;opacity:.82}.rm .nw .it{border-left-color:#FF8A57}.rm .nw i{font-style:normal;font-size:12px;font-weight:800;background:#FF8A57;color:#0D1020;border-radius:6px;padding:1px 7px;margin-right:6px}.rm .done .it{border-left-color:#4ADE80}.rm .wip .it{border-left-color:#FACC15}.rm .idea .it{border-left-color:#94A3B8}.rm a.cta{display:inline-block;margin-top:18px;font-weight:800}';
export function roadmapPage(origin) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const news = `<div class="nw"><h2>Dernières mises à jour</h2>${CHANGELOG.map(([d, t, x]) => `<div class="it"><b><i>${esc(d)}</i> ${esc(t)}</b><span>${esc(x)}</span></div>`).join('')}</div>`;
  const body = news + ROADMAP.map(([h, c, items]) => `<div class="${c}"><h2>${h.replace(/<ICON:(\w+)>/, (_, k) => RMI[k])}</h2>${items.map(([t, d]) => `<div class="it"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>`).join('');
  return page({ title: 'Roadmap – Pick du Soir', description: 'Ce qui est en ligne, en cours et à venir sur Pick du Soir.', canonical: origin + '/roadmap', nav: 'roadmap', body: `<section class="rm"><h1><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg> Roadmap</h1><p class="sub">Ce qu'on a construit, ce qu'on prépare, ce qu'on imagine. Les priorités évoluent avec vos retours.</p>${body}<a class="cta" href="/idees">💡 Propose ton idée →</a></section><style>${IDEAS_CSS}${ROADMAP_CSS}</style>` });
}
function page({ title, description, canonical, body, nav = 'soir', hockey = nav === 'nhl', jsonLd = null }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="google-site-verification" content="x6lRJ8aaqzgtqy3nTJFK8rxPwiUmxUb0ONiXjDtpr40"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Pick du Soir"><meta property="og:locale" content="fr_FR">${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}<meta name="twitter:card" content="summary"><meta name="twitter:site" content="@PickDuSoir">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}<meta name="theme-color" content="${hockey ? '#07111E' : '#0D1020'}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap" rel="stylesheet">
${hockey ? `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M2 12v8c0 3 6 6 14 6s14-3 14-6v-8z' fill='%232C86B8'/%3E%3Cellipse cx='16' cy='12' rx='14' ry='6.5' fill='%235CC8FF'/%3E%3Cellipse cx='16' cy='12' rx='8' ry='3' fill='none' stroke='%230D1020' stroke-width='2'/%3E%3C/svg%3E">` : `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='15' fill='%23FF6B2C'/%3E%3Cpath d='M1 16h30M16 1v30M5 5c6 6 6 16 0 22M27 5c-6 6-6 16 0 22' stroke='%230D1020' stroke-width='2' fill='none'/%3E%3C/svg%3E">`}
<style>${CSS}${SERIES_CSS}${IDEAS_CSS}${hockey ? ICE_CSS : ''}${UI_CSS}${HERO_FIX_CSS}</style></head><body${hockey ? ' class="ice"' : ''}>${artDefs()}<div class="wrap">
<header class="top"><a class="logo" href="/"><i${hockey ? ' class="puck"' : ''}></i>Pick du Soir</a><nav class="mainnav" aria-label="Navigation"><a href="/algo" class="algo${nav === 'algo' ? ' on' : ''}">Lignes</a><a href="/" class="${nav === 'soir' ? 'on' : ''}">NBA</a><a href="/nhl" class="${nav === 'nhl' ? 'on' : ''}">NHL</a><a href="/joueurs" class="${nav === 'joueurs' ? 'on' : ''}">Joueurs</a><a href="/fiabilite" class="${nav === 'fiabilite' ? 'on' : ''}">Résultats</a></nav></header>${AD('haut')}
<main>${body}</main>
<footer><nav class="flinks" aria-label="Plus"><a href="/joueurs">Tous les joueurs</a><a href="/classement">Classement</a><a href="/fiabilite">Résultats</a><a href="/roadmap">Nouveautés</a><a href="/idees">Proposer une idée</a><a href="/a-propos">À propos</a><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité et cookies</a></nav>Statistiques à titre informatif, calculées chaque jour à partir des feuilles de match officielles. Les performances passées ne préjugent pas des performances futures.<br>
<div class="vis"><!--VIS--></div>
Pick du Soir ne propose aucun pari et n'est lié à aucun opérateur de jeux. Site indépendant, sans lien avec la NBA, la NHL ni leurs équipes.
<div class="resp">Les jeux d'argent sont interdits aux mineurs. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).</div></footer>
</div>
<nav class="dock" aria-label="Navigation"><a href="/" class="${nav === 'soir' ? 'on' : ''}">NBA</a><a href="/nhl" class="${nav === 'nhl' ? 'on' : ''}">NHL</a><a href="/classement" class="${nav === 'classement' ? 'on' : ''}">Classement</a><a href="/joueurs" class="${nav === 'joueurs' ? 'on' : ''}">Joueurs</a></nav>
<script>document.querySelectorAll('.chips').forEach(function(c){var a=c.querySelector('a.on');if(a)c.scrollLeft=a.offsetLeft-c.clientWidth/2+a.offsetWidth/2;});</script>
</body></html>`;
}

const injChip = (s) => (!s ? '' : `<span class="chip ${s === 'Out' ? 'out' : 'warn'}">${esc(INJ[s] || s)}</span>`);
const vs = (r) => `${r.home ? 'vs' : '@'} ${esc(r.opp)}`;

const lineLabel = (stat, t) => `${t}+ ${STATS[stat].label}`;
const lineShort = (stat, t) => `${t}+ ${STATS[stat].short}`;
const frac = (h, n) => `${h}/${n}`;

function card(r, first) {
  const [c1, c2] = tc(r.team);
  const [fn, ln] = splitName(r.name);
  const badge = r.l10 === r.n10 ? ['10 sur 10', 'elite'] : r.l5 === r.n5 ? ['5 sur 5', 'top'] : ['Régulier', 'solid'];
  return `<a class="pc${first ? ' first' : ''}${badge[1] === 'elite' ? ' foil' : ''}" href="/joueur/${esc(r.slug)}?stat=${r.stat}" style="--c1:${c1};--c2:${c2};--ca:${artColor(c2)}">${avatarSvg('nba', r.player_id, artColor(c2), c1, null)}${photo('nba', r.player_id)}
  <div class="row"><span class="rank">№ ${String(r.rank).padStart(2, '0')}</span><span class="tier ${badge[1]}">${badge[1] === 'elite' ? '✦ ' : ''}${badge[0]}</span></div>
  <div class="mt"><b>${esc(r.team)} ${vs(r)}</b> · ${hourFR(r.start_utc)}${injChip(r.inj)}${r.streak >= 3 ? ` · Série ${r.streak}` : ''}</div>
  <span class="line">${esc(lineLabel(r.stat, r.threshold))}</span>
  <div class="score">${r.l10}<small>/${r.n10}</small></div><div class="unit">sur ses 10 derniers matchs</div>
  <div class="rates"><span>5 derniers<b>${frac(r.l5, r.n5)}</b></span><span>20 derniers<b>${frac(r.l20, r.n20)}</b></span>${r.nh2h ? `<span>vs ${esc(r.opp)}<b>${frac(r.h2h, r.nh2h)}</b></span>` : ''}</div>
  ${r.ms != null ? `<div class="ctx"><b class="cx${r.ms >= 70 ? ' hi' : r.ms >= 55 ? ' mid' : ''}">Match-up ${r.ms}/100</b>${r.mr?.[0] ? `<span>${esc(r.mr[0].t)}</span>` : ''}</div>` : ''}
  <span class="first-n">${esc(fn)}</span><span class="last-n">${esc(ln)}</span></a>`;
}


// ---------- Cartes TCG (aperçu : /?tcg=1) ----------
// Petite recherche de joueur (NBA + NHL), résultats en direct depuis /api/search
export const SEARCH = `<form class="srch" action="/joueurs" role="search" onsubmit="return false"><input type="search" placeholder="🔍 Chercher un joueur (NBA ou NHL)" autocomplete="off" aria-label="Chercher un joueur" enterkeyhint="search"><div class="srl" hidden></div></form>
<style>.srch{position:relative;margin:4px 0 14px}.srch input{width:100%;box-sizing:border-box;padding:12px 15px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;font:500 16px/1.2 inherit;outline:none}.srch input:focus{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.09)}
.srl{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;background:#151a2e;border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;box-shadow:0 18px 40px -10px rgba(0,0,0,.7)}.srl a{display:flex;justify-content:space-between;gap:10px;padding:11px 14px;color:#fff;text-decoration:none;border-top:1px solid rgba(255,255,255,.06)}.srl a:first-child{border-top:0}.srl a:active,.srl a:hover{background:rgba(255,255,255,.07)}.srl small{opacity:.6;white-space:nowrap}.srl p{margin:0;padding:12px 14px;opacity:.7}</style>
<script>(()=>{const f=document.currentScript.previousElementSibling.previousElementSibling,i=f.querySelector('input'),l=f.querySelector('.srl');let t,last='';const e=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const go=async()=>{const q=i.value.trim();if(q.length<2){l.hidden=true;return}if(q===last)return;last=q;try{const r=await fetch('/api/search?q='+encodeURIComponent(q));const d=await r.json();if(q!==last)return;l.innerHTML=d.length?d.map(p=>'<a href="'+p.url+'"><span>'+e(p.name)+'</span><small>'+e(p.team||'')+' · '+p.sport.toUpperCase()+'</small></a>').join(''):'<p>Aucun joueur trouvé</p>';l.hidden=false}catch{}};
i.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(go,180)});i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){const a=l.querySelector('a');if(a)location.href=a.href}});document.addEventListener('click',ev=>{if(!f.contains(ev.target))l.hidden=true})})()</script>`;

export const TCG_CSS = `.tc{--c1:#333;--c2:#999;flex:0 0 80%;max-width:316px;scroll-snap-align:start;position:relative;border-radius:18px;padding:7px;color:#fff;text-decoration:none;box-shadow:0 12px 30px -12px rgba(0,0,0,.7);animation:deal .55s cubic-bezier(.2,.8,.2,1) both}
.tc.leg{background:linear-gradient(135deg,#F6E27A,#B8860B 30%,#FFF3B0 50%,#B8860B 70%,#F6E27A)}
.tc.epi{background:linear-gradient(135deg,#D9C2FF,#6B3FD1 35%,#EFE4FF 52%,#6B3FD1 72%,#D9C2FF)}
.tc.rar{background:linear-gradient(135deg,#EEF1F6,#8A94A6 35%,#FFFFFF 52%,#8A94A6 72%,#EEF1F6)}
.tc-in{position:relative;border-radius:12px;overflow:hidden;min-height:530px;display:flex;flex-direction:column;background:linear-gradient(180deg,var(--c1) 0%,color-mix(in srgb,var(--c1) 45%,#0D1020) 55%,#0D1020 100%)}
.tc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px 8px;background:rgba(0,0,0,.32)}
.tc-name{font:800 19px/1.1 var(--disp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tc-rar{flex:none;font-size:10.5px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.45)}
.leg .tc-rar{color:#FFD86B}.epi .tc-rar{color:#CDB4FF}.rar .tc-rar{color:#E2E8F0}
.tc-art{position:relative;margin:0 9px;height:210px;border-radius:9px;overflow:hidden;border:2px solid rgba(255,255,255,.28);isolation:isolate;background:radial-gradient(ellipse 38% 42% at 50% 28%,rgba(255,255,255,.2) 0%,rgba(255,255,255,.06) 55%,transparent 100%),radial-gradient(ellipse 120% 95% at 50% 32%,color-mix(in srgb,var(--c1) 72%,var(--c2) 28%) 0%,color-mix(in srgb,var(--c1) 68%,#000 32%) 55%,color-mix(in srgb,var(--c1) 22%,#05060c 78%) 100%)}.tc-art::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url%28%23g%29'/%3E%3C/svg%3E");opacity:.05}.tc-beams{position:absolute;left:50%;top:-30%;width:240%;height:240%;margin-left:-120%;z-index:0;pointer-events:none;transform-origin:50% 0;opacity:0;background:repeating-conic-gradient(from 150deg at 50% 0,rgba(255,255,255,.0) 0deg,rgba(255,255,255,.16) 2deg,rgba(255,255,255,0) 5deg,rgba(255,255,255,0) 11deg);-webkit-mask:radial-gradient(ellipse 45% 45% at 50% 0,#000 20%,transparent 70%);mask:radial-gradient(ellipse 45% 45% at 50% 0,#000 20%,transparent 70%)}.epi .tc-beams{opacity:.55}.tc-beams{animation:none}.leg .tc-beams{opacity:.7;background:repeating-conic-gradient(from 150deg at 50% 0,rgba(255,214,110,0) 0deg,rgba(255,214,110,.2) 2deg,rgba(255,255,255,0) 5deg,rgba(255,255,255,0) 11deg);}.ult .tc-beams{opacity:.6;animation:none;x:beams 22s ease-in-out infinite alternate}@keyframes beams{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}.ult .tc-art::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;mix-blend-mode:overlay;opacity:.32;background:linear-gradient(115deg,#ff7773,#ffed5f,#83fff7,#d875ff,#ff7773) var(--mx,50%) var(--my,50%)/300% 300%}@media (prefers-reduced-motion:reduce){.tc-beams{animation:none!important}}
.tc-art .ph{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:106%;width:auto;max-width:none}
.tc-art .ph.nhl{height:128%;bottom:-14%}
.tc-ty{position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;overflow:visible}
.tc-art .ph{z-index:1}.u .u-fr{margin:8px 9px 0;padding:2px;background:var(--fr,linear-gradient(160deg,#eef1f6,#8a94a6 40%,#fff 55%,#8a94a6 75%));clip-path:polygon(0 0,100% 0,100% 85%,50% 100%,0 85%)}.u.epi .u-fr{--fr:linear-gradient(160deg,#efe4ff,#6b3fd1 40%,#d9c2ff 55%,#6b3fd1 75%)}.u.leg .u-fr{--fr:linear-gradient(160deg,#fff3b0,#b8860b 40%,#f6e27a 55%,#b8860b 75%)}.u.ult .u-fr{--fr:linear-gradient(160deg,#ff7773,#ffed5f,#83fff7,#d875ff)}.u .tc-art{margin:0;height:272px;border:0;border-radius:0;clip-path:polygon(0 0,100% 0,100% 85%,50% 100%,0 85%)}.u .tc-art .ph{height:100%;bottom:4%}.u .tc-art .ph.nhl{height:122%;bottom:-12%}.u-sh{position:absolute;top:0;bottom:0;left:-12%;width:124%;z-index:0;pointer-events:none;background:linear-gradient(118deg,color-mix(in srgb,var(--c1) 45%,#05060c) 0 20%,transparent 20.2%),linear-gradient(118deg,transparent 56%,color-mix(in srgb,var(--c2) 55%,transparent) 56.2% 65%,transparent 65.2%),linear-gradient(62deg,transparent 63%,color-mix(in srgb,var(--c2) 38%,transparent) 63.2% 71%,transparent 71.2%),linear-gradient(118deg,transparent 68%,rgba(255,255,255,.45) 68.2% 68.9%,transparent 69.1%),linear-gradient(118deg,transparent 24%,rgba(255,255,255,.12) 24.2% 25.6%,transparent 25.8%)}.u.none .u-sh{animation:ush 9s ease-in-out infinite alternate}@keyframes ush{from{transform:translateX(-5%)}to{transform:translateX(5%)}}.u.leg .u-sh{background:linear-gradient(118deg,color-mix(in srgb,var(--c1) 45%,#05060c) 0 20%,transparent 20.2%),linear-gradient(118deg,transparent 56%,rgba(255,206,84,.5) 56.2% 65%,transparent 65.2%),linear-gradient(62deg,transparent 63%,rgba(255,226,140,.35) 63.2% 71%,transparent 71.2%),linear-gradient(118deg,transparent 68%,rgba(255,244,200,.7) 68.2% 68.9%,transparent 69.1%),linear-gradient(118deg,transparent 24%,rgba(255,215,110,.25) 24.2% 25.6%,transparent 25.8%)}.u.ult .u-sh{background:linear-gradient(118deg,color-mix(in srgb,var(--c1) 45%,#05060c) 0 20%,transparent 20.2%),linear-gradient(118deg,transparent 56%,rgba(255,119,115,.45) 56.2% 60%,rgba(255,237,95,.45) 60% 63%,rgba(131,255,247,.45) 63% 65%,transparent 65.2%),linear-gradient(62deg,transparent 63%,rgba(216,117,255,.4) 63.2% 71%,transparent 71.2%),linear-gradient(118deg,transparent 68%,rgba(255,255,255,.6) 68.2% 68.9%,transparent 69.1%)}.u-fade{position:absolute;left:0;right:0;bottom:0;height:42%;z-index:2;pointer-events:none;background:linear-gradient(transparent,rgba(5,6,12,.85) 85%)}.u-ovr{position:absolute;left:12px;top:12px;z-index:3;display:grid;grid-template-columns:auto auto;align-items:end;column-gap:2px;text-shadow:0 2px 8px rgba(0,0,0,.6)}.u-ovr b{font:900 54px/.8 var(--disp)}.u-ovr small{font:800 17px/1 var(--disp);opacity:.85;padding-bottom:3px}.u-ovr em{grid-column:1/3;font:800 17px/1.3 var(--disp);font-style:normal;letter-spacing:.04em;opacity:.95}.u-st{position:absolute;left:0;right:0;top:3px;z-index:3;text-align:center;font-size:12px;letter-spacing:3px;color:#e2e8f0;text-shadow:0 0 6px rgba(255,255,255,.6)}.u.epi .u-st{color:#cdb4ff;text-shadow:0 0 6px #8b5cf6}.u.leg .u-st{color:#ffd86b;text-shadow:0 0 6px #f59e0b}.u.ult .u-st{color:#fff;text-shadow:0 0 6px #ff7773,0 0 10px #83fff7}.u-rar{position:absolute;right:9px;top:14px;z-index:3;font-size:9.5px;font-weight:800;letter-spacing:.1em;padding:3px 7px;border-radius:999px;background:rgba(0,0,0,.5);color:#e2e8f0}.u.epi .u-rar{color:#cdb4ff}.u.leg .u-rar{color:#ffd86b}.u.ult .u-rar{background:linear-gradient(90deg,#ff7773,#ffed5f,#83fff7,#d875ff);color:#0d1020}.u-name{position:absolute;left:8%;right:8%;bottom:19%;z-index:3;text-align:center;font:900 25px/1 var(--disp);text-transform:uppercase;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 8px rgba(0,0,0,.8)}.u .tc-mt{padding-top:10px}@property --ea{syntax:'<angle>';inherits:false;initial-value:0deg}.tc-edge{position:absolute;inset:0;border-radius:18px;padding:2px;z-index:6;pointer-events:none;display:none;--ec:#c9a7ff;background:conic-gradient(from var(--ea),transparent 0 62%,color-mix(in srgb,var(--ec) 60%,transparent) 76%,var(--ec) 84%,#fff 87%,transparent 90%,transparent 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:edge 4.5s linear infinite}.tc-edge{display:none!important}.tc.ser{background:linear-gradient(135deg,#8fa3bd,#3b4a63 38%,#b9c8dc 52%,#3b4a63 72%,#8fa3bd)}
.u.ser .u-fr{--fr:linear-gradient(160deg,#c3d2e6,#53647f 40%,#b9c8dc 55%,#475873 75%)}.u.ser .u-st{display:none}.u.ser .u-rar{color:#c3d2e6}.u.ser .tc-shine{opacity:.15}.u.ser .tc-glare{opacity:.2}
.tc.com{background:linear-gradient(135deg,#a07e63,#5e4838 38%,#c9a283 52%,#5e4838 72%,#a07e63)}.u.com .u-fr{--fr:linear-gradient(160deg,#d6b295,#7a5c47 40%,#c9a283 55%,#6b5140 75%)}.u.com .u-st{color:#d6b295;text-shadow:none}.u.com .u-rar{color:#d6b295}.u.com .tc-shine{opacity:.15}.u.com .tc-glare{opacity:.2}.tc:not(.vis) .tc-shine,.tc:not(.vis) .tc-glare,.tc:not(.vis) .tc-sweep,.tc:not(.vis) .tc-pt{display:none!important}.hero.mini{background:none;min-height:0;height:auto;padding:4px 2px;overflow:visible}.hero.mini .team,.hero.mini .next{position:static;text-align:center;margin:4px 0}.solo{display:flex;justify-content:center;margin:6px 0 4px}.solo .tc{flex:0 1 316px;animation:none}.solo .tc-no{display:none}.u .tc-art{contain:paint}.leg .tc-edge{--ec:#ffd36b;animation-duration:3.6s}.ult .tc-edge{--ec:#83fff7;background:conic-gradient(from var(--ea),transparent 0 30%,#ff7773 37%,#fff 40%,transparent 43% 80%,#83fff7 87%,#fff 90%,transparent 93%);animation-duration:3s}@keyframes edge{to{--ea:360deg}}.tc-sweep{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;border-radius:inherit;display:none}.tc-sweep::before{content:"";position:absolute;top:-20%;bottom:-20%;left:-45%;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.07) 35%,rgba(255,255,255,.28) 50%,rgba(255,255,255,.07) 65%,transparent);transform:skewX(-14deg);animation:sweep 6s ease-in-out infinite}.vis.epi .tc-sweep,.vis.leg .tc-sweep,.vis.ult .tc-sweep{display:block}.leg .tc-sweep::before{animation-duration:5s}.ult .tc-sweep::before{animation-duration:4s}@keyframes sweep{0%,55%{transform:translateX(0) skewX(-14deg)}100%{transform:translateX(480%) skewX(-14deg)}}.tc-pt{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;display:none;--pc:#d8c4ff}.tc-pt::before,.tc-pt::after{content:"";position:absolute;left:0;right:0;top:0;height:calc(100% + 120px);animation:rise 9s linear infinite;background-image:radial-gradient(circle,#fff 0 .8px,var(--pc) 1.4px,transparent 3px),radial-gradient(circle,var(--pc) 0 1px,transparent 1.9px),radial-gradient(circle,#fff 0 .8px,transparent 1.6px);background-size:137px 120px,173px 120px,211px 120px;background-position:13px 21px,90px 74px,161px 39px;opacity:.6}.tc-pt::after{animation-duration:6s;background-size:151px 120px,97px 120px,229px 120px;background-position:57px 95px,27px 30px,117px 61px;opacity:.35;animation-name:rise,twk}@keyframes rise{to{transform:translateY(-120px)}}@keyframes twk{50%{opacity:.12}}.vis.epi .tc-pt,.vis.leg .tc-pt,.vis.ult .tc-pt,.vis.fx-flame .tc-pt{display:block}.leg .tc-pt{--pc:#ffd36b}.ult .tc-pt{--pc:#fff}.fx-flame .tc-pt{--pc:#ff8a3d}.fx-flame .tc-pt::before{animation-duration:4s}.fx-flame .tc-pt::after{animation-duration:2.6s}.fx-bolt .tc-pt{--pc:#8fd6ff}.fx-water .tc-pt{--pc:#8fe3ff}.fx-toxic .tc-pt{--pc:#9dff6a}.fx-ice .tc-pt{--pc:#e8fbff}.fx-gold .tc-pt{--pc:#ffd54a}.fx-laser .tc-pt{--pc:#ff6b8a}.tc-beams{transition:translate .25s ease-out}.tc.live .tc-beams{translate:calc((var(--mx) - 50%) * .06) 0}.tc:not(.vis),.tc:not(.vis) *,.tc:not(.vis) *::before,.tc:not(.vis) *::after{animation-play-state:paused!important}body.scr .tc *,body.scr .tc *::before,body.scr .tc *::after{animation-play-state:paused!important}body.scr .tc-edge{display:none!important}@media (prefers-reduced-motion:reduce){.tc-edge,.tc-sweep::before,.tc-pt::before,.tc-pt::after{animation:none!important}}.tc-ty{mix-blend-mode:soft-light}.rar .tc-ty{opacity:.05}.epi .tc-ty{opacity:.06}.leg .tc-ty{opacity:.07}.ult .tc-ty{opacity:.08}
.tc-no{position:absolute;right:7px;bottom:7px;font-size:11px;font-weight:800;background:rgba(0,0,0,.6);padding:2px 7px;border-radius:6px}
.tc-mt{padding:8px 13px 0;font-size:13.5px}.tc-mt b{font-weight:800}
.tc-atk{margin:8px 9px 0;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15)}
.tc-ah{display:flex;justify-content:space-between;align-items:center;gap:10px}
.tc-ah b{font:800 21px/1.05 var(--disp)}
.tc-sc{flex:none;font:900 44px/.85 var(--disp)}.tc-sc small{font-size:20px;opacity:.7}
.tc-dots{display:flex;gap:4px;margin:9px 0 7px}.tc-dots i{flex:1;height:7px;border-radius:3px;background:rgba(255,255,255,.18)}.tc-dots i.on{background:#4ADE80;box-shadow:0 0 8px rgba(74,222,128,.5)}
.tc-sub{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;opacity:.9}.tc-sub b{font-weight:800}
.tc-en{margin:8px 9px 0;padding:9px 12px;border-radius:10px;background:rgba(0,0,0,.32)}
.tc-eh{display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.tc-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.15);margin:6px 0 5px;overflow:hidden}.tc-bar span{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#FACC15,#4ADE80)}
.tc-fl{font-size:12.5px;font-style:italic;opacity:.85;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tc-ft{margin-top:auto;display:flex;justify-content:space-between;padding:9px 13px 10px;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;opacity:.65}
.tc.old .tc-in::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 25%,rgba(255,236,170,.28) 42%,rgba(140,210,255,.22) 52%,transparent 68%);background-size:260% 260%;mix-blend-mode:overlay;animation:holo 6s ease-in-out infinite}
@keyframes holo{0%,100%{background-position:0% 0%}50%{background-position:100% 100%}}
@media(prefers-reduced-motion:reduce){.tc.leg .tc-in::after{animation:none}}
@property --mx{syntax:'<percentage>';inherits:true;initial-value:50%}@property --my{syntax:'<percentage>';inherits:true;initial-value:50%}
.tc{--rx:0deg;--ry:0deg;transform:perspective(900px) rotateX(var(--ry)) rotateY(var(--rx));transition:transform .25s ease-out;animation:deal .55s cubic-bezier(.2,.8,.2,1) both}
.tc.live{animation:none}
@keyframes drift{0%{--mx:15%;--my:20%}50%{--mx:85%;--my:45%}100%{--mx:40%;--my:85%}}
.tc-shine,.tc-glit,.tc-glare{position:absolute;inset:0;pointer-events:none;border-radius:inherit}
.tc-glare{z-index:5;mix-blend-mode:overlay;background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.75) 0%,rgba(255,255,255,.15) 30%,transparent 55%);opacity:.35}
.tc-shine{z-index:4;mix-blend-mode:color-dodge;opacity:0;background-image:repeating-linear-gradient(115deg,#ff7773 0%,#ffed5f 5%,#a8ff5f 10%,#83fff7 15%,#7894ff 20%,#d875ff 25%,#ff7773 30%);background-size:300% 300%;background-position:var(--mx) var(--my);filter:brightness(.55) contrast(1.6) saturate(1.3)}
.tc-glit{z-index:4;mix-blend-mode:color-dodge;opacity:0;background-image:radial-gradient(circle,#fff 0 .8px,transparent 1.6px),radial-gradient(circle,#fff 0 .6px,transparent 1.4px),radial-gradient(circle,#ffe9a8 0 1px,transparent 2px);background-size:41px 53px,67px 59px,89px 83px;background-position:var(--my) var(--mx),11px 7px,var(--mx) var(--my)}
.rar .tc-glare{opacity:.28}
.epi .tc-shine{opacity:.42}.epi .tc-glare{opacity:.45}
.leg .tc-shine{opacity:.5;background-image:repeating-linear-gradient(115deg,#fff3b0 0%,#ffcf4a 6%,#fff 10%,#e0a526 16%,#fff3b0 22%)}.leg .tc-glit{opacity:0}.leg .tc-glare{opacity:.55}
.tc.ult{background:linear-gradient(125deg,#ff7773,#ffed5f,#a8ff5f,#83fff7,#7894ff,#d875ff,#ff7773,#ffed5f);background-size:300% 300%;background-position:var(--mx) var(--my);box-shadow:0 0 26px -4px rgba(216,117,255,.6),0 12px 30px -12px rgba(0,0,0,.7)}
.ult .tc-rar{background:linear-gradient(90deg,#ff7773,#ffed5f,#83fff7,#d875ff);color:#0D1020}
.ult .tc-shine{opacity:.65}.ult .tc-glit{opacity:0}.ult .tc-glare{opacity:.6}
.leg .tc-rar{box-shadow:0 0 10px rgba(255,216,107,.55)}

.pk.com .tc-shine,.pk.com .tc-glare{opacity:.06}.pk.com .tc-in{background:linear-gradient(180deg,#2b2e37,#15171d)}.pk.com .u-st{color:#a9a39b}
.pk.rar .tc-in{box-shadow:inset 0 0 0 1px rgba(226,232,240,.35)}.pk.rar .u-name,.pk.rar .u-ovr b{text-shadow:0 0 10px rgba(226,232,240,.45)}
.tc.pk.epi{box-shadow:0 0 24px -3px rgba(139,92,246,.75),0 12px 30px -12px rgba(0,0,0,.7)}.pk.epi .tc-in{background:radial-gradient(ellipse 90% 60% at 50% 18%,#5a2fc0 0,#251052 55%,#0b0716 100%)}.pk.epi .u-name,.pk.epi .u-ovr b{color:#e6d9ff;text-shadow:0 0 14px rgba(167,139,250,.9)}.pk.epi .tc-atk{background:rgba(139,92,246,.18);border-color:rgba(190,160,255,.45)}.pk.epi .tc-shine{opacity:.55}
.tc.pk.leg{box-shadow:0 0 28px -2px rgba(255,200,70,.8),0 12px 30px -12px rgba(0,0,0,.7)}.pk.leg .tc-in{background:radial-gradient(ellipse 90% 60% at 50% 16%,#a87a14 0,#3a2706 55%,#120c02 100%)}.pk.leg .u-name,.pk.leg .u-ovr b{color:#ffe9a3;text-shadow:0 0 14px rgba(255,205,80,.95)}.pk.leg .tc-atk{background:rgba(255,200,70,.14);border-color:rgba(255,215,110,.55)}.pk.leg .tc-ft{color:#ffe08a}
.tc.pk.ult{box-shadow:0 0 30px -2px rgba(216,117,255,.8),0 0 14px rgba(131,255,247,.45),0 12px 30px -12px rgba(0,0,0,.7)}.pk.ult .tc-in{background:repeating-linear-gradient(45deg,#07070a 0 3px,#0e0e14 3px 6px)}.pk.ult .u-name,.pk.ult .u-ovr b{background:linear-gradient(90deg,#ff7773,#ffed5f,#83fff7,#d875ff,#ff7773);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}.pk.ult .tc-atk{background:rgba(255,255,255,.05);border-color:transparent;border-image:linear-gradient(90deg,#ff7773,#ffed5f,#83fff7,#d875ff) 1}.pk.ult .tc-ft{color:#d9c6ff;opacity:.9}
.tc.pk.vsn{background:linear-gradient(135deg,#fff,#9fb4d4 30%,#fff 50%,#9fb4d4 70%,#fff);box-shadow:0 0 28px -2px rgba(200,225,255,.85),0 12px 30px -12px rgba(0,0,0,.7)}.u.vsn .u-fr{--fr:linear-gradient(160deg,#fff,#7f95b8 40%,#fff 55%,#7f95b8 75%)}.pk.vsn .tc-in{background:radial-gradient(ellipse 90% 60% at 50% 16%,#9db3d8 0,#2a3652 55%,#0a0e18 100%)}.pk.vsn .u-name,.pk.vsn .u-ovr b{color:#fff;text-shadow:0 0 16px rgba(220,235,255,1)}.pk.vsn .u-rar{color:#fff}.pk.vsn .tc-shine{opacity:.5}
.tc.pk.ulm{background:linear-gradient(135deg,#f6e27a,#7a5a00 30%,#fff3b0 50%,#7a5a00 70%,#f6e27a);box-shadow:0 0 32px -2px rgba(255,200,70,.9),0 12px 30px -12px rgba(0,0,0,.7)}.u.ulm .u-fr{--fr:linear-gradient(160deg,#fff3b0,#b8860b 40%,#f6e27a 55%,#b8860b 75%)}.pk.ulm .tc-in{background:radial-gradient(ellipse 80% 45% at 50% 14%,#6b4d0a 0,#0c0a05 60%),repeating-linear-gradient(45deg,#050505 0 3px,#0c0c0c 3px 6px)}.pk.ulm .u-name,.pk.ulm .u-ovr b{background:linear-gradient(180deg,#fff3b0,#e0a526);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}.pk.ulm .u-rar{color:#ffd36b;border:1px solid #ffd36b}.pk.ulm .tc-atk{background:rgba(255,200,70,.1);border-color:rgba(255,215,110,.7)}
.tc.pk.imp{background:conic-gradient(from var(--ea,0deg),#ff0040,#fff,#00e5ff,#ff0040,#fff,#ff0040);animation:edge 5s linear infinite,deal .55s cubic-bezier(.2,.8,.2,1) both;box-shadow:0 0 34px -2px rgba(255,0,64,.7),0 0 18px rgba(0,229,255,.5)}.u.imp .u-fr{--fr:linear-gradient(160deg,#ff3b6b,#111 40%,#00e5ff 55%,#111 75%)}.pk.imp .tc-in{background:#000}.pk.imp .u-name,.pk.imp .u-ovr b{color:#fff;text-shadow:2px 0 #ff0040,-2px 0 #00e5ff}.pk.imp .u-rar{color:#ff3b6b;border:1px solid #00e5ff}.pk.imp .tc-atk{background:#000;border-color:#ff3b6b;box-shadow:0 0 10px rgba(255,59,107,.5)}.pk.imp .tc-ft{color:#00e5ff;opacity:.9}
@media(prefers-reduced-motion:reduce){.tc{animation:none}}`;
export const TCG_JS = `${FX_SVG}<style>${FX_CSS}.fxgl{position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;pointer-events:none}.gl .tc-art .ph{z-index:2;filter:none!important}</style><script>${FXGL}</script><script>(()=>{const C=[...document.querySelectorAll('.tc')];if(!C.length)return;const fx=document.getElementById('fxsvg');const V=new Set();
const io=new IntersectionObserver(es=>es.forEach(e=>{e.target.classList.toggle('vis',e.isIntersecting);e.isIntersecting?V.add(e.target):V.delete(e.target)}),{rootMargin:'40px'});C.forEach(c=>io.observe(c));
let st=0,sc=false;const onScroll=()=>{if(!sc){sc=true;document.body.classList.add('scr');fx&&fx.pauseAnimations&&fx.pauseAnimations()}clearTimeout(st);st=setTimeout(()=>{sc=false;document.body.classList.remove('scr');fx&&fx.unpauseAnimations&&fx.unpauseAnimations()},180)};
addEventListener('scroll',onScroll,{passive:true});document.querySelectorAll('.deck').forEach(d=>d.addEventListener('scroll',onScroll,{passive:true}));
const set=(c,x,y)=>{c.classList.add('live');c.style.setProperty('--mx',x*100+'%');c.style.setProperty('--my',y*100+'%');c.style.setProperty('--rx',(x-.5)*16+'deg');c.style.setProperty('--ry',(.5-y)*16+'deg')};
C.forEach(c=>{c.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=c.getBoundingClientRect();set(c,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)});c.addEventListener('pointerleave',()=>{c.classList.remove('live');c.style.removeProperty('--rx');c.style.removeProperty('--ry')})});
let q=null,raf=0;addEventListener('deviceorientation',e=>{if(e.gamma==null)return;q=e;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(sc||!q)return;const x=Math.min(1,Math.max(0,.5+q.gamma/50)),y=Math.min(1,Math.max(0,.5+(q.beta-45)/50));V.forEach(c=>set(c,x,y))})})})()</script>`;
const STARS = { com: 1, rar: 2, epi: 3, leg: 4, ult: 5, vsn: 5, ulm: 5, imp: 5 };
const CODE = { pts: 'PTS', reb: 'REB', ast: 'PAS', tpm: '3PT', stl: 'INT', blk: 'CTR', pra: 'PRA', pr: 'P+R', pa: 'P+P', ra: 'R+P', g: 'BUT', a: 'AST', p: 'PTS' };
export function tcgCard(r, total, sport = 'nba', force, opt = {}) {
  const [c1, c2] = opt.colors || tc(r.team);
  // Les cartes de séries n'ont pas de rareté : la rareté se gagne uniquement dans le Défi du soir.
  const rar = ['ser', r.streak >= 3 ? '◆ SÉRIE ' + r.streak : '◆ SÉRIE'];
  const no = String(r.rank).padStart(2, '0') + '/' + String(total).padStart(2, '0');
  const dots = Array.from({ length: r.n10 || 10 }, (_, i) => `<i${i < r.l10 ? ' class="on"' : ''}></i>`).join('');
  const href = sport === 'nhl' ? `/nhl/joueur/${esc(r.slug)}?stat=${r.stat}` : `/joueur/${esc(r.slug)}?stat=${r.stat}`;
  const en = r.ms != null ? `<div class="tc-en"><div class="tc-eh"><span>Match-up</span><span>${r.ms}/100</span></div><div class="tc-bar"><span style="width:${r.ms}%"></span></div>${r.mr?.[0] ? `<div class="tc-fl">${esc(r.mr[0].t)}</div>` : ''}</div>` : '';
  const fx = fxFor(r, sport, r.streak >= 3 || r.l10 === r.n10 ? 'epi' : 'com');
  const T = opt.solo ? 'div' : 'a';
  return `<${T} class="tc u ${rar[0]}${fx ? ' fx-' + fx : ''}"${opt.solo ? '' : ` href="${href}"`} style="--c1:${c1};--c2:${c2}"><div class="tc-in">
  <div class="u-fr"><div class="tc-art"><i class="u-sh"></i><i class="tc-beams"></i>${photo(sport, r.player_id, r.team)}<i class="tc-fx"></i><i class="tc-pt"></i><i class="u-fade"></i><span class="u-st">${'★'.repeat(STARS[rar[0]] || 0)}</span><span class="u-ovr"><b>${r.l10}</b><small>/${r.n10}</small><em>${CODE[r.stat] || esc(String(r.stat).toUpperCase())}</em></span><span class="u-rar">${rar[1].replace(/^[◆✦] /, '')}</span><span class="u-name"${r.name.length > 20 ? ' style="font-size:18px"' : r.name.length > 16 ? ' style="font-size:21px"' : ''}>${esc(r.name)}</span></div></div>
  <div class="tc-mt"><b>${esc(r.team)} ${vs(r)}</b> · ${hourFR(r.start_utc)}${injChip(r.inj)}</div>
  <div class="tc-atk"><div class="tc-ah"><b>${esc(opt.label || lineLabel(r.stat, r.threshold))}</b></div><div class="tc-dots">${dots}</div>
  <div class="tc-sub"><span>5 derniers <b>${frac(r.l5, r.n5)}</b></span><span>20 derniers <b>${frac(r.l20, r.n20)}</b></span>${r.nh2h ? `<span>vs ${esc(r.opp)} <b>${frac(r.h2h, r.nh2h)}</b></span>` : ''}</div></div>
  ${en}
  <div class="tc-ft"><span>Pick du Soir · 2026-27</span><span>${r.streak >= 3 ? `Série ${r.streak}` : sport.toUpperCase()}</span></div>
  <span class="tc-shine"></span><span class="tc-glit"></span><span class="tc-glare"></span><span class="tc-sweep"></span>
</div></${T}>`;
}

// Carte du Défi du soir (même gabarit bouclier que les cartes de séries)
export function pickCard(o) {
  const rk = ({ imp: ['imp', 'IMPOSSIBLE'], ulm: ['ulm', 'ULTIME'], vsn: ['vsn', 'VISION'], ult: ['ult', 'ULTRA LÉGENDAIRE'], leg: ['leg', 'LÉGENDAIRE'], epi: ['epi', 'ÉPIQUE'], rar: ['rar', 'RARE'], com: ['com', 'COMMUN'] })[o.rar] || ['com', 'COMMUN'];
  const SK = { vsn: ['#1a2233', '#e8f1ff'], ulm: ['#0a0a0a', '#ffd36b'], imp: ['#000', '#ff3b6b'], com: ['#3a3d47', '#8b909c'], epi: ['#3a1d7a', '#b58cff'], leg: ['#6b4708', '#ffd36b'], ult: ['#08080c', '#d875ff'] };
  const [c1, c2] = SK[rk[0]] || o.colors || ['#333', '#999'];
  const nm = String(o.name);
  return `<div class="tc u pk ${rk[0]}" style="--c1:${c1};--c2:${c2}"><div class="tc-in">
  <div class="u-fr"><div class="tc-art"><i class="u-sh"></i><i class="tc-beams"></i>${photo(o.sport, o.player_id, o.team)}<i class="tc-fx"></i><i class="tc-pt"></i><i class="u-fade"></i><span class="u-st">${'★'.repeat(STARS[rk[0]])}</span><span class="u-ovr"><b>${esc(String(o.big))}</b><em>${CODE[o.stat] || esc(String(o.stat).toUpperCase())}</em></span><span class="u-rar"${rk[0] === 'ult' || rk[0] === 'ulm' || rk[0] === 'imp' ? ' style="font-size:8px;letter-spacing:0;padding:2px 5px"' : ''}>${rk[1]}</span><span class="u-name"${nm.length > 20 ? ' style="font-size:18px"' : nm.length > 16 ? ' style="font-size:21px"' : ''}>${esc(nm)}</span></div></div>
  <div class="tc-mt"><b>${esc(o.team)}</b> · ${esc(o.day)}</div>
  <div class="tc-atk"><div class="tc-ah"><b>${esc(o.label)}</b></div><div class="tc-sub"><span>${esc(o.sub)}</span></div></div>
  <div class="tc-ft"><span>Défi du soir${o.bonus ? ' · Pick du soir' : ''}</span><span>${esc(o.sport.toUpperCase())}</span></div>
  <span class="tc-shine"></span><span class="tc-glit"></span><span class="tc-glare"></span><span class="tc-sweep"></span>
</div></div>`;
}

export async function homePage(origin, q) {
  await loadArt();
  const stat = STATS[q?.get('stat')] || ['streak','match'].includes(q?.get('stat')) ? q.get('stat') : 'all';
  const today = usDate();
  const [d] = await sql.query(`SELECT coalesce((SELECT min(day) FROM trends WHERE day >= $1), (SELECT max(day) FROM trends))::text AS day`, [today]);
  const day = d?.day;
  let rows = day ? await sql.query(
    `SELECT tr.*, pl.name, pl.slug, pl.position, t.tricode AS team, o.tricode AS opp,
            (g.home_team_id = pl.team_id) AS home, g.start_utc, g.game_type, i.status AS inj, m.score AS ms, m.reasons AS mr
     FROM trends tr JOIN players pl ON pl.id = tr.player_id JOIN games g ON g.id = tr.game_id
     LEFT JOIN matchups m ON m.day = tr.day AND m.player_id = tr.player_id AND m.stat = tr.stat
     LEFT JOIN teams t ON t.id = pl.team_id LEFT JOIN teams o ON o.id = tr.opp_team_id
     LEFT JOIN injuries i ON i.player_id = tr.player_id
     WHERE tr.day = $1 AND ($2 = 'all' OR ($2 = 'streak' AND tr.streak >= 3) OR ($2 = 'match' AND m.score IS NOT NULL) OR tr.stat = $2)
     ORDER BY ${stat === 'streak' ? 'tr.streak DESC, ' : stat === 'match' ? 'm.score DESC, ' : ''}${stat === 'match' ? '' : '(tr.l10::float / NULLIF(tr.n10, 0)) DESC NULLS LAST, tr.streak DESC, '}tr.score DESC, tr.threshold DESC LIMIT ${stat === 'streak' || stat === 'match' ? 300 : 60}`, [day, stat]) : [];
  if (stat === 'streak' || stat === 'match') { const seen = new Set(); rows = rows.filter((r) => !seen.has(r.player_id) && seen.add(r.player_id)).slice(0, 60); rows.forEach((r, i) => { r.rank = i + 1; }); }
  const tabs = `<nav class="chips" aria-label="Filtrer par stat">${[...STAT_TABS, ['match', 'Match-up']].map(([k, l]) => `<a href="${k === 'all' ? '/' : `/?stat=${k}`}" class="${k === stat ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  if (!rows.length) {
    return page({ title: 'Pick du Soir : les séries NBA du soir', description: 'Les séries de stats des joueurs NBA qui jouent ce soir.', canonical: origin + '/',
      body: `<h1>Pas de série ce soir</h1>${tabs}<p class="empty">Les séries apparaissent ici dès que le calendrier propose des matchs.</p>` });
  }
  rows.forEach((r, i) => { r.rank = i + 1; });
  // Une seule carte par joueur dans le top 5
  const seen = new Set(), top = [];
  for (const r of rows) { if (!seen.has(r.player_id)) { seen.add(r.player_id); top.push(r); } if (top.length === 5) break; }
  const topIds = new Set(top.map((r) => `${r.player_id}-${r.stat}`));
  const rest = rows.filter((r) => !topIds.has(`${r.player_id}-${r.stat}`));
  const [info] = await sql.query(`SELECT count(*)::int AS n, min(start_utc) AS first FROM games WHERE game_date = $1`, [day]);
  const longest = [...rows].sort((a, b) => b.streak - a.streak)[0];
  const perfect = rows.filter((r) => r.l10 === r.n10).length;
  const pre = rows.some((r) => r.game_type === 'pre');

  const hist = await lastTen('nba', rows, day);
  const items = rows.map((r) => seriesRow(r, { href: `/joueur/${esc(r.slug)}?stat=${r.stat}`, color: tc(r.team)[0], photoHtml: photo('nba', r.player_id),
    line: lineLabel(r.stat, r.threshold), meta: `${esc(r.team)} ${vs(r)} · ${hourFR(r.start_utc)}${injChip(r.inj)}`, vals: hist.get(`${r.player_id}-${r.stat}`) }));
  void longest; void perfect; void rest;
  const seenP = new Set(), main = [], others = [];
  rows.forEach((r, i) => { if (main.length < 12 && !seenP.has(r.player_id)) { seenP.add(r.player_id); main.push(items[i]); } else others.push(items[i]); });
  // En tête d'accueil : les 4 premières lignes du soir (Plus/Moins), une stat différente par ligne
  const lines = stat === 'all' ? await algoRows(day, { league: 'nba', limit: 4 }).catch(() => []) : [];
  const linesHtml = lines.length >= 3 ? `<section class="intro"><p class="kick">NBA · ${esc(dayFR(day))}</p><h1>Plus ou moins ce soir ?</h1>
  <p class="lede">Une ligne au demi-point par joueur, et le côté que notre modèle juge le plus probable.</p></section>
  <div class="slist">${lines.map((r) => lineRow(r, { href: `/joueur/${esc(r.slug)}?stat=${r.stat}`, color: tc(r.team)[0], photoHtml: photo('nba', r.player_id), text: `${fr1(r.line)} ${statName(r.stat, r.line)}`, meta: `${esc(r.team)} ${vs(r)} · ${hourFR(r.start_utc)}` })).join('')}</div>
  <a class="band" href="/algo"><span><b>Toutes les lignes du soir</b><span>NBA et NHL, avec la projection de chaque joueur et nos résultats publics.</span></span><span class="go">Voir</span></a>` : '';
  const H = linesHtml ? 'h2' : 'h1';
  const body = `${linesHtml}<section class="intro"><p class="kick">${linesHtml ? 'Séries' : 'NBA'} · ${esc(dayFR(day))}</p><${H}${linesHtml ? ' class="h1b"' : ''}>Les joueurs en série ce soir</${H}>
  <p class="lede">${info.n} match${info.n > 1 ? 's' : ''} ce soir, premier à ${hourFR(info.first)}. Du plus régulier au moins régulier.</p>
  <div class="howto"><span><b>9/10</b> = palier atteint dans 9 de ses 10 derniers matchs. Barres : ses 10 derniers matchs, en vert quand le palier est atteint.</span></div></section>
  ${SEARCH}
  ${pre ? `<p class="note">Matchs de présaison ce soir : les titulaires jouent peu. Les séries portent sur les matchs de saison régulière.</p>` : ''}
  ${tabs}
  <div class="slist">${main.join('')}</div>
  ${AD('milieu')}
  ${others.length ? `<div class="sect"><h2>Les autres séries</h2><span>${others.length}</span></div><div class="slist">${others.join('')}</div>` : ''}
  <p class="tip">Une série passée ne garantit pas le prochain match : minutes, blessures et adversaire comptent.</p>`;
  return page({ title: `Séries NBA du ${dayFR(day)} : points, rebonds, passes | Pick du Soir`,
    description: `${top[0].name} : ${lineLabel(top[0].stat, top[0].threshold)} dans ${top[0].l10} de ses 10 derniers matchs. Toutes les séries de stats des joueurs NBA du soir.`,
    canonical: origin + '/', body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Pick du Soir', url: origin + '/', inLanguage: 'fr', description: 'Statistiques NBA et NHL du soir : séries des joueurs et lignes Plus/Moins.' } });
}

// Page « Lignes du soir » : pour chaque joueur, une ligne au demi-point et le côté (Plus ou Moins) que le modèle juge le plus probable
export async function algoPage(origin, q) {
  const nhl = q?.get('sport') === 'nhl', lg = nhl ? 'nhl' : 'nba', M = MODELS[lg], today = usDate();
  const [d] = await sql.query(nhl ? `SELECT min(game_date)::text AS day FROM nhl_games WHERE game_date >= $1 AND start_utc > now() - interval '3 hours'` : `SELECT min(game_date)::text AS day FROM games WHERE game_date >= $1 AND coalesce(status, 1) < 3 AND game_type IS DISTINCT FROM 'pre'`, [today]);
  const day = d?.day;
  const [rows, track] = await Promise.all([algoRows(day, { league: lg, limit: 12 }), algoTrack().catch(() => ({ n: 0, ok: 0, nba: { n: 0 }, nhl: { n: 0 } }))]);
  const items = rows.map((r) => lineRow(r, nhl
    ? { href: `/nhl/joueur/${esc(r.slug)}`, color: (NHL_TEAMS[r.team] || [])[2] || '#2C86B8', photoHtml: photo('nhl', r.player_id, r.team), text: `${fr1(r.line)} ${statName(r.stat, r.line)}`, meta: `${esc(r.team)} ${vs(r)} · ${hourFR(r.start_utc)}` }
    : { href: `/joueur/${esc(r.slug)}?stat=${r.stat}`, color: tc(r.team)[0], photoHtml: photo('nba', r.player_id), text: `${fr1(r.line)} ${statName(r.stat, r.line)}`, meta: `${esc(r.team)} ${vs(r)} · ${hourFR(r.start_utc)}` }));
  const t = track[lg] || { n: 0, ok: 0 };
  const live = t.n >= 8 ? `<div><b>${Math.round(t.ok / t.n * 100)} %</b><span>en conditions réelles : ${t.ok} lignes réussies sur ${t.n} publiées</span></div>` : `<div class="bad"><b>${t.n ? `${t.ok}/${t.n}` : 'En cours'}</b><span>en conditions réelles : le suivi public démarre, trop peu de lignes pour un pourcentage</span></div>`;
  const what = nhl ? 'tirs cadrés' : 'points, rebonds, passes, tirs à 3 pts';
  const my = (d) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00Z')), period = `${my(M.oos_from)} – ${my(M.oos_to)}`; // période du test, lue dans le modèle
  const body = `<section class="intro"><p class="kick">Lignes du soir · ${lg.toUpperCase()}${day ? ' · ' + esc(dayFR(day)) : ''}</p><h1>Plus ou moins ?</h1>
  <p class="lede">Pour chaque joueur, une ligne au demi-point (${what}) et le côté que notre modèle juge le plus probable ce soir.</p></section>
  <div class="chips sport"><a class="${nhl ? '' : 'on'}" href="/algo">🏀 NBA</a><a class="${nhl ? 'on' : ''}" href="/algo?sport=nhl">🏒 NHL</a></div>
  ${rows.length ? `<div class="slist">${items.join('')}</div>` : `<p class="empty">Pas de ligne pour l'instant : elles apparaissent quand les matchs du soir et les compositions sont connus.</p>`}
  ${AD('milieu')}
  <div class="algo-hero"><h2>Que vaut ce modèle ?</h2>
  <div class="algo-stats"><div><b>${Math.round(M.top4 * 100)} %</b><span>des 4 premières lignes du soir réussies en test, sur ${M.oos_days} soirs (${period})</span></div><div class="bad"><b>50 %</b><span>ce que donne un choix à pile ou face sur ces mêmes lignes</span></div>${live}</div>
  <p><b>La ligne</b> est le demi-point qui coupe en deux les matchs récents du joueur : c'est une ligne de référence maison, pas celle d'un opérateur. <b>Le pourcentage</b> est l'estimation du modèle pour ce côté. <b>La projection</b> est la valeur où Plus et Moins seraient à égalité.</p>
  <p>Le modèle regarde la forme sur 5, 10, 20 et 40 matchs, les minutes récentes, la défense adverse, le lieu du match et l'enchaînement des matchs. On ne garde que les lignes entre ${Math.round(M.loPlus * 100)} et ${Math.round(M.hi * 100)} % : en dessous c'est du pile ou face, au-dessus la ligne est trop facile pour être intéressante.</p>
  <p>Test réalisé sur des matchs que le modèle n'avait jamais vus ; le futur peut différer. <a href="/fiabilite"><u>Tous nos résultats, ratés compris</u></a></p></div>
  <a class="band" href="${nhl ? '/nhl' : '/'}"><span><b>Les séries ${lg.toUpperCase()} du soir</b><span>Qui tient son palier depuis 5, 10 ou 20 matchs.</span></span><span class="go">Voir</span></a>
  <p class="tip">Minutes, blessures de dernière minute et scénario du match peuvent tout changer. Stats informatives, pas un conseil de pari.</p>`;
  return page({ title: `Lignes ${lg.toUpperCase()} du soir : Plus ou Moins, joueur par joueur | Pick du Soir`, description: `Les lignes ${lg.toUpperCase()} du soir (${what}) avec le côté le plus probable selon notre modèle. ${Math.round(M.top4 * 100)} % de réussite en test sur ${M.oos_days} soirs, résultats publics.`, canonical: origin + '/algo' + (nhl ? '?sport=nhl' : ''), nav: 'algo', body });
}

export async function playerPage(slug, origin, q) {
  await loadArt();
  const stat = STATS[q?.get('stat')] ? q.get('stat') : 'pts';
  const [p] = await sql.query(
    `SELECT p.id, p.name, p.slug, p.position, p.team_id, t.tricode, t.city, t.name AS team_name
     FROM players p LEFT JOIN teams t ON t.id = p.team_id WHERE p.slug = $1 ORDER BY p.last_game_date DESC NULLS LAST LIMIT 1`, [slug]);
  if (!p) return null;
  const today = usDate();
  const [next] = p.team_id ? await sql.query(
    `SELECT g.start_utc, g.game_date::text AS d, g.game_type, (g.home_team_id = $1) AS home,
            CASE WHEN g.home_team_id = $1 THEN g.away_team_id ELSE g.home_team_id END AS opp_id,
            CASE WHEN g.home_team_id = $1 THEN a.tricode ELSE h.tricode END AS opp
     FROM games g JOIN teams h ON h.id = g.home_team_id JOIN teams a ON a.id = g.away_team_id
     WHERE (g.home_team_id = $1 OR g.away_team_id = $1) AND g.game_date >= $2 AND coalesce(g.status, 1) < 3
     ORDER BY g.start_utc LIMIT 1`, [p.team_id, today]) : [];
  const [games, inj] = await Promise.all([
    sql.query(`SELECT * FROM (
                 SELECT pg.game_date::text AS d, o.tricode AS opp, pg.opp_team_id, (g.home_team_id = pg.team_id) AS home, pg.minutes,
                        pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk, pg.fgm, pg.fga,
                        row_number() OVER (ORDER BY pg.game_date DESC) AS rn
                 FROM player_games pg JOIN games g ON g.id = pg.game_id LEFT JOIN teams o ON o.id = pg.opp_team_id
                 WHERE pg.player_id = $1 AND pg.minutes > 0 AND pg.game_type IN ('reg','cup','playin','po')) x
               WHERE rn <= 20 OR opp_team_id = $2 ORDER BY rn`, [p.id, next?.opp_id || 0]),
    sql.query(`SELECT status, detail FROM injuries WHERE player_id = $1 LIMIT 1`, [p.id]),
  ]);
  for (const g of games) g.rn = Number(g.rn);
  const i = inj[0];
  const [c1, c2] = tc(p.tricode);
  const [fn, ln] = splitName(p.name);
  const lad = ladder(games, stat, next?.opp_id);
  const best = bestLine(games, stat, next?.opp_id, 0);
  const recent = games.filter((g) => g.rn <= 10);
  const vals = recent.map(STATS[stat].val);
  const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  const mark = best ? best.threshold : Math.round(avg);
  const last10 = recent.slice().reverse();
  const max = Math.max(mark * 1.4, ...last10.map(STATS[stat].val), 1);
  const bars = last10.map((g) => { const v = STATS[stat].val(g); return `<div><span>${v}</span><b class="${v >= mark ? 'ok' : 'ko'}" style="height:${Math.max(4, Math.round((v / max) * 110))}px" title="${esc(shortDay(g.d))}"></b><em>${esc(g.opp || '')}</em></div>`; }).join('');
  const markPx = Math.round((mark / max) * 110) + 22;
  const tabs = `<nav class="chips" aria-label="Choisir une stat">${STAT_TABS.filter(([k]) => k !== 'all' && k !== 'streak' && k !== 'match').map(([k, l]) => `<a href="/joueur/${esc(p.slug)}?stat=${k}" class="${k === stat ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  const grid = lad.slice().reverse().map((r) => `<tr><td class="t">${r.threshold}+</td>
    <td><span class="cell ${cellClass(r.l5, r.n5)}">${frac(r.l5, r.n5)}</span></td>
    <td><span class="cell ${cellClass(r.l10, r.n10)}">${frac(r.l10, r.n10)}</span></td>
    <td><span class="cell ${cellClass(r.l20, r.n20)}">${frac(r.l20, r.n20)}</span></td>
    ${next ? `<td>${r.nh2h ? `<span class="cell ${cellClass(r.h2h, r.nh2h)}">${frac(r.h2h, r.nh2h)}</span>` : '–'}</td>` : ''}</tr>`).join('');
  let mu = null;
  if (next) { try { const [m] = await sql.query(`SELECT m.score, m.reasons, m.stat, tr.threshold AS thr FROM matchups m JOIN trends tr ON tr.day = m.day AND tr.player_id = m.player_id AND tr.stat = m.stat WHERE m.player_id = $1 AND m.day = $2 ORDER BY (m.stat = $3) DESC, m.score DESC LIMIT 1`, [p.id, next.d, stat]); mu = m || null; } catch { mu = null; } }
  const combo = ['pra', 'pr', 'pa', 'ra'].includes(stat) ? stat : 'pra';
  const comboHead = { pra: 'P+R+P', pr: 'Pts+Reb', pa: 'Pts+Pas', ra: 'Reb+Pas' }[combo];
  const log = games.filter((g) => g.rn <= 15).map((x) => `<tr><td>${esc(shortDay(x.d))}</td><td>${x.home ? 'vs' : '@'} ${esc(x.opp)}</td>
    <td class="n">${x.pts}</td><td class="n">${x.reb}</td><td class="n">${x.ast}</td><td class="n">${x.tpm}</td><td class="n sc">${STATS[combo].val(x)}</td><td class="n">${num(x.minutes, 0)}</td></tr>`).join('');

  const [hc] = await sql.query(`SELECT 1 AS x FROM trends WHERE day = (SELECT max(day) FROM trends) AND player_id = $1 LIMIT 1`, [p.id]).catch(() => []);
  const hasCard = !!hc && !!next;
  const rows0 = lad.slice().reverse(), cr = best || rows0.find((x) => x.n10 >= 5 && x.l10 >= 6) || rows0.find((x) => x.n10 >= 3 && x.l10 >= 5) || rows0.find((x) => x.n10 >= 3) || null;
  const card = cr && next ? tcgCard({ ...cr, stat, name: p.name, team: p.tricode, player_id: p.id, slug: p.slug, opp: next.opp, home: next.home, start_utc: next.start_utc, rank: 1, inj: i?.status, ms: mu?.score, mr: mu?.reasons }, 1, 'nba', null, { solo: true }) : '';
  const body = `${(void card, null) ? `<style>${TCG_CSS}</style><div class="solo">${card}</div>${TCG_JS}<section class="hero mini"><div class="team">${esc(p.city || '')} ${esc(p.team_name || '')}${p.position ? `, poste ${esc(p.position)}` : ''}${i ? injChip(i.status) : ''}</div><div class="next">Prochain match ${next.home ? 'contre' : 'à'} <b>${esc(next.opp)}</b>, ${esc(dayFR(next.d))} à ${hourFR(next.start_utc)}${next.game_type === 'pre' ? ' (présaison)' : ''}</div></section>` : `<section class="hero" style="--c1:${c1};--c2:${c2};--ca:${artColor(c2)}">${avatarSvg('nba', p.id, artColor(c2), c1, null)}${photo('nba', p.id)}
    <span class="first-n">${esc(fn)}</span><span class="last-n">${esc(ln)}</span>
    <div class="team">${esc(p.city || '')} ${esc(p.team_name || '')}${p.position ? `, poste ${esc(p.position)}` : ''}${i ? injChip(i.status) : ''}</div>
    <div class="next">${next ? `Prochain match ${next.home ? 'contre' : 'à'} <b>${esc(next.opp)}</b>, ${esc(dayFR(next.d))} à ${hourFR(next.start_utc)}${next.game_type === 'pre' ? ' (présaison)' : ''}` : 'Pas de match programmé'}</div>
  </section>`}
  ${hasCard ? `<a class="band" href="/carte/nba/${esc(p.slug)}.png?stat=${stat}" download><span><b>La carte du soir de ${esc(p.name)}</b><span>Image à télécharger et partager sur X, Insta ou WhatsApp.</span></span><span class="go">Télécharger</span></a>` : ''}
  ${mu ? `<div class="mu"><span>Match-up du soir, ${esc(STATS[mu.stat].label)} (${esc(mu.thr)}+)</span><div class="big">${mu.score}<small style="display:inline">/100</small></div><ul>${(mu.reasons || []).map((x) => `<li>${x.s > 0 ? '🟢' : '🔴'} ${esc(x.t)}</li>`).join('')}</ul><small>Score de contexte statistique (forme, défense adverse, minutes, rythme, repos). Ce n'est ni une probabilité ni un conseil de pari.</small></div>` : ''}
  ${i?.detail ? `<p class="note" style="margin-top:12px"><b>Dernière info :</b> ${esc(injuryFR(i.detail, i.status))}</p>` : ''}
  <h2>Ses séries</h2>${tabs}
  ${best ? `<p class="lede">Meilleure série : <b>${esc(lineLabel(stat, best.threshold))}</b> dans ${best.l10} de ses 10 derniers matchs${best.streak >= 3 ? `, ${best.streak} matchs de suite` : ''}. Moyenne sur 10 matchs : ${num(avg)}.</p>` : `<p class="lede">Moyenne sur ses 10 derniers matchs : ${num(avg)} ${esc(STATS[stat].label)}.</p>`}
  <div class="grid"><table><thead><tr><th>Palier</th><th>5 derniers</th><th>10 derniers</th><th>20 derniers</th>${next ? `<th>vs ${esc(next.opp)}</th>` : ''}</tr></thead><tbody>${grid}</tbody></table></div>
  ${AD('milieu')}
  <h2>Ses 10 derniers matchs</h2>
  <div class="chart"><div class="bars">${bars}<i class="line-mark" style="bottom:${markPx}px"></i></div><p class="legend">Barres vertes : palier de ${mark}+ ${esc(STATS[stat].label)} atteint.</p></div>
  <h2>Match par match</h2>
  <div class="tbl"><table><thead><tr><th>Date</th><th>Match</th><th class="n">Pts</th><th class="n">Reb</th><th class="n">Pas</th><th class="n">3 pts</th><th class="n">${comboHead}</th><th class="n">Min</th></tr></thead><tbody>${log}</tbody></table></div>`;
  const m = (k) => recent.length ? (recent.reduce((t, g) => t + (+g[k] || 0), 0) / recent.length).toFixed(1).replace('.', ',') : '0';
  return page({ title: `${p.name} : stats des 10 derniers matchs (points, rebonds, passes) | Pick du Soir`,
    description: `${p.name} (${p.tricode || ''}) sur ses 10 derniers matchs : ${m('pts')} points, ${m('reb')} rebonds et ${m('ast')} passes de moyenne. Séries sur 5, 10 et 20 matchs${next ? `, prochain match face à ${next.opp}` : ''}.`,
    canonical: `${origin}/joueur/${p.slug}`, body, nav: 'joueurs',
    jsonLd: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Pick du Soir', origin + '/'], ['Joueurs NBA', origin + '/joueurs'], [p.name, `${origin}/joueur/${p.slug}`]].map(([name, item], k) => ({ '@type': 'ListItem', position: k + 1, name, item })) } });
}

const NBA_RANK = { pts: ['Points', 'points'], ast: ['Passes', 'passes'], reb: ['Rebonds', 'rebonds'], blk: ['Contres', 'contres'], stl: ['Interceptions', 'interceptions'], tpm: ['3 points', 'paniers à 3 points'] };
const NHL_RANK = { g: ['Buts', 'buts', 'goals'], a: ['Passes', 'passes décisives', 'assists'], p: ['Points', 'points', 'points'] };
export async function playersIndex(origin, q) {
  const nhl = q?.get('sport') === 'nhl';
  const R = nhl ? NHL_RANK : NBA_RANK;
  const stat = R[q?.get('stat')] ? q.get('stat') : (nhl ? 'g' : 'pts');
  const href = (sp, st) => `/joueurs${sp === 'nhl' ? '?sport=nhl' : ''}${st ? `${sp === 'nhl' ? '&' : '?'}stat=${st}` : ''}`;
  const sel = `<nav class="chips" aria-label="Choisir le sport"><a href="/joueurs" class="${nhl ? '' : 'on'}">NBA</a><a href="/joueurs?sport=nhl" class="${nhl ? 'on' : ''}">NHL</a></nav>
  <nav class="chips" aria-label="Classer par">${Object.entries(R).map(([k, v]) => `<a href="${href(nhl ? 'nhl' : 'nba', k === (nhl ? 'g' : 'pts') ? '' : k)}" class="${k === stat ? 'on' : ''}">${v[0]}</a>`).join('')}</nav>`;
  if (nhl) {
    const col = R[stat][2];
    const rows = await sql.query(
      `SELECT p.name, p.slug, p.team, count(*)::int AS gp, sum(pg.goals)::int AS g, sum(pg.assists)::int AS a, sum(pg.points)::int AS p
       FROM nhl_player_games pg JOIN nhl_games g ON g.id = pg.game_id JOIN nhl_players p ON p.id = pg.player_id
       WHERE g.season = (SELECT max(season) FROM nhl_games WHERE game_type = 2 AND state IN ('FINAL','OFF')) AND pg.game_type = 2 AND p.position <> 'G'
       GROUP BY p.id, p.name, p.slug, p.team ORDER BY sum(pg.${col}) DESC, sum(pg.points) DESC, count(*) ASC LIMIT 250`);
    const list = rows.map((r, i) => `<a class="li" href="/nhl/joueur/${esc(r.slug)}"><span class="r">${i + 1}</span>
    <span><span class="n">${esc(r.name)}</span><br><span class="s">${esc(r.team || '')}, ${r.g} but${r.g > 1 ? 's' : ''}, ${r.a} passe${r.a > 1 ? 's' : ''}, ${r.p} point${r.p > 1 ? 's' : ''}, ${r.gp} match${r.gp > 1 ? 's' : ''}</span></span><span class="pill">${r[stat]}</span></a>`).join('');
    return page({ title: `Classement NHL : ${R[stat][1]} | Pick du Soir`,
      description: 'Les meilleurs joueurs NHL de la saison en cours, avec leurs séries détaillées en buts, passes décisives et points.',
      canonical: origin + href('nhl', stat === 'g' ? '' : stat), nav: 'joueurs', hockey: true,
      body: `<h1>Les joueurs</h1>${sel}<p class="lede">Classement NHL de la saison en cours (saison régulière), total de ${R[stat][1]}. Touche un joueur pour voir toutes ses séries.</p><div class="list">${list}</div>` });
  }
  const rows = await sql.query(
    `SELECT p.name, p.slug, t.tricode, round(avg(pg.pts), 1) AS pts, round(avg(pg.reb), 1) AS reb, round(avg(pg.ast), 1) AS ast, round(avg(pg.stl), 1) AS stl, round(avg(pg.blk), 1) AS blk, round(avg(pg.tpm), 1) AS tpm, count(*)::int AS n
     FROM player_games pg JOIN games g ON g.id = pg.game_id JOIN players p ON p.id = pg.player_id LEFT JOIN teams t ON t.id = p.team_id
     WHERE g.season = '2025-26' AND pg.game_type = 'reg' AND pg.minutes > 0
     GROUP BY p.id, p.name, p.slug, t.tricode HAVING count(*) >= 10 ORDER BY avg(pg.${stat}) DESC, avg(pg.pts) DESC LIMIT 250`);
  const list = rows.map((r, i) => `<a class="li" href="/joueur/${esc(r.slug)}" style="--c1:${tc(r.tricode)[0]}"><span class="r">${i + 1}</span>
    <span><span class="n">${esc(r.name)}</span><br><span class="s">${esc(r.tricode || '')}, ${num(r.pts)} pts, ${num(r.reb)} reb, ${num(r.ast)} pas, ${r.n} matchs</span></span><span class="pill">${num(r[stat])}</span></a>`).join('');
  return page({ title: `Classement NBA 2025-26 : ${R[stat][1]} par match | Pick du Soir`,
    description: 'Les 250 meilleurs joueurs NBA de la saison 2025-26, avec leurs séries détaillées en points, rebonds, passes et paniers à 3 points.',
    canonical: origin + href('nba', stat === 'pts' ? '' : stat), nav: 'joueurs',
    body: `<h1>Les joueurs</h1>${sel}<p class="lede">Moyenne de ${R[stat][1]} par match sur la saison régulière 2025-26, 10 matchs minimum. Touche un joueur pour voir toutes ses séries. La saison 2026-27 prendra le relais dès les premiers matchs.</p><div class="list">${list}</div>` });
}

export async function sitemap(origin) {
  const rows = await sql.query(`SELECT DISTINCT p.slug FROM players p JOIN player_games pg ON pg.player_id = p.id WHERE pg.minutes > 0`);
  let nhl = [];
  try { nhl = await sql.query(`SELECT slug FROM nhl_players WHERE on_roster AND position <> 'G'`); } catch { nhl = []; }
  const urls = ['/', '/algo', '/algo?sport=nhl', '/joueurs', '/joueurs?sport=nhl', '/nhl', '/fiabilite', '/a-propos', ...rows.map((r) => `/joueur/${r.slug}`), ...nhl.map((r) => `/nhl/joueur/${r.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(origin + u)}</loc></url>`).join('')}</urlset>`;
}

export function notFound() {
  return page({ title: 'Page introuvable | Pick du Soir', description: '', body: `<h1>Page introuvable</h1><p class="empty">Retourne aux <a href="/" style="color:var(--ball)">picks du soir</a> ou cherche un joueur dans le <a href="/joueurs" style="color:var(--ball)">classement</a>.</p>` });
}

// ——— Visuel réseaux sociaux : « Les 5 séries du soir » (story 9:16 ou post 4:5), exporté en PNG dans le navigateur ———
const visLine = (stat, t) => (['pra', 'pr', 'pa', 'ra'].includes(stat) ? `${t}+ ${STATS[stat].short.replace(/\+/g, ' + ')}` : `${t}+ ${STATS[stat].label}`);
const artInline = (pose, color) => { const a = ART[pose] || ART.dunk; return a ? `<svg class="vart" viewBox="${a.vb}" aria-hidden="true"><path fill="${color}" d="${a.d}"/></svg>` : ''; };

export async function nbaVisual() {
  await loadArt();
  const today = usDate();
  const [d] = await sql.query(`SELECT coalesce((SELECT min(day) FROM trends WHERE day >= $1), (SELECT max(day) FROM trends))::text AS day`, [today]);
  const day = d?.day;
  const rows = day ? await sql.query(
    `SELECT tr.*, pl.name, pl.position, t.tricode AS team, o.tricode AS opp, (g.home_team_id = pl.team_id) AS home, g.start_utc, m.score AS ms
     FROM trends tr JOIN players pl ON pl.id = tr.player_id JOIN games g ON g.id = tr.game_id
     LEFT JOIN matchups m ON m.day = tr.day AND m.player_id = tr.player_id AND m.stat = tr.stat
     LEFT JOIN teams t ON t.id = pl.team_id LEFT JOIN teams o ON o.id = tr.opp_team_id
     LEFT JOIN injuries i ON i.player_id = tr.player_id
     WHERE tr.day = $1 AND i.status IS NULL AND NOT EXISTS (SELECT 1 FROM lineups l WHERE l.slug = pl.slug AND l.pct <= 50)
     ORDER BY tr.score DESC, tr.threshold DESC LIMIT 80`, [day]) : [];
  // Filtre « joue vraiment » : au moins 20 min de moyenne et 4 matchs joués sur les 5 derniers
  if (rows.length) {
    const ok = await sql.query(`SELECT p.id AS pid FROM players p WHERE p.id = ANY($1) AND (SELECT count(*) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 5) tg
      JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes > 0) >= 3
      AND (SELECT avg(px.minutes) FROM (SELECT g2.id FROM games g2 WHERE g2.status = 3 AND p.team_id IN (g2.home_team_id, g2.away_team_id) ORDER BY g2.game_date DESC LIMIT 5) tg JOIN player_games px ON px.game_id = tg.id AND px.player_id = p.id AND px.minutes > 0) >= 18`, [[...new Set(rows.map((r) => r.player_id))]]);
    const set = new Set(ok.map((r) => r.pid));
    rows.splice(0, rows.length, ...rows.filter((r) => set.has(r.player_id)));
  }
  const top = pickCategories(rows, NBA_CATS).map((r) => { const [c1, c2] = tc(r.team); return { name: r.name, cat: r.cat, c1, c2, art: `<img class="vart" style="opacity:1;height:112%;bottom:0" alt="" src="https://cdn.nba.com/headshots/nba/latest/1040x760/${r.player_id}.png">`, league: 'nba', photo: `https://cdn.nba.com/headshots/nba/latest/1040x760/${r.player_id}.png`,
    line: serieLine(r, visLine(r.stat, r.threshold)), meta: `${r.team} ${r.home ? 'vs' : '@'} ${r.opp} · ${hourFR(r.start_utc)}`, l10: r.l10, n10: r.n10, start: r.start_utc, pid: r.player_id, stat: r.stat, thr: r.threshold, gid: r.game_id }; });
  const cards = rows.map((r) => { const [c1, c2] = tc(r.team); return { name: r.name, slug: r.slug, c1, c2, league: 'nba', photo: `https://cdn.nba.com/headshots/nba/latest/1040x760/${r.player_id}.png`, team: r.team, opp: r.opp, home: r.home, hour: hourFR(r.start_utc), start: r.start_utc, stat: r.stat, thr: r.threshold, line: visLine(r.stat, r.threshold), l10: r.l10, n10: r.n10, l5: r.l5, n5: r.n5, l20: r.l20, n20: r.n20, streak: r.streak || 0, avg: r.avg10 != null ? +r.avg10 : null, ms: r.ms, score: r.score, pid: r.player_id, gid: r.game_id }; });
  return { day, top, cards, kicker: 'NBA · Ce soir', league: 'NBA', emoji: '🏀', tags: '#NBA #NBAProps #TeamParieur', base: '/visuel', file: 'nba' };
}
// 5 joueurs différents, et pas plus de 2 fois la même stat pour varier le visuel
// Top 5 par catégories : un joueur différent par case ; les cases vides sont complétées par le meilleur score restant
export function pickCategories(rows, cats) {
  const used = new Set(), out = new Array(cats.length).fill(null);
  const order = cats.map((c, i) => i).sort((a, b) => (cats[a].prio ?? a) - (cats[b].prio ?? b));
  for (const i of order) {
    const c = cats[i], cand = rows.filter((r) => !used.has(r.player_id) && c.test(r));
    if (c.sort) cand.sort(c.sort);
    if (cand[0]) { used.add(cand[0].player_id); out[i] = { ...cand[0], cat: c.label }; }
  }
  for (let i = 0; i < out.length; i++) if (!out[i]) { const r = rows.find((x) => !used.has(x.player_id)); if (r) { used.add(r.player_id); out[i] = { ...r, cat: 'EN FORME' }; } }
  return out.filter(Boolean);
}
const rung = (r) => { const l = STATS[r.stat]?.ladder || [r.threshold]; return Math.max(l.indexOf(r.threshold), 0) / Math.max(l.length - 1, 1); };
export const NBA_CATS = [
  { label: 'POINTS', test: (r) => r.stat === 'pts' },
  { label: 'REBONDS', test: (r) => r.stat === 'reb' },
  { label: 'PASSES', test: (r) => r.stat === 'ast' },
  { label: 'SÉRIE', prio: 4, test: () => true, sort: (a, b) => (b.streak || 0) - (a.streak || 0) },
  { label: 'SPÉCIAL', prio: 3, test: (r) => ['pra', 'pr', 'pa', 'ra', 'tpm', 'stl', 'blk'].includes(r.stat) || rung(r) >= 0.5, sort: (a, b) => rung(b) - rung(a) },
];
export const serieLine = (r, line) => (r.cat === 'SÉRIE' && r.streak ? `${line} · ${r.streak} de suite` : line);

export function pickTop(rows) {
  const seen = new Set(), perStat = {}, top = [];
  for (const r of rows) {
    if (seen.has(r.player_id) || (perStat[r.stat] || 0) >= 2) continue;
    seen.add(r.player_id); perStat[r.stat] = (perStat[r.stat] || 0) + 1; top.push(r);
    if (top.length === 5) break;
  }
  // affichage : du plus grand nombre de matchs réussis au plus petit (ordre de sélection conservé à égalité)
  return top.sort((a, b) => b.l10 / b.n10 - a.l10 / a.n10);
}

export async function visualPage(origin, q, source = nbaVisual) {
  const fmt = q?.get('format') === 'post' ? 'post' : 'story';
  const [W, H] = fmt === 'post' ? [1080, 1350] : [1080, 1920];
  const { day, top, kicker, league, emoji, tags, base, file } = await source();
  const dateTxt = day ? dayFR(day) : '';
  const items = top.map((r, i) => {
    const [fn, ln] = splitName(r.name);
    return `<div class="vrow" style="--c1:${r.c1};--c2:${r.c2}">${r.art}
      <span class="vrk">${i + 1}</span>
      <div class="vwho"><span class="vfn">${r.cat ? `<em class="vcat">${esc(r.cat)}</em>` : ''}${esc(fn)}</span><span class="vln${ln.length > 12 ? ' long' : ''}">${esc(ln)}</span>
        <span class="vline">${esc(r.line)}</span>
        <span class="vmeta">${esc(r.meta)}</span></div>
      <div class="vsc"><b>${r.l10}<small>/${r.n10}</small></b><span>10 derniers matchs</span></div></div>`;
  }).join('');
  const caption = top.length ? `${emoji} Les 5 séries ${league} à suivre ce soir (${dateTxt})\n\n${top.map((r, i) => `${r.cat ? r.cat + ' · ' : `${i + 1}. `}${r.name} : ${r.line} dans ${r.l10} de ses ${r.n10} derniers matchs`).join('\n')}\n\nToutes les séries, joueur par joueur : lien en bio.\nStats informatives, pas un conseil de pari.\n\n${tags}` : '';
  const S = fmt === 'post'
    ? { pad: 60, title: 100, row: 150, ln: 50, sc: 86, gap: 12, line: 29 }
    : { pad: 80, title: 140, row: 226, ln: 66, sc: 116, gap: 22, line: 37 };
  const css = `
  body{background:#07080F;color:#fff;margin:0;font-family:'Bricolage Grotesque',system-ui,sans-serif}
  .tools{max-width:560px;margin:0 auto;padding:16px}
  .tools h1{font:800 28px/1.1 'Big Shoulders Display',sans-serif;margin:8px 0 4px}
  .tools p{color:#AAB0CC;font-size:15px;margin:6px 0 14px}
  .seg{display:flex;gap:8px;margin-bottom:14px}.seg a{flex:1;text-align:center;padding:10px;border-radius:999px;border:1px solid #2A3050;color:#AAB0CC;text-decoration:none;font-weight:700}
  .seg a.on{background:#fff;color:#0D1020;border-color:#fff}
  .stage{width:100%;aspect-ratio:${W}/${H};position:relative;overflow:hidden;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  .stage>#vis{position:absolute;top:0;left:0;transform-origin:0 0}
  .btn{display:block;width:100%;margin:14px 0 0;padding:16px;border:0;border-radius:16px;font:800 18px 'Bricolage Grotesque',sans-serif;background:#FF6B2C;color:#0D1020}
  .btn.alt{background:#1B2038;color:#fff;border:1px solid #2A3050}
  textarea{width:100%;box-sizing:border-box;min-height:220px;margin-top:14px;border-radius:14px;background:#11152A;color:#E6E8F2;border:1px solid #2A3050;padding:12px;font:14px/1.45 'Bricolage Grotesque',sans-serif}
  .msg{color:#3DDC97;font-size:14px;min-height:20px;margin-top:8px}
  #vis{width:${W}px;height:${H}px;box-sizing:border-box;padding:${S.pad}px;display:flex;flex-direction:column;
    background:radial-gradient(900px 700px at 85% -5%,rgba(255,107,44,.30),transparent 60%),radial-gradient(800px 600px at -10% 105%,rgba(91,140,255,.18),transparent 60%),#0D1020;font-family:'Bricolage Grotesque',sans-serif;color:#fff}
  .vtop{display:flex;justify-content:space-between;align-items:center;font:800 34px 'Big Shoulders Display',sans-serif;letter-spacing:.06em;text-transform:uppercase}
  .vtop .vlogo{display:flex;align-items:center;gap:14px}.vtop .vlogo i{width:34px;height:34px;border-radius:50%;background:#FF6B2C;display:inline-block}
  .vtop .vdate{color:#AAB0CC;font-size:28px}
  .vkick{margin-top:${fmt === 'post' ? 24 : 48}px;color:#FF8A57;font:800 30px 'Big Shoulders Display',sans-serif;letter-spacing:.14em;text-transform:uppercase}
  .vtitle{font:900 ${S.title}px/.88 'Big Shoulders Display',sans-serif;text-transform:uppercase;margin:8px 0 ${fmt === 'post' ? 24 : 40}px;letter-spacing:-.005em}
  .vlist{display:flex;flex-direction:column;gap:${S.gap}px}
  .vrow{position:relative;overflow:hidden;height:${S.row}px;border-radius:34px;display:flex;align-items:center;gap:26px;padding:0 36px 0 30px;
    background:linear-gradient(115deg,var(--c1) 0%,color-mix(in srgb,var(--c1) 55%,#0D1020) 70%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.08)}
  .vart{position:absolute;right:${fmt === 'post' ? 250 : 280}px;bottom:-8%;height:116%;opacity:.18}
  .vrow .vjn{font-size:${Math.round(S.row * 0.82)}px!important;right:${fmt === 'post' ? 230 : 250}px!important}
  .vrk{position:relative;font:900 ${Math.round(S.row * 0.42)}px/1 'Big Shoulders Display',sans-serif;color:rgba(255,255,255,.35);width:${Math.round(S.row * 0.28)}px;text-align:center}
  .vwho{position:relative;flex:1;display:flex;flex-direction:column;min-width:0}
  .vfn{font-size:${Math.round(S.ln * 0.42)}px;color:rgba(255,255,255,.8);font-weight:600}
  .vcat{font:800 ${Math.round(S.ln * 0.36)}px/1 'Big Shoulders Display',sans-serif;font-style:normal;letter-spacing:.08em;color:#0D1020;background:#FF8A57;border-radius:6px;padding:3px 8px 2px;margin-right:10px;vertical-align:2px}
  .vln{font:900 ${S.ln}px/1.08 'Big Shoulders Display',sans-serif;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-top:4px;margin-top:-4px}.vln.long{font-size:${Math.round(S.ln * 0.78)}px}
  .vline{margin-top:${fmt === 'post' ? 6 : 12}px;font-weight:800;font-size:${S.line}px;color:#fff}
  .vmeta{margin-top:${fmt === 'post' ? 2 : 6}px;font-size:${Math.round(S.line * 0.7)}px;color:rgba(255,255,255,.72)}
  .vsc{position:relative;text-align:right;display:flex;flex-direction:column;align-items:flex-end}
  .vsc b{font:900 ${S.sc}px/.9 'Big Shoulders Display',sans-serif;color:#fff}.vsc b small{font-size:.45em;color:rgba(255,255,255,.7);margin-left:4px}
  .vsc span{font-size:${Math.round(S.line * 0.62)}px;color:rgba(255,255,255,.75);margin-top:6px}
  .vfoot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
  .vcta{font:800 ${fmt === 'post' ? 32 : 42}px/1.05 'Big Shoulders Display',sans-serif;text-transform:uppercase}.vcta em{font-style:normal;color:#FF8A57}
  .vlegal{font-size:${fmt === 'post' ? 17 : 21}px;color:#8890B0;text-align:right;max-width:${fmt === 'post' ? 470 : 400}px;line-height:1.3}`;
  const vis = `<div id="vis"><div class="vtop"><span class="vlogo"><i></i>Pick du Soir</span><span class="vdate">${esc(dateTxt)}</span></div>
    <div class="vkick">${esc(kicker)}</div><div class="vtitle">Les 5 séries<br>du soir</div>
    <div class="vlist">${items || '<div class="vrow"><div class="vwho"><span class="vln">Pas de match ce soir</span></div></div>'}</div>
    <div class="vfoot"><div class="vcta">Toutes les séries<br><em>lien en bio</em></div><div class="vlegal">Matchs où le joueur a atteint ce palier, sur ses 10 derniers. Stats informatives, pas un conseil de pari.</div></div></div>`;
  const js = `
  var vis=document.getElementById('vis'),st=document.querySelector('.stage');
  function fit(){vis.style.transform='scale('+(st.clientWidth/${W})+')';}fit();addEventListener('resize',fit);
  var msg=document.querySelector('.msg');
  async function make(){
    msg.textContent='Création de l\\'image…';
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    var t=vis.style.transform;vis.style.transform='none';
    try{var blob=await htmlToImage.toBlob(vis,{width:${W},height:${H},pixelRatio:1,cacheBust:true});}finally{vis.style.transform=t;}
    return new File([blob],'series-${file}-${fmt}-${day || ''}.png',{type:'image/png'});
  }
  document.getElementById('share').onclick=async function(){
    try{var f=await make();
      if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Les 5 séries du soir'});msg.textContent='Image prête.';}
      else{var a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();msg.textContent='Image téléchargée.';}
    }catch(e){msg.textContent=e&&e.name==='AbortError'?'':'Échec : '+(e&&e.message||e);}
  };
  document.getElementById('dl').onclick=async function(){try{var f=await make();var a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click();msg.textContent='Image téléchargée.';}catch(e){msg.textContent='Échec : '+(e&&e.message||e);}};
  document.getElementById('copy').onclick=async function(){var ta=document.querySelector('textarea');try{await navigator.clipboard.writeText(ta.value);}catch(e){ta.select();document.execCommand('copy');}msg.textContent='Légende copiée.';};`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="google-site-verification" content="x6lRJ8aaqzgtqy3nTJFK8rxPwiUmxUb0ONiXjDtpr40"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visuel du soir | Pick du Soir</title><meta name="robots" content="noindex"><meta name="theme-color" content="#07080F">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link crossorigin="anonymous" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap" rel="stylesheet">
<style>${css}</style></head><body><div class="tools">
<h1>Visuel du soir · ${esc(league)}</h1><p>Mis à jour automatiquement chaque jour. Touche « Partager » pour l'envoyer direct sur Instagram ou TikTok.</p>
<nav class="seg"><a href="${base}" class="${fmt === 'story' ? 'on' : ''}">Story 9:16</a><a href="${base}?format=post" class="${fmt === 'post' ? 'on' : ''}">Post 4:5</a></nav>
<div class="stage">${vis}</div>
<button class="btn" id="share">Partager l'image</button><button class="btn alt" id="dl">Télécharger le PNG</button>
<div class="msg"></div>
<textarea readonly>${esc(caption)}</textarea><button class="btn alt" id="copy">Copier la légende</button>
</div>
<script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js"></script>
<script>${js}</script></body></html>`;
}

export { hockeyPose, hockeyInline, avatarSvg, avatar };
export { tc, page, esc, num, hourFR, dayFR, shortDay, splitName, artColor, lum, INJ, AD };

export async function classementPage(origin, q) {
  const nhl = q?.get('l') === 'nhl';
  const rows = nhl
    ? await sql.query(`WITH g AS (SELECT game_date d, home t, home_score s, away_score o FROM nhl_games WHERE game_type=2 AND state='OFF' AND season=20262027 UNION ALL SELECT game_date, away, away_score, home_score FROM nhl_games WHERE game_type=2 AND state='OFF' AND season=20262027)
      SELECT t, count(*)::int j, sum((s>o)::int)::int w, sum((s<o)::int)::int l, (SELECT string_agg(CASE WHEN x.s>x.o THEN 'V' ELSE 'D' END,'' ORDER BY x.d DESC) FROM (SELECT * FROM g g2 WHERE g2.t=g.t ORDER BY d DESC LIMIT 10) x) f FROM g GROUP BY t ORDER BY w DESC, l`)
    : await sql.query(`WITH g AS (SELECT g.game_date d, g.home_team_id t, g.home_score s, g.away_score o FROM games g WHERE g.game_type='reg' AND g.status=3 AND g.season='2026-27' UNION ALL SELECT g.game_date, g.away_team_id, g.away_score, g.home_score FROM games g WHERE g.game_type='reg' AND g.status=3 AND g.season='2026-27')
      SELECT tm.tricode t, count(*)::int j, sum((s>o)::int)::int w, sum((s<o)::int)::int l, (SELECT string_agg(CASE WHEN x.s>x.o THEN 'V' ELSE 'D' END,'' ORDER BY x.d DESC) FROM (SELECT * FROM g g2 WHERE g2.t=g.t ORDER BY d DESC LIMIT 10) x) f FROM g JOIN teams tm ON tm.id=g.t GROUP BY tm.tricode, g.t ORDER BY w DESC, l`);
  const e = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const tab = `<nav class="chips"><a href="/classement" class="${nhl ? '' : 'on'}">NBA</a><a href="/classement?l=nhl" class="${nhl ? 'on' : ''}">NHL</a></nav>`;
  const list = rows.length ? `<table class="cl"><tr><th>#</th><th>Équipe</th><th>J</th><th>V</th><th>D</th><th>Forme</th></tr>${rows.map((r, i) => `<tr><td>${i + 1}</td><td><b>${e(r.t)}</b></td><td>${r.j}</td><td>${r.w}</td><td>${r.l}</td><td class="fm">${[...(r.f || '')].map((c) => `<i class="${c === 'V' ? 'v' : 'd'}"></i>`).join('')}</td></tr>`).join('')}</table>` : '<p class="empty">Le classement apparaît dès les premiers matchs.</p>';
  const css = '<style>.cl{width:100%;border-collapse:collapse;font-size:14px}.cl th{opacity:.6;font-weight:600;text-align:left;padding:6px 4px}.cl td{padding:9px 4px;border-top:1px solid rgba(255,255,255,.1)}.cl td:nth-child(n+3),.cl th:nth-child(n+3){text-align:center}.fm{white-space:nowrap}.fm i{display:inline-block;width:7px;height:14px;border-radius:2px;margin-right:2px}.fm i.v{background:#30A46C}.fm i.d{background:#E5484D}</style>';
  return page({ title: 'Classement ' + (nhl ? 'NHL' : 'NBA') + ' – Pick du Soir', description: 'Classement de la saison : victoires, défaites et forme sur 10 matchs.', canonical: origin + '/classement', nav: 'classement', hockey: nhl, body: `${css}<h1>Classement ${nhl ? 'NHL' : 'NBA'}</h1>${tab}${list}<p class="empty">Victoires incluent les prolongations. Saison régulière 2026-27.</p>` });
}

