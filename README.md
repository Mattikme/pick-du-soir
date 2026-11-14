# Pick du Soir

Site de stats NBA/NHL (séries / hit-rate) + publication automatique sur X. Fonction serverless Neon `pickdusoir`.

- `functions/index.js` : routes du site, tâches (`/run?job=...&key=CRON_SECRET`), publication X (cartes, bilans, sondage)
- `lib/` : stats (trends, site, nhl-site), cartes images (xcards.js, xpost.js), interface (ui.js)
- `publish.mjs` : publication de la fonction ; `dist/` est généré (esbuild)
- Variables nécessaires (jamais dans le dépôt) : DATABASE_URL, CRON_SECRET, clés X

Build : `npx esbuild functions/index.js --bundle --minify --platform=node --target=node24 --format=esm --loader:.txt=text --outfile=dist/index.mjs`

## Lignes du soir (Plus/Moins)
- `lib/lignes.js` : ligne de référence au demi-point par joueur et par stat, probabilité Plus/Moins, sélection du soir. `lib/algo.js` : suivi public (table `algo_picks`).
- `lib/lignes-model.js` : coefficients générés par `etude/lignes.py` (ne pas modifier à la main).
- Réentraîner : `DATABASE_URL=... node etude/dump.mjs`, puis `python3 etude/lignes.py nba v` et `python3 etude/lignes.py nhl v`, `node etude/assemble.mjs .` (écrit `lib/lignes-model.js`), et vérifier avec `node etude/parite.mjs nba .` puis `nhl` (0 écart attendu). Une tâche planifiée refait tout cela chaque lundi et ne publie que si les contrôles passent.
- Test hors échantillon (janv.–nov. 2026) : 4 premières lignes du soir réussies à 66,6 % en NBA (464 lignes) et 64,3 % en NHL (516 lignes).

## Ce qui tourne tout seul
- `xtick` (toutes les 30 min, 8 h–21 h UTC) : lignes du soir par ligue (NBA 18 h, NHL 20 h, heure de Paris), bilan image du lendemain, sondage Plus/Moins et sa réponse, tweet de nouveauté, relevé des statistiques des tweets, et le lundi le bilan de la semaine (`xalgoweek`).
- `daily` / `evening` : calendrier, feuilles de match, blessures, séries.
- Le Défi du soir est arrêté (14 nov. 2026) : `/defi`, `/collection` et `/album` renvoient vers `/algo` ; le code reste dans `lib/game.js`.

## Publicité et pages légales
- Tout est éteint par défaut. Réglages dans la table `site_config` (voir l'en-tête de `lib/ads.js`) : `adsense_client`, `adsense_slots`, `interstitiel`, `editeur`, `hebergeur`.
- `/ads.txt`, `/mentions-legales`, `/confidentialite` sont servis par la fonction.

## Base
- `migrations/` : scripts à exécuter une fois sur la base avant de publier la version correspondante.

Légal (ANJ) : stats informatives, pas de cotes, mention « Stats informatives, pas un conseil de pari. »
