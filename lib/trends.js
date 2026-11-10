// Séries de stats (hit rates) : combien de fois un joueur a atteint un palier sur ses derniers matchs
export const STATS = {
  pts: { label: 'points', short: 'pts', ladder: [10, 15, 20, 25, 30, 35, 40], val: (g) => g.pts },
  reb: { label: 'rebonds', short: 'reb', ladder: [4, 6, 8, 10, 12, 14], val: (g) => g.reb },
  ast: { label: 'passes', short: 'pas', ladder: [3, 4, 6, 8, 10, 12], val: (g) => g.ast },
  tpm: { label: 'paniers à 3 pts', short: 'tirs à 3 pts', ladder: [1, 2, 3, 4, 5], val: (g) => g.tpm },
  stl: { label: 'interceptions', short: 'int', ladder: [1, 2, 3, 4], val: (g) => g.stl },
  blk: { label: 'contres', short: 'ct', ladder: [1, 2, 3, 4, 5], val: (g) => g.blk },
  pra: { label: 'points + rebonds + passes', short: 'pts+reb+pas', ladder: [15, 20, 25, 30, 35, 40, 45, 50], val: (g) => g.pts + g.reb + g.ast },
  pr: { label: 'points + rebonds', short: 'pts+reb', ladder: [10, 15, 20, 25, 30, 35, 40, 45], val: (g) => g.pts + g.reb },
  pa: { label: 'points + passes', short: 'pts+pas', ladder: [10, 15, 20, 25, 30, 35, 40, 45], val: (g) => g.pts + g.ast },
  ra: { label: 'rebonds + passes', short: 'reb+pas', ladder: [5, 8, 10, 12, 15, 18, 20], val: (g) => g.reb + g.ast },
};

// games : matchs du joueur, du plus récent au plus ancien (minutes > 0, saison régulière)
export function ladder(games, statKey, oppId, custom) {
  const st = STATS[statKey];
  const recent = games.filter((g) => !g.rn || Number(g.rn) <= 20);
  const v = recent.map(st.val);
  const vs = games.filter((g) => oppId && Number(g.opp_team_id) === Number(oppId)).slice(0, 6).map(st.val);
  const rate = (arr, t) => [arr.filter((x) => x >= t).length, arr.length];
  return (custom || st.ladder).map((t) => {
    let streak = 0;
    for (const x of v) { if (x >= t) streak++; else break; }
    const [l5, n5] = rate(v.slice(0, 5), t), [l10, n10] = rate(v.slice(0, 10), t), [l20, n20] = rate(v.slice(0, 20), t), [h2h, nh2h] = rate(vs, t);
    return { threshold: t, l5, n5, l10, n10, l20, n20, h2h, nh2h, streak };
  });
}

// Meilleure série d'un joueur pour une stat : le palier le plus haut tenu au moins 8 fois sur 10 et 4 fois sur 5.
// Le score combine la régularité et l'exigence du palier (palier / moyenne sur 10 matchs) :
// « 30+ points pour un joueur à 32 de moyenne » vaut plus que « 4+ rebonds pour un joueur à 9 ».
// Ligne de référence (type « ligne du marché ») : forme de saison et des 10 derniers matchs, arrondie au demi.
export function refLine(vals) {
  if (!vals.length) return null;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const L = Math.round((0.6 * mean(vals.slice(0, 40)) + 0.4 * mean(vals.slice(0, 10))) * 2) / 2;
  return Math.max(L, 0.5);
}

export function bestLine(games, statKey, oppId, minRatio = 0.6) {
  const st = STATS[statKey];
  if (minRatio > 0) {
    const v = games.filter((g) => !g.rn || Number(g.rn) <= 40).map(st.val);
    const L = refLine(v);
    if (L === null || v.length < 10) return null;
    const t = Math.floor(L) + 1;
    const r = ladder(games, statKey, oppId, [t])[0];
    if (r.n10 < 10 || r.l10 < 7 || r.l5 < 3) return null;
    const hit = 0.45 * (r.l10 / r.n10) + 0.25 * (r.l5 / r.n5) + 0.3 * (r.l20 / Math.max(1, r.n20));
    return { ...r, line: L, ratio: 1, score: Math.round((hit + Math.min(r.streak, 20) * 0.004) * 1000) / 1000 };
  }
  const last10 = games.filter((g) => !g.rn || Number(g.rn) <= 10).slice(0, 10).map(st.val);
  const avg = last10.length ? last10.reduce((s, x) => s + x, 0) / last10.length : 0;
  const rows = ladder(games, statKey, oppId).reverse();
  for (const r of rows) {
    if (r.n10 < 10 || r.l10 < 8 || r.l5 < 4) continue;
    const ratio = avg ? Math.min(r.threshold / avg, 1) : 0;
    if (ratio < minRatio) return null;
    const hit = 0.45 * (r.l10 / r.n10) + 0.25 * (r.l5 / r.n5) + 0.3 * (r.l20 / Math.max(1, r.n20));
    // le premier palier (1 tir à 3 pts, 3 passes...) est peu parlant : léger malus
    const floor = r.threshold === st.ladder[0] ? 0.08 : 0;
    const score = 0.55 * hit + 0.45 * ratio + Math.min(r.streak, 20) * 0.002 - floor;
    return { ...r, ratio, score: Math.round(score * 1000) / 1000 };
  }
  return null;
}
