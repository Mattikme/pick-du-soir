const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Accept': 'application/json, text/plain, */*',
};

export const SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
export const boxUrl = (id) => `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`;
export const INJURIES_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';

export async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (r.status === 403 || r.status === 404) return null; // match pas encore dispo
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw last;
}

// Préfixe de gameId -> type de match
export function gameType(id) {
  const p = id.slice(0, 3);
  return { '001': 'pre', '002': 'reg', '003': 'allstar', '004': 'po', '005': 'playin', '006': 'cup' }[p] || 'other';
}

export function seasonFromId(id) {
  const y = 2000 + parseInt(id.slice(3, 5), 10);
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

// Exécute fn sur items avec une concurrence limitée
export async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { out[idx] = { error: String(e) }; }
    }
  });
  await Promise.all(workers);
  return out;
}
