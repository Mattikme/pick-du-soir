// Traduit les brèves blessures (ESPN, en anglais) en une phrase courte en français.
// Pas de traduction mot à mot : on repère la raison (genou, repos...), l'événement
// (forfait, opéré, réévalué dans X semaines...) et le match concerné, puis on recompose.

const DAYS = { Monday: 'lundi', Tuesday: 'mardi', Wednesday: 'mercredi', Thursday: 'jeudi', Friday: 'vendredi', Saturday: 'samedi', Sunday: 'dimanche' };
const NUM = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, couple: 2, few: 3 };
const SIDE = { left: ['gauche', 'gauche'], right: ['droit', 'droite'] };
const PLURAL = /ischio|adducteurs|abdominaux|côtes|dents|quadriceps/;

// [motif anglais, traduction, genre féminin ?]  (ordre : du plus précis au plus général)
const PARTS = [
  [/rotator cuff/i, 'coiffe des rotateurs', 1], [/plantar fascia/i, 'fascia plantaire'], [/plantar plate/i, 'plaque plantaire', 1],
  [/patellar tendon/i, 'tendon rotulien'], [/achilles/i, "tendon d'Achille"], [/\bacl\b/i, 'ligament croisé'], [/\bmcl\b/i, 'ligament interne du genou'],
  [/meniscus/i, 'ménisque'], [/labrum/i, 'labrum'], [/hamstring/i, 'ischio-jambiers'], [/quad(riceps)?/i, 'quadriceps'],
  [/adductor/i, 'adducteurs'], [/groin/i, 'aine', 1], [/calf/i, 'mollet'], [/ankle/i, 'cheville', 1], [/knee/i, 'genou'],
  [/\bhip\b/i, 'hanche', 1], [/lower[- ]?(leg|body)/i, 'bas du corps'], [/upper body/i, 'haut du corps'], [/\bback\b/i, 'dos'],
  [/foot|feet/i, 'pied'], [/\btoe\b/i, 'orteil'], [/heel/i, 'talon'], [/shin/i, 'tibia'], [/thigh/i, 'cuisse', 1],
  [/shoulder/i, 'épaule', 1], [/elbow/i, 'coude'], [/wrist/i, 'poignet'], [/thumb/i, 'pouce'], [/finger/i, 'doigt'], [/\bhand\b/i, 'main', 1],
  [/neck/i, 'cou'], [/\brib/i, 'côtes'], [/chest/i, 'poitrine', 1], [/oblique/i, 'oblique'], [/abdom/i, 'abdominaux'],
  [/concussion/i, 'commotion cérébrale'], [/\beye\b/i, 'œil'], [/nose/i, 'nez'], [/dental|tooth|teeth/i, 'dents'],
  [/illness|sick/i, 'maladie'], [/reconditioning/i, 'remise en forme'], [/general soreness/i, 'courbatures'],
  [/coach'?s decision/i, "choix de l'entraîneur"], [/personal/i, 'raisons personnelles'], [/\brest\b/i, 'repos'],
  [/undisclosed/i, 'raison non communiquée'], [/contusion/i, 'contusion'],
];
const KIND = [
  [/torn|tear|rupture/i, 'déchirure'], [/fractur|broken/i, 'fracture'], [/sprain/i, 'entorse'],
  [/strain/i, 'élongation'], [/subluxation/i, 'subluxation'], [/soreness|sore\b/i, 'douleur'], [/inflammation/i, 'inflammation'],
  [/contusion|bruise/i, 'contusion'],
];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s) => String(s || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function partOf(text) {
  for (const [re, fr, fem] of PARTS) if (re.test(text)) return { fr, fem };
  return null;
}

// Raison : d'abord la parenthèse « (knee) », sinon la blessure décrite dans la phrase
function reasonOf(text) {
  const par = text.match(/^[^(]{0,60}\(([^)]+)\)/);
  if (par) {
    const items = par[1].split(/,\s*/).map((x) => partOf(x)?.fr).filter(Boolean);
    if (items.length) return items.join(', ');
  }
  if (/for rest purposes|due to rest|\brest\b/i.test(text) && !/rest of|remainder/i.test(text)) {
    if (/due to rest|for rest purposes/i.test(text)) return 'repos';
  }
  const part = partOf(text);
  if (!part) return null;
  const kind = KIND.find(([re]) => re.test(text))?.[1];
  const side = text.match(/\b(left|right)\b/i)?.[1]?.toLowerCase();
  let p = part.fr;
  const NOSIDE = /repos|maladie|raison|choix|courbatures|remise|commotion|contusion|bas du|haut du|dos|cou|nez|poitrine/;
  if (side && !NOSIDE.test(p)) p += ' ' + SIDE[side][part.fem ? 1 : 0] + (PLURAL.test(p) ? 's' : '');
  if (!kind || NOSIDE.test(p) || /underwent surgery|has undergone surgery|had surgery/i.test(text)) return p;
  const prep = /^[aeiouéèêœ]/i.test(p) ? "à l'" : part.fem ? 'à la ' : PLURAL.test(p) ? 'aux ' : 'au ';
  return `${kind} ${prep}${p}`;
}

function durationOf(text) {
  const m = text.match(/\b(?:at least |approximately |about |roughly |another |the next )?(a couple(?: of)?|a few|\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)(?:-to-\w+| to \w+)? (weeks?|months?)\b/i);
  if (!m) return null;
  const n = NUM[m[1].toLowerCase().replace(/^a /, '').replace(/ of$/, '')] ?? (Number.parseInt(m[1], 10) || null);
  const unit = /month/i.test(m[2]) ? 'mois' : n > 1 ? 'semaines' : 'semaine';
  return { n, unit, approx: /couple|few|approximately|about|roughly/i.test(m[0]), min: /at least/i.test(m[0]) };
}
const durFR = (d) => (d ? `${d.min ? 'au moins ' : d.approx ? 'environ ' : ''}${d.n} ${d.unit}` : '');

// Le match concerné : « Monday's preseason game against the Hawks » -> « le match de présaison de lundi contre les Hawks »
function gameOf(text) {
  const RE = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)'s\s+(?:[\d-]+\s+)?(preseason\s+|regular-season\s+)?(game|matchup|contest|exhibition(?: game)?|rematch|loss|win|practice|opener)?\s*(?:(against|versus|vs\.?|with|over|to|in|at)\s+(the\s+)?([A-Z0-9][\w'-]+(?:\s[A-Z][\w'-]+)?))?/g;
  const all = [...text.matchAll(RE)];
  const m = all.find((x) => !/practice/i.test(x[3] || '')) || all[0];
  if (m) {
    const day = DAYS[m[1]];
    const pre = m[2] && /pre/i.test(m[2]) ? ' de présaison' : '';
    const kind = m[3] || '';
    const opp = m[6] ? `${/^(in|at)$/i.test(m[4]) ? 'à' : 'contre'} ${m[5] ? 'les ' : ''}${m[6]}` : '';
    if (/practice/i.test(kind)) return { txt: day, bare: true };
    return { txt: `le match${pre} de ${day}${opp ? ' ' + opp : ''}` };
  }
  const d = text.match(/\b(?:won't|will not|didn't|did not)\s+(play|practice)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+(against|at|in)\s+(the\s+)?([A-Z0-9][\w'-]+(?:\s[A-Z][\w'-]+)?))?/);
  if (d && d[1] === 'practice') return { txt: DAYS[d[2]], bare: true };
  if (d) return { txt: `le match de ${DAYS[d[2]]}${d[5] ? ` ${/against/.test(d[3]) ? 'contre' : 'à'} ${d[4] ? 'les ' : ''}${d[5]}` : ''}` };
  const day = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/);
  return day ? { txt: DAYS[day[1]], bare: true } : null;
}

function eventOf(t, status) {
  const g = gameOf(t);
  const dur = durationOf(t);
  const forGame = g && !g.bare ? ` pour ${g.txt}` : '';
  const when = g?.bare ? ` ${g.txt}` : '';

  if (/season-ending|miss (?:the )?(?:remainder|rest) of the season|miss the 20\d\d-\d\d season|out for the season/i.test(t)) return 'Absent pour toute la saison';
  if (/(won't|will not) be ready for the start of the season|out for the start of the season/i.test(t)) return 'Ne sera pas prêt pour le début de la saison';
  if (/underwent surgery|has undergone surgery|had surgery|will undergo surgery/i.test(t)) {
    const fut = /will undergo/i.test(t);
    const after = /re-?evaluated/i.test(t) && dur ? `, sera réévalué dans ${durFR(dur)}` : dur ? `, absent ${durFR(dur)}` : /extended period/i.test(t) ? ', absent pour une longue période' : '';
    return `${fut ? 'Va être opéré' : 'Opéré'}${after}`;
  }
  if (/re-?evaluated/i.test(t)) return `Sera réévalué dans ${dur ? durFR(dur) : 'les prochains jours'}`;
  if (/miss (?:at least |the next |another |approximately |about )?(?:a couple|a few|\d+|one|two|three|four|five|six|seven|eight)/i.test(t) || (/expected to miss|will miss/i.test(t) && dur))
    return `Absent ${dur ? durFR(dur) : 'plusieurs semaines'}`;
  if (/(miss|not play (?:during|in)) the (?:rest of the )?preseason/i.test(t)) return 'Forfait pour toute la présaison';
  if (/remains away from the team/i.test(t)) return "Toujours éloigné de l'équipe";
  if (/went to the locker room|left (?:the game|.* game) early|exited/i.test(t)) return `A dû rentrer au vestiaire${g && !g.bare ? ` pendant ${g.txt}` : ' en cours de match'}`;
  if (/not (?:yet )?been cleared|hasn't been cleared|not cleared/i.test(t)) return 'Pas encore autorisé à reprendre';
  if (/isn't expected to play|is not expected to play|not expected to play|unlikely to play/i.test(t)) return `Ne devrait pas jouer${forGame || when}`;
  if (/questionable/i.test(t)) return `Incertain${forGame || when}`;
  if (/doubtful/i.test(t)) return `Douteux${forGame || when}`;
  if (/probable/i.test(t)) return `Probable${forGame || when}`;
  if (/did not play|didn't play|did not see the floor|was unavailable|sat out|was inactive/i.test(t)) return `N'a pas joué${g && !g.bare ? ` ${g.txt.replace(/^le match/, 'lors du match')}` : when}`;
  if (/won't play|will not play|won't suit up|will not suit up|won't be available|will not be available|is out\b|has been ruled out|ruled out|is not playing|isn't playing|is inactive|won't take the court/i.test(t)) return `Forfait${forGame || when}`;
  if (/didn't practice|did not practice|missed practice|sat out practice/i.test(t)) return `Absent à l'entraînement${when}`;
  if (/limited/i.test(t)) return `Entraînement allégé${when}`;
  if (/full participant|without restrictions|practiced fully|returned to practice|participated in .*practice|practiced\b/i.test(t)) return `A participé à l'entraînement${when}`;
  if (/day-to-day/i.test(t)) return 'Incertain, statut réévalué au jour le jour';
  if (/rehab|recover|progress|light on-court|individual (?:player development )?work|return timeline|return during|back early|month away/i.test(t)) {
    const season = t.match(/\b(20\d\d-\d\d) season/);
    if (season && /return/i.test(t)) return `En rééducation, retour espéré pendant la saison ${season[1]}`;
    const y = t.match(/\b(20\d\d)\b(?!-)/);
    if (/back early in (20\d\d)/i.test(t)) return `En convalescence, retour espéré début ${t.match(/back early in (20\d\d)/i)[1]}`;
    if (/month away/i.test(t)) return 'En convalescence, retour espéré dans environ un mois';
    return `En rééducation${y && /return/i.test(t) ? `, retour espéré en ${y[1]}` : ''}`;
  }
  if (/diagnosed/i.test(t)) return 'Blessure diagnostiquée';
  if (/dealing with/i.test(t)) return 'Gêné physiquement';
  return status === 'Out' ? 'Absent' : 'Incertain';
}

export function injuryFR(detail, status) {
  const text = clean(detail);
  if (!text) return '';
  // On ignore les phrases de stats du dernier match (« X ended with 11 points ... ») et on garde la brève blessure
  const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/);
  const useful = sentences.filter((s) => !/\(\d+-\d+ FG/.test(s) && !/^(He|She)?\s*\w+ (finished|ended|recorded|totaled|tallied|posted|had) /.test(s));
  const t = (useful.length ? useful : sentences).join(' ');
  const reason = reasonOf(t);
  const event = eventOf(t, status);
  return reason ? `${cap(reason)} : ${event[0].toLowerCase() + event.slice(1)}.` : `${event}.`;
}
