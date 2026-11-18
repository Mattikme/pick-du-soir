// Point d'entrée Vercel : toutes les requêtes (rewrite /(.*) -> /api/index) passent par le site bundlé.
// dist/index.mjs est produit par « npm run build » (esbuild, voir vercel.json).
export { default } from '../dist/index.mjs';
