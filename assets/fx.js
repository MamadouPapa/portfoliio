/* fx.js: interaction effects for pmgueye.fr (boot log, headline reveal, card tilt,
   magnetic buttons, film grain, cursor spotlight). Progressive enhancement only:
   every effect is optional, guarded on its own, and skipped under reduced motion. */
(function () {
  'use strict';

  const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
  const FINE_POINTER = '(pointer: fine)';
  const BOOT_KEY = 'fx:boot';
  const PREBOOT_CLASS = 'fx-preboot';

  const TYPE_MS = 760;        // typing phase
  const HOLD_MS = 120;        // pause on "Welcome."
  const WIPE_MS = 480;        // split wipe; TYPE + HOLD + WIPE <= 1400
  const SKIP_WIPE_MS = 320;
  const FAILSAFE_MS = 2400;   // hard removal even if rAF never runs

  const LETTER_STAGGER_MS = 16;
  const STAGGER_CAP_MS = 520;
  const LETTER_MS = 760;
  const RESTORE_PAD_MS = 120;

  const TILT_SELECTOR = '.project, .case, .life-card, .dossier';
  const TILT_MAX_DEG = 6;
  const TILT_MIN_DEG = 2;
  const TILT_REF_WIDTH = 480; // wide cards tilt less so edges move a similar distance
  const TILT_EASE = 0.12;

  const MAGNET_SELECTOR = '.btn, .btn-sm';
  const MAGNET_MAX_PX = 6;
  const MAGNET_EASE = 0.18;

  const SPOT_EASE = 0.16;
  const SETTLE = 0.02;

  const BOOT_TEXT = {
    en: {
      hint: 'Press any key to skip',
      lines: [['', 'pmgueye.fr — boot'], ['OK', 'Loading identity modules'], ['OK', 'Hardening TLS'],
        ['OK', 'Mounting /projects'], ['OK', 'Firewall: policy drop'], ['', 'Welcome.']]
    },
    fr: {
      hint: 'Appuyez sur une touche pour passer',
      lines: [['', 'pmgueye.fr — démarrage'], ['OK', 'Chargement des modules d’identité'], ['OK', 'Durcissement TLS'],
        ['OK', 'Montage de /projects'], ['OK', 'Pare-feu : politique drop'], ['', 'Bienvenue.']]
    }
  };

  /* ---------- helpers ---------- */

  const matches = (query) => Boolean(window.matchMedia && window.matchMedia(query).matches);
  const lerp = (from, to, t) => from + (to - from) * t;
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const isMouseLike = (event) => event.pointerType === 'mouse' || event.pointerType === 'pen';

  function warn(name, err) {
    if (window.console && console.warn) console.warn('[fx] ' + name + ' disabled:', err);
  }

  function guard(name, fn) {
    try { return fn(); } catch (err) { warn(name, err); return null; }
  }

  function once(fn) {
    let called = false;
    return () => { if (!called) { called = true; fn(); } };
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function decorative(node) {
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  /* Runs step() every frame until it returns false; kick() restarts it. */
  function rafLoop(step) {
    let id = 0;
    const tick = (now) => { id = step(now) ? requestAnimationFrame(tick) : 0; };
    return () => { if (!id) id = requestAnimationFrame(tick); };
  }

  function readBootFlag() {
    try { return window.sessionStorage.getItem(BOOT_KEY) === '1'; } catch (err) { return true; }
  }

  function writeBootFlag() {
    try { window.sessionStorage.setItem(BOOT_KEY, '1'); } catch (err) { /* storage blocked: boot may replay */ }
  }

  /* ---------- 1. boot sequence ---------- */

  function buildBoot(copy) {
    const root = decorative(make('div', 'fx-boot'));
    const log = make('div', 'fx-boot-log');
    const rows = copy.lines.map(([tag, text], i) => {
      const row = make('div', 'fx-boot-row');
      if (i === 0) row.classList.add('fx-boot-title');
      if (i === copy.lines.length - 1) row.classList.add('fx-boot-last');
      log.append(row);
      return { row, tag, full: (tag ? '[ ' + tag + ' ] ' : '') + text, shown: -1 };
    });
    const track = make('div', 'fx-boot-track');
    const bar = make('div', 'fx-boot-bar');
    track.append(bar);
    log.append(track);
    root.append(make('div', 'fx-boot-half fx-top'), make('div', 'fx-boot-half fx-bottom'),
      make('div', 'fx-boot-seam'), log, make('div', 'fx-boot-hint', copy.hint));
    return { root, rows, bar };
  }

  function paintRow(item, count) {
    const tagLength = item.tag ? item.tag.length + 5 : 0; // "[ OK ] "
    item.row.textContent = '';
    if (tagLength) item.row.append(make('span', 'fx-ok', item.full.slice(0, Math.min(count, tagLength))));
    item.row.append(document.createTextNode(item.full.slice(tagLength, Math.max(count, tagLength))));
  }

  /* Reveals `count` characters across all rows; the active row shows a cursor. */
  function renderRows(rows, count) {
    let left = count;
    rows.forEach((item) => {
      const shown = clamp(left, 0, item.full.length);
      const typing = left > 0 && left <= item.full.length;
      left -= item.full.length;
      item.row.classList.toggle('is-typing', typing);
      if (shown !== item.shown) { item.shown = shown; paintRow(item, shown); }
    });
  }

  function createBootController(ui, onReveal) {
    const total = ui.rows.reduce((sum, item) => sum + item.full.length, 0);
    const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    const state = { done: false, out: false, start: 0, timer: 0 };
    const finish = () => {
      if (state.done) return;
      state.done = true;
      skipEvents.forEach((type) => window.removeEventListener(type, skip, true));
      clearTimeout(state.timer);
      ui.root.remove();
      onReveal();
    };
    const exit = (ms) => {
      if (state.out || state.done) return;
      state.out = true;
      renderRows(ui.rows, total);
      ui.root.style.setProperty('--fx-wipe', ms + 'ms');
      ui.root.classList.add('is-out');
      onReveal();
      state.timer = setTimeout(finish, ms + 40);
    };
    const skip = () => exit(SKIP_WIPE_MS);
    const tick = (now) => {
      if (state.out || state.done) return false;
      const progress = clamp((now - state.start) / TYPE_MS, 0, 1);
      renderRows(ui.rows, Math.round(progress * total));
      ui.bar.style.transform = 'scaleX(' + progress.toFixed(3) + ')';
      return progress < 1;
    };
    // Timers own the sequence; rAF only paints (it may be throttled, e.g. in background tabs).
    const schedule = () => {
      state.start = performance.now();
      setTimeout(() => exit(WIPE_MS), TYPE_MS + HOLD_MS);
      setTimeout(finish, FAILSAFE_MS);
      rafLoop(tick)();
    };
    return { finish, skip, schedule, skipEvents };
  }

  function runBoot(onReveal) {
    const lang = (document.documentElement.lang || 'en').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    let ui = null;
    let ctrl = null;
    let mounted = false;
    try {
      ui = buildBoot(BOOT_TEXT[lang]);
      ctrl = createBootController(ui, onReveal);
      (document.body || document.documentElement).append(ui.root);
      ctrl.skipEvents.forEach((type) => window.addEventListener(type, ctrl.skip, { capture: true, passive: true }));
      ctrl.schedule();
      mounted = true;
    } catch (err) {
      warn('boot', err);
    } finally {
      document.documentElement.classList.remove(PREBOOT_CLASS);
      if (!mounted) {
        if (ui) ui.root.remove();
        onReveal();
      }
    }
  }

  /* ---------- 2. headline reveal ---------- */

  /* Flattens the heading into characters, each remembering its element ancestry (e.g. <em>). */
  function collectChars(node, chain, out) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const ch of child.nodeValue) out.push({ ch, chain });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.childNodes.length) collectChars(child, chain.concat(child), out);
        else out.push({ atom: child, chain });
      }
    });
    return out;
  }

  /* Appends node under root, re-creating (or reusing) shallow clones of its ancestry. */
  function appendInChain(root, chain, node, clones) {
    let parent = root;
    chain.forEach((source) => {
      const last = parent.lastChild;
      if (last && clones.get(last) === source) { parent = last; return; }
      const copy = source.cloneNode(false);
      copy.removeAttribute('id');
      clones.set(copy, source);
      parent.append(copy);
      parent = copy;
    });
    parent.append(node);
  }

  /* Words become nowrap inline-blocks (wrapping stays at spaces); letters animate inside them. */
  function buildSplit(heading) {
    const wrap = decorative(make('span', 'fx-split-wrap'));
    const clones = new WeakMap();
    let word = null;
    let index = 0;
    collectChars(heading, [], []).forEach((item) => {
      if (item.atom) { word = null; appendInChain(wrap, item.chain, item.atom.cloneNode(true), clones); return; }
      if (/\s/.test(item.ch)) { word = null; appendInChain(wrap, item.chain, document.createTextNode(item.ch), clones); return; }
      if (!word) { word = make('span', 'fx-w'); wrap.append(word); }
      const letter = make('span', 'fx-l', item.ch);
      letter.style.setProperty('--fx-i', String(index));
      index += 1;
      appendInChain(word, item.chain, letter, clones);
    });
    return { wrap, count: index };
  }

  function splitHeadline(heading) {
    const original = Array.from(heading.childNodes);
    const hadLabel = heading.hasAttribute('aria-label');
    const { wrap, count } = buildSplit(heading);
    if (!count) return null;
    if (!hadLabel) heading.setAttribute('aria-label', heading.textContent.replace(/\s+/g, ' ').trim());
    heading.replaceChildren(wrap);
    heading.classList.add('fx-split');
    heading.style.setProperty('--fx-step', Math.min(LETTER_STAGGER_MS, STAGGER_CAP_MS / count).toFixed(2) + 'ms');
    heading.style.setProperty('--fx-dur', LETTER_MS + 'ms');

    // Put the original nodes back once settled: real kerning, plain DOM, native selection.
    const restore = () => {
      heading.replaceChildren(...original);
      heading.classList.remove('fx-split', 'fx-in');
      heading.style.removeProperty('--fx-step');
      heading.style.removeProperty('--fx-dur');
      if (!hadLabel) heading.removeAttribute('aria-label');
    };
    const reveal = () => {
      void heading.offsetWidth; // flush styles so the hidden state is the transition start
      heading.classList.add('fx-in');
      setTimeout(() => guard('headline-restore', restore), LETTER_MS + STAGGER_CAP_MS + RESTORE_PAD_MS);
    };
    return { reveal, restore };
  }

  /* ---------- 3. 3D tilt + specular highlight ---------- */

  /* Skip while the card's own entrance animation/transition is moving its transform. */
  function isTransformBusy(node) {
    if (node.classList.contains('pending')) return true;
    if (!node.getAnimations) return false;
    return node.getAnimations().some((anim) => anim.playState === 'running' && anim.effect &&
      anim.effect.getKeyframes().some((frame) => 'transform' in frame));
  }

  function stepTilt(card, s) {
    s.rx = lerp(s.rx, s.tx, TILT_EASE);
    s.ry = lerp(s.ry, s.ty, TILT_EASE);
    const resting = Math.abs(s.rx - s.tx) < SETTLE && Math.abs(s.ry - s.ty) < SETTLE;
    if (resting && !s.hover) {
      card.classList.remove('fx-tilt');
      ['--fx-rx', '--fx-ry', '--fx-persp'].forEach((prop) => card.style.removeProperty(prop));
      s.engaged = false;
      return false;
    }
    card.style.setProperty('--fx-rx', s.rx.toFixed(3));
    card.style.setProperty('--fx-ry', s.ry.toFixed(3));
    return !resting;
  }

  function engageTilt(card, s) {
    const rect = card.getBoundingClientRect();
    s.rect = { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
    s.deg = clamp(TILT_MAX_DEG * TILT_REF_WIDTH / rect.width, TILT_MIN_DEG, TILT_MAX_DEG);
    card.style.setProperty('--fx-persp', Math.max(900, rect.width * 2).toFixed(0) + 'px');
    card.classList.add('fx-tilt');
    s.engaged = true;
  }

  function bindTilt(card) {
    const s = { rx: 0, ry: 0, tx: 0, ty: 0, deg: TILT_MAX_DEG, rect: null, hover: false, engaged: false };
    const kick = rafLoop(() => stepTilt(card, s));
    if (getComputedStyle(card).position === 'static') card.classList.add('fx-rel');
    card.append(decorative(make('span', 'fx-glare')));

    card.addEventListener('pointermove', (event) => {
      if (!isMouseLike(event)) return;
      if (!s.engaged) { if (isTransformBusy(card)) return; engageTilt(card, s); }
      s.hover = true;
      const px = clamp((event.pageX - s.rect.left) / s.rect.width, 0, 1);
      const py = clamp((event.pageY - s.rect.top) / s.rect.height, 0, 1);
      s.tx = (0.5 - py) * 2 * s.deg; // the area under the pointer dips away
      s.ty = (px - 0.5) * 2 * s.deg;
      card.style.setProperty('--fx-gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--fx-gy', (py * 100).toFixed(1) + '%');
      card.classList.add('fx-hot');
      kick();
    }, { passive: true });

    card.addEventListener('pointerleave', () => {
      s.hover = false;
      s.tx = 0;
      s.ty = 0;
      card.classList.remove('fx-hot');
      if (s.engaged) kick();
    });
  }

  /* ---------- 4. magnetic buttons ---------- */

  function bindMagnet(button) {
    const s = { x: 0, y: 0, tx: 0, ty: 0 };
    const kick = rafLoop(() => {
      s.x = lerp(s.x, s.tx, MAGNET_EASE);
      s.y = lerp(s.y, s.ty, MAGNET_EASE);
      const resting = Math.abs(s.x - s.tx) < SETTLE && Math.abs(s.y - s.ty) < SETTLE;
      if (resting && !s.tx && !s.ty) { button.style.removeProperty('translate'); return false; }
      button.style.translate = s.x.toFixed(2) + 'px ' + s.y.toFixed(2) + 'px';
      return !resting;
    });

    button.addEventListener('pointermove', (event) => {
      if (!isMouseLike(event)) return;
      const rect = button.getBoundingClientRect(); // includes current offset, subtract it below
      const cx = rect.left - s.x + rect.width / 2;
      const cy = rect.top - s.y + rect.height / 2;
      s.tx = clamp((event.clientX - cx) / (rect.width / 2), -1, 1) * MAGNET_MAX_PX;
      s.ty = clamp((event.clientY - cy) / (rect.height / 2), -1, 1) * MAGNET_MAX_PX;
      kick();
    }, { passive: true });

    button.addEventListener('pointerleave', () => { s.tx = 0; s.ty = 0; kick(); });
  }

  /* ---------- 5. film grain ---------- */

  function initGrain() {
    document.body.append(decorative(make('div', 'fx-grain')));
  }

  /* ---------- 6. cursor spotlight ---------- */

  function initSpotlight() {
    const spot = decorative(make('div', 'fx-spot'));
    document.body.append(spot);
    const s = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    const kick = rafLoop(() => {
      s.x = lerp(s.x, s.tx, SPOT_EASE);
      s.y = lerp(s.y, s.ty, SPOT_EASE);
      spot.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0)';
      return Math.abs(s.x - s.tx) > SETTLE * 10 || Math.abs(s.y - s.ty) > SETTLE * 10;
    });

    window.addEventListener('pointermove', (event) => {
      if (!isMouseLike(event)) return;
      s.tx = event.clientX;
      s.ty = event.clientY;
      if (!s.on) { s.on = true; s.x = s.tx; s.y = s.ty; spot.classList.add('is-on'); }
      kick();
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => {
      s.on = false;
      spot.classList.remove('is-on');
    });
  }

  /* ---------- bootstrap ---------- */

  function initPointerEffects() {
    guard('spotlight', initSpotlight);
    document.querySelectorAll(TILT_SELECTOR).forEach((card) => guard('tilt', () => bindTilt(card)));
    document.querySelectorAll(MAGNET_SELECTOR).forEach((button) => guard('magnet', () => bindMagnet(button)));
  }

  function init() {
    try {
      if (matches(REDUCED_MOTION)) return;
      const heading = document.querySelector('.headline');
      const split = heading ? guard('headline', () => splitHeadline(heading)) : null;
      const reveal = once(() => { if (split) guard('headline-reveal', split.reveal); });

      if (readBootFlag()) reveal();
      else { writeBootFlag(); runBoot(reveal); }

      guard('grain', initGrain);
      if (matches(FINE_POINTER)) initPointerEffects();
    } catch (err) {
      warn('fx', err);
    } finally {
      document.documentElement.classList.remove(PREBOOT_CLASS);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
