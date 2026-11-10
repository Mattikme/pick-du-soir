// Personnages cartoon originaux (mannequins neutres aux couleurs du maillot) — aucun joueur réel, aucun visage réel.
const INK = '#0D1020', SKIN = '#D9DEE8', SKIN2 = '#BFC6D6';
const HAIRS = ['#1B1B1F', '#4A3426', '#8A5A33', '#D9B45B', '#B5482A'];

const limb = (pts, w, fill) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 9}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

function head(x, y, hair, style, helmet, c1) {
  const face = `<circle cx="${x}" cy="${y}" r="44" fill="${SKIN}" stroke="${INK}" stroke-width="9"/>
    <ellipse cx="${x - 15}" cy="${y + 2}" rx="8.5" ry="10.5" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="${x + 15}" cy="${y + 2}" rx="8.5" ry="10.5" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="${x - 13}" cy="${y + 4}" r="4.6" fill="${INK}"/><circle cx="${x + 17}" cy="${y + 4}" r="4.6" fill="${INK}"/>
    <path d="M${x - 24} ${y - 14} L${x - 6} ${y - 10} M${x + 6} ${y - 10} L${x + 24} ${y - 14}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${x - 12} ${y + 24} Q${x} ${y + 34} ${x + 12} ${y + 24}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (helmet) return face + `<path d="M${x - 47} ${y - 4} Q${x - 46} ${y - 52} ${x} ${y - 52} Q${x + 46} ${y - 52} ${x + 47} ${y - 4} L${x + 40} ${y - 14} Q${x} ${y - 30} ${x - 40} ${y - 14} Z" fill="${c1}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  const H = {
    short: `<path d="M${x - 45} ${y - 6} Q${x - 50} ${y - 54} ${x} ${y - 52} Q${x + 50} ${y - 54} ${x + 45} ${y - 6} Q${x + 30} ${y - 30} ${x} ${y - 28} Q${x - 30} ${y - 30} ${x - 45} ${y - 6} Z"`,
    tall: `<path d="M${x - 40} ${y - 8} L${x - 36} ${y - 66} L${x + 36} ${y - 66} L${x + 40} ${y - 8} Q${x + 28} ${y - 28} ${x} ${y - 28} Q${x - 28} ${y - 28} ${x - 40} ${y - 8} Z"`,
    bun: `<path d="M${x - 46} ${y - 4} Q${x - 52} ${y - 56} ${x} ${y - 54} Q${x + 52} ${y - 56} ${x + 46} ${y - 4} Q${x + 30} ${y - 28} ${x} ${y - 26} Q${x - 30} ${y - 28} ${x - 46} ${y - 4} Z"`,
  }[style];
  if (!H) return face;
  return face + `${H} fill="${hair}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>` + (style === 'bun' ? `<circle cx="${x}" cy="${y - 62}" r="17" fill="${hair}" stroke="${INK}" stroke-width="7"/>` : '');
}
const shoe = (x, y, dir = 1) => `<path d="M${x - 24 * dir} ${y - 12} L${x + 6 * dir} ${y - 12} Q${x + 34 * dir} ${y - 10} ${x + 34 * dir} ${y + 6} L${x - 24 * dir} ${y + 6} Z" fill="#fff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/><path d="M${x - 24 * dir} ${y + 2} L${x + 34 * dir} ${y + 2}" stroke="${INK}" stroke-width="5"/>`;
const ball = (x, y, r = 28) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#F27A2A" stroke="${INK}" stroke-width="7"/><path d="M${x - r} ${y} L${x + r} ${y} M${x} ${y - r} L${x} ${y + r}" stroke="${INK}" stroke-width="4"/><path d="M${x - r * 0.7} ${y - r * 0.7} Q${x} ${y} ${x - r * 0.7} ${y + r * 0.7} M${x + r * 0.7} ${y - r * 0.7} Q${x} ${y} ${x + r * 0.7} ${y + r * 0.7}" fill="none" stroke="${INK}" stroke-width="4"/>`;
const num = (x, y, n, c2, size = 44, rot = 0) => (n || n === 0 ? `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" text-anchor="middle" font-family="Big Shoulders Display,Impact,sans-serif" font-weight="900" font-size="${size}" fill="${c2}" stroke="${INK}" stroke-width="2.5" paint-order="stroke">${n}</text>` : '');

const POSES = {
  // basket : tir en suspension
  shoot: (o) => ({ vb: '0 0 360 540', svg:
    limb([[168, 372], [150, 430], [128, 470]], 26, SKIN) + limb([[200, 372], [226, 424], [248, 458]], 26, SKIN) + shoe(124, 488, -1) + shoe(256, 476, 1)
    + limb([[172, 330], [172, 372]], 52, o.shorts) + limb([[200, 330], [200, 372]], 52, o.shorts)
    + limb([[186, 160], [186, 318]], 86, o.c1) + `<path d="M150 190 L222 190" stroke="${o.c2}" stroke-width="9" stroke-linecap="round"/>` + num(186, 282, o.n, o.c2, 56)
    + limb([[152, 170], [118, 150], [138, 96]], 26, SKIN) + limb([[220, 170], [258, 140], [236, 70]], 26, SKIN)
    + head(188, 108, o.hair, o.hs, false, o.c1).replace(/^/, '') + ball(190, 36) }),
  // basket : dribble
  dribble: (o) => ({ vb: '0 0 360 540', svg:
    limb([[170, 372], [136, 432], [118, 488]], 26, SKIN) + limb([[206, 372], [240, 424], [268, 480]], 26, SKIN) + shoe(114, 506, -1) + shoe(274, 498, 1)
    + limb([[172, 334], [172, 372]], 52, o.shorts) + limb([[204, 334], [206, 372]], 52, o.shorts)
    + limb([[190, 178], [186, 320]], 84, o.c1) + `<path d="M150 208 L226 208" stroke="${o.c2}" stroke-width="9" stroke-linecap="round"/>` + num(188, 296, o.n, o.c2, 54)
    + limb([[154, 186], [112, 232], [104, 300]], 25, SKIN) + ball(104, 346, 30) + limb([[224, 186], [262, 222], [286, 196]], 25, SKIN)
    + head(196, 124, o.hair, o.hs, false, o.c1) }),
  // basket : dunk
  dunk: (o) => ({ vb: '0 0 360 540', svg:
    limb([[168, 360], [128, 392], [92, 440]], 26, SKIN) + limb([[202, 360], [244, 388], [286, 424]], 26, SKIN) + shoe(86, 456, -1) + shoe(296, 440, 1)
    + limb([[172, 322], [170, 362]], 52, o.shorts) + limb([[204, 322], [206, 362]], 52, o.shorts)
    + limb([[188, 150], [188, 312]], 86, o.c1) + `<path d="M152 182 L226 182" stroke="${o.c2}" stroke-width="9" stroke-linecap="round"/>` + num(188, 270, o.n, o.c2, 56)
    + limb([[220, 166], [250, 120], [244, 52]], 26, SKIN) + ball(246, 26, 28) + limb([[154, 168], [116, 196], [92, 238]], 25, SKIN)
    + head(184, 100, o.hair, o.hs, false, o.c1) }),
  // hockey : patineur
  skate: (o) => ({ vb: '0 0 420 540', svg:
    limb([[186, 366], [244, 410], [226, 474]], 28, o.pants) + limb([[170, 362], [112, 392], [58, 452]], 28, o.pants)
    + `<path d="M196 486 L270 486 M26 462 L100 462" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M204 468 L256 468 L262 480 L196 480 Z M42 446 L92 446 L98 458 L36 458 Z" fill="#fff" stroke="${INK}" stroke-width="6"/>`
    + limb([[178, 190], [166, 328]], 92, o.c1) + `<path d="M130 232 L214 224 M128 252 L212 244" stroke="${o.c2}" stroke-width="8" stroke-linecap="round"/>` + num(172, 288, o.n, o.c2, 44)
    + limb([[174, 330], [182, 372]], 58, o.pants)
    + limb([[212, 208], [262, 252], [318, 292]], 26, o.c1) + limb([[142, 214], [186, 262], [296, 280]], 24, o.c1)
    + limb([[318, 292], [366, 452]], 9, '#8A5A2B') + `<path d="M356 458 L420 458" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M356 458 L420 458" stroke="#2B2B33" stroke-width="7" stroke-linecap="round"/>`
    + head(196, 134, o.hair, o.hs, true, o.c1) }),
  slap: (o) => ({ vb: '0 0 420 540', svg:
    limb([[188, 366], [250, 408], [236, 474]], 28, o.pants) + limb([[170, 362], [120, 396], [70, 456]], 28, o.pants)
    + `<path d="M204 486 L282 486 M38 466 L112 466" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M212 468 L268 468 L274 480 L204 480 Z M52 450 L104 450 L110 462 L46 462 Z" fill="#fff" stroke="${INK}" stroke-width="6"/>`
    + limb([[176, 194], [168, 332]], 92, o.c1) + `<path d="M132 236 L216 230 M130 256 L214 250" stroke="${o.c2}" stroke-width="8" stroke-linecap="round"/>` + num(172, 290, o.n, o.c2, 44)
    + limb([[176, 334], [184, 372]], 58, o.pants)
    + limb([[214, 210], [276, 196], [330, 140]], 26, o.c1) + limb([[144, 218], [214, 170], [296, 120]], 24, o.c1)
    + limb([[310, 70], [372, 390]], 9, '#8A5A2B') + `<path d="M362 396 L420 396" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M362 396 L420 396" stroke="#2B2B33" stroke-width="7" stroke-linecap="round"/><ellipse cx="404" cy="428" rx="20" ry="8" fill="${INK}"/>`
    + head(190, 138, o.hair, o.hs, true, o.c1) }),
  sweep: (o) => ({ vb: '0 0 420 540', svg:
    limb([[186, 366], [240, 414], [262, 474]], 28, o.pants) + limb([[170, 362], [140, 416], [104, 474]], 28, o.pants)
    + `<path d="M228 486 L306 486 M72 486 L148 486" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M236 468 L292 468 L298 480 L228 480 Z M80 468 L134 468 L140 480 L72 480 Z" fill="#fff" stroke="${INK}" stroke-width="6"/>`
    + limb([[180, 188], [172, 326]], 92, o.c1) + `<path d="M136 230 L218 224 M134 250 L216 244" stroke="${o.c2}" stroke-width="8" stroke-linecap="round"/>` + num(176, 286, o.n, o.c2, 44)
    + limb([[178, 328], [186, 372]], 58, o.pants)
    + limb([[146, 212], [96, 262], [60, 330]], 25, o.c1) + limb([[216, 206], [176, 270], [118, 342]], 24, o.c1)
    + limb([[60, 330], [30, 466]], 9, '#8A5A2B') + `<path d="M4 472 L66 472" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M4 472 L66 472" stroke="#2B2B33" stroke-width="7" stroke-linecap="round"/>`
    + head(196, 130, o.hair, o.hs, true, o.c1) }),
};

export const NBA_POSES = ['shoot', 'dribble', 'dunk'], NHL_POSES = ['skate', 'slap', 'sweep'];
export function avatar(sport, id, c1, c2, n) {
  const k = Math.abs(Number(id) || 0), poses = sport === 'nhl' ? NHL_POSES : NBA_POSES, pose = poses[k % 3];
  const o = { c1, c2, n, shorts: shade(c1, 0.78), pants: shade(c1, 0.55), hair: HAIRS[(k >> 2) % HAIRS.length], hs: ['short', 'tall', 'bun', null][(k >> 4) % 4] };
  return { pose, ...POSES[pose](o) };
}
export const avatarSvg = (sport, id, c1, c2, n, cls = 'av') => { const a = avatar(sport, id, c1, c2, n); return `<svg class="${cls}" viewBox="${a.vb}" aria-hidden="true">${a.svg}</svg>`; };

// couleurs lisibles sur fond d'équipe : maillot en couleur secondaire, liseré et numéro dans la couleur principale
export const jerseyColors = (c1, c2, artColor) => [artColor(c2), c1];
