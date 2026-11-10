// Score fantasy du soir : stats positives moins stats négatives.
// Barème public TTFL : points, rebonds, passes, interceptions, contres,
// tirs réussis (2pts, 3pts, LF) — moins tirs ratés et ballons perdus.
export function fantasyScore(s) {
  const pos = s.pts + s.reb + s.ast + s.stl + s.blk + s.fgm + s.tpm + s.ftm;
  const neg = (s.fga - s.fgm) + (s.tpa - s.tpm) + (s.fta - s.ftm) + s.tov;
  return pos - neg;
}

// "PT34M12.00S" -> 34.2
export function parseMinutes(iso) {
  if (!iso) return 0;
  const m = /PT(?:(\d+)M)?(?:([\d.]+)S)?/.exec(iso);
  if (!m) return 0;
  return Math.round(((+m[1] || 0) + (+m[2] || 0) / 60) * 10) / 10;
}

export function slugify(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Date "du soir" côté US (America/New_York)
export function usDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}
