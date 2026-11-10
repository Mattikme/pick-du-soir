// Publie dist/index.mjs dans la table code_bundle (utilisé par functions/loader.js)
import fs from 'fs';
import { createSql } from './lib/db.js';
const sql = createSql(fs.readFileSync(process.argv[2], 'utf8').trim());
await sql.query(`CREATE TABLE IF NOT EXISTS code_bundle (id text PRIMARY KEY, version text NOT NULL, code text NOT NULL, updated_at timestamptz DEFAULT now())`);
const code = fs.readFileSync(new URL('./dist/index.mjs', import.meta.url), 'utf8');
const version = new Date().toISOString();
await sql.query(`INSERT INTO code_bundle (id, version, code) VALUES ('main', $1, $2) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, code = EXCLUDED.code, updated_at = now()`, [version, code]);
console.log('publié', version, code.length, 'octets');
// Sauvegarde des sources (tar.gz base64) dans Neon à chaque publication
import { execSync } from 'child_process';
await sql.query(`CREATE TABLE IF NOT EXISTS code_src (id text PRIMARY KEY, version text NOT NULL, data text NOT NULL, updated_at timestamptz DEFAULT now())`);
const tgz = execSync('tar czf - lib functions api package.json publish.mjs index.html vercel.json', { cwd: new URL('.', import.meta.url).pathname, maxBuffer: 1 << 28 }).toString('base64');
await sql.query(`INSERT INTO code_src (id, version, data) VALUES ('main', $1, $2) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, updated_at = now()`, [version, tgz]);
console.log('sources sauvegardées', tgz.length, 'octets base64');
