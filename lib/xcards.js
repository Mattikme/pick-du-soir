// Tweets en cartes : une image 1080x1350 avec 4 cartes (2x2), rendue en SVG -> PNG (resvg), + sélection et textes.
import { Resvg } from '@resvg/resvg-wasm';
import { loadRenderer, xe, mix } from './xpost.js';

const W = 1080, H = 1350;
const NHL_TAGS = {
  ANA: '#FlyTogether', BOS: '#NHLBruins', BUF: '#Sabrehood', CGY: '#Flames', CAR: '#CarolinaCulture', CHI: '#Blackhawks', COL: '#GoAvsGo', CBJ: '#CBJ',
  DAL: '#TexasHockey', DET: '#LGRW', EDM: '#LetsGoOilers', FLA: '#TimeToHunt', LAK: '#GoKingsGo', MIN: '#MNWild', MTL: '#GoHabsGo', NSH: '#Smashville',
  NJD: '#NJDevils', NYI: '#Isles', NYR: '#NYR', OTT: '#GoSensGo', PHI: '#LetsGoFlyers', PIT: '#LetsGoPens', SJS: '#TheFutureIsTeal', SEA: '#SeaKraken',
  STL: '#STLBlues', TBL: '#GoBolts', TOR: '#LeafsForever', UTA: '#TusksUp', VAN: '#Canucks', VGK: '#VegasBorn', WSH: '#ALLCAPS', WPG: '#GoJetsGo',
};
const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');
const lastName = (n) => { const p = String(n).trim().split(/\s+/); return p.length > 1 ? p.slice(1).join('') : p[0]; };
export const playerTag = (name) => '#' + ascii(lastName(name));
export const nhlTeamTag = (t) => NHL_TAGS[t] || '';

function helpers(M) {
  const fk = (f, w) => (f === 'bsd' ? (w >= 900 ? 'bsd900' : 'bsd800') : w >= 700 ? 'bri800' : 'bri600');
  const met = (f, w) => (f === 'bsd' ? [M.bsd900, M.bsd900x] : w >= 700 ? [M.bri800, M.bri800x] : [M.bri600, M.bri800x]);
  const width = (txt, f, w, size, ls = 0) => { const [a, b] = met(f, w); let x = 0; for (const ch of String(txt)) { const cp = ch.codePointAt(0); x += ((a.adv(cp) ?? b.adv(cp) ?? 0.5) * size) + ls; } return x; };
  const T = (txt, x, top, lh, f, w, size, fill, o = {}) => {
    const m = met(f, w)[0], base = top + (lh - (m.asc - m.desc) * size) / 2 + m.asc * size;
    const ls = o.ls ? ` letter-spacing="${o.ls}"` : '', an = o.anchor ? ` text-anchor="${o.anchor}"` : '';
    const op = o.op != null ? ` fill-opacity="${o.op}"` : '', st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 4}" paint-order="stroke" stroke-linejoin="round"` : '';
    return `<text x="${x.toFixed(1)}" y="${base.toFixed(1)}" font-family="${M[fk(f, w)].family}" font-weight="${w}" font-size="${size}"${ls}${an}${st} fill="${fill}"${op}>${xe(txt)}</text>`;
  };
  return { width, T };
}

const STAT_CODE = { pts: 'PTS', reb: 'REB', ast: 'PAS', tpm: '3PT', stl: 'INT', blk: 'CTR', pra: 'PRA', pr: 'P+R', pa: 'P+P', ra: 'R+P', g: 'BUT', a: 'PAS', p: 'PTS' };

// Une carte (x, y, cw, ch) ; c = { name, c1, c2, photoData, league, team, opp, home, l10, n10, l5, n5, l20, n20, streak, line, ms, hour, avg, thr, hist:[valeurs du plus ancien au plus récent] }
const fmt1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
function card(c, i, x, y, cw, ch, h, ice, mode) {
  const { T, width } = h;
  const id = `k${i}`, c1 = c.c1 || '#3A4170', c2 = c.c2 || '#8B93B5', BG = ice ? '#07111E' : '#0B0E1C';
  const fire = (c.streak || 0) >= 5, hot = (c.streak || 0) >= 3, perfect = c.l10 === c.n10;
  const frame = fire ? ['#FFE27A', '#FF8A1F', '#E0300E'] : perfect ? ['#FFF3B0', '#E8B931', '#FFF6CF'] : ['#E4ECF7', '#7A8BA6', '#F4F8FC'];
  const GREEN = '#4ADE80', RED = '#FB7185', GOLD = '#FACC15';
  const px = 10, py = 10, pw = cw - 20, ph = 300; // zone photo
  const o = [];
  o.push(`<g transform="translate(${x} ${y})"><defs>
<linearGradient id="f${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${frame[0]}"/><stop offset=".5" stop-color="${frame[1]}"/><stop offset="1" stop-color="${frame[2]}"/></linearGradient>
<linearGradient id="b${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c1, BG, 0.9)}"/><stop offset=".5" stop-color="${mix(c1, BG, 0.38)}"/><stop offset="1" stop-color="${BG}"/></linearGradient>
<radialGradient id="a${id}" cx=".62" cy=".35" r=".8"><stop offset="0" stop-color="${mix(c2, c1, 0.55)}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${mix(c1, '#000000', 0.45)}"/></radialGradient>
<linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="${mix(c1, BG, 0.5)}" stop-opacity="0"/><stop offset="1" stop-color="${mix(c1, BG, 0.5)}" stop-opacity="1"/></linearGradient>
<linearGradient id="h${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".03"/><stop offset=".56" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="p${id}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="20"/></clipPath></defs>`);
  if (fire || perfect) o.push(`<rect x="-7" y="-7" width="${cw + 14}" height="${ch + 14}" rx="34" fill="${fire ? '#FF7417' : GOLD}" opacity=".22"/>`);
  o.push(`<rect width="${cw}" height="${ch}" rx="28" fill="url(#f${id})"/><rect x="5" y="5" width="${cw - 10}" height="${ch - 10}" rx="24" fill="url(#b${id})"/>`);
  // zone photo : fond club, rayures, tricode géant, photo, fondu
  o.push(`<g clip-path="url(#p${id})"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#a${id})"/>`);
  for (let k = 0; k < 7; k++) { const sx = px - 120 + k * 92; o.push(`<polygon points="${sx},${py + ph} ${sx + 40},${py + ph} ${sx + 210},${py} ${sx + 170},${py}" fill="${k % 2 ? c2 : '#ffffff'}" opacity="${k % 2 ? 0.13 : 0.05}"/>`); }
  o.push(T(String(c.team || ''), cw - 14, py + 6, 210, 'bsd', 900, 200, '#FFFFFF', { anchor: 'end', op: 0.09 }));
  if (c.photoData) {
    // NBA : visage un peu plus petit ; NHL : photo carrée très cadrée large, on agrandit pour que la tête compte autant
    const ih = c.league === 'nhl' ? ph * 1.25 : ph * 0.92, iw = c.league === 'nhl' ? ih : ih * 1.37, cx = px + pw * (c.league === 'nhl' ? 0.62 : 0.6);
    const iy = c.league === 'nhl' ? py + ph * 0.42 - ih * 0.4 : py + ph - ih;
    o.push(`<image x="${(cx - iw / 2).toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" preserveAspectRatio="xMidYMax meet" href="${c.photoData}"/>`);
  }
  o.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#d${id})"/></g>`);
  // jauge 10 derniers matchs
  const gx = 64, gy = 66, gr = 40, circ = 2 * Math.PI * gr, algo = c.prob != null, fr = algo ? c.prob : (c.n10 ? c.l10 / c.n10 : 0);
  o.push(`<circle cx="${gx}" cy="${gy}" r="${gr + 12}" fill="#05060C" fill-opacity=".62"/><circle cx="${gx}" cy="${gy}" r="${gr}" fill="none" stroke="#FFFFFF" stroke-opacity=".16" stroke-width="8"/>
<circle cx="${gx}" cy="${gy}" r="${gr}" fill="none" stroke="${perfect ? GOLD : GREEN}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(circ * fr).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${gx} ${gy})"/>`);
  const big = algo ? String(Math.round(c.prob * 20) * 5) : String(c.l10), suf = algo ? '%' : '/' + c.n10, bw = width(big, 'bsd', 900, algo ? 40 : 44), sw2 = width(suf, 'bsd', 800, 20);
  o.push(T(big, gx - (bw + sw2) / 2, gy - 30, 48, 'bsd', 900, algo ? 40 : 44, '#FFFFFF'));
  o.push(T(suf, gx - (bw + sw2) / 2 + bw + 1, gy - 12, 30, 'bsd', 800, 20, '#FFFFFF', { op: 0.8 }));
  o.push(T(algo ? 'CHANCES' : 'MATCHS', gx, gy + 14, 18, 'bsd', 800, 14, '#FFFFFF', { anchor: 'middle', ls: 1.5, op: 0.75 }));
  const code = STAT_CODE[c.stat] || String(c.stat || '').toUpperCase(), cwid = width(code, 'bsd', 900, 20, 1.5) + 20;
  o.push(`<rect x="${gx - cwid / 2}" y="${gy + gr + 18}" width="${cwid}" height="28" rx="14" fill="#FFFFFF"/>${T(code, gx, gy + gr + 18, 28, 'bsd', 900, 20, mix(c1, '#05060C', 0.5), { anchor: 'middle', ls: 1.5 })}`);
  if (hot) {
    // pastille sous le code stat, dans la colonne de gauche : ne cache plus le visage
    const t = fire ? `EN FEU · ${c.streak}` : `${c.streak} DE SUITE`, w2 = width(t, 'bsd', 900, 18, 1) + 22, by = gy + gr + 58;
    o.push(`<rect x="22" y="${by}" width="${w2}" height="32" rx="16" fill="${fire ? '#FF7417' : '#05060C'}" fill-opacity="${fire ? 1 : 0.78}"${fire ? '' : ' stroke="#9CC7FF" stroke-opacity=".5" stroke-width="1.5"'}/>${T(t, 22 + w2 / 2, by, 32, 'bsd', 900, 18, fire ? '#1A0B00' : '#D6E9FF', { anchor: 'middle', ls: 1 })}`);
  }
  // nom : prénom + NOM
  const parts = String(c.name).trim().split(/\s+/), first = parts.length > 1 ? parts[0] : '', last = (parts.length > 1 ? parts.slice(1).join(' ') : parts[0]).toUpperCase();
  let ns = 52; while (width(last, 'bsd', 900, ns) > cw - 52 && ns > 26) ns -= 2;
  if (first) o.push(T(first, 26, py + ph - 88, 28, 'bri', 600, 22, '#FFFFFF', { op: 0.92, stroke: '#05060C', sw: 4 }));
  o.push(T(last, 26, py + ph - 62, 58, 'bsd', 900, ns, '#FFFFFF', { stroke: '#05060C', sw: 6 }));
  // ligne de la série
  const ly = py + ph + 12, line = String(c.line || '').toUpperCase();
  let ls = 30; while (width(line, 'bsd', 900, ls, 1) > cw - 80 && ls > 18) ls -= 1;
  o.push(`<rect x="20" y="${ly}" width="${cw - 40}" height="50" rx="14" fill="${fire ? '#FFB347' : perfect ? GOLD : '#FFFFFF'}"/>`);
  o.push(T(line, cw / 2, ly, 50, 'bsd', 900, ls, '#0A0C16', { anchor: 'middle', ls: 1 }));
  const meta = `${c.team} ${c.home ? 'vs' : 'chez'} ${c.opp} · ${c.hour}` + (mode === 'match' && c.ms != null ? `  ·  MATCH-UP ${c.ms}/100` : '');
  o.push(T(meta, cw / 2, ly + 56, 28, 'bri', 800, 19, mode === 'match' ? '#FFE58A' : '#E6ECF8', { anchor: 'middle', op: 0.92 }));
  // mini-graphique des 10 derniers matchs (seuil en pointillés), sinon pastilles
  const gy0 = ly + 92, gh = 66, gl = 24, gw = cw - 48, hist = Array.isArray(c.hist) ? c.hist.slice(-10) : null;
  if (hist && hist.length >= 5 && c.thr != null) {
    const n = hist.length, gap = 6, bw2 = (gw - gap * (n - 1)) / n, maxV = Math.max(c.thr * (c.thr <= 2 ? 2.2 : 1.5), ...hist, 1), yb = gy0 + gh;
    hist.forEach((v, k) => {
      const hh = Math.max(4, (v / maxV) * (gh - 14)), ok = v >= c.thr, bx = gl + k * (bw2 + gap);
      o.push(`<rect x="${bx.toFixed(1)}" y="${(yb - hh).toFixed(1)}" width="${bw2.toFixed(1)}" height="${hh.toFixed(1)}" rx="4" fill="${ok ? GREEN : RED}" fill-opacity="${ok ? 1 : 0.75}"/>`);
      o.push(T(String(v), bx + bw2 / 2, yb - hh - 16, 16, 'bri', 800, 13, ok ? '#D9FBE6' : '#FFD2DA', { anchor: 'middle' }));
    });
    const ty = yb - (c.thr / maxV) * (gh - 14);
    o.push(`<line x1="${gl - 4}" y1="${ty.toFixed(1)}" x2="${gl + gw + 4}" y2="${ty.toFixed(1)}" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="2" stroke-dasharray="6 5"/>`);
  } else {
    const n = c.n10 || 10, gap = 7, pw2 = (gw - gap * (n - 1)) / n;
    for (let k = 0; k < n; k++) o.push(`<rect x="${(gl + k * (pw2 + gap)).toFixed(1)}" y="${gy0 + gh - 14}" width="${pw2.toFixed(1)}" height="14" rx="5" fill="${k < c.l10 ? GREEN : '#FFFFFF'}" fill-opacity="${k < c.l10 ? 1 : 0.18}"/>`);
  }
  const avg = c.avg != null ? `Moy. ${fmt1(c.avg)}  ·  ` : '';
  o.push(T(algo ? `${avg}10 der. ${c.l10}/${c.n10}  ·  5 der. ${c.l5}/${c.n5}` : `${avg}5 der. ${c.l5}/${c.n5}  ·  20 der. ${c.l20}/${c.n20}`, cw / 2, gy0 + gh + 8, 26, 'bri', 600, 18, '#CFD8EA', { anchor: 'middle', op: 0.9 }));
  // reflet holographique
  o.push(`<rect x="5" y="5" width="${cw - 10}" height="${ch - 10}" rx="24" fill="url(#h${id})"/>`);
  o.push('</g>');
  return o.join('\n');
}

// Tuile de fin quand il n'y a que 3 cartes
function ctaTile(x, y, cw, ch, h, acc) {
  const { T } = h;
  return `<g transform="translate(${x} ${y})"><rect x="3" y="3" width="${cw - 6}" height="${ch - 6}" rx="26" fill="#FFFFFF" fill-opacity=".04" stroke="${acc}" stroke-width="3" stroke-dasharray="14 10"/>
${T('TOUTES', cw / 2, ch / 2 - 150, 70, 'bsd', 900, 66, '#FFFFFF', { anchor: 'middle' })}${T('LES SÉRIES', cw / 2, ch / 2 - 84, 70, 'bsd', 900, 66, '#FFFFFF', { anchor: 'middle' })}
${T('joueur par joueur, chaque soir', cw / 2, ch / 2 - 6, 30, 'bri', 600, 22, '#CFD8EA', { anchor: 'middle' })}
<rect x="60" y="${ch / 2 + 50}" width="${cw - 120}" height="64" rx="32" fill="${acc}"/>${T('pickdusoir.fr', cw / 2, ch / 2 + 50, 64, 'bsd', 900, 34, '#0A0C16', { anchor: 'middle', ls: 1 })}
${T('Gratuit · sans inscription', cw / 2, ch / 2 + 130, 30, 'bri', 600, 20, '#AAB0CC', { anchor: 'middle' })}</g>`;
}

export function buildCardsSvg(set, M) {
  const ice = set.league === 'nhl', h = helpers(M), { T, width } = h;
  const ACC = ice ? '#7FD6FF' : '#FF8A57', BG = ice ? '#06101C' : '#0B0D1A';
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<radialGradient id="g1" cx=".9" cy="0" r=".95"><stop offset="0" stop-color="${ice ? '#38BDF8' : '#FF6B2C'}" stop-opacity=".34"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0" cy="1" r=".85"><stop offset="0" stop-color="${ice ? '#6366F1' : '#7C3AED'}" stop-opacity=".26"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>
<circle cx="${W}" cy="0" r="420" fill="none" stroke="#FFFFFF" stroke-opacity=".05" stroke-width="3"/><circle cx="${W}" cy="0" r="560" fill="none" stroke="#FFFFFF" stroke-opacity=".035" stroke-width="3"/>`];
  o.push(`<circle cx="62" cy="54" r="15" fill="${ACC}"/>`);
  o.push(T('PICK DU SOIR', 88, 34, 40, 'bsd', 800, 30, '#FFFFFF', { ls: 2 }));
  o.push(T(String(set.dateTxt || '').toUpperCase(), W - 46, 34, 40, 'bsd', 800, 24, '#AAB0CC', { ls: 1.6, anchor: 'end' }));
  o.push(T(`${set.league.toUpperCase()} · CE SOIR`, 46, 82, 30, 'bsd', 800, 26, ACC, { ls: 4 }));
  const title = String(set.title).toUpperCase();
  o.push(T(title, 46, 104, 86, 'bsd', 900, 84, '#FFFFFF'));
  const n = set.cards.length, tag = `${n} SÉRIE${n > 1 ? 'S' : ''} À SUIVRE`, tw = width(title, 'bsd', 900, 84);
  o.push(`<rect x="${46 + tw + 22}" y="128" width="${width(tag, 'bsd', 800, 22, 1.5) + 28}" height="38" rx="19" fill="${ACC}" fill-opacity=".16" stroke="${ACC}" stroke-opacity=".6"/>${T(tag, 46 + tw + 36, 128, 38, 'bsd', 800, 22, ACC, { ls: 1.5 })}`);
  const cw = 500, ch = 525, gx = 20, x0 = (W - 2 * cw - gx) / 2, y0 = 200;
  const pos = (i) => [x0 + (i % 2) * (cw + gx), y0 + Math.floor(i / 2) * (ch + 16)];
  set.cards.slice(0, 4).forEach((c, i) => { const [x, y] = pos(i); o.push(card(c, i, x, y, cw, ch, h, ice, set.key)); });
  if (n === 3) { const [x, y] = pos(3); o.push(ctaTile(x, y, cw, ch, h, ACC)); }
  o.push(T('Stats informatives, pas un conseil de pari.', 46, 1290, 40, 'bri', 600, 21, '#AAB0CC', { op: 0.9 }));
  o.push(T('TOUTES LES SÉRIES · PICKDUSOIR.FR', W - 46, 1290, 40, 'bsd', 800, 24, ACC, { anchor: 'end', ls: 1.2 }));
  o.push('</svg>');
  return o.join('\n');
}
export async function renderCards(set, fetchBytes, wasmBytes) {
  const { buffers, M } = await loadRenderer(fetchBytes, wasmBytes);
  const get = fetchBytes || (async (u) => { const x = await fetch(u, { signal: AbortSignal.timeout(8000) }); if (!x.ok) throw new Error(String(x.status)); return x.arrayBuffer(); });
  await Promise.all(set.cards.map(async (c) => {
    for (const u of [c.photo, c.photo2].filter(Boolean)) {
      try { const b = Buffer.from(await get(u)); if (b.length > 800) { c.photoData = 'data:image/png;base64,' + b.toString('base64'); break; } } catch {}
    }
  }));
  const svg = buildCardsSvg(set, M);
  const r = new Resvg(svg, { fitTo: { mode: 'original' }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: M.bri600.family } });
  const png = r.render().asPng(); r.free?.();
  return png;
}

// ---------- textes de tweet ----------
const xLen = (t) => { let n = 0; for (const ch of t) n += ch.codePointAt(0) > 0x1100 ? 2 : 1; return n; };
export function cardsTweet(set) {
  const ice = set.league === 'nhl', emoji = ice ? '🏒' : '🏀';
  const base = ice ? '#NHL #TeamParieur' : '#NBA #TeamParieur';
  const first = set.cards[0];
  const extra = first ? (ice ? nhlTeamTag(first.team) : playerTag(first.name)) : '';
  const legal = 'Stats informatives, pas un conseil de pari.';
  const num = /^Séries #/.test(set.title), heads = [num ? `${emoji} ${set.title} du soir` : `${emoji} ${set.title} ce soir`, `${emoji} ${set.title} : les ${set.cards.length} séries à suivre`];
  const last = (n) => String(n).trim().split(/\s+/).slice(1).join(' ') || n;
  for (const head of heads) for (const full of [true, false]) {
    const list = set.cards.slice(0, 4).map((c, i) => `${i + 1}. ${full ? c.name : last(c.name)} : ${c.line} (${c.l10}/${c.n10})`).join('\n');
    for (const tags of [`${base} ${extra}`.trim(), base]) {
      const t = `${head}\n\n${list}\n\n${legal}\n${tags}`;
      if (xLen(t) <= 280) return t;
    }
  }
  return `${heads[0]}\n\n${legal}\n${base}`;
}

// Tweet « Notre algo » : les séries les plus probables du soir, avec le pourcentage
export function algoTweet(set) {
  const last = (n) => String(n).trim().split(/\s+/).slice(1).join(' ') || n;
  const legal = 'Stats informatives, pas un conseil de pari.', first = set.cards[0];
  const heads = ['🤖 Notre algo : les 4 séries NBA les plus probables ce soir', '🤖 Notre algo, ce soir'];
  for (const head of heads) for (const full of [true, false]) {
    const list = set.cards.slice(0, 4).map((c, i) => `${i + 1}. ${full ? c.name : last(c.name)} : ${c.line} (${Math.round(c.prob * 20) * 5} %)`).join('\n');
    for (const tags of [`#NBA #TeamParieur ${first ? playerTag(first.name) : ''}`.trim(), '#NBA #TeamParieur']) {
      const t = `${head}\n\n${list}\n\n${legal}\n${tags}`;
      if (xLen(t) <= 280) return t;
    }
  }
  return `${heads[1]}\n\n${legal}\n#NBA #TeamParieur`;
}

// ---------- joueurs connus (mis en avant : ce sont eux que les gens cherchent) ----------
const STARS_TXT = {
  nba: 'Victor Wembanyama,Luka Doncic,Stephen Curry,LeBron James,Nikola Jokic,Giannis Antetokounmpo,Shai Gilgeous-Alexander,Jayson Tatum,Anthony Edwards,Kevin Durant,Joel Embiid,Jalen Brunson,Donovan Mitchell,Devin Booker,Anthony Davis,Tyrese Haliburton,Ja Morant,Trae Young,Zion Williamson,Jimmy Butler,Kawhi Leonard,Paul George,Damian Lillard,Kyrie Irving,James Harden,Cade Cunningham,Paolo Banchero,Franz Wagner,Jaylen Brown,Domantas Sabonis,Bam Adebayo,Tyrese Maxey,Karl-Anthony Towns,Chet Holmgren,Jalen Williams,Alperen Sengun,Evan Mobley,Darius Garland,LaMelo Ball,De\'Aaron Fox,Zach LaVine,Scottie Barnes,Cooper Flagg,Rudy Gobert,Nicolas Batum,Zaccharie Risacher,Alex Sarr,Bilal Coulibaly,Tidjane Salaun,Nolan Traore,Evan Fournier,Austin Reaves,Desmond Bane,Jamal Murray,Jaren Jackson Jr.,Lauri Markkanen,Pascal Siakam,Derrick White,Mikal Bridges,OG Anunoby,Josh Giddey,Amen Thompson,Dyson Daniels',
  nhl: 'Connor McDavid,Leon Draisaitl,Nathan MacKinnon,Auston Matthews,Nikita Kucherov,Cale Makar,David Pastrnak,Sidney Crosby,Alex Ovechkin,Artemi Panarin,Kirill Kaprizov,Jack Hughes,Quinn Hughes,Matthew Tkachuk,Brady Tkachuk,Mitch Marner,William Nylander,Jack Eichel,Mikko Rantanen,Sam Reinhart,Aleksander Barkov,Jason Robertson,Kyle Connor,Tage Thompson,Connor Bedard,Macklin Celebrini,Elias Pettersson,J.T. Miller,Brayden Point,Jake Guentzel,Martin Necas,Nico Hischier,Clayton Keller,Dylan Larkin,Lucas Raymond,Tim Stutzle,Nick Suzuki,Cole Caufield,Juraj Slafkovsky,Lane Hutson,Adam Fox,Roman Josi,Evan Bouchard,Zach Werenski,Alexandre Texier,Mathieu Olivier',
};
const norm = (n) => String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const STARS = Object.fromEntries(Object.entries(STARS_TXT).map(([k, v]) => [k, new Set(v.split(',').map(norm))]));
export const isStar = (league, name) => STARS[league]?.has(norm(name)) || false;

// ---------- sélection des séries par thème ----------
const SETS = {
  nba: [
    // les combinés (PRA, P+R…) complètent chaque thème : sinon, trop peu de séries certains soirs
    { key: 'pts', title: 'Séries #1', slot: '17:30', test: (c) => ['pts', 'pra', 'pr', 'pa'].includes(c.stat), sort: (a, b) => (b.stat === 'pts') - (a.stat === 'pts') || byForm(a, b) },
    { key: 'reb', title: 'Séries #2', slot: '19:30', test: (c) => ['reb', 'ra', 'pr', 'blk'].includes(c.stat), sort: (a, b) => (b.stat === 'reb') - (a.stat === 'reb') || byForm(a, b) },
    { key: 'ast', title: 'Séries #3', slot: '21:30', test: (c) => ['ast', 'pa', 'ra', 'stl', 'tpm'].includes(c.stat), sort: (a, b) => (b.stat === 'ast') - (a.stat === 'ast') || byForm(a, b) },
    { key: 'match', title: 'Match-up', slot: '23:00', test: (c) => c.ms != null && c.ms >= 50, sort: (a, b) => b.ms - a.ms },
  ],
  nhl: [
    { key: 'g', title: 'Buts', slot: '18:30', test: (c) => c.stat === 'g' },
    { key: 'a', title: 'Passeurs', slot: '20:30', test: (c) => c.stat === 'a' },
    { key: 'p', title: 'Points', slot: '22:30', test: (c) => c.stat === 'p' },
  ],
};
function byForm(a, b) { return byForm0(a, b); }
const byForm0 = (a, b) => b.l10 / b.n10 - a.l10 / a.n10 || (b.streak || 0) - (a.streak || 0) || (b.score || 0) - (a.score || 0);
// Retourne les sets du jour (4 cartes max, joueurs distincts d'un thème à l'autre quand c'est possible)
export function planSets(league, cards, now = Date.now()) {
  const used = new Set(), out = [];
  const live = (cards || []).filter((c) => !c.start || new Date(c.start).getTime() > now + 20 * 6e4);
  // une star à 7/10 passe devant un inconnu à 7/10 ; un 9/10 reste devant un 7/10
  const starFirst = (cmp) => (a, b) => Math.round(b.l10 / b.n10 * 10) - Math.round(a.l10 / a.n10 * 10) || isStar(league, b.name) - isStar(league, a.name) || cmp(a, b);
  for (const def of SETS[league]) {
    const pool = live.filter(def.test).sort(def.key === 'match' ? def.sort : starFirst(def.sort || byForm));
    const pick = [], seen = new Set();
    for (const c of pool) { if (used.has(c.pid) || seen.has(c.pid)) continue; seen.add(c.pid); pick.push(c); if (pick.length === 4) break; }
    // joueurs déjà vus dans un autre thème du soir : seulement pour atteindre 3 cartes (la 4e case devient alors la tuile du site)
    for (const c of pool) { if (pick.length >= 3) break; if (!seen.has(c.pid)) { seen.add(c.pid); pick.push(c); } }
    if (pick.length < 3) continue;
    pick.forEach((c) => used.add(c.pid));
    out.push({ league, key: def.key, title: def.title, slot: def.slot, cards: pick });
  }
  return out;
}
export const picksOf = (set) => set.cards.map((c) => ({ name: c.name, cat: set.title, pid: c.pid, stat: c.stat, thr: c.thr, gid: c.gid }));

// Valeurs réelles des 10 derniers matchs joués (du plus ancien au plus récent), pour le mini-graphique
const NHL_V = { g: 'goals', a: 'assists', p: 'points' };
export async function loadHist(sql, league, cards, STATS) {
  await Promise.all(cards.map(async (c) => {
    try {
      if (league === 'nba') {
        const rows = await sql.query(`SELECT pg.pts, pg.reb, pg.ast, pg.tpm, pg.stl, pg.blk FROM player_games pg JOIN games g ON g.id = pg.game_id
          WHERE pg.player_id = $1 AND pg.minutes > 0 AND g.status = 3 AND g.game_type IS DISTINCT FROM 'pre' ORDER BY g.game_date DESC LIMIT 10`, [c.pid]);
        if (STATS[c.stat]) c.hist = rows.map((r) => STATS[c.stat].val(r)).reverse();
      } else if (NHL_V[c.stat]) {
        const rows = await sql.query(`SELECT pg.${NHL_V[c.stat]} AS v FROM nhl_player_games pg JOIN nhl_games g ON g.id = pg.game_id
          WHERE pg.player_id = $1 AND coalesce(pg.toi, 1) > 0 AND g.start_utc < now() - interval '4 hours' ORDER BY g.start_utc DESC LIMIT 10`, [c.pid]);
        c.hist = rows.map((r) => +r.v || 0).reverse();
      }
    } catch { c.hist = null; }
  }));
}

// ---------- bilan du matin en image ----------
// items = [{ name, ok (true|false|null), val, short, thr }]
export function buildRecapSvg(league, items, dateTxt, M) {
  const ice = league === 'nhl', h = helpers(M), { T, width } = h;
  const ACC = ice ? '#7FD6FF' : '#FF8A57', BG = ice ? '#06101C' : '#0B0D1A', GREEN = '#4ADE80', RED = '#FB7185';
  const played = items.filter((i) => i.ok !== null), hit = played.filter((i) => i.ok).length;
  const list = [...items].sort((a, b) => (b.ok === true) - (a.ok === true) || (a.ok === null) - (b.ok === null)).slice(0, 14);
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<radialGradient id="g1" cx=".9" cy="0" r=".95"><stop offset="0" stop-color="${ice ? '#38BDF8' : '#FF6B2C'}" stop-opacity=".30"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0" cy="1" r=".85"><stop offset="0" stop-color="#16A34A" stop-opacity=".18"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>`];
  o.push(`<circle cx="62" cy="54" r="15" fill="${ACC}"/>`);
  o.push(T('PICK DU SOIR', 88, 34, 40, 'bsd', 800, 30, '#FFFFFF', { ls: 2 }));
  o.push(T(String(dateTxt || '').toUpperCase(), W - 46, 34, 40, 'bsd', 800, 24, '#AAB0CC', { ls: 1.6, anchor: 'end' }));
  o.push(T(`${league.toUpperCase()} · BILAN D'HIER`, 46, 82, 30, 'bsd', 800, 26, ACC, { ls: 4 }));
  // score
  const sc = `${hit}/${played.length}`;
  o.push(T(sc, 46, 104, 130, 'bsd', 900, 128, '#FFFFFF'));
  const sw = width(sc, 'bsd', 900, 128);
  o.push(T('SÉRIES', 46 + sw + 22, 124, 44, 'bsd', 900, 40, '#FFFFFF'));
  o.push(T('TENUES', 46 + sw + 22, 166, 44, 'bsd', 900, 40, GREEN));
  const bx = 46, by = 252, bw = W - 92;
  o.push(`<rect x="${bx}" y="${by}" width="${bw}" height="14" rx="7" fill="#FFFFFF" fill-opacity=".12"/>`);
  if (played.length) o.push(`<rect x="${bx}" y="${by}" width="${(bw * hit) / played.length}" height="14" rx="7" fill="${GREEN}"/>`);
  // lignes
  const top = 296, avail = 1250 - top, rh = Math.min(92, Math.floor(avail / Math.max(list.length, 1)));
  const fs = Math.min(38, rh * 0.46);
  list.forEach((it, k) => {
    const y = top + k * rh, mid = y + rh / 2, col = it.ok === null ? '#8B93B5' : it.ok ? GREEN : RED;
    o.push(`<rect x="46" y="${y + 4}" width="${W - 92}" height="${rh - 8}" rx="${Math.min(18, rh / 3)}" fill="#FFFFFF" fill-opacity="${k % 2 ? 0.035 : 0.06}"/>`);
    const r = Math.min(20, rh * 0.26), cx = 46 + 22 + r;
    o.push(`<circle cx="${cx}" cy="${mid}" r="${r}" fill="${col}"/>`);
    if (it.ok === true) o.push(`<path d="M${cx - r * 0.45} ${mid} L${cx - r * 0.1} ${mid + r * 0.38} L${cx + r * 0.5} ${mid - r * 0.36}" fill="none" stroke="#0A0C16" stroke-width="${r * 0.28}" stroke-linecap="round" stroke-linejoin="round"/>`);
    else if (it.ok === false) o.push(`<path d="M${cx - r * 0.38} ${mid - r * 0.38} L${cx + r * 0.38} ${mid + r * 0.38} M${cx + r * 0.38} ${mid - r * 0.38} L${cx - r * 0.38} ${mid + r * 0.38}" stroke="#0A0C16" stroke-width="${r * 0.28}" stroke-linecap="round"/>`);
    else o.push(`<path d="M${cx - r * 0.4} ${mid} L${cx + r * 0.4} ${mid}" stroke="#0A0C16" stroke-width="${r * 0.28}" stroke-linecap="round"/>`);
    const nx = cx + r + 22, name = String(it.name).toUpperCase();
    let ns = fs; while (width(name, 'bsd', 900, ns) > 560 && ns > 18) ns -= 1;
    o.push(T(name, nx, mid - rh * 0.4, rh * 0.5, 'bsd', 900, ns, '#FFFFFF'));
    o.push(T(it.thr != null ? `Objectif ${it.thr}+ ${it.unit || ''}`.trim() : '', nx, mid + rh * 0.04, rh * 0.36, 'bri', 600, Math.min(20, rh * 0.24), '#AAB0CC'));
    const res = it.ok === null ? 'N\'A PAS JOUÉ' : `${it.val} ${String(it.short || '').toUpperCase()}`;
    o.push(T(res, W - 72, y, rh, 'bsd', 900, it.ok === null ? fs * 0.7 : fs, col, { anchor: 'end' }));
  });
  if (items.length > list.length) o.push(T(`+ ${items.length - list.length} autres séries sur le site`, W / 2, 1238, 30, 'bri', 600, 20, '#AAB0CC', { anchor: 'middle' }));
  o.push(T('Stats informatives, pas un conseil de pari.', 46, 1290, 40, 'bri', 600, 21, '#AAB0CC', { op: 0.9 }));
  o.push(T('LES SÉRIES DU SOIR · PICKDUSOIR.FR', W - 46, 1290, 40, 'bsd', 800, 24, ACC, { anchor: 'end', ls: 1.2 }));
  o.push('</svg>');
  return o.join('\n');
}
export async function renderRecap(league, items, dateTxt, fetchBytes, wasmBytes) {
  const { buffers, M } = await loadRenderer(fetchBytes, wasmBytes);
  const r = new Resvg(buildRecapSvg(league, items, dateTxt, M), { fitTo: { mode: 'original' }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: M.bri600.family } });
  const png = r.render().asPng(); r.free?.();
  return png;
}
// Texte du bilan : score, meilleures réussites, nombre de séries tombées (honnête)
export function recapTweet(league, items) {
  const ice = league === 'nhl', emoji = ice ? '🏒' : '🏀';
  const played = items.filter((i) => i.ok !== null), hits = played.filter((i) => i.ok), miss = played.length - hits.length;
  const legal = 'Stats informatives, pas un conseil de pari.', tags = ice ? '#TeamParieur #NHL' : '#TeamParieur #NBA';
  const outro = miss === 0 && played.length ? 'Sans faute 🔥' : 'Les séries du soir arrivent 👀';
  for (const n of [3, 2, 1, 0]) {
    const best = hits.slice(0, n).map((i) => `✅ ${i.name} : ${i.val} ${i.short}`).join('\n');
    const t = `${emoji} Bilan ${league.toUpperCase()} d'hier : ${hits.length}/${played.length} séries tenues\n\n${best}${best ? '\n' : ''}${miss ? `❌ ${miss} série${miss > 1 ? 's' : ''} tombée${miss > 1 ? 's' : ''}\n` : ''}\n${outro}\n${legal}\n${tags}`;
    if (xLen(t) <= 280) return t;
  }
  return `${emoji} Bilan ${league.toUpperCase()} d'hier : ${hits.length}/${played.length} séries tenues\n\n${legal}\n${tags}`;
}

// ---------- une seule carte (à télécharger pour répondre sous un tweet) ----------
export async function renderSingle(c, key, fetchBytes, wasmBytes) {
  const { buffers, M } = await loadRenderer(fetchBytes, wasmBytes);
  const get = fetchBytes || (async (u) => { const x = await fetch(u, { signal: AbortSignal.timeout(8000) }); if (!x.ok) throw new Error(String(x.status)); return x.arrayBuffer(); });
  for (const u of [c.photo, c.photo2].filter(Boolean)) {
    try { const b = Buffer.from(await get(u)); if (b.length > 800) { c.photoData = 'data:image/png;base64,' + b.toString('base64'); break; } } catch {}
  }
  const ice = c.league === 'nhl', h = helpers(M), { T } = h, ACC = ice ? '#7FD6FF' : '#FF8A57', BG = ice ? '#06101C' : '#0B0D1A';
  const SW = 540, SH = 640;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}"><rect width="${SW}" height="${SH}" fill="${BG}"/>
<circle cx="34" cy="31" r="10" fill="${ACC}"/>${T('PICK DU SOIR', 52, 16, 30, 'bsd', 800, 22, '#FFFFFF', { ls: 1.5 })}${T('PICKDUSOIR.FR', SW - 20, 16, 30, 'bsd', 800, 18, ACC, { anchor: 'end', ls: 1.2 })}
${card(c, 0, 20, 56, 500, 525, h, ice, key)}
${T('Stats informatives, pas un conseil de pari.', SW / 2, 596, 30, 'bri', 600, 16, '#AAB0CC', { anchor: 'middle' })}</svg>`;
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: M.bri600.family } });
  const png = r.render().asPng(); r.free?.();
  return png;
}

// ---------- sondage du soir ----------
export function pollTweet(c) {
  const ice = c.league === 'nhl', fr = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const tags = ice ? '#NHL #TeamParieur' : '#NBA #TeamParieur';
  const t = `🗳️ Sondage du soir\n\n${c.name} : ${c.line} ce soir ?\n\nSur ses 10 derniers matchs : ${c.l10}/${c.n10}${c.avg != null ? ` (moyenne ${fr(c.avg)})` : ''}.\n\nStats informatives, pas un conseil de pari.\n${tags} ${ice ? nhlTeamTag(c.team) : playerTag(c.name)}`;
  return { text: xLen(t) <= 280 ? t : t.replace(/ #\S+$/, ''), options: ['Oui, ça passe ✅', 'Non ❌'] };
}
