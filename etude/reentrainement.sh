#!/usr/bin/env bash
# Réentraînement du modèle des lignes : export des matchs, apprentissage, contrôles, vérification du build.
# Lancé par .github/workflows/reentrainement.yml. À la main : DATABASE_URL=... PUBLIER=1 bash etude/reentrainement.sh
# Avec PUBLIER=1, le nouveau modèle reste dans lib/lignes-model.js : le workflow l'enregistre dans le dépôt,
# ce qui déclenche le déploiement Vercel. Sans PUBLIER=1, tout est calculé et contrôlé puis l'ancien modèle est remis (essai à blanc).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${DATABASE_URL:-}" ]; then echo "::warning::Secret DATABASE_URL absent : réentraînement non fait."; exit 0; fi
T="$(mktemp -d)"
cp "$ROOT/lib/lignes-model.js" "$T/ancien-modele.mjs"
annuler() { cp "$T/ancien-modele.mjs" "$ROOT/lib/lignes-model.js"; }
trap 'annuler; echo "::error::Réentraînement arrêté : ancien modèle conservé, rien de publié."' ERR
trap 'rm -rf "$T"' EXIT

cd "$T"
node "$ROOT/etude/dump.mjs"
python3 "$ROOT/etude/lignes.py" nba v
python3 "$ROOT/etude/lignes.py" nhl v
node "$ROOT/etude/assemble.mjs" "$T"
node "$ROOT/etude/parite.mjs" nba "$T"     # le site doit calculer exactement comme l'étude
node "$ROOT/etude/parite.mjs" nhl "$T"
node "$ROOT/etude/controle.mjs" "$T/ancien-modele.mjs"

cd "$ROOT"
npm run build --silent                    # le site doit se construire avec le nouveau modèle
if [ "${PUBLIER:-0}" != "1" ]; then annuler; echo "Essai à blanc : contrôles passés, rien de publié."; exit 0; fi
echo "Contrôles passés : nouveau modèle prêt dans lib/lignes-model.js."
