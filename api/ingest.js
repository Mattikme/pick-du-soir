import { syncSchedule, ingestPending, backfill, syncInjuries, buildPicks, log } from '../lib/jobs.js';

export const config = { maxDuration: 60 };

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url, 'http://x');
  return req.headers.authorization === `Bearer ${secret}` || url.searchParams.get('key') === secret;
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  const q = new URL(req.url, 'http://x').searchParams;
  const job = q.get('job') || 'daily';
  const out = {};
  try {
    if (job === 'daily') {          // le matin (heure FR) : résultats de la nuit + picks
      out.schedule = await syncSchedule();
      out.boxscores = await ingestPending(80);
      out.injuries = await syncInjuries();
      out.picks = await buildPicks();
    } else if (job === 'evening') { // avant les matchs : blessures à jour + picks recalculés
      out.injuries = await syncInjuries();
      out.picks = await buildPicks();
    } else if (job === 'schedule') out.schedule = await syncSchedule();
    else if (job === 'boxscores') out.boxscores = await ingestPending(+q.get('limit') || 60);
    else if (job === 'backfill') out.backfill = await backfill(+q.get('season'), +q.get('from'), +q.get('to'));
    else if (job === 'injuries') out.injuries = await syncInjuries();
    else if (job === 'picks') out.picks = await buildPicks(q.get('date') || undefined);
    else return res.status(400).json({ error: 'job inconnu' });
    await log(job, true, out);
    res.status(200).json({ ok: true, job, ...out });
  } catch (e) {
    await log(job, false, { error: String(e), ...out }).catch(() => {});
    res.status(500).json({ ok: false, job, error: String(e), ...out });
  }
}
