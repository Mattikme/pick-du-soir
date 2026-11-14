-- Lignes du soir (nov. 2026) : à exécuter une fois sur la base. Sans danger si relancé.
ALTER TABLE algo_picks ADD COLUMN IF NOT EXISTS side text;
ALTER TABLE algo_picks ADD COLUMN IF NOT EXISTS league text NOT NULL DEFAULT 'nba';
ALTER TABLE algo_recaps ADD COLUMN IF NOT EXISTS league text NOT NULL DEFAULT 'nba';
ALTER TABLE algo_recaps DROP CONSTRAINT IF EXISTS algo_recaps_pkey;
ALTER TABLE algo_recaps ADD PRIMARY KEY (day, league);
ALTER TABLE x_poll ADD COLUMN IF NOT EXISTS kind text;
CREATE TABLE IF NOT EXISTS site_config (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz DEFAULT now());
