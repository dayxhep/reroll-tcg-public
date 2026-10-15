/* ═══════════════════════════════════════════════════════════════════════════
   REROLL TCG — générateur et pilote de carte

   Une carte se déclare par ses données, pas par son balisage :

       <div data-rr-tcg-card='{"name": "Valentina Galvez", "image": "…"}'></div>

   Au chargement, chaque élément portant cet attribut est remplacé par une carte
   complète, puis rendu sensible au pointeur. Le HTML de carte n'a donc jamais à être
   écrit ni maintenu à la main, et les règles du jeu qui en découlent — PV dérivés de
   l'Endurance, mise en valeur des deux meilleures statistiques — sont appliquées ici,
   à un seul endroit.

   Sans JS, rien ne s'affiche : c'est le prix de la génération. Pour un rendu qui
   survit à l'absence de script, écrire le balisage en dur (voir example.html) et
   n'utiliser que RerollTCG.init().

   ─── Variables posées sur .card par le pilote ───
     --pointer-x / --pointer-y            position du pointeur, en % de la carte
     --pointer-from-left / -from-top      les mêmes, en 0-1
     --pointer-from-center                distance au centre, 0 au centre, 1 aux bords
     --background-x / --background-y      position resserrée (37-63 %) pour les motifs
     --rotate-x / --rotate-y              inclinaison 3D, en degrés
     --card-opacity                       0 au repos, 1 pendant la manipulation
     --seal-lit                           1 quand la lumière passe sur le sceau, 0 loin

   Le pilote est porté de pokemon-cards-css (Simon Goellner, GPL-3.0) : les formules de
   rotation et de recadrage du fond en sont reprises. Les ressorts Svelte de la source
   sont remplacés par une interpolation simple à chaque frame — suffisant, sans dépendance.
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {

  /* ═══════════════ Données du jeu ═══════════════ */

  /* Ordre d'affichage, libellé et icône des six statistiques. Les deux rangées en
     quinconce reprennent ce découpage : FOR/AGI/END puis INT/CHA/CHC. */
  const STATS = [
    { key: 'for', label: 'Force', icon: 'arm-flex' },
    { key: 'agi', label: 'Agilité', icon: 'run-fast' },
    { key: 'end', label: 'Endurance', icon: 'heart-pulse' },
    { key: 'int', label: 'Intelligence', icon: 'brain' },
    { key: 'cha', label: 'Charisme', icon: 'account-voice' },
    { key: 'chc', label: 'Chance', icon: 'clover' },
  ];

  const VERSIONS = ['classic', 'full-art', 'collection'];

  /* Règle du jeu : les PV découlent de l'Endurance, 2 par défaut et 3 au-delà de 15.
     Une valeur explicite dans les données l'emporte, pour les cas particuliers. */
  const pvFromEndurance = end => (Number(end) > 15 ? 3 : 2);

  /* Les deux statistiques les plus hautes sont mises en valeur. À égalité, l'ordre
     d'affichage tranche, ce qui rend le rendu déterministe. */
  function keyStats(stats) {
    return STATS
      .map((s, i) => ({ i, v: Number(stats?.[s.key] ?? 0) }))
      .sort((a, b) => b.v - a.v || a.i - b.i)
      .slice(0, 2)
      .map(s => s.i);
  }

  /* ═══════════════ Génération ═══════════════ */

  const esc = v => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const HEX = '26,2 50,15 50,45 26,58 2,45 2,15';

  /* hex-shape porte l'aplat, hex-sheen le dégradé de relief : les deux sont nécessaires */
  const hexSvg = () =>
    `<svg viewBox="0 0 52 60" aria-hidden="true">` +
    `<polygon class="hex-shape" points="${HEX}"/>` +
    `<polygon class="hex-sheen" points="${HEX}"/></svg>`;

  function statGrid(stats) {
    const keys = keyStats(stats);
    const hex = (s, i) =>
      `<div class="stat-hex${keys.includes(i) ? ' is-key' : ''}" role="listitem"` +
      ` aria-label="${esc(s.label)} ${esc(stats[s.key])}">` +
      hexSvg() +
      `<div class="stat-hex-content"><i class="mdi mdi-${esc(s.icon)}" aria-hidden="true"></i>` +
      `<span class="stat-hex-val">${esc(stats[s.key])}</span></div></div>`;

    const row = from => `<div class="stat-row">` +
      STATS.slice(from, from + 3).map((s, j) => hex(s, from + j)).join('') + `</div>`;

    return `<div class="stat-grid" role="list" aria-label="Statistiques">${row(0)}${row(3)}</div>`;
  }

  /** Étiquette lue par les lecteurs d'écran : la carte entière en une phrase. */
  function ariaLabel(d, pv) {
    const bits = [`Carte ${d.name}`];
    if (d.tags?.length) bits.push(d.tags.join(', '));
    if (d.version !== 'collection') bits.push(`${pv} points de vie`);
    if (d.version === 'full-art') bits.push('version pleine illustration');
    if (d.version === 'collection') bits.push('version collection');
    return bits.join('. ') + '.';
  }

  /**
   * Construit le HTML d'une carte à partir de ses données.
   * @param {object} d
   * @returns {string}
   */
  function cardHtml(d) {
    const version = VERSIONS.includes(d.version) ? d.version : 'classic';
    const stats = d.stats || {};
    const pv = d.pv ?? pvFromEndurance(stats.end);

    // teinte et typographie : quatre variables suffisent, le CSS dérive le reste.
    // La Classic ignore accent et garde le rouge de marque : la teinte par carte est
    // réservée aux versions de collection, c'est ce qui les distingue au premier coup d'œil.
    // `case` et `tracking` sont à part de `font` : ni text-transform ni letter-spacing
    // n'entrent dans le raccourci CSS.
    const style = [
      version !== 'classic' && d.accent && `--accent: ${d.accent}`,
      d.font && `--font-title: ${d.font}`,
      d.case && `--case-title: ${d.case}`,
      d.tracking && `--tracking-title: ${d.tracking}`,
    ].filter(Boolean).join('; ');

    const attrs = [
      `class="card card--${version}"`,
      d.fx && `data-fx="${esc(d.fx)}"`,
      // la rareté n'est lue que par la version Collection, cf. la feuille de style
      d.rarity && `data-rarity="${esc(d.rarity)}"`,
      style && `style="${esc(style)}"`,
      `aria-label="${esc(ariaLabel({ ...d, version }, pv))}"`,
    ].filter(Boolean).join(' ');

    const credit = d.artist ? `Art : ${esc(d.artist)}` : '';

    return `<article ${attrs}>
 <div class="card-inner">
  <div class="art-wrap">
    <img src="${esc(d.image)}" alt="Illustration de ${esc(d.name)}">

    <div class="card-banner">
      <h2 class="card-name">${esc(d.name)}</h2>
    </div>
${credit ? `
    <span class="art-credit-overlay">${credit}</span>
` : ''}
    <svg class="card-seal" viewBox="0 0 223.55 221.44" aria-hidden="true">
      <use class="seal-shade" href="#rerollLogo"/>
      <use class="seal-lit" href="#rerollLogo"/>
    </svg>

    <div class="card-fx card-shine" aria-hidden="true"></div>
    <div class="card-fx card-glare" aria-hidden="true"></div>

    ${statGrid(stats)}

    <ul class="tags" aria-label="Thèmes">${(d.tags || []).map(t => `<li class="tag">${esc(t)}</li>`).join('')}</ul>

    <div class="pv-badge" aria-label="${pv} points de vie">
      <div class="stat-hex is-key">
        ${hexSvg()}
        <div class="stat-hex-content"><span class="stat-hex-val">${esc(pv)}</span></div>
      </div>
    </div>
  </div>

  <blockquote class="quote">
    <span class="quote-text">${esc(d.quote)}</span>
    ${credit ? `<cite class="art-credit">${credit}</cite>` : ''}
  </blockquote>

  <div class="card-footer">
    <span>${esc(d.number ?? '')}</span>
    <span class="footer-mark"><svg class="footer-logo" aria-hidden="true"><use href="#rerollLogo"/></svg>REROLL</span>
    <span class="footer-serial">${esc(d.serial ?? '')}</span>
    <span class="footer-edition">${esc(d.edition ?? 'Collector')}</span>
  </div>
 </div>
</article>`;
  }

  /**
   * (Re)dessine dans l'hôte la carte décrite par son attribut data-rr-tcg-card.
   * L'hôte est peuplé, pas remplacé : il conserve l'attribut, sert de scène 3D, et
   * réécrire l'attribut puis rappeler render() suffit à redessiner la carte.
   * @param {Element} host
   * @returns {Element|null} la carte produite
   */
  function render(host) {
    let data;
    try {
      data = JSON.parse(host.getAttribute('data-rr-tcg-card'));
    } catch (e) {
      console.error('[rr-tcg] JSON invalide sur', host, e);
      return null;
    }
    // remplacer le contenu détruit l'ancienne carte et ses écouteurs avec elle
    host.innerHTML = cardHtml(data);
    return host.firstElementChild;
  }

  /* ═══════════════ Pilote ═══════════════ */

  const round = (v, p = 3) => parseFloat(v.toFixed(p));
  const clamp = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
  const adjust = (v, fMin, fMax, tMin, tMax) => round(tMin + (tMax - tMin) * (v - fMin) / (fMax - fMin));

  const EASE = 0.14;               // part de l'écart comblée à chaque frame
  const SEAL = { x: 82, y: 13 };   // centre du sceau, en % de carte — doit rester
                                   // d'accord avec les top/right de .card-seal
  /* Écouteurs par carte : nécessaires pour délier, et donc pour éteindre le tilt
     après coup. Une WeakMap plutôt qu'un drapeau en dataset, qu'un clone hériterait. */
  const bound = new WeakMap();

  /** Rend une carte sensible au pointeur. Idempotent. */
  /**
   * Rend une carte sensible au pointeur. Sans effet sur une carte déjà liée, ou
   * portant data-tilt="off" — utile quand la carte est empilée derrière d'autres,
   * où l'inclinaison salit le rendu.
   * @param {HTMLElement} card
   */
  function bind(card) {
    if (bound.has(card) || card.dataset.tilt === 'off') return;

    /* Repos de la matière : nul sur une carte mate, --fx-rest sur une carte à effet.
       Lu à chaque retour et non une fois pour toutes : bind() peut être appelé sur une
       carte encore détachée, où getComputedStyle ne renvoie rien. */
    const rest = () =>
      parseFloat(getComputedStyle(card).getPropertyValue('--fx-rest')) || 0;

    // état affiché et état visé ; l'écart est comblé frame par frame
    const now = { rx: 0, ry: 0, px: 50, py: 50, bx: 50, by: 50, o: rest() };
    const to = { ...now };
    let raf = null;

    const paint = () => {
      let moving = false;
      for (const k in now) {
        const d = to[k] - now[k];
        if (Math.abs(d) > 0.01) { now[k] += d * EASE; moving = true; }
        else now[k] = to[k];
      }
      const fromCenter = clamp(Math.hypot(now.px - 50, now.py - 50) / 50, 0, 1);
      // le sceau s'allume quand la lumière l'effleure : 1 dessus, 0 au-delà de 45 %
      const lit = clamp(1 - Math.hypot(now.px - SEAL.x, now.py - SEAL.y) / 45, 0, 1);

      const s = card.style;
      s.setProperty('--rotate-x', round(now.rx) + 'deg');
      s.setProperty('--rotate-y', round(now.ry) + 'deg');
      s.setProperty('--pointer-x', round(now.px) + '%');
      s.setProperty('--pointer-y', round(now.py) + '%');
      s.setProperty('--background-x', round(now.bx) + '%');
      s.setProperty('--background-y', round(now.by) + '%');
      s.setProperty('--pointer-from-center', round(fromCenter));
      s.setProperty('--pointer-from-top', round(now.py / 100));
      s.setProperty('--pointer-from-left', round(now.px / 100));
      s.setProperty('--card-opacity', round(now.o));
      s.setProperty('--seal-lit', round(lit));

      raf = moving ? requestAnimationFrame(paint) : null;
    };

    const kick = () => { if (raf === null) raf = requestAnimationFrame(paint); };

    const onMove = e => {
      const r = card.getBoundingClientRect();
      const px = clamp(round((100 / r.width) * (e.clientX - r.left)));
      const py = clamp(round((100 / r.height) * (e.clientY - r.top)));
      // formules de la source : rotation inversée sur X, amortie d'un facteur 3,5
      to.rx = round(-((px - 50) / 3.5));
      to.ry = round((py - 50) / 3.5);
      to.px = px;
      to.py = py;
      to.bx = adjust(px, 0, 100, 37, 63);
      to.by = adjust(py, 0, 100, 33, 67);
      to.o = 1;
      card.classList.add('is-interacting');
      kick();
    };

    const onLeave = () => {
      to.rx = to.ry = 0;
      to.px = to.py = to.bx = to.by = 50;
      to.o = rest();
      card.classList.remove('is-interacting');
      kick();
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    bound.set(card, { onMove, onLeave });
  }

  /**
   * Détache les écouteurs et remet la carte à plat. L'animation de retour joue :
   * couper le tilt sur une carte inclinée ne doit pas la figer de travers.
   * @param {HTMLElement} card
   */
  function unbind(card) {
    const h = bound.get(card);
    if (!h) return;
    card.removeEventListener('pointermove', h.onMove);
    card.removeEventListener('pointerleave', h.onLeave);
    bound.delete(card);
    h.onLeave();
  }

  /**
   * Allume ou éteint le tilt, y compris sur une carte déjà rendue.
   * @param {HTMLElement} card
   * @param {boolean} on
   */
  function setTilt(card, on) {
    card.dataset.tilt = on ? 'on' : 'off';
    if (on) bind(card);
    else unbind(card);
  }

  /* ═══════════════ Amorçage ═══════════════ */

  /* Le pied de carte et le sceau pointent vers un <symbol> SVG. On l'injecte une fois
     plutôt que d'exiger de la page hôte qu'elle le colle elle-même dans son HTML. */
  const LOGO = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\">\n  <defs>\n    <!-- logo REROLL (version solo). fill hérité du CSS ; fill-rule evenodd conservé sur les\n         deux tracés qui en dépendent, sinon leurs contre-formes se bouchent. -->\n    <symbol id=\"rerollLogo\" viewBox=\"0 0 223.55 221.44\">\n      <path fill-rule=\"evenodd\" d=\"m192.62,34.13c-.06-.03-.11-.09-.13-.16-1.77-5.62-7.03-9.71-13.23-9.71h-5.04s-.09-.01-.14-.03l-6.34-3.39c-.26-.14-.16-.54.14-.54h11.38c9.08,0,16.6,6.83,17.69,15.63.03.23-.22.4-.43.29l-3.9-2.08Zm-117.96-9.87H23.12c-7.82,0-14.16,6.34-14.16,14.16v148.7c0,7.82,6.34,14.16,14.16,14.16h50.91s.09.01.14.03l6.31,3.39c.26.14.16.54-.14.54H23.12c-10.01,0-18.12-8.11-18.12-18.12V38.42c0-10.01,8.12-18.13,18.13-18.13h57.8c.3,0,.4.4.14.54l-6.27,3.39s-.09.03-.14.03Zm96.55,177.05s.09-.04.14-.04h7.92c7.09,0,12.94-5.35,13.77-12.22.01-.09.06-.17.14-.21l3.5-1.99c.19-.11.43.03.43.25h0c0,10.01-8.12,18.13-18.13,18.13h-13.59c-.29,0-.4-.39-.14-.54l5.97-3.39Z\"/>\n      <path fill-rule=\"evenodd\" d=\"m193.35,149.57l24.64-74.83c.1-.31.57-.23.56.1l-2.1,89.56c0,.22-.26.36-.44.23l-22.54-14.73c-.11-.07-.16-.21-.12-.33ZM126.28,27.9V5.45c0-.22.23-.36.42-.25l73.33,39.21c.3.16.13.61-.2.53l-73.33-16.76c-.13-.03-.22-.15-.22-.28Zm-2.26,116.95V40.46c0-.3.4-.4.54-.14l56.75,104.4c.1.19-.03.42-.25.42h-56.75c-.16,0-.29-.13-.29-.29Zm.29,8.19l56.89-.13c.25,0,.38.29.21.48l-56.89,62.95c-.18.19-.5.07-.5-.19v-62.82c0-.16.13-.29.29-.29Zm90.48-95.29l-27.48,82.43c-.08.24-.41.27-.53.04l-53.73-101.96c-.12-.22.08-.47.32-.41l81.2,19.54c.16.04.26.21.21.37Zm-78.26,157.3l53.8-58.3c.1-.1.25-.12.37-.04l21.34,14.43c.18.12.17.38-.02.49l-75.14,43.88c-.28.17-.58-.2-.36-.44Z\"/>\n      <path d=\"m66.52,145.12l57.22.02c.16,0,.29-.13.29-.29v-3.42c0-.16-.13-.29-.29-.29h-50.53c-.22,0-.36-.24-.25-.43l51.03-93.14s.04-.09.04-.14v-6.99c0-.3-.4-.4-.54-.14l-57.22,104.38c-.1.19.03.42.25.42Z\"/>\n      <path d=\"m28.93,74.73l2.11,89.65c0,.22.26.36.44.23l22.6-14.74c.11-.07.16-.21.12-.33l-24.71-74.91c-.1-.31-.57-.23-.56.1Zm5.17,26.57l15.37,46.59c.04.12,0,.26-.12.33l-14.05,9.17c-.19.12-.44,0-.44-.23l-1.31-55.75c0-.33.46-.41.56-.1Z\"/>\n      <path d=\"m121.02,5.03L47.5,44.29c-.3.16-.13.61.2.53l73.53-16.78c.13-.03.22-.15.22-.28V5.29c0-.22-.23-.36-.42-.25Zm-3.78,19.84l-41.47,9.46c-.33.07-.49-.38-.2-.53l41.47-22.14c.19-.1.42.04.42.25v12.68c0,.13-.09.25-.22.28Z\"/>\n      <path d=\"m35.47,171.62l75.33,43.93c.28.17.58-.2.36-.44l-53.94-58.37c-.1-.1-.25-.12-.37-.04l-21.39,14.44c-.18.12-.17.38.02.49Zm7.45-.73l13.32-8.99c.12-.08.28-.06.37.04l33.58,36.34c.22.24-.07.61-.36.44l-46.91-27.35c-.18-.11-.19-.37-.02-.49Z\"/>\n      <path d=\"m123.95,211.35l-49-54.18c-.17-.19-.03-.48.22-.48l48.57.39c.16,0,.29-.13.29-.29v-3.46c0-.16-.13-.29-.29-.29l-57.37-.14c-.25,0-.38.3-.21.48l57.36,62.96c.18.19.5.07.5-.19v-4.61c0-.07-.03-.14-.07-.19Z\"/>\n      <path d=\"m114.32,37.72l-81.42,19.56c-.16.04-.26.21-.21.37l27.55,82.51c.08.24.41.27.53.04l53.87-102.07c.12-.22-.08-.47-.32-.41Zm-7.3,6.33l-45.42,86.07c-.12.22-.45.2-.53-.04l-23.23-69.57c-.05-.16.04-.33.21-.37l68.65-16.49c.24-.06.44.19.32.41Z\"/>\n    </symbol>\n  </defs>\n</svg>";

  function injectLogo() {
    if (document.getElementById('rerollLogo')) return;
    const holder = document.createElement('div');
    holder.innerHTML = LOGO;
    document.body.prepend(holder.firstElementChild);
  }

  /**
   * Génère les cartes déclarées en JSON puis lie toutes les cartes présentes.
   * À rappeler après un ajout dynamique — les cartes déjà liées sont ignorées.
   * @param {ParentNode} root
   */
  function init(root = document) {
    injectLogo();
    root.querySelectorAll('[data-rr-tcg-card]').forEach(render);
    root.querySelectorAll('.card').forEach(bind);
  }

  window.RerollTCG = { init, bind, unbind, setTilt, render, cardHtml };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
