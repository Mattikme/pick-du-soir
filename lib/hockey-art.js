// Silhouettes de hockey originales (dessinées en traits arrondis) — aucun joueur réel
const L = (a, b, c, d, w) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke-width="${w}"/>`;
const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" stroke-width="0"/>`;
const wrap = (inner) => `<g stroke="currentColor" fill="currentColor" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
const head = (x, y) => C(x, y, 27) + `<ellipse cx="${x - 2}" cy="${y - 10}" rx="30" ry="22" stroke-width="0"/>`;
const puck = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="9" stroke-width="0"/>`;

export const HOCKEY_ART = {
  // patineur penché en avant, crosse basse
  skate: { vb: '0 0 460 520', svg: wrap(
    head(215, 92) + L(212, 135, 175, 265, 60) + L(212, 148, 268, 214, 24) + L(268, 214, 322, 268, 20) + L(212, 150, 238, 238, 22) + L(238, 238, 300, 262, 18)
    + L(322, 268, 372, 420, 11) + L(366, 424, 428, 424, 12)
    + L(178, 262, 240, 335, 38) + L(240, 335, 208, 428, 28) + L(172, 440, 262, 440, 12) + L(208, 428, 232, 440, 22)
    + L(172, 268, 120, 346, 38) + L(120, 346, 52, 410, 28) + L(24, 424, 100, 424, 12) + L(52, 410, 66, 424, 22)
    + puck(405, 458)) },
  // tir frappé : crosse levée
  slap: { vb: '0 0 460 520', svg: wrap(
    head(190, 100) + L(194, 142, 180, 262, 62) + L(200, 156, 262, 140, 24) + L(262, 140, 318, 88, 20) + L(196, 160, 258, 202, 22) + L(258, 202, 304, 142, 18)
    + L(310, 100, 392, 330, 11) + L(386, 336, 448, 336, 12)
    + L(184, 262, 252, 340, 38) + L(252, 340, 226, 432, 28) + L(190, 444, 282, 444, 12) + L(226, 432, 250, 444, 22)
    + L(176, 270, 108, 330, 38) + L(108, 330, 58, 412, 28) + L(30, 426, 108, 426, 12) + L(58, 412, 72, 426, 22)
    + puck(420, 366)) },
  // glisse arrière-main, crosse devant
  sweep: { vb: '0 0 460 520', svg: wrap(
    head(170, 96) + L(176, 138, 190, 262, 60) + L(172, 152, 112, 212, 24) + L(112, 212, 70, 280, 20) + L(180, 154, 244, 214, 22) + L(244, 214, 196, 286, 18)
    + L(70, 280, 26, 424, 11) + L(18, 428, 84, 428, 12)
    + L(194, 262, 262, 330, 38) + L(262, 330, 262, 428, 28) + L(226, 442, 312, 442, 12) + L(262, 428, 280, 442, 22)
    + L(184, 270, 150, 352, 38) + L(150, 352, 126, 430, 28) + L(94, 444, 176, 444, 12) + L(126, 430, 148, 444, 22)
    + puck(120, 468)) },
};
export const hockeyPose = (id) => ['skate', 'slap', 'sweep'][Math.abs(Number(id) || 0) % 3];
export const hockeyInline = (pose, color) => { const a = HOCKEY_ART[pose] || HOCKEY_ART.skate; return { vb: a.vb, svg: a.svg.replace(/currentColor/g, color) }; };
