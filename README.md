# reroll-tcg

Source du composant carte **REROLL TCG** (rendu HTML/CSS/JS, effets holographiques),
tel que distribué sur le panel Reroll et dans le serveur FiveM.

Ce dépôt existe pour satisfaire l'obligation de distribution des sources de la
**GPL-3.0** : les fichiers servis/embarqués ailleurs (`rr-tcg.css`, `rr-tcg.js` et les
textures `assets/fx/`) y sont fournis sous leur forme source, avec le texte de licence.

## Licence

L'ensemble est sous **GPL-3.0** — voir [`LICENSE`](LICENSE).

`src/02-effects.css` et les textures de `assets/fx/` sont **portés de
[pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) © 2022 Simon
Goellner ([@simeydotme](https://github.com/simeydotme)), sous GPL-3.0** ;
`rr-tcg.js` reprend ses formules de pointeur. Par contamination, l'agrégat `rr-tcg.css`
est donc lui aussi sous GPL-3.0.

`src/01-card.css` et `src/03-editions.css` sont du travail original Reroll, distribués
ici sous GPL-3.0 comme partie de cet agrégat.

## Contenu

```
src/01-card.css       gabarit de carte (original Reroll)
src/02-effects.css    effets holographiques (porté de pokemon-cards-css, GPL-3.0)
src/03-editions.css   éditions foil / polychrome (original Reroll)
assets/fx/            textures des effets (pokemon-cards-css, GPL-3.0)
rr-tcg.js             générateur et pilote de carte
build.mjs             concatène src/ → rr-tcg.css
```

## Build

```sh
node build.mjs        # produit rr-tcg.css à partir de src/
```
