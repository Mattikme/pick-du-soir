# Pick du Soir

Site de stats NBA/NHL (séries / hit-rate) + publication automatique sur X. Fonction serverless Neon `pickdusoir`.

- `functions/index.js` : routes du site, tâches (`/run?job=...&key=CRON_SECRET`), publication X (cartes, bilans, sondage)
- `lib/` : stats (trends, site, nhl-site), cartes images (xcards.js, xpost.js), interface (ui.js)
- `publish.mjs` : publication de la fonction ; `dist/` est généré (esbuild)
- Variables nécessaires (jamais dans le dépôt) : DATABASE_URL, CRON_SECRET, clés X

Build : `npx esbuild functions/index.js --bundle --minify --platform=node --target=node24 --format=esm --loader:.txt=text --outfile=dist/index.mjs`

Légal (ANJ) : stats informatives, pas de cotes, mention « Stats informatives, pas un conseil de pari. »
