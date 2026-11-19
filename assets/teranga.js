/* Teranga layer: telemetry strip, ⌘K palette, traceroute map, wax motif from SHA-256, Wolof proverb.
   Everything degrades gracefully: static HTML stays readable without JS. */
(function () {
  'use strict';
  var FR = document.documentElement.lang === 'fr';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = FR ? {
    newWax: 'Nouveau motif', waxCap: 'Motif wax généré pour vous : SHA-256(graine) =',
    placeholder: 'Tapez une commande… (cv, projets, contact)', hint: '↑ ↓ pour naviguer · Entrée pour lancer · Échap pour fermer',
    cmds: [
      ['Aller à : Couverture', '#couverture'], ['Aller à : Projets', '#projets'], ['Aller à : Missions', '#missions'],
      ['Aller à : Console PowerShell', '#console'], ['Aller à : Itinéraire (traceroute)', '#itineraire'], ['Aller à : Parcours', '#parcours'],
      ['Aller à : Hors écran', '#hors-ecran'],
      ['Télécharger mon CV', 'cv/CV_Papa_Mamadou_Gueye.pdf'], ['Copier mon e-mail', 'copy:papa@pmgueye.fr'],
      ['Ouvrir GitHub', 'https://github.com/MamadouPapa'], ['Ouvrir le lab webstack-lab', 'https://github.com/MamadouPapa/webstack-lab'],
      ['Ouvrir LinkedIn', 'https://www.linkedin.com/in/papa-mamadou-gueye-developpeur-cybersecurite'],
      ['Nouveau motif wax', 'wax'], ['English version', 'en/'], ['whoami', '#top']
    ],
    proverbs: [
      ['Ndank ndank mooy japp golo ci naay.', '« Doucement, doucement, on attrape le singe dans la forêt. »', 'En sécurité aussi, <em>la méthode et la patience</em> battent la précipitation.'],
      ['Nit nitay garabam.', '« L’homme est le remède de l’homme. »', 'Aucun SI ne se protège seul : <em>la sécurité, ce sont d’abord des gens</em> qui s’entraident.']
    ]
  } : {
    newWax: 'New pattern', waxCap: 'Wax pattern generated for you: SHA-256(seed) =',
    placeholder: 'Type a command… (cv, projects, contact)', hint: '↑ ↓ to move · Enter to run · Esc to close',
    cmds: [
      ['Go to: Coverage', '#coverage'], ['Go to: Projects', '#projects'], ['Go to: Experience', '#missions'],
      ['Go to: PowerShell console', '#console'], ['Go to: Journey (traceroute)', '#journey'], ['Go to: Background', '#background'],
      ['Go to: Off screen', '#off-screen'],
      ['Download my CV', '../cv/CV_Papa_Mamadou_Gueye_EN.pdf'], ['Copy my e-mail', 'copy:papa@pmgueye.fr'],
      ['Open GitHub', 'https://github.com/MamadouPapa'], ['Open the webstack-lab repo', 'https://github.com/MamadouPapa/webstack-lab'],
      ['Open LinkedIn', 'https://www.linkedin.com/in/papa-mamadou-gueye-developpeur-cybersecurite'],
      ['New wax pattern', 'wax'], ['Version française', '../'], ['whoami', '#top']
    ],
    proverbs: [
      ['Ndank ndank mooy japp golo ci naay.', '“Slowly, slowly, you catch the monkey in the forest.”', 'In security too, <em>method and patience</em> beat haste.'],
      ['Nit nitay garabam.', '“People are each other’s remedy.”', 'No system protects itself: <em>security starts with people</em> helping each other.']
    ]
  };

  /* ---------- Telemetry strip: two home clocks, TLS, measured LCP ---------- */
  var tele = document.getElementById('telemetry');
  if (tele) {
    var clock = function (tz) {
      try { return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date()); }
      catch (e) { return '--:--'; }
    };
    var dkr = tele.querySelector('[data-t="dkr"] b'), par = tele.querySelector('[data-t="par"] b');
    var tick = function () { dkr.textContent = clock('Africa/Dakar'); par.textContent = clock('Europe/Paris'); };
    tick(); setInterval(tick, 30000);
    tele.querySelector('[data-t="tls"] b').textContent = location.protocol === 'https:' ? 'OK' : 'LOCAL';
    var lcpEl = tele.querySelector('[data-t="lcp"] b');
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver(function (list) {
          var e = list.getEntries().pop();
          if (e) lcpEl.textContent = (e.startTime / 1000).toFixed(1) + 's';
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { lcpEl.textContent = 'n/a'; }
    }
  }

  /* ---------- Command palette (⌘K / Ctrl+K) ---------- */
  var pal = document.getElementById('palette');
  if (pal && pal.showModal) {
    var input = pal.querySelector('input'), list = pal.querySelector('ul'), selected = 0, shown = [];
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    var render = function () {
      var q = norm(input.value.trim());
      shown = T.cmds.filter(function (c) { return !q || norm(c[0]).indexOf(q) !== -1 || norm(c[1]).indexOf(q) !== -1; });
      selected = Math.min(selected, Math.max(shown.length - 1, 0));
      list.innerHTML = '';
      shown.forEach(function (c, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === selected));
        li.textContent = c[0];
        var small = document.createElement('small'); small.textContent = c[1].replace(/^copy:/, ''); li.appendChild(small);
        li.addEventListener('click', function () { run(c); });
        list.appendChild(li);
      });
    };
    var scrollTo = function (el) { if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); };
    var run = function (c) {
      var target = c[1];
      pal.close();
      if (target === 'wax') { regenerateWax(); scrollTo(document.getElementById('wax')); return; }
      if (target.indexOf('copy:') === 0) { if (navigator.clipboard) navigator.clipboard.writeText(target.slice(5)); return; }
      if (target.charAt(0) === '#') { scrollTo(document.querySelector(target)); return; }
      if (/^https?:/.test(target)) { window.open(target, '_blank', 'noopener'); return; }
      window.location.href = target;
    };
    var open = function () { input.value = ''; selected = 0; render(); pal.showModal(); input.focus(); };
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (pal.open) pal.close(); else open(); }
    });
    var btn = document.getElementById('paletteBtn');
    if (btn) btn.addEventListener('click', open);
    input.addEventListener('input', function () { selected = 0; render(); });
    input.addEventListener('keydown', function (e) {
      var n = Math.max(shown.length, 1);
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % n; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + n) % n; render(); }
      else if (e.key === 'Enter' && shown[selected]) { e.preventDefault(); run(shown[selected]); }
    });
    pal.addEventListener('click', function (e) { if (e.target === pal) pal.close(); });
    input.setAttribute('placeholder', T.placeholder);
    pal.querySelector('.hint').textContent = T.hint;
  }

  /* ---------- Traceroute map: equirectangular projection of the journey ---------- */
  var MAP = { w: 520, h: 420, lonMin: -20, lonMax: 20, latMin: 10, latMax: 52, pad: 20 };
  var px = function (lon, lat) {
    return [MAP.pad + (lon - MAP.lonMin) / (MAP.lonMax - MAP.lonMin) * (MAP.w - 2 * MAP.pad),
            MAP.pad + (MAP.latMax - lat) / (MAP.latMax - MAP.latMin) * (MAP.h - 2 * MAP.pad)];
  };
  /* Rough coastline, dotted on purpose: a schematic, not a geographic map */
  var COAST = [
    [[-17.5, 14.7], [-16.6, 17.5], [-16.3, 19.5], [-17, 21], [-15.8, 23.7], [-14.5, 26], [-13.2, 27.7], [-11, 28.8], [-9.7, 30.5], [-9.6, 32], [-8.5, 33.3], [-6.8, 34.1], [-6.2, 35.2], [-5.9, 35.8], [-5.3, 35.9], [-3, 35.2], [-1.2, 35.3], [1.5, 36.6], [5, 36.8], [10, 37.2]],
    [[-6.3, 36.6], [-7.4, 37.2], [-8.9, 37.1], [-8.8, 38.6], [-9.4, 39.4], [-8.8, 41.2], [-8.9, 42.6], [-8.2, 43.6], [-5.8, 43.6], [-1.8, 43.4], [-1.3, 44.6], [-1.2, 46.2], [-2.3, 47.2], [-4.6, 47.9], [-4.6, 48.6], [-1.6, 48.7], [-1.3, 49.7], [0.2, 49.5], [1.6, 50.3], [2.5, 51.1]],
    [[-5.6, 36.0], [-4.4, 36.7], [-2.1, 36.7], [-0.4, 38.3], [0.2, 39.6], [0.9, 41], [3.2, 42.0], [3.1, 43.1], [4.8, 43.4], [6.0, 43.1], [7.3, 43.7], [8.5, 44.3], [9.9, 44.1], [10.5, 43.4]]
  ];
  var CITIES = [
    { id: 'dakar', lon: -17.44, lat: 14.69, label: 'Dakar', sub: FR ? 'origine' : 'origin', color: 'var(--pirogue-sun)' },
    { id: 'maroc', lon: -6.6, lat: 34.2, label: 'Kénitra · Rabat', sub: FR ? 'licence · stage' : "bachelor's · internship", color: 'var(--pirogue-red)' },
    { id: 'nice', lon: 7.26, lat: 43.7, label: 'Nice', sub: FR ? 'responsable SI' : 'head of IT', color: 'var(--pirogue-sea)' },
    { id: 'paris', lon: 2.35, lat: 48.86, label: 'Paris', sub: FR ? 'mastère · aujourd’hui' : "master's · today", color: 'var(--accent)' }
  ];
  var routeEl = document.getElementById('route');
  var mapEl = document.getElementById('routeMap');
  if (routeEl && mapEl) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + MAP.w + ' ' + MAP.h);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', FR ? 'Carte schématique du parcours : Dakar, Kénitra et Rabat, Nice, puis Paris.' : 'Schematic map of the journey: Dakar, Kenitra and Rabat, Nice, then Paris.');
    var html = '<defs><linearGradient id="routeGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F2B33D"/><stop offset=".45" stop-color="#E2553E"/><stop offset="1" stop-color="#89A2FF"/></linearGradient></defs>';
    for (var lat = 15; lat <= 50; lat += 5) {
      var gy = px(0, lat)[1];
      html += '<line class="grat" x1="' + MAP.pad + '" x2="' + (MAP.w - MAP.pad) + '" y1="' + gy + '" y2="' + gy + '"/>';
      html += '<text class="grat-label" x="' + (MAP.w - MAP.pad - 2) + '" y="' + (gy - 3) + '" text-anchor="end">' + lat + '°N</text>';
    }
    for (var lon = -15; lon <= 10; lon += 5) {
      var gx = px(lon, 0)[0];
      html += '<line class="grat" y1="' + MAP.pad + '" y2="' + (MAP.h - MAP.pad) + '" x1="' + gx + '" x2="' + gx + '"/>';
    }
    COAST.forEach(function (line) {
      html += '<polyline class="coast" points="' + line.map(function (p) { return px(p[0], p[1]).join(','); }).join(' ') + '"/>';
    });
    var pts = CITIES.map(function (c) { return px(c.lon, c.lat); });
    var d = 'M' + pts[0].join(',');
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, k = 0.22;
      d += ' Q' + (mx - (b[1] - a[1]) * k).toFixed(1) + ',' + (my + (b[0] - a[0]) * k).toFixed(1) + ' ' + b.join(',');
    }
    html += '<path class="path" id="routePath" d="' + d + '"/>';
    CITIES.forEach(function (c, idx) {
      var p = px(c.lon, c.lat), right = c.id !== 'paris', tx = p[0] + (right ? 14 : -14), anchor = right ? 'start' : 'end';
      html += '<g class="city" style="transition-delay:' + (0.3 + idx * 0.55) + 's">'
        + '<circle class="halo" cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + c.color + '"/>'
        + '<circle class="core" cx="' + p[0] + '" cy="' + p[1] + '" r="5" stroke="' + c.color + '"/>'
        + '<text x="' + tx + '" y="' + (p[1] - 2) + '" text-anchor="' + anchor + '">' + c.label + '</text>'
        + '<text class="sub" x="' + tx + '" y="' + (p[1] + 11) + '" text-anchor="' + anchor + '">' + c.sub + '</text></g>';
    });
    html += '<circle class="packet" r="4" cx="' + pts[0][0] + '" cy="' + pts[0][1] + '"/>';
    svg.innerHTML = html;
    mapEl.appendChild(svg);
    var path = svg.querySelector('#routePath'), packet = svg.querySelector('.packet');
    var len = Math.ceil(path.getTotalLength());
    path.style.setProperty('--len', len);
    Array.prototype.forEach.call(routeEl.querySelectorAll('.trace li'), function (li, n) { li.style.transitionDelay = (0.3 + n * 0.45) + 's'; });
    var PACKET_MS = 2600;
    var sendPacket = function () {
      var start = null;
      var step = function (now) {
        if (start === null) start = now;
        var t = Math.min((now - start) / PACKET_MS, 1), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        var p = path.getPointAtLength(e * len);
        packet.setAttribute('cx', p.x.toFixed(1)); packet.setAttribute('cy', p.y.toFixed(1));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var light = function () {
      routeEl.classList.add('on');
      if (!reduceMotion) { sendPacket(); return; }
      var end = path.getPointAtLength(len); packet.setAttribute('cx', end.x); packet.setAttribute('cy', end.y);
    };
    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { light(); io.disconnect(); } }, { threshold: 0.35 });
      io.observe(routeEl);
    } else { light(); }
  }

  /* ---------- Wax motif: tiles chosen from the bytes of SHA-256(seed), mirrored like a textile ---------- */
  var WAX_COLS = 20, WAX_ROWS = 2, WAX_TILE = 60, WAX_BG = '#0A0F1C';
  var PALETTE = ['#F2B33D', '#E2553E', '#3A86D9', '#2FA77A', '#F4EFE6', '#89A2FF', '#B48CFF'];
  var waxEl = document.getElementById('waxBand');
  function toHex(bytes) { return Array.prototype.map.call(bytes, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function seedHex() { var b = new Uint8Array(16); crypto.getRandomValues(b); return toHex(b); }
  function tile(kind, x, y, s, c1, c2) {
    var h = s / 2, q = s / 4, out = '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" fill="' + WAX_BG + '"/>';
    switch (kind) {
      case 0: return out + '<path d="M' + (x + h) + ' ' + (y + 4) + 'L' + (x + s - 4) + ' ' + (y + h) + 'L' + (x + h) + ' ' + (y + s - 4) + 'L' + (x + 4) + ' ' + (y + h) + 'Z" fill="' + c1 + '"/>'
        + '<path d="M' + (x + h) + ' ' + (y + q + 4) + 'L' + (x + s - q - 4) + ' ' + (y + h) + 'L' + (x + h) + ' ' + (y + s - q - 4) + 'L' + (x + q + 4) + ' ' + (y + h) + 'Z" fill="' + c2 + '"/>';
      case 1: return out + '<path d="M' + x + ' ' + (y + s) + 'L' + (x + h) + ' ' + y + 'L' + (x + s) + ' ' + (y + s) + 'Z" fill="' + c1 + '"/>'
        + '<path d="M' + (x + q) + ' ' + (y + s) + 'L' + (x + h) + ' ' + (y + h) + 'L' + (x + s - q) + ' ' + (y + s) + 'Z" fill="' + c2 + '"/>';
      case 2: return out + '<polyline points="' + x + ',' + (y + q) + ' ' + (x + q) + ',' + (y + 4) + ' ' + (x + h) + ',' + (y + q) + ' ' + (x + 3 * q) + ',' + (y + 4) + ' ' + (x + s) + ',' + (y + q) + '" fill="none" stroke="' + c1 + '" stroke-width="5"/>'
        + '<polyline points="' + x + ',' + (y + 3 * q) + ' ' + (x + q) + ',' + (y + h) + ' ' + (x + h) + ',' + (y + 3 * q) + ' ' + (x + 3 * q) + ',' + (y + h) + ' ' + (x + s) + ',' + (y + 3 * q) + '" fill="none" stroke="' + c2 + '" stroke-width="5"/>';
      case 3: return out + '<circle cx="' + (x + h) + '" cy="' + (y + h) + '" r="' + (h - 5) + '" fill="' + c1 + '"/><circle cx="' + (x + h) + '" cy="' + (y + h) + '" r="' + (h - 13) + '" fill="' + WAX_BG + '"/>'
        + '<circle cx="' + (x + h) + '" cy="' + (y + h) + '" r="' + (q - 4) + '" fill="' + c2 + '"/>';
      case 4: return out + '<rect x="' + (x + h - 5) + '" y="' + (y + 5) + '" width="10" height="' + (s - 10) + '" fill="' + c1 + '"/><rect x="' + (x + 5) + '" y="' + (y + h - 5) + '" width="' + (s - 10) + '" height="10" fill="' + c1 + '"/>'
        + '<rect x="' + (x + h - 5) + '" y="' + (y + h - 5) + '" width="10" height="10" fill="' + c2 + '"/>';
      default: return out + '<rect x="' + x + '" y="' + (y + 6) + '" width="' + s + '" height="8" fill="' + c1 + '"/><rect x="' + x + '" y="' + (y + 26) + '" width="' + s + '" height="8" fill="' + c2 + '"/>'
        + '<rect x="' + x + '" y="' + (y + 46) + '" width="' + s + '" height="8" fill="' + c1 + '"/>';
    }
  }
  function drawWax(seed) {
    if (!waxEl || !window.crypto || !crypto.subtle) return;
    crypto.subtle.digest('SHA-256', new TextEncoder().encode('teranga:' + seed)).then(function (buf) {
      var bytes = new Uint8Array(buf), half = WAX_COLS / 2, out = '';
      for (var r = 0; r < WAX_ROWS; r++) {
        for (var c = 0; c < half; c++) {
          var b = bytes[(r * half + c) % bytes.length], b2 = bytes[(r * half + c + 7) % bytes.length];
          var kind = b % 6, c1 = PALETTE[b2 % PALETTE.length], c2 = PALETTE[(b2 >> 3) % PALETTE.length];
          if (c2 === c1) c2 = PALETTE[(PALETTE.indexOf(c1) + 2) % PALETTE.length];
          out += tile(kind, c * WAX_TILE, r * WAX_TILE, WAX_TILE, c1, c2);
          out += tile(kind, (WAX_COLS - 1 - c) * WAX_TILE, r * WAX_TILE, WAX_TILE, c1, c2);
        }
      }
      var hex = toHex(bytes);
      waxEl.innerHTML = '<svg viewBox="0 0 ' + (WAX_COLS * WAX_TILE) + ' ' + (WAX_ROWS * WAX_TILE) + '" role="img" aria-label="'
        + (FR ? 'Motif géométrique façon wax, généré à partir d’une empreinte SHA-256' : 'Wax-style geometric pattern generated from a SHA-256 digest') + '">' + out + '</svg>';
      var cap = document.getElementById('waxHash');
      if (cap) cap.textContent = hex.slice(0, 16) + '…' + hex.slice(-8);
    });
  }
  function regenerateWax() {
    var s = seedHex();
    try { localStorage.setItem('teranga-seed', s); } catch (e) { /* private mode: the pattern just changes per visit */ }
    drawWax(s);
  }
  if (waxEl) {
    var seed = null;
    try { seed = localStorage.getItem('teranga-seed'); } catch (e) { seed = null; }
    if (!/^[0-9a-f]{32}$/.test(seed || '')) { seed = seedHex(); try { localStorage.setItem('teranga-seed', seed); } catch (e) { /* ignore */ } }
    drawWax(seed);
    var wb = document.getElementById('waxNew');
    if (wb) { wb.textContent = T.newWax; wb.addEventListener('click', regenerateWax); }
    var wl = document.getElementById('waxLabel');
    if (wl) wl.textContent = T.waxCap;
  }

  /* ---------- Wolof proverb of the day ---------- */
  var pv = document.getElementById('proverb');
  if (pv) {
    var item = T.proverbs[Math.floor(Date.now() / 86400000) % T.proverbs.length];
    pv.querySelector('blockquote').textContent = item[0];
    pv.querySelector('[data-p="tr"]').textContent = item[1];
    pv.querySelector('[data-p="sense"]').innerHTML = item[2];
  }
})();
