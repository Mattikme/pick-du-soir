// Contours animés qui suivent la silhouette du joueur (photo détourée) : filtres SVG appliqués à l'image.
// Principe commun : un halo autour de la silhouette, déformé par un bruit qui défile en boucle (tuile répétée = boucle sans saut),
// découpé en 3 couches de couleur (extérieur → cœur) + lueur + liseré collé au joueur.
const F = (id, body) => `<filter id="${id}" x="-12%" y="-14%" width="124%" height="128%" color-interpolation-filters="sRGB">${body}</filter>`;
const ring = (w, res) => `<feMorphology in="SourceAlpha" operator="dilate" radius="${w}" result="${res}d"/><feComposite in="${res}d" in2="SourceAlpha" operator="out" result="${res}"/>`;
const paint = (src, color, res, op = 1) => `<feFlood flood-color="${color}" flood-opacity="${op}"/><feComposite in2="${src}" operator="in" result="${res}"/>`;
const out = (...n) => `<feMerge>${n.map((x) => `<feMergeNode in="${x}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge>`;
// Bruit qui défile : dx/dy = déplacement sur une période (120×100 px), dur = durée d'un cycle
const flow = ({ freq, oct = 3, seed = 8, type = 'fractalNoise', dx = 0, dy = -100, dur = '1.4s' }) => `<feTurbulence type="${type}" baseFrequency="${freq}" numOctaves="${Math.min(oct, 2)}" seed="${seed}" stitchTiles="stitch" x="0" y="0" width="120" height="100" result="n0"/><feTile in="n0" result="n1"/><feOffset in="n1" x="0" y="0" width="120" height="100" result="n2">${dx ? `<animate attributeName="dx" values="0;${dx}" dur="${dur}" repeatCount="indefinite"/>` : ''}${dy ? `<animate attributeName="dy" values="0;${dy}" dur="${dur}" repeatCount="indefinite"/>` : ''}</feOffset><feTile in="n2" result="n"/>`;
const steps = (src, at, res) => { const n = 10, v = Array.from({ length: n }, (_, i) => (i >= at ? 1 : 0)).join(' '); return `<feComponentTransfer in="${src}" result="${res}"><feFuncA type="discrete" tableValues="${v}"/></feComponentTransfer>`; };
// Effet « matière » (feu, poison, eau) : halo étiré (sx, sy, oy), déformé (scale), seuillé en 3 couleurs
const matter = (o) => `<feMorphology in="SourceAlpha" operator="dilate" radius="${o.dil ?? 1}" result="d"/><feGaussianBlur in="d" stdDeviation="${o.sx} ${o.sy}" result="sm"/><feOffset in="sm" dx="${o.ox ?? 0}" dy="${o.oy}" result="h0"/><feMerge result="h"><feMergeNode in="h0"/><feMergeNode in="d"/></feMerge>
${flow(o.flow)}<feDisplacementMap in="h" in2="n" scale="${o.scale}" xChannelSelector="R" yChannelSelector="G" result="dp"/><feOffset in="dp" dx="${-o.scale / 4}" dy="${-o.scale / 4}" result="dpo"/>
<feComposite in="dpo" in2="n" operator="arithmetic" k1="0" k2="${o.k[0]}" k3="${o.k[1]}" k4="${o.k[2]}" result="t"/>${o.goo ? `<feGaussianBlur in="t" stdDeviation="${o.goo}" result="tg"/>` : ''}
${steps(o.goo ? 'tg' : 't', o.th[0], 'm1')}${steps(o.goo ? 'tg' : 't', o.th[1], 'm2')}${steps(o.goo ? 'tg' : 't', o.th[2], 'm3')}
${paint('m1', o.c[0], 'c1')}${paint('m2', o.c[1], 'c2')}${paint('m3', o.c[2], 'c3')}
<feGaussianBlur in="c1" stdDeviation="${o.soft ? 1.6 : 0.6}" result="c1b"/><feGaussianBlur in="c2" stdDeviation="${o.soft ? 1.2 : 0.4}" result="c2b"/><feGaussianBlur in="c3" stdDeviation="${o.soft ? 0.8 : 0}" result="c3b"/><feGaussianBlur in="c1" stdDeviation="${o.glow ?? 4}" result="gl"/>
${ring(0.8, 'rm')}${paint('rm', o.rim, 'rim', 0.85)}${out('gl', 'c1b', 'c2b', 'c3b', 'rim')}`;

// Effet « énergie » (éclair, glace) : arcs fins très déformés, couche externe colorée + cœur blanc + lueur
const arcs = (o) => `<feTurbulence type="turbulence" baseFrequency="${o.freq}" numOctaves="2" seed="1" result="n">${o.anim}</feTurbulence>
${ring(o.w, 'r')}<feDisplacementMap in="r" in2="n" scale="${o.scale}" xChannelSelector="R" yChannelSelector="G" result="a1"/><feOffset in="a1" dx="${-o.scale / 2}" dy="${-o.scale / 2}" result="a1o"/>
${ring(o.w * 0.6, 'r2')}<feDisplacementMap in="r2" in2="n" scale="${o.scale * 0.45}" xChannelSelector="G" yChannelSelector="B" result="a2"/><feOffset in="a2" dx="${-o.scale * 0.22}" dy="${-o.scale * 0.22}" result="a2o"/>
${paint('a1o', o.c[0], 'c1')}${paint('a2o', o.c[1], 'c2')}<feGaussianBlur in="c1" stdDeviation="${o.glow}" result="gl"><animate attributeName="stdDeviation" values="${o.glow};${o.glow * 1.8};${o.glow}" dur="${o.pulse}" repeatCount="indefinite"/></feGaussianBlur>
${ring(0.7, 'rm')}${paint('rm', o.c[1], 'rim', 0.8)}${out('gl', 'gl', 'c1', 'c2', 'rim')}`;

// Effet « néon » (laser, or, holo) : double trait net + reflet lumineux qui fait le tour (bruit qui défile en masque)
const neon = (o) => `${ring(o.w, 'r')}${ring(o.w * 2.2, 'rw')}${flow(o.flow)}
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${o.m}" result="mask"/>
${paint('r', o.c[0], 'c1')}${paint('rw', o.c[1], 'w1')}<feComposite in="w1" in2="mask" operator="in" result="shine"/>
<feGaussianBlur in="c1" stdDeviation="${o.glow}" result="gl"/><feGaussianBlur in="shine" stdDeviation="2.5" result="shg"/><feGaussianBlur in="shine" stdDeviation="0.9" result="shs"/>${o.hue ? `<feMerge result="base"><feMergeNode in="gl"/><feMergeNode in="c1"/></feMerge><feColorMatrix in="base" type="hueRotate" values="0" result="bh"><animate attributeName="values" values="0;360" dur="${o.hue}" repeatCount="indefinite"/></feColorMatrix>` : ''}${o.spark ? `<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="2" result="sp0"><animate attributeName="seed" dur="1.2s" values="2;5;8;11;14" calcMode="discrete" repeatCount="indefinite"/></feTurbulence><feComponentTransfer in="sp0" result="sp1"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 1"/></feComponentTransfer>${ring(o.w * 4, 'rz')}<feComposite in="sp1" in2="rz" operator="in" result="sp2"/>${paint('sp2', '#fffbe0', 'sp3')}<feGaussianBlur in="sp3" stdDeviation="0.8" result="sp"/>` : ''}
${o.hue ? out('bh', 'shg', 'shs') : out('gl', 'c1', 'shg', 'shs', ...(o.spark ? ['sp', 'sp'] : []))}`;

const RAW = `<svg id="fxsvg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${F('fxFlame', matter({ sx: 1.6, sy: 9, oy: -8, scale: 12, k: [1.7, -1.6, 0.18], th: [3, 6, 9], c: ['#d9230b', '#ff7417', '#ffd24a'], rim: '#ffe9a8', flow: { freq: '0.07 0.03', dy: -100, dur: '3.2s' }, soft: 1 }))}
${F('fxToxic', matter({ sx: 2.5, sy: 6, oy: -4, scale: 10, k: [1.8, -1.5, 0.15], th: [3, 6, 9], goo: 1.2, c: ['#1f8f0a', '#5dff2e', '#e4ffb5'], rim: '#caff9a', glow: 5, flow: { freq: '0.05 0.05', seed: 4, dy: -100, dur: '3.2s' } }))}
${F('fxWater', matter({ sx: 3.5, sy: 3.5, oy: 0, scale: 10, k: [1.8, -1.4, 0.1], th: [3, 6, 9], goo: 1.5, c: ['#0b5fd9', '#1fb6ff', '#d6f6ff'], rim: '#bff2ff', glow: 5, flow: { freq: '0.03 0.045', seed: 2, dx: -120, dy: 0, dur: '4s' } }))}
${F('fxBolt', arcs({ freq: '0.05 0.09', w: 1.8, scale: 11, c: ['#3fb4ff', '#ffffff'], glow: 3.5, pulse: '0.5s', anim: '<animate attributeName="seed" dur="0.45s" values="1;7;3;9;5;2" calcMode="discrete" repeatCount="indefinite"/>' }))}
${F('fxIce', arcs({ freq: '0.18 0.18', w: 1.8, scale: 5, c: ['#8fdcff', '#ffffff'], glow: 2.5, pulse: '2.4s', anim: '<animate attributeName="seed" dur="3s" values="2;6;4;8" calcMode="discrete" repeatCount="indefinite"/>' }))}
${F('fxLaser', neon({ w: 1.3, c: ['#ff1f4d', '#ffffff'], glow: 2.5, m: '0 0 0 6 -2.75', flow: { freq: '0.012 0.012', oct: 1, seed: 5, dx: -120, dy: -100, dur: '2.2s' } }))}
${F('fxGold', neon({ w: 1.3, c: ['#ffb300', '#fff4c2'], glow: 2.5, m: '0 0 0 6 -2.75', spark: 1, flow: { freq: '0.02 0.02', oct: 1, seed: 9, dx: -120, dy: 0, dur: '2.6s' } }))}
${F('fxRainbow', neon({ w: 1.4, c: ['#ff3cac', '#ffffff'], glow: 3, hue: '4s', m: '0 0 0 6 -2.75', flow: { freq: '0.015 0.015', oct: 1, seed: 3, dx: -120, dy: -100, dur: '3s' } }))}
</defs></svg>`;
// Filtres STATIQUES : un filtre SVG animé est recalculé à chaque image, trop lourd sur mobile
export const FX_SVG = RAW.replace(/<animate[^>]*\/>/g, '');
export const FX_CSS = `.vis.fx-flame .ph{filter:url(#fxFlame)}.vis.fx-bolt .ph{filter:url(#fxBolt)}.vis.fx-laser .ph{filter:url(#fxLaser)}.vis.fx-water .ph{filter:url(#fxWater)}.vis.fx-gold .ph{filter:url(#fxGold)}.vis.fx-toxic .ph{filter:url(#fxToxic)}.vis.fx-ice .ph{filter:url(#fxIce)}.vis.fx-rainbow .ph{filter:url(#fxRainbow)}
.tc-fx{display:none}.vis.fx-laser .tc-fx{display:block;position:absolute;left:8%;right:8%;height:1px;top:0;z-index:4;background:linear-gradient(90deg,transparent,#ff4d6d,#fff,#ff4d6d,transparent);box-shadow:0 0 6px rgba(255,40,90,.7);opacity:.45;animation:fxscan 3.2s ease-in-out infinite}
@keyframes fxscan{0%{top:4%}50%{top:94%}100%{top:4%}}`;
// Effet par catégorie (cartes Épique et au-dessus) ; une série de 5+ matchs donne toujours la flamme
const BY = { nba: { pts: 'bolt', reb: 'water', ast: 'laser', tpm: 'gold', stl: 'toxic', blk: 'ice', pra: 'rainbow', pr: 'rainbow', pa: 'rainbow', ra: 'rainbow' }, nhl: { g: 'bolt', a: 'laser', p: 'rainbow' } };
export const fxFor = (r, sport, rar) => (r.streak >= 5 ? 'flame' : rar === 'rar' || rar === 'com' ? '' : (BY[sport] || {})[r.stat] || '');
