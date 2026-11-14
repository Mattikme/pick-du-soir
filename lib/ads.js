// Publicité : tout est éteint par défaut. On allume en écrivant une valeur dans la table site_config (aucun code à modifier) :
//   adsense_client  = ca-pub-XXXXXXXXXXXXXXXX          → charge AdSense (annonces automatiques + bandeau de consentement Google)
//   adsense_slots   = {"haut":"1234567890","milieu":"0987654321"}   → blocs fixes aux emplacements réservés (facultatif)
//   interstitiel    = {"titre":"…","texte":"…","bouton":"…","lien":"https://…"}   → fenêtre maison, 1 fois par visite (facultatif)
// Les pages contiennent des repères <!--AD:haut--> et <!--AD:milieu--> ; withAds() les remplace, ou les retire si la pub est éteinte.
import { sql } from './jobs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const AD = (k) => `<!--AD:${k}-->`;

let cache = { t: 0, cfg: {} };
export async function siteConfig() {
  if (Date.now() - cache.t < 60000) return cache.cfg;
  const cfg = {};
  try {
    await sql.query(`CREATE TABLE IF NOT EXISTS site_config (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz DEFAULT now())`);
    for (const r of await sql.query(`SELECT key, value FROM site_config`)) cfg[r.key] = r.value;
  } catch (e) { console.error('site_config', String(e).slice(0, 120)); }
  cache = { t: Date.now(), cfg };
  return cfg;
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const client = (cfg) => (/^ca-pub-\d{10,20}$/.test(cfg.adsense_client || '') ? cfg.adsense_client : null);

// Hauteur réservée avant le chargement de l'annonce : la page ne saute pas (pas de décalage de mise en page)
const AD_CSS = `.ad{margin:14px 0;text-align:center;overflow:hidden}.ad::before{content:'Publicité';display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-bottom:4px}
.ad-haut{min-height:118px}.ad-milieu{min-height:298px}@media(min-width:760px){.ad-haut{min-height:108px}}
.itl{position:fixed;inset:0;z-index:60;background:rgba(5,6,12,.78);display:grid;place-items:center;padding:20px}.itl[hidden]{display:none}
.itl div{position:relative;max-width:420px;width:100%;background:var(--card);border:1px solid var(--edge);border-radius:18px;padding:26px 22px 22px;text-align:center}
.itl small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-bottom:10px}.itl b{display:block;font:800 26px/1.1 var(--disp);margin-bottom:8px}.itl p{margin:0 0 16px;color:var(--mute);font-size:15px}
.itl a{display:inline-block;background:var(--ink);color:var(--night);font-weight:700;padding:11px 18px;border-radius:11px}
.itl button{position:absolute;right:8px;top:8px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:var(--ink);font-size:22px;line-height:1;cursor:pointer}`;

// Fenêtre maison : jamais sur les 2 premières pages, une seule fois par visite, fermable tout de suite (croix, clic à côté, Échap)
const ITL_JS = `(function(){try{var s=sessionStorage,n=+(s.getItem('pv')||0)+1;s.setItem('pv',n);if(n<3||s.getItem('itl'))return;var e=document.getElementById('itl');if(!e)return;s.setItem('itl','1');e.hidden=false;
var c=function(){e.hidden=true};e.querySelector('button').onclick=c;e.onclick=function(x){if(x.target===e)c()};document.addEventListener('keydown',function(x){if(x.key==='Escape')c()});e.querySelector('button').focus()}catch(x){}})();`;

export async function withAds(html) {
  const cfg = await siteConfig(), id = client(cfg), slots = (id && json(cfg.adsense_slots)) || {}, itl = json(cfg.interstitiel);
  const unit = (k) => (/^\d{6,14}$/.test(slots[k] || '') ? `<div class="ad ad-${k}"><ins class="adsbygoogle" style="display:block" data-ad-client="${id}" data-ad-slot="${slots[k]}" data-ad-format="${k === 'haut' ? 'horizontal' : 'auto'}" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>` : '');
  let out = html.replace(/<!--AD:(\w+)-->/g, (_, k) => unit(k));
  const head = [], foot = [];
  if (id) head.push(`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}" crossorigin="anonymous"></script>`);
  if (id || itl) head.push(`<style>${AD_CSS}</style>`);
  if (itl?.titre && /^(https:\/\/|\/)/.test(itl.lien || '')) foot.push(`<div class="itl" id="itl" hidden role="dialog" aria-modal="true" aria-label="${esc(itl.titre)}"><div><button type="button" aria-label="Fermer">×</button><small>${itl.pub === false ? 'Pick du Soir' : 'Publicité'}</small><b>${esc(itl.titre)}</b><p>${esc(itl.texte || '')}</p><a href="${esc(itl.lien)}"${itl.lien.startsWith('/') ? '' : ' rel="sponsored noopener" target="_blank"'}>${esc(itl.bouton || 'Voir')}</a></div></div><script>${ITL_JS}</script>`);
  if (head.length) out = out.replace('</head>', head.join('') + '</head>');
  if (foot.length) out = out.replace('</body>', foot.join('') + '</body>');
  return out;
}

// /ads.txt : déclare Google comme vendeur autorisé dès que l'identifiant AdSense est renseigné
export async function adsTxt() {
  const id = client(await siteConfig());
  return id ? `google.com, ${id.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` : `# Pick du Soir : aucune régie publicitaire active pour l'instant.\n`;
}
export const adsOn = async () => !!client(await siteConfig());
