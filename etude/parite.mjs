// Contrôle de parité : lib/lignes.js doit redonner les mêmes lignes et probabilités que etude/lignes.py.
// Usage : node parite.mjs nba|nhl <dossier contenant nba.json / vecteurs_nba.json>
import fs from 'fs';
const [lg, dir] = process.argv.slice(2);
process.env.DATABASE_URL ||= 'postgresql://x:x@x.x.neon.tech/x'; // aucune requête : seuls les calculs sont testés
const { refLine, probPlus, MODELS } = await import('../lib/lignes.js');
const M = MODELS[lg], rows = JSON.parse(fs.readFileSync(`${dir}/${lg}.json`)), vec = JSON.parse(fs.readFileSync(`${dir}/vecteurs_${lg}.json`));
const val = lg === 'nba'
  ? { pts: (g) => +g.pts, reb: (g) => +g.reb, ast: (g) => +g.ast, tpm: (g) => +g.tpm, pra: (g) => +g.pts + +g.reb + +g.ast, pr: (g) => +g.pts + +g.reb, pa: (g) => +g.pts + +g.ast, ra: (g) => +g.reb + +g.ast }
  : { sog: (g) => +g.sog };
const min = lg === 'nba' ? (g) => +g.min : (g) => +g.toi / 60;
const by = new Map(); for (const r of rows) { if (!by.has(r.pid)) by.set(r.pid, []); by.get(r.pid).push(r); }
let n = 0, bad = 0, maxd = 0;
for (const t of vec) {
  const gs = by.get(t.pid), i = gs.findIndex((g) => String(g.gid) === String(t.gid)), h = gs.slice(0, i);
  const v = h.map(val[t.stat]), mins = h.map(min), L = refLine(v);
  const rest = Math.round((Date.parse(t.d) - Date.parse(h[h.length - 1].d)) / 864e5);
  const p = probPlus(M, v, mins, L, { home: +gs[i].home === 1, rest, oppr: t.oppr });
  const d = Math.abs(p - t.p); n++; if (L !== t.L || d > 1e-6) bad++; if (d > maxd) maxd = d;
}
console.log(lg, n, 'lignes comparées ;', bad, 'écarts ; écart max', maxd.toExponential(2));
process.exit(bad ? 1 : 0);
