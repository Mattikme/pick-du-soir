// Contrôle avant publication : le nouveau modèle (lib/lignes-model.js) est comparé à l'ancien. Sort en erreur au moindre doute.
// Usage : node etude/controle.mjs <copie de l'ancien modèle (.mjs)>
import fs from 'fs';
import { pathToFileURL } from 'url';
const old = (await import(pathToFileURL(process.argv[2]).href)).default, neu = (await import('../lib/lignes-model.js')).default;
const MIN_TOP4 = { nba: 0.60, nhl: 0.58 }, pb = [], lines = [];
for (const lg of ['nba', 'nhl']) {
  const a = old[lg], b = neu[lg];
  if (!(b.top4 >= MIN_TOP4[lg])) pb.push(`${lg} : réussite des 4 premières lignes trop basse (${b.top4})`);
  if (!(b.top4 >= a.top4 - 0.04)) pb.push(`${lg} : réussite en baisse de plus de 4 points (${a.top4} → ${b.top4})`);
  if (!(b.auc >= 0.55)) pb.push(`${lg} : modèle trop peu discriminant (AUC ${b.auc})`);
  if (!(b.trained_rows >= a.trained_rows)) pb.push(`${lg} : moins de données qu'avant (${a.trained_rows} → ${b.trained_rows})`);
  for (const k of ['lo', 'loPlus', 'hi', 'minT', 'minT20', 'feats', 'minLine']) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) pb.push(`${lg} : réglage « ${k} » modifié`);
  lines.push(`| ${lg.toUpperCase()} | ${a.top4} → ${b.top4} | ${a.top10} → ${b.top10} | ${a.trained_rows} → ${b.trained_rows} | ${b.oos_days} |`);
}
const md = `### Modèle des lignes\n\n| Ligue | 4 premières lignes | 10 premières | Lignes d'apprentissage | Soirs testés |\n|---|---|---|---|---|\n${lines.join('\n')}\n\n${pb.length ? '**Refusé :**\n- ' + pb.join('\n- ') : '**Contrôles passés.**'}\n`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(pb.length ? 1 : 0);
