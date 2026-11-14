// Recopie les modèles produits par etude/lignes.py (lignes_nba.json, lignes_nhl.json) dans lib/lignes-model.js.
// Usage : node etude/assemble.mjs <dossier contenant lignes_nba.json et lignes_nhl.json>
import fs from 'fs';
const dir = process.argv[2] || '.';
const o = { nba: JSON.parse(fs.readFileSync(`${dir}/lignes_nba.json`, 'utf8')), nhl: JSON.parse(fs.readFileSync(`${dir}/lignes_nhl.json`, 'utf8')) };
for (const [lg, M] of Object.entries(o)) if (M.league !== lg || !Array.isArray(M.coef) || M.coef.length !== M.feats.length || M.coef.some((x) => !Number.isFinite(x))) throw new Error('modèle invalide : ' + lg);
const out = new URL('../lib/lignes-model.js', import.meta.url);
fs.writeFileSync(out, '// Modèles « lignes Plus/Moins » (régression logistique, test walk-forward) : générés par etude/lignes.py, ne pas modifier à la main.\nexport default ' + JSON.stringify(o, null, 1) + ';\n');
for (const [lg, M] of Object.entries(o)) console.log(lg, 'lignes', M.trained_rows, '| soirs testés', M.oos_days, '| 4 premières', M.top4, '| 10 premières', M.top10, '| AUC', M.auc);
