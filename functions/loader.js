// Chargeur : le code du site est stocké en base (table code_bundle) et rechargé dès qu'une nouvelle version est publiée
import { createSql } from '../lib/db.js';

const sql = createSql(process.env.DATABASE_URL);
let mod = null, ver = null, checked = 0;

async function app() {
  if (mod && Date.now() - checked < 20000) return mod;
  const [v] = await sql.query(`SELECT version FROM code_bundle WHERE id = 'main'`);
  checked = Date.now();
  if (!mod || v.version !== ver) {
    const [r] = await sql.query(`SELECT version, code FROM code_bundle WHERE id = 'main'`);
    mod = (await import('data:text/javascript;base64,' + Buffer.from(r.code).toString('base64'))).default;
    ver = r.version;
  }
  return mod;
}

export default {
  async fetch(request) {
    try { return await (await app()).fetch(request); }
    catch (e) { return new Response(JSON.stringify({ error: 'chargement: ' + String(e).slice(0, 300) }), { status: 500, headers: { 'content-type': 'application/json' } }); }
  },
};
