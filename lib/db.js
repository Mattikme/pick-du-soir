// Client SQL minimal pour l'API HTTP de Neon (sans dépendance)
function pgArray(arr) {
  return '{' + arr.map((v) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }).join(',') + '}';
}

const norm = (params = []) => params.map((p) => (Array.isArray(p) ? pgArray(p) : p ?? null));

export function createSql(connectionString) {
  const host = new URL(connectionString).hostname;
  const endpoint = 'https://' + host.replace(/^[^.]+\./, 'api.') + '/sql';
  async function post(body, extra = {}) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Neon-Connection-String': connectionString, 'content-type': 'application/json', ...extra },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`SQL ${r.status}: ${data.message || JSON.stringify(data).slice(0, 300)}`);
    return data;
  }
  return {
    async query(text, params) {
      return (await post({ query: text, params: norm(params) })).rows;
    },
    q: (text, params) => ({ query: text, params: norm(params) }),
    async transaction(queries) {
      const data = await post({ queries }, { 'Neon-Batch-Isolation-Level': 'ReadCommitted' });
      return data.results.map((r) => r.rows);
    },
  };
}
