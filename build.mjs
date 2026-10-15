/*
  REROLL TCG — assemblage du composant.

      node build.mjs        →  rr-tcg.css

  Concatène les fragments de src/ dans l'ordre de leur préfixe numérique. L'ordre
  compte : les effets et les éditions surchargent des règles posées par le gabarit.

  Le portage des effets depuis pokemon-cards-css est une étape séparée et rare,
  dans tools/port-effects.mjs — elle a besoin d'un clone de la source, pas ce script.
*/
import fs from 'fs';
import path from 'path';

const SRC = 'src';
const OUT = 'rr-tcg.css';

const HEAD = `/* ═══════════════════════════════════════════════════════════════════════════
   REROLL TCG — feuille de style du composant carte
   ───────────────────────────────────────────────────────────────────────────
   GÉNÉRÉ PAR build.mjs — NE PAS ÉDITER. Les sources sont dans src/.

   LICENCE : ce fichier agrège src/02-effects.css, porté de pokemon-cards-css
   © 2022 Simon Goellner (@simeydotme), sous GPL-3.0. Par contamination, le fichier
   assemblé est donc lui aussi sous GPL-3.0. Pris isolément, src/01-card.css et
   src/03-editions.css sont du travail original sans cette contrainte.

   Sources completes (obligation GPL-3.0) : https://github.com/dayxhep/reroll-tcg-public
   ═══════════════════════════════════════════════════════════════════════════ */

`;

const parts = fs.readdirSync(SRC).filter(f => f.endsWith('.css')).sort();
if (!parts.length) { console.error('src/ ne contient aucun fragment CSS'); process.exit(1); }

const css = parts.map(p => fs.readFileSync(path.join(SRC, p), 'utf8').trimEnd()).join('\n\n\n');
fs.writeFileSync(OUT, HEAD + css + '\n');

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`${OUT} — ${parts.length} fragments (${parts.join(', ')}), ${kb} Ko`);
