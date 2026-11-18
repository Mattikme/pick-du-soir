# Pick du Soir

Site de stats NBA/NHL (séries / hit-rate) + publication automatique sur X. Hébergé sur Vercel (Hobby), base Postgres Neon.

- `functions/index.js` : routes du site, tâches (`/run?job=...&key=CRON_SECRET`), publication X (cartes, bilans, sondage)
- `lib/` : stats (trends, site, nhl-site), cartes images (xcards.js, xpost.js), interface (ui.js)
- `api/index.js` : point d'entrée Vercel, réexporte `dist/index.mjs` (généré par esbuild) ; `vercel.json` renvoie toutes les URL vers lui
- Déploiement : chaque push sur `main` est déployé par Vercel
- Variables Vercel (jamais dans le dépôt) : DATABASE_URL, CRON_SECRET, clés X
- Secrets GitHub Actions : SITE_URL, CRON_SECRET (tâches planifiées), DATABASE_URL (réentraînement)

Build : `npm run build` (esbuild `functions/index.js` → `dist/index.mjs`, target node22, loader `.txt=text`)

## Lignes du soir (Plus/Moins)
- NBA seulement depuis le 16 nov. 2026 (tirs cadrés NHL non proposés en France) : `/algo?sport=nhl`, `/matchs-nhl-ce-soir` et `/nhl/match/...` redirigent (301) ; plus de tweets ni de sondage NHL. Le modèle NHL reste dans le code.
- `lib/lignes.js` : ligne de référence au demi-point par joueur et par stat, probabilité Plus/Moins, sélection du soir. `lib/algo.js` : suivi public (table `algo_picks`).
- `lib/lignes-model.js` : coefficients générés par `etude/lignes.py` (ne pas modifier à la main).
- Réentraîner : `DATABASE_URL=... node etude/dump.mjs`, puis `python3 etude/lignes.py nba v` et `python3 etude/lignes.py nhl v`, `node etude/assemble.mjs .` (écrit `lib/lignes-model.js`), et vérifier avec `node etude/parite.mjs nba .` puis `nhl` (0 écart attendu). Tout cela est enchaîné par `etude/reentrainement.sh`, lancé chaque semaine par GitHub Actions (tenté deux fois par jour, exécuté si le dernier réentraînement date de plus de 6 jours) (`.github/workflows/reentrainement.yml`, secret `DATABASE_URL` requis) : le modèle n'est enregistré dans le dépôt (donc déployé par Vercel) que si les contrôles de `etude/controle.mjs` passent, et le commit est annulé si le déploiement ou le site échoue.
- Test hors échantillon (janv.–nov. 2026) : 4 premières lignes du soir réussies à 66,6 % en NBA (464 lignes) et 64,3 % en NHL (516 lignes).

## Pages match et fiches joueur (SEO)
- `lib/match-pages.js` : une page par match (`/match/AAAA-MM-JJ/ext-dom`, `/nhl/match/...`) avec les lignes des deux équipes ; bloc « Sa ligne du soir » des fiches joueur (titre « [Joueur] stats ce soir : Plus ou Moins X points »).
- `lib/programme.js` : pages « Matchs NBA ce soir » (`/matchs-nba-ce-soir`) et NHL (`/matchs-nhl-ce-soir`), programme du prochain soir en heure de Paris avec un lien vers chaque page match ; bandeau sur les accueils NBA/NHL et lien en pied de page.
- Les lignes de tous les joueurs d'un soir viennent de `nightBoard()` (`lib/lignes.js`, gardé 10 min en mémoire). Sitemap : matchs NBA de J-3 à J+2, joueurs de la saison en cours avec `lastmod` (date du dernier match).

## Ce qui tourne tout seul
Tâches lancées par GitHub Actions (`.github/workflows/taches.yml`, heures UTC) via `/run?job=...&key=CRON_SECRET`.
- `xtick` (toutes les 30 min, 8 h–21 h UTC) : lignes du soir par ligue (NBA 18 h, NHL 20 h, heure de Paris), bilan image du lendemain, sondage Plus/Moins et sa réponse, tweet de nouveauté, relevé des statistiques des tweets, et le lundi le bilan de la semaine (`xalgoweek`).
- `daily` (9 h UTC) / `evening` (21 h UTC) : calendrier, feuilles de match, blessures, séries.
- Le Défi du soir est arrêté (14 nov. 2026) : `/defi`, `/collection` et `/album` renvoient vers `/algo` ; le code reste dans `lib/game.js`.

## Publicité et pages légales
- Tout est éteint par défaut. Réglages dans la table `site_config` (voir l'en-tête de `lib/ads.js`) : `adsense_client`, `adsense_slots`, `interstitiel`, `editeur`, `hebergeur`.
- `/ads.txt`, `/mentions-legales`, `/confidentialite` sont servis par la fonction.

## Base
- `migrations/` : scripts à exécuter une fois sur la base avant de publier la version correspondante.

Légal (ANJ) : stats informatives, pas de cotes, mention « Stats informatives, pas un conseil de pari. »
