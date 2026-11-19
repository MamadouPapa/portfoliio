/* Teranga layer: telemetry strip, ⌘K palette, traceroute map, live GitHub stats, Wolof proverb.
   Everything degrades gracefully: static HTML stays readable without JS. */
(function () {
  'use strict';
  var FR = document.documentElement.lang === 'fr';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = FR ? {
    placeholder: 'Tapez une commande… (cv, projets, contact)', hint: '↑ ↓ pour naviguer · Entrée pour lancer · Échap pour fermer',
    cmds: [
      ['Aller à : Couverture', '#couverture'], ['Aller à : Projets', '#projets'], ['Aller à : Missions', '#missions'],
      ['Aller à : Console PowerShell', '#console'], ['Aller à : Itinéraire (traceroute)', '#itineraire'], ['Aller à : Parcours', '#parcours'],
      ['Aller à : Hors écran', '#hors-ecran'],
      ['Télécharger mon CV', 'cv/CV_Papa_Mamadou_Gueye.pdf'], ['Copier mon e-mail', 'copy:papa@pmgueye.fr'],
      ['Ouvrir GitHub', 'https://github.com/MamadouPapa'], ['Ouvrir le lab webstack-lab', 'https://github.com/MamadouPapa/webstack-lab'],
      ['Ouvrir LinkedIn', 'https://www.linkedin.com/in/papa-mamadou-gueye-developpeur-cybersecurite'],
      ['Jouer : tenir le pare-feu', '#jeu'], ['English version', 'en/'], ['whoami', '#top']
    ],
    proverbs: [
      ['Ndank ndank mooy japp golo ci naay.', '« Doucement, doucement, on attrape le singe dans la forêt. »', 'En sécurité aussi, <em>la méthode et la patience</em> battent la précipitation.'],
      ['Nit nitay garabam.', '« L’homme est le remède de l’homme. »', 'Aucun SI ne se protège seul : <em>la sécurité, ce sont d’abord des gens</em> qui s’entraident.']
    ]
  } : {
    placeholder: 'Type a command… (cv, projects, contact)', hint: '↑ ↓ to move · Enter to run · Esc to close',
    cmds: [
      ['Go to: Coverage', '#coverage'], ['Go to: Projects', '#projects'], ['Go to: Experience', '#missions'],
      ['Go to: PowerShell console', '#console'], ['Go to: Journey (traceroute)', '#journey'], ['Go to: Background', '#background'],
      ['Go to: Off screen', '#off-screen'],
      ['Download my CV', '../cv/CV_Papa_Mamadou_Gueye_EN.pdf'], ['Copy my e-mail', 'copy:papa@pmgueye.fr'],
      ['Open GitHub', 'https://github.com/MamadouPapa'], ['Open the webstack-lab repo', 'https://github.com/MamadouPapa/webstack-lab'],
      ['Open LinkedIn', 'https://www.linkedin.com/in/papa-mamadou-gueye-developpeur-cybersecurite'],
      ['Play: hold the firewall', '#jeu'], ['Version française', '../'], ['whoami', '#top']
    ],
    proverbs: [
      ['Ndank ndank mooy japp golo ci naay.', '“Slowly, slowly, you catch the monkey in the forest.”', 'In security too, <em>method and patience</em> beat haste.'],
      ['Nit nitay garabam.', '“People are each other’s remedy.”', 'No system protects itself: <em>security starts with people</em> helping each other.']
    ]
  };

  /* ---------- Telemetry strip: Paris clock, TLS, measured LCP ---------- */
  var tele = document.getElementById('telemetry');
  if (tele) {
    var clock = function (tz) {
      try { return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date()); }
      catch (e) { return '--:--'; }
    };
    var par = tele.querySelector('[data-t="par"] b');
    var tick = function () { par.textContent = clock('Europe/Paris'); };
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

  /* ---------- Live GitHub stats (public API, cached 10 min per tab to respect the 60 req/h limit) ---------- */
  var GH_USER = 'MamadouPapa', GH_CACHE_KEY = 'gh-live-v2', GH_CACHE_MS = 600000, GH_RECENT = 5;
  var gh = document.getElementById('ghLive');
  var GHT = FR
    ? { repos: 'dépôts publics', days: 'jours actifs (30 derniers jours)', pushes: 'commits poussés (30 derniers jours)', last: 'dernier push', recent: 'Derniers dépôts mis à jour', langs: 'Langages', fail: 'Données GitHub indisponibles pour le moment.', open: 'Voir le profil GitHub', ago: ['à l’instant', 'il y a %d min', 'il y a %d h', 'il y a %d j'] }
    : { repos: 'public repositories', days: 'active days (last 30 days)', pushes: 'commits pushed (last 30 days)', last: 'last push', recent: 'Recently updated repositories', langs: 'Languages', fail: 'GitHub data unavailable right now.', open: 'Open GitHub profile', ago: ['just now', '%d min ago', '%d h ago', '%d d ago'] };
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return GHT.ago[0];
    if (m < 60) return GHT.ago[1].replace('%d', m);
    if (m < 1440) return GHT.ago[2].replace('%d', Math.round(m / 60));
    return GHT.ago[3].replace('%d', Math.round(m / 1440));
  }
  function esc(v) { var d = document.createElement('div'); d.textContent = String(v); return d.innerHTML; }
  function summarise(repos, events) {
    var since = Date.now() - 30 * 86400000, pushes = 0, days = {}, langs = {};
    events.forEach(function (e) {
      if (e.type !== 'PushEvent' || new Date(e.created_at).getTime() < since) return;
      pushes += (e.payload && e.payload.size) || 1;
      days[e.created_at.slice(0, 10)] = true;
    });
    repos.forEach(function (r) { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
    return {
      repos: repos.length,
      days: Object.keys(days).length,
      pushes: pushes,
      last: repos.length ? repos[0].pushed_at : null,
      recent: repos.slice(0, GH_RECENT).map(function (r) { return { name: r.name, url: r.html_url, lang: r.language, pushed: r.pushed_at }; }),
      langs: Object.keys(langs).sort(function (x, y) { return langs[y] - langs[x]; })
    };
  }
  function renderGh(d) {
    var stat = function (v, l) { return '<div class="gh-stat"><b>' + esc(v) + '</b><span>' + l + '</span></div>'; };
    var rows = d.recent.map(function (r) {
      return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a><span>' + esc(r.lang || '—') + '</span><time>' + ago(r.pushed) + '</time></li>';
    }).join('');
    gh.querySelector('.gh-body').innerHTML = '<div class="gh-stats">' + stat(d.repos, GHT.repos) + stat(d.pushes, GHT.pushes) + stat(d.days, GHT.days) + stat(d.last ? ago(d.last) : '—', GHT.last) + '</div>'
      + '<div class="gh-cols"><div><p class="label">' + GHT.recent + '</p><ul class="gh-recent">' + rows + '</ul></div>'
      + '<div><p class="label">' + GHT.langs + '</p><div class="gh-langs">' + d.langs.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div></div></div>';
  }
  function ghFail() {
    gh.querySelector('.gh-body').innerHTML = '<p class="gh-loading">' + GHT.fail + ' <a href="https://github.com/' + GH_USER + '" target="_blank" rel="noopener">' + GHT.open + '</a></p>';
  }
  if (gh && window.fetch) {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(GH_CACHE_KEY) || 'null'); } catch (e) { cached = null; }
    if (cached && Date.now() - cached.at < GH_CACHE_MS) { renderGh(cached.data); }
    else {
      var get = function (u) { return fetch('https://api.github.com' + u, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); };
      Promise.all([get('/users/' + GH_USER + '/repos?per_page=100&sort=pushed'), get('/users/' + GH_USER + '/events/public?per_page=100')])
        .then(function (res) {
          var data = summarise(res[0].filter(function (r) { return !r.fork && r.name !== GH_USER; }), res[1]);
          try { sessionStorage.setItem(GH_CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* storage blocked: just refetch next time */ }
          renderGh(data);
        })
        .catch(ghFail);
    }
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
