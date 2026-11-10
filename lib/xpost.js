// Publication automatique sur X : rendu PNG du visuel "Top 5 séries" (SVG -> resvg-wasm) + API X (OAuth 1.0a)
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { inflateSync } from 'node:zlib';
import { createHmac, randomBytes } from 'node:crypto';

const WASM_URLS = ['https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm', 'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'];
const FS = 'https://cdn.jsdelivr.net/npm/@fontsource/';
export const FONT_FILES = {
  bsd800: 'big-shoulders-display@5.3.0/files/big-shoulders-display-latin-800-normal.woff',
  bsd900: 'big-shoulders-display@5.3.0/files/big-shoulders-display-latin-900-normal.woff',
  bsd900x: 'big-shoulders-display@5.3.0/files/big-shoulders-display-latin-ext-900-normal.woff',
  bri600: 'bricolage-grotesque@5.3.0/files/bricolage-grotesque-latin-600-normal.woff',
  bri800: 'bricolage-grotesque@5.3.0/files/bricolage-grotesque-latin-800-normal.woff',
  bri800x: 'bricolage-grotesque@5.3.0/files/bricolage-grotesque-latin-ext-800-normal.woff',
};

// ---------- polices : WOFF -> TTF + métriques (largeur des textes) ----------
function woffToTtf(buf) {
  const b = Buffer.from(buf);
  if (b.readUInt32BE(0) !== 0x774f4646) return b;
  const n = b.readUInt16BE(12);
  let pow = 1, e = 0; while (pow * 2 <= n) { pow *= 2; e++; }
  const head = Buffer.alloc(12 + 16 * n);
  head.writeUInt32BE(b.readUInt32BE(4), 0); head.writeUInt16BE(n, 4);
  head.writeUInt16BE(pow * 16, 6); head.writeUInt16BE(e, 8); head.writeUInt16BE(n * 16 - pow * 16, 10);
  const parts = [head]; let off = head.length;
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20, tOff = b.readUInt32BE(o + 4), comp = b.readUInt32BE(o + 8), orig = b.readUInt32BE(o + 12);
    let data = b.subarray(tOff, tOff + comp); if (comp < orig) data = inflateSync(data);
    const d = 12 + i * 16;
    head.writeUInt32BE(b.readUInt32BE(o), d); head.writeUInt32BE(b.readUInt32BE(o + 16), d + 4);
    head.writeUInt32BE(off, d + 8); head.writeUInt32BE(orig, d + 12);
    const pad = (4 - (orig % 4)) % 4; parts.push(data); if (pad) parts.push(Buffer.alloc(pad)); off += orig + pad;
  }
  return Buffer.concat(parts);
}

function metrics(ttf) {
  const n = ttf.readUInt16BE(4), T = {};
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; T[ttf.toString('latin1', o, o + 4)] = ttf.readUInt32BE(o + 8); }
  const upm = ttf.readUInt16BE(T.head + 18), nh = ttf.readUInt16BE(T.hhea + 34);
  const asc = ttf.readInt16BE(T.hhea + 4) / upm, desc = ttf.readInt16BE(T.hhea + 6) / upm;
  const adv = (g) => ttf.readUInt16BE(T.hmtx + 4 * Math.min(g, nh - 1)) / upm;
  const map = new Map(), c = T.cmap, nt = ttf.readUInt16BE(c + 2);
  for (let i = 0; i < nt; i++) {
    const p = ttf.readUInt16BE(c + 4 + i * 8), en = ttf.readUInt16BE(c + 6 + i * 8), so = c + ttf.readUInt32BE(c + 8 + i * 8);
    if (p !== 3 || en !== 1 || ttf.readUInt16BE(so) !== 4) continue;
    const seg = ttf.readUInt16BE(so + 6) / 2, ends = so + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
    for (let s = 0; s < seg; s++) {
      const end = ttf.readUInt16BE(ends + 2 * s), st = ttf.readUInt16BE(starts + 2 * s), dl = ttf.readInt16BE(deltas + 2 * s), ro = ttf.readUInt16BE(ranges + 2 * s);
      for (let ch = st; ch <= Math.min(end, 0x2122); ch++) {
        let g = ro === 0 ? (ch + dl) & 0xffff : ttf.readUInt16BE(ranges + 2 * s + ro + 2 * (ch - st));
        if (ro !== 0 && g) g = (g + dl) & 0xffff;
        if (g) map.set(ch, g);
      }
    }
    break;
  }
  let family = '';
  if (T.name != null) {
    const nm = T.name, cnt = ttf.readUInt16BE(nm + 2), so = nm + ttf.readUInt16BE(nm + 4), got = {};
    for (let i = 0; i < cnt; i++) {
      const r = nm + 6 + i * 12, pid = ttf.readUInt16BE(r), id = ttf.readUInt16BE(r + 6), len = ttf.readUInt16BE(r + 8), off = so + ttf.readUInt16BE(r + 10);
      if (pid !== 3 || (id !== 1 && id !== 16)) continue;
      const u = Buffer.from(ttf.subarray(off, off + len)); u.swap16(); got[id] = u.toString('utf16le');
    }
    family = got[16] || got[1] || '';
  }
  return { family, asc, desc, has: (cp) => map.has(cp), adv: (cp) => (map.has(cp) ? adv(map.get(cp)) : null) };
}

let READY = null;
// fetchBytes(url) -> ArrayBuffer ; remplaçable pour les tests locaux
export function loadRenderer(fetchBytes = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.arrayBuffer(); }, wasmBytes) {
  if (READY) return READY;
  READY = (async () => {
    let wasm = wasmBytes, err;
    for (const u of WASM_URLS) { if (wasm) break; try { wasm = await fetchBytes(u); } catch (e) { err = e; } }
    if (!wasm) throw err;
    await initWasm(wasm);
    const fonts = {};
    await Promise.all(Object.entries(FONT_FILES).map(async ([k, f]) => { fonts[k] = woffToTtf(await fetchBytes(FS + f)); }));
    const M = Object.fromEntries(Object.entries(fonts).map(([k, b]) => [k, metrics(b)]));
    return { buffers: Object.values(fonts).map((b) => new Uint8Array(b)), M };
  })();
  READY.catch(() => { READY = null; });
  return READY;
}

// ---------- rendu SVG ----------
export const xe = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); };
const splitName = (n) => { const p = n.split(' '); return p.length > 1 ? [p[0], p.slice(1).join(' ')] : ['', n]; };

export function buildSvg(src, fmt, M) {
  const post = fmt === 'post';
  const [W, H] = post ? [1080, 1350] : [1080, 1920];
  const S = post ? { pad: 60, title: 100, row: 150, ln: 50, sc: 86, gap: 12, line: 29 } : { pad: 80, title: 140, row: 226, ln: 66, sc: 116, gap: 22, line: 37 };
  const fk = (f, w) => (f === 'bsd' ? (w >= 900 ? 'bsd900' : 'bsd800') : w >= 700 ? 'bri800' : 'bri600');
  const met = (f, w) => (f === 'bsd' ? [M.bsd900, M.bsd900x] : w >= 700 ? [M.bri800, M.bri800x] : [M.bri600, M.bri800x]);
  const width = (txt, f, w, size, ls = 0) => { const [a, b] = met(f, w); let x = 0; for (const ch of txt) { const cp = ch.codePointAt(0); x += ((a.adv(cp) ?? b.adv(cp) ?? 0.5) * size) + ls; } return x; };
  // ligne de texte posée dans une boîte (top, hauteur de ligne) comme en CSS
  const T = (txt, x, top, lh, f, w, size, fill, o = {}) => {
    const m = met(f, w)[0], base = top + (lh - (m.asc - m.desc) * size) / 2 + m.asc * size;
    const ls = o.ls ? ` letter-spacing="${o.ls}"` : '', an = o.anchor ? ` text-anchor="${o.anchor}"` : '';
    const op = o.op != null ? ` fill-opacity="${o.op}"` : '';
    return `<text x="${x.toFixed(1)}" y="${base.toFixed(1)}" font-family="${M[fk(f, w)].family}" font-weight="${w}" font-size="${size}"${ls}${an} fill="${fill}"${op}>${xe(txt)}</text>`;
  };
  const ice = src.league === 'NHL', ACC = ice ? '#7FD6FF' : '#FF8A57', BG = ice ? '#07111E' : '#0D1020', BADGE_INK = ice ? '#04131F' : '#0D1020';
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<radialGradient id="g1" gradientUnits="userSpaceOnUse" cx="${W * 0.85}" cy="${-H * 0.05}" r="900" gradientTransform="translate(${W * 0.85} ${-H * 0.05}) scale(1 ${700 / 900}) translate(${-W * 0.85} ${H * 0.05})"><stop offset="0" stop-color="${ice ? '#5CC8FF' : '#FF6B2C'}" stop-opacity="${ice ? .36 : .30}"/><stop offset=".6" stop-color="${ice ? '#5CC8FF' : '#FF6B2C'}" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" gradientUnits="userSpaceOnUse" cx="${-W * 0.1}" cy="${H * 1.05}" r="800" gradientTransform="translate(${-W * 0.1} ${H * 1.05}) scale(1 .75) translate(${W * 0.1} ${-H * 1.05})"><stop offset="0" stop-color="${ice ? '#7C9BFF' : '#5B8CFF'}" stop-opacity=".18"/><stop offset=".6" stop-color="${ice ? '#7C9BFF' : '#5B8CFF'}" stop-opacity="0"/></radialGradient>${ice ? `<linearGradient id="fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDF4FF" stop-opacity=".30"/><stop offset="1" stop-color="#DDF4FF" stop-opacity="0"/></linearGradient><linearGradient id="ic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0FAFF" stop-opacity=".95"/><stop offset="1" stop-color="#7FD6FF" stop-opacity=".25"/></linearGradient><filter id="fz" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .78 0 0 0 0 .92 0 0 0 0 1 0 0 0 1.6 -.6"/></filter>` : ''}</defs>
<rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="url(#g1)"/><rect width="${W}" height="${H}" fill="url(#g2)"/>`);
  if (ice) {
    out.push(`<rect width="${W}" height="${H}" filter="url(#fz)" opacity=".16"/><rect width="${W}" height="170" fill="url(#fr)"/>`);
    let d = `M0 0`; for (let x = 0, k = 0; x < W; x += 34, k++) { const hh = 16 + ((k * 7919) % 5) * 9; d += `L${x} 0L${x + 17} ${hh}L${x + 34} 0`; } out.push(`<path d="${d}Z" fill="url(#ic)"/>`);
  }
  const P = S.pad, R = W - P;
  // en-tête
  out.push(ice ? `<path d="M${P} ${P + 15}v14c0 6 8 10 17 10s17-4 17-10v-14z" fill="#2C86B8"/><ellipse cx="${P + 17}" cy="${P + 15}" rx="17" ry="9" fill="#5CC8FF"/><path d="M${P} ${P + 19}c0 6 8 10 17 10s17-4 17-10" fill="none" stroke="#07111E" stroke-width="2.5"/>` : `<circle cx="${P + 17}" cy="${P + 21}" r="17" fill="#FF6B2C"/>`);
  out.push(T('PICK DU SOIR', P + 48, P, 42, 'bsd', 800, 34, '#FFFFFF', { ls: 2.04 }));
  out.push(T(String(src.dateTxt || '').toUpperCase(), R, P, 42, 'bsd', 800, 28, '#AAB0CC', { ls: 1.68, anchor: 'end' }));
  let y = P + 42 + (post ? 24 : 48);
  out.push(T(String(src.kicker).toUpperCase(), P, y, 36, 'bsd', 800, 30, ACC, { ls: 4.2 })); y += 36 + 8;
  const tl = S.title * 0.88;
  out.push(T('LES 5 SÉRIES', P, y, tl, 'bsd', 900, S.title, '#FFFFFF')); y += tl;
  out.push(T('DU SOIR', P, y, tl, 'bsd', 900, S.title, '#FFFFFF')); y += tl + (post ? 24 : 40);
  // lignes
  const rows = src.top.length ? src.top : [{ name: 'Pas de match ce soir', none: true }];
  rows.forEach((r, i) => {
    const top = y, h = S.row, id = `r${i}`, c1 = r.c1 || '#3A4170';
    out.push(`<defs><clipPath id="c${id}"><rect x="${P}" y="${top}" width="${R - P}" height="${h}" rx="34"/></clipPath>
<linearGradient id="l${id}" gradientUnits="objectBoundingBox" x1="0" y1=".5" x2="1" y2=".5" gradientTransform="rotate(25 .5 .5)"><stop offset="0" stop-color="${c1}"/><stop offset=".7" stop-color="${mix(c1, BG, 0.55)}"/></linearGradient></defs>`);
    out.push(`<g clip-path="url(#c${id})"><rect x="${P}" y="${top}" width="${R - P}" height="${h}" fill="url(#l${id})"/>`);
    if (r.photoData) {
      // Photo posée sur le bas de la ligne : tête + épaules visibles, la tête dépasse un peu au-dessus (effet carte)
      const nhl = r.league === 'nhl', bh = h * 1.2, bw = nhl ? bh : bh * 1.37, by = top + h - bh;
      out.push(`</g><clipPath id="p${id}"><rect x="${P}" y="${(top - 0.25 * h).toFixed(1)}" width="${R - P}" height="${(1.25 * h).toFixed(1)}"/></clipPath><g clip-path="url(#p${id})"><image x="${(R - (post ? 250 : 280) - bw).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" preserveAspectRatio="xMidYMax meet" href="${r.photoData}"/></g><g clip-path="url(#c${id})">`);
    }
    if (r.jersey != null) {
      const fs = Math.round(h * 0.82);
      out.push(`<text x="${R - (post ? 230 : 250)}" y="${(top + h / 2 + fs * 0.36).toFixed(1)}" text-anchor="end" font-family="${M.bsd900.family}" font-weight="900" font-size="${fs}" fill="none" stroke="${r.jcol}" stroke-width="4" stroke-opacity=".3">${xe(r.jersey)}</text>`);
    }
    out.push(`</g><rect x="${P + 1}" y="${top + 1}" width="${R - P - 2}" height="${h - 2}" rx="33" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="2"/>`);
    if (r.none) { out.push(T(r.name.toUpperCase(), P + 40, top, h, 'bsd', 900, S.ln, '#FFFFFF')); y += h + S.gap; return; }
    const rkW = Math.round(h * 0.28), rkX = P + 30 + rkW / 2;
    out.push(T(String(i + 1), rkX, top, h, 'bsd', 900, Math.round(h * 0.42), '#FFFFFF', { anchor: 'middle', op: 0.35 }));
    // score à droite
    const sc = S.sc, small = Math.round(sc * 0.45), lab = Math.round(S.line * 0.62), sx = R - 36;
    const lw = width('10 derniers matchs', 'bri', 600, lab), bw = width(String(r.l10), 'bsd', 900, sc) + 4 + width('/' + r.n10, 'bsd', 900, small);
    const scW = Math.max(lw, bw), scH = sc * 0.9 + 6 + lab * 1.2, sTop = top + (h - scH) / 2;
    out.push(T('/' + r.n10, sx, sTop + sc * 0.9 - small * 0.95, small, 'bsd', 900, small, '#FFFFFF', { anchor: 'end', op: 0.7 }));
    out.push(T(String(r.l10), sx - width('/' + r.n10, 'bsd', 900, small) - 4, sTop, sc * 0.9, 'bsd', 900, sc, '#FFFFFF', { anchor: 'end' }));
    out.push(T('10 derniers matchs', sx, sTop + sc * 0.9 + 6, lab * 1.2, 'bri', 600, lab, '#FFFFFF', { anchor: 'end', op: 0.75 }));
    // bloc joueur
    const wx = P + 30 + rkW + 26, avail = sx - scW - 26 - wx;
    const [fn, ln] = splitName(r.name);
    let lnS = ln.length > 12 ? Math.round(S.ln * 0.78) : S.ln;
    const lnTxt = ln.toUpperCase(); const lw2 = width(lnTxt, 'bsd', 900, lnS); if (lw2 > avail) lnS = Math.floor((lnS * avail) / lw2);
    const fnS = Math.round(S.ln * 0.42), mS = Math.round(S.line * 0.7);
    let lineS = S.line; const lw3 = width(r.line, 'bri', 800, lineS); if (lw3 > avail) lineS = Math.floor((lineS * avail) / lw3);
    const hs = [fnS * 1.2, lnS * 1.08, (post ? 6 : 12) + lineS * 1.2, (post ? 2 : 6) + mS * 1.2], tot = hs.reduce((a, b) => a + b, 0);
    let yy = top + (h - tot) / 2;
    let fx = wx;
    if (r.cat) {
      const cs = Math.round(S.ln * 0.36), cw = width(r.cat, 'bsd', 800, cs, cs * 0.08) + 16, ch = cs + 6, cy = yy + (fnS * 1.2 - ch) / 2;
      out.push(`<rect x="${wx}" y="${cy.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch}" rx="6" fill="${ACC}"/>`);
      out.push(T(r.cat, wx + 8, cy, ch, 'bsd', 800, cs, BADGE_INK, { ls: (cs * 0.08).toFixed(2) }));
      fx = wx + cw + 10;
    }
    out.push(T(fn, fx, yy, fnS * 1.2, 'bri', 600, fnS, '#FFFFFF', { op: 0.8 })); yy += hs[0];
    out.push(T(lnTxt, wx, yy, lnS * 1.08, 'bsd', 900, lnS, '#FFFFFF')); yy += hs[1];
    out.push(T(r.line, wx, yy + (post ? 6 : 12), lineS * 1.2, 'bri', 800, lineS, '#FFFFFF')); yy += hs[2];
    out.push(T(r.meta, wx, yy + (post ? 2 : 6), mS * 1.2, 'bri', 600, mS, '#FFFFFF', { op: 0.72 }));
    y += h + S.gap;
  });
  // pied
  const cta = post ? 32 : 42, ctaL = cta * 1.05, fy = H - P - ctaL * 2;
  out.push(T('TOUTES LES SÉRIES', P, fy, ctaL, 'bsd', 800, cta, '#FFFFFF'));
  out.push(T('LIEN EN BIO', P, fy + ctaL, ctaL, 'bsd', 800, cta, ACC));
  const lg = post ? 17 : 21, maxW = post ? 470 : 400, words = 'Matchs où le joueur a atteint ce palier, sur ses 10 derniers. Stats informatives, pas un conseil de pari.'.split(' ');
  const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (width(t, 'bri', 600, lg) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  lines.forEach((l, k) => out.push(T(l, R, H - P - (lines.length - k) * lg * 1.3, lg * 1.3, 'bri', 600, lg, '#8890B0', { anchor: 'end' })));
  out.push('</svg>');
  return out.join('\n');
}

export async function renderPng(src, fmt = 'post', fetchBytes, wasmBytes) {
  const { buffers, M } = await loadRenderer(fetchBytes, wasmBytes);
  const get = fetchBytes || (async (u) => { const x = await fetch(u, { signal: AbortSignal.timeout(8000) }); if (!x.ok) throw new Error(String(x.status)); return x.arrayBuffer(); });
  await Promise.all((src.top || []).map(async (r) => {
    for (const u of [r.photo, r.photo2].filter(Boolean)) {
      try { const b = Buffer.from(await get(u)); if (b.length > 800) { r.photoData = 'data:image/png;base64,' + b.toString('base64'); r.photoAspect = r.photoW / r.photoH; break; } } catch {}
    }
  }));
  const svg = buildSvg(src, fmt, M);
  const r = new Resvg(svg, { fitTo: { mode: 'original' }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: M.bri600.family } });
  const png = r.render().asPng(); r.free?.();
  return png;
}

// ---------- texte du post (≤ 280 caractères comptés façon X) ----------
const xLen = (s) => [...s].reduce((n, ch) => n + (ch.codePointAt(0) > 0x2fff ? 2 : 1), 0);
export function tweetText(src) {
  const last = (n) => splitName(n)[1] || n;
  const di = Math.floor(Date.parse(src.day || '2026-01-01') / 864e5);
  const hooks = [
    `${src.emoji} Top 5 séries ${src.league} ce soir : qui reste en feu ?`,
    `${src.emoji} Les 5 séries ${src.league} à surveiller ce soir`,
    `${src.emoji} 5 séries ${src.league} en cours ce soir`,
  ];
  const asks = ['Laquelle tient ? 👇', 'Ton joueur du soir ? 👇', 'Laquelle est la plus solide ? 👇'];
  const heads = [hooks[di % 3], `${src.emoji} Top 5 séries ${src.league} ce soir`, `${src.emoji} 5 séries ${src.league}`];
  const ask = asks[di % 3];
  const legal = 'Stats informatives, pas un conseil de pari.';
  const tags = String(src.tags || '').split(' ').filter(Boolean);
  const variants = [
    (r) => `${r.name} : ${r.line} (${r.l10}/${r.n10})`,
    (r) => `${last(r.name)} : ${r.line} (${r.l10}/${r.n10})`,
    (r) => `${last(r.name)} : ${r.line.replace(/ \+ /g, '+')} (${r.l10}/${r.n10})`,
    (r) => `${last(r.name)} : ${r.line.replace(/ \+ /g, '+').replace('passe décisive', 'passe')} (${r.l10}/${r.n10})`,
    (r) => `${last(r.name)} : ${r.line.replace(/ \+ /g, '+').replace('passe décisive', 'passe')}${r.cat === 'SÉRIE' ? '' : ` (${r.l10}/${r.n10})`}`,
  ];
  let t = '';
  for (const withAsk of [true, false]) for (const head of heads) for (const v of variants) {
    const list = src.top.map((r, i) => `${r.cat ? r.cat + ' · ' : `${i + 1}. `}${v(r)}`).join('\n');
    for (let k = tags.length; k >= 0; k--) {
      t = `${head}\n\n${list}\n\n${withAsk ? ask + '\n' : ''}${legal}${k ? '\n' + tags.slice(0, k).join(' ') : ''}`;
      if (xLen(t) <= 280) return t;
    }
  }
  return t;
}

// Bilan du matin : items = [{ name, ok (true|false|null = n'a pas joué), val, short, thr }]
export function recapText(league, emoji, tags, items, day) {
  const last = (n) => splitName(n)[1] || n;
  const played = items.filter((i) => i.ok !== null), hit = played.filter((i) => i.ok).length;
  const di = Math.floor(Date.parse(day || '2026-01-01') / 864e5);
  const head = `Bilan ${league} d'hier : ${hit}/${played.length} séries tenues`;
  const outro = hit === played.length ? 'Sans faute 🔥' : hit * 2 >= played.length ? 'Les séries du soir arrivent 👀' : 'Rien n\'est jamais acquis. Les séries du soir arrivent 👀';
  const legal = 'Stats informatives, pas un conseil de pari.';
  const tag = String(tags || '').trim();
  const forms = [
    (i) => `${i.ok === null ? '➖' : i.ok ? '✅' : '❌'} ${i.name} : ${i.ok === null ? "n'a pas joué" : `${i.val} ${i.short} (${i.thr}+)`}`,
    (i) => `${i.ok === null ? '➖' : i.ok ? '✅' : '❌'} ${last(i.name)} : ${i.ok === null ? "n'a pas joué" : `${i.val} ${i.short} (${i.thr}+)`}`,
    (i) => `${i.ok === null ? '➖' : i.ok ? '✅' : '❌'} ${last(i.name)} : ${i.ok === null ? 'absent' : `${i.val} ${i.short}`}`,
  ];
  void di;
  const shown = items.length > 5 ? items.filter((i) => i.ok).slice(0, 5) : items;
  for (const f of forms) for (const withOutro of [true, false]) {
    const t = `${emoji} ${head.slice(0)}\n\n${shown.map(f).join('\n')}\n\n${withOutro ? outro + '\n' : ''}${legal}${tag ? '\n' + tag : ''}`;
    if (xLen(t) <= 280) return t;
  }
  return `${emoji} ${head}\n\n${legal}`;
}

// ---------- API X (OAuth 1.0a utilisateur) ----------
const pct = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function oauthHeader(method, url, env, extra = {}, fixed = {}) {
  const o = {
    oauth_consumer_key: env.X_API_KEY, oauth_nonce: fixed.nonce || randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: fixed.ts || String(Math.floor(Date.now() / 1000)),
    oauth_token: env.X_ACCESS_TOKEN, oauth_version: '1.0',
  };
  const u = new URL(url), all = [];
  u.searchParams.forEach((v, k) => all.push([pct(k), pct(v)]));
  for (const [k, v] of Object.entries({ ...extra, ...o })) all.push([pct(k), pct(v)]);
  all.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const base = [method.toUpperCase(), pct(u.origin + u.pathname), pct(all.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
  o.oauth_signature = createHmac('sha1', `${pct(env.X_API_SECRET)}&${pct(env.X_ACCESS_SECRET)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(o).sort().map((k) => `${pct(k)}="${pct(o[k])}"`).join(', ');
}

async function xFetch(method, url, env, init = {}) {
  const r = await fetch(url, { method, ...init, headers: { ...(init.headers || {}), authorization: oauthHeader(method, url, env) }, signal: AbortSignal.timeout(30000) });
  const txt = await r.text(); let data; try { data = JSON.parse(txt); } catch { data = { raw: txt.slice(0, 300) }; }
  if (!r.ok) throw new Error(`X ${r.status} ${url.replace('https://', '')}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

export const xMe = (env) => xFetch('GET', 'https://api.x.com/2/users/me', env);

export async function xUpload(png, env) {
  const fd = () => { const f = new FormData(); f.append('media', new Blob([png], { type: 'image/png' }), 'visuel.png'); f.append('media_category', 'tweet_image'); return f; };
  try {
    const d = await xFetch('POST', 'https://api.x.com/2/media/upload', env, { body: fd() });
    return d.data?.id || d.media_id_string;
  } catch (e) {
    const f = new FormData(); f.append('media', new Blob([png], { type: 'image/png' }), 'visuel.png');
    const d = await xFetch('POST', 'https://upload.x.com/1.1/media/upload.json', env, { body: f }).catch((e2) => { throw new Error(`${e.message} | ${e2.message}`); });
    return d.media_id_string;
  }
}

export async function xTweet(text, mediaId, env, replyTo, poll) {
  const body = { text, ...(poll ? { poll } : {}), ...(mediaId ? { media: { media_ids: [String(mediaId)] } } : {}), ...(replyTo ? { reply: { in_reply_to_tweet_id: String(replyTo) } } : {}) };
  const d = await xFetch('POST', 'https://api.x.com/2/tweets', env, { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return d.data?.id;
}

export async function xMetrics(ids, env) {
  const d = await xFetch('GET', `https://api.x.com/2/tweets?ids=${ids.join(',')}&tweet.fields=public_metrics`, env);
  return d.data || [];
}

// ---------- visuel « nouveauté » (1200×675), un par fonction ----------
export async function renderNews(n, fetchBytes, wasmBytes) {
  const { buffers, M } = await loadRenderer(fetchBytes, wasmBytes);
  const W = 1200, H = 675, D = M.bsd900.family, B = M.bri600.family, c = n.color;
  const t = (x, y, txt, fam, w, sz, fill, an = 'start') => `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${sz}" fill="${fill}" text-anchor="${an}">${xe(txt)}</text>`;
  const lines = n.title.split('\n');
  const title = lines.map((l, i) => t(70, 250 + i * 104, l, D, 900, 104, '#FFFFFF')).join('');
  const sub = (n.sub.match(/.{1,34}(\s|$)/g) || [n.sub]).slice(0, 3).map((l, i) => t(70, 250 + lines.length * 104 + 18 + i * 40, l.trim(), B, 600, 30, '#B8C4E6')).join('');
  let mock = '';
  if (n.kind === 'cards') {
    const card = (x, y, rot, col, num) => `<g transform="rotate(${rot} ${x + 130} ${y + 180})"><rect x="${x}" y="${y}" width="260" height="360" rx="22" fill="#F2EEE3"/><rect x="${x + 8}" y="${y + 8}" width="244" height="344" rx="16" fill="${col}"/><circle cx="${x + 170}" cy="${y + 215}" r="52" fill="#E8B27A"/><path d="M${x + 80} ${y + 352} Q${x + 170} ${y + 240} ${x + 252} ${y + 352}Z" fill="#fff" opacity=".9"/>${t(x + 24, y + 110, num, D, 900, 96, '#fff')}${t(x + 24, y + 150, 'sur ses 10 derniers', B, 600, 17, '#ffffffcc')}<rect x="${x + 8}" y="${y + 292}" width="244" height="44" fill="#0b1a4a" opacity=".85"/></g>`;
    mock = card(700, 130, 7, '#B3122D', '8') + card(880, 190, -6, '#4B2A8F', '7');
  } else if (n.kind === 'matchup') {
    const rowsM = [['81', 0.81], ['78', 0.78], ['73', 0.73], ['64', 0.64]];
    mock = `<rect x="690" y="120" width="440" height="430" rx="28" fill="#ffffff12" stroke="#ffffff30"/>` + rowsM.map(([v, f], i) => `<rect x="720" y="${160 + i * 98}" width="380" height="74" rx="16" fill="#0D1020"/><rect x="720" y="${160 + i * 98}" width="${380 * f}" height="74" rx="16" fill="${f > 0.7 ? '#30A46C' : '#FACC15'}" opacity=".9"/>${t(742, 210 + i * 98, 'Match-up ' + v + '/100', B, 800, 30, f > 0.7 ? '#fff' : '#1b1b1b')}`).join('');
  } else {
    const tm = ['HOU', 'PHI', 'DET', 'BOS', 'CAR'];
    mock = `<rect x="690" y="120" width="440" height="440" rx="28" fill="#ffffff12" stroke="#ffffff30"/>` + tm.map((x, i) => `${t(724, 196 + i * 78, String(i + 1), D, 900, 36, '#ffffff70')}${t(780, 196 + i * 78, x, D, 900, 44, '#fff')}${[0, 1, 2, 3, 4, 5].map((k) => `<rect x="${900 + k * 36}" y="${160 + i * 78}" width="26" height="46" rx="6" fill="${(k + i) % 4 === 3 ? '#E5484D' : '#30A46C'}"/>`).join('')}`).join('');
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1020"/><stop offset="1" stop-color="#1B2250"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1100" cy="40" r="330" fill="${c}" opacity=".22"/><circle cx="60" cy="700" r="220" fill="${c}" opacity=".12"/>
<rect x="70" y="70" width="190" height="52" rx="26" fill="${c}"/>${t(165, 107, 'NOUVEAU', D, 900, 34, '#0D1020', 'middle')}${t(290, 107, 'PICK DU SOIR', D, 900, 30, '#ffffffaa')}${title}${sub}${mock}${t(W - 70, H - 40, 'pickdusoir.fr', D, 900, 32, c, 'end')}</svg>`;
  const r = new Resvg(svg, { fitTo: { mode: 'original' }, font: { fontBuffers: buffers, loadSystemFonts: false, defaultFontFamily: M.bri600.family } });
  const png = r.render().asPng(); r.free?.(); return png;
}
