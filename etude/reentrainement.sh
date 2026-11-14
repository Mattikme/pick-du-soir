#!/usr/bin/env bash
# Réentraînement du modèle des lignes, de bout en bout : export des matchs, apprentissage, contrôles, publication, vérification du site.
# Lancé chaque lundi par .github/workflows/reentrainement.yml. À la main : DATABASE_URL=... PUBLIER=1 bash etude/reentrainement.sh
# Sans PUBLIER=1, tout est calculé et contrôlé mais rien n'est publié ni modifié (essai à blanc).
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
if [ "${PUBLIER:-0}" != "1" ]; then annuler; echo "Essai à blanc : contrôles passés, rien de publié."; exit 0; fi

construire() { npx --yes esbuild functions/index.js --bundle --minify --platform=node --target=node24 --format=esm --loader:.txt=text --log-level=error --outfile=dist/index.mjs && node --check dist/index.mjs; }
site_ok() { for p in "/algo" "/algo?sport=nhl"; do s="?"; case "$p" in *\?*) s="&";; esac
  curl -fsS -m 40 "https://www.pickdusoir.fr$p${s}v=$(date +%s)" | grep -q "Plus ou moins" || return 1; done; }
( umask 077; printf '%s' "$DATABASE_URL" > "$T/db.url" )
construire
node publish.mjs "$T/db.url"
sleep 40   # le site recharge le code publié en 20 secondes au plus
if ! site_ok; then
  trap - ERR
  annuler; construire; node publish.mjs "$T/db.url"
  echo "::error::Le site ne répondait plus correctement après publication : ancienne version remise en ligne."; exit 1
fi
echo "Nouveau modèle publié et site vérifié."
