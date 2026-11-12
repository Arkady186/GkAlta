/* Выбор квартиры по этажам (лёгкий, без 3D): секция → этаж (свайп) → квартира на плане этажа.
   План рисуется по чертежу (window.ALTA_FLOORS); на телефоне он повёрнут вертикально, чтобы квартиры были крупными. */
(function () {
  'use strict';
  var D = window.ALTA, F = window.ALTA_FLOORS;
  var root = document.getElementById('chooser');
  if (!D || !F || !root) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n, d) { return n.toLocaleString('ru-RU', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d }); };
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  var FMIN = 2, FMAX = 16, FH = 3.1;
  var TYPES = {
    '1С': { name: 'Студия', mini: 'Студия', short: 'Ст', color: '#b6a6d8' },
    '1К': { name: 'Однокомнатная', mini: '1-комн.', short: '1к', color: '#98bad3' },
    '2Е': { name: 'Евродвушка', mini: 'Евро-2', short: 'Е2', color: '#a6c69c' },
    '2К': { name: 'Двухкомнатная', mini: '2-комн.', short: '2к', color: '#e2c88b' },
    '3Е': { name: 'Евротрёшка', mini: 'Евро-3', short: 'Е3', color: '#e0a179' },
    '3К': { name: 'Трёхкомнатная', mini: '3-комн.', short: '3к', color: '#d9979a' }
  };
  var ORDER = ['1С', '1К', '2Е', '2К', '3Е', '3К'];
  var HOMES = D.buildings.filter(function (b) { return b.kind === 'home'; });

  var secsEl = $('#chSecs'), floorsEl = $('#chFloors'), planEl = $('#chPlan'), pickEl = $('#chPick'),
      floorBig = $('#chFloorBig'), legendEl = $('#chLegend');
  var S = { b: HOMES[0], floor: 7, apt: null };

  function centroid(poly) {
    var a = 0, x = 0, y = 0;
    for (var i = 0, n = poly.length; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n], c = p[0] * q[1] - q[0] * p[1];
      a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c;
    }
    a *= 0.5;
    return a ? { x: x / (6 * a), z: y / (6 * a), area: Math.abs(a) } : { x: poly[0][0], z: poly[0][1], area: 0 };
  }

  /* план этажа: tall = повернуть на 90° (длинная сторона дома — по вертикали) */
  var cache = {};
  function planSVG(st, mir, tall) {
    var key = st + '|' + mir + '|' + tall;
    if (cache[key]) return cache[key];
    var f = F[st], s = mir ? -1 : 1;
    var P = function (p) { var x = s * p[0], z = p[1]; return tall ? [z, x] : [x, z]; };
    var pts = function (poly) { return poly.map(function (p) { var q = P(p); return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' '); };
    var w = f.w, d = f.d, M = 0.6, k = tall ? 1.5 : 1;          // k — кегль подписей в метрах плана
    var vb = tall ? [-d / 2 - M, -w / 2 - M, d + 2 * M, w + 2 * M] : [-w / 2 - M, -d / 2 - M, w + 2 * M, d + 2 * M];
    var h = '<svg class="ch-svg" viewBox="' + vb.map(function (v) { return v.toFixed(2); }).join(' ') + '" width="' + Math.round(vb[2] * 10) + '" height="' + Math.round(vb[3] * 10) + '" role="group" aria-label="План этажа">';
    h += '<polygon class="ch-foot" points="' + pts(f.foot) + '"/>';
    (f.core || []).forEach(function (c) { h += '<polygon class="ch-core" points="' + pts(c) + '"/>'; });
    f.apts.forEach(function (a) {
      var t = TYPES[a.type], big = a.poly.reduce(function (m, p) { var c = centroid(p); return c.area > m.area ? c : m; }, { area: 0 });
      h += '<g class="ch-apt" data-n="' + a.n + '" style="--c:' + t.color + '" tabindex="0" role="button" aria-label="' + t.name + ', ' + fmt(a.total, 2) + ' м²">';
      a.poly.forEach(function (p) { h += '<polygon points="' + pts(p) + '"/>'; });
      var c = P([big.x, big.z]);
      h += '<text x="' + c[0].toFixed(2) + '" y="' + (c[1] - 0.3 * k).toFixed(2) + '" class="ch-t1" font-size="' + k + '">' + t.short + '</text>';
      h += '<text x="' + c[0].toFixed(2) + '" y="' + (c[1] + 0.95 * k).toFixed(2) + '" class="ch-t2" font-size="' + (0.8 * k).toFixed(2) + '">' + fmt(a.total, 1) + '</text>';
      h += '</g>';
    });
    var ring = function (r) { return 'M' + pts(r).replace(/ /g, 'L') + 'Z'; };
    (f.walls || []).forEach(function (wl) { h += '<path class="ch-wall" fill-rule="evenodd" d="' + ring(wl.o) + (wl.h || []).map(ring).join('') + '"/>'; });
    h += '</svg>';
    return (cache[key] = h);
  }

  function tall() { return window.matchMedia('(max-width: 860px) and (orientation: portrait)').matches; }

  /* ───────── разметка ───────── */
  secsEl.innerHTML = HOMES.map(function (b) {
    return '<button type="button" class="ch-sec" data-sec="' + b.id + '" aria-pressed="false"><b>' + b.id + '</b><span>' + ROMAN[b.phase] + ' оч.</span></button>';
  }).join('');
  var fl = '';
  for (var i = FMAX; i >= FMIN; i--) fl += '<button type="button" class="ch-floor" data-floor="' + i + '" aria-pressed="false">' + i + '</button>';
  floorsEl.innerHTML = fl;

  function renderLegend() {
    var cnt = {}; F[S.b.st].apts.forEach(function (a) { cnt[a.type] = (cnt[a.type] || 0) + 1; });
    legendEl.innerHTML = ORDER.filter(function (t) { return cnt[t]; }).map(function (t) {
      return '<span title="' + TYPES[t].name + '"><i style="background:' + TYPES[t].color + '"></i>' + (tall() ? TYPES[t].mini : TYPES[t].name) + ' <b>' + cnt[t] + '</b></span>';
    }).join('');
  }
  function center(el, box, smooth) {
    if (!el) return;
    var b = smooth ? 'smooth' : 'auto', r = el.getBoundingClientRect(), R = box.getBoundingClientRect();
    if (box.scrollWidth > box.clientWidth + 1) box.scrollTo({ left: box.scrollLeft + r.left - R.left - (box.clientWidth - r.width) / 2, behavior: b });
    if (box.scrollHeight > box.clientHeight + 1) box.scrollTo({ top: box.scrollTop + r.top - R.top - (box.clientHeight - r.height) / 2, behavior: b });
  }

  function renderPlan() {
    var mir = /\.1$/.test(S.b.type), tl = tall();
    root.classList.toggle('is-tall', tl);
    planEl.innerHTML = planSVG(S.b.st, mir, tl);
    markApt();
  }
  function setSection(id, keepFloor) {
    S.b = HOMES.filter(function (b) { return b.id === id; })[0] || HOMES[0];
    S.apt = null;
    $$('.ch-sec', secsEl).forEach(function (b) { var on = +b.dataset.sec === S.b.id; b.setAttribute('aria-pressed', String(on)); if (on) center(b, secsEl, true); });
    $('#chSecInfo').innerHTML = 'Секция ' + S.b.id + ', ' + ROMAN[S.b.phase] + ' очередь<br>' + S.b.perFloor + ' квартир на этаже';
    renderLegend(); renderPlan(); renderPick();
    if (!keepFloor) setFloor(S.floor, false);
  }
  function setFloor(n, smooth) {
    S.floor = Math.max(FMIN, Math.min(FMAX, n));
    $$('.ch-floor', floorsEl).forEach(function (b) { var on = +b.dataset.floor === S.floor; b.setAttribute('aria-pressed', String(on)); if (on) center(b, floorsEl, smooth); });
    floorBig.innerHTML = '<b>' + S.floor + '</b><span>этаж<br>≈ ' + Math.round((S.floor - 1) * FH + 0.5) + ' м над землёй</span>';
    floorBig.classList.remove('is-swap'); void floorBig.offsetWidth; floorBig.classList.add('is-swap');
    renderPick();
  }
  function markApt() {
    $$('.ch-apt', planEl).forEach(function (g) { g.classList.toggle('is-on', +g.dataset.n === S.apt); });
    planEl.classList.toggle('has-sel', !!S.apt);
  }
  function apt() { return S.apt ? F[S.b.st].apts.filter(function (a) { return a.n === S.apt; })[0] : null; }
  function renderPick() {
    var a = apt();
    root.classList.toggle('has-pick', !!a);
    if (!a) { pickEl.innerHTML = '<p class="ch-pick-hint">Нажмите на квартиру на плане</p>'; return; }
    var t = TYPES[a.type];
    pickEl.innerHTML = '<div class="ch-pick-i"><p><i style="background:' + t.color + '"></i>' + t.name + '</p><b>' + fmt(a.total, 2) + ' м²</b><span>Секция ' + S.b.id + ', этаж ' + S.floor + '</span></div>' +
      '<div class="ch-pick-a"><button type="button" class="btn ch-3d" data-ch="walk" aria-label="Прогулка по квартире в 3D">Прогулка</button><button type="button" class="btn ch-open" data-ch="open">Подробнее</button></div>';
  }

  secsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-sec]'); if (b) setSection(+b.dataset.sec, true); });
  floorsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-floor]'); if (b) setFloor(+b.dataset.floor, true); });
  function tapApt(e) {
    var g = e.target.closest('.ch-apt'); if (!g) return;
    S.apt = +g.dataset.n === S.apt ? null : +g.dataset.n; markApt(); renderPick();
  }
  planEl.addEventListener('click', tapApt);
  planEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapApt(e); } });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ch]'); if (!b) return;
    var a = apt(), k = b.dataset.ch;
    if (k === 'close') close();
    else if (k === 'up') setFloor(S.floor + 1, true);
    else if (k === 'down') setFloor(S.floor - 1, true);
    else if (k === '3d') { if (window.ALTA_openPicker) window.ALTA_openPicker(S.b.id, S.floor, S.apt || undefined); }
    else if (!a) return;
    else if (k === 'open') { if (window.ALTA_openFlat) window.ALTA_openFlat(S.b.id + '-' + S.floor + '-' + a.n, { solo: true }); }
    else if (k === 'walk') {
      var t = TYPES[a.type];
      window.ALTA_openWalk && window.ALTA_openWalk({ st: S.b.st, n: a.n, mirror: /\.1$/.test(S.b.type), floor: S.floor, section: S.b.id, name: t.name, total: a.total,
        tour: { type: a.type, name: t.name, n: a.n, floor: S.floor, section: S.b.id, total: a.total } });
    }
  });

  // свайп по плану влево-вправо — этаж выше / ниже
  var sw = null;
  planEl.addEventListener('touchstart', function (e) { if (e.touches.length === 1) sw = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  planEl.addEventListener('touchend', function (e) {
    if (!sw) return; var t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setFloor(S.floor + (dx < 0 ? 1 : -1), true);
  }, { passive: true });

  var mq = window.matchMedia('(max-width: 860px) and (orientation: portrait)');
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () { if (root.classList.contains('is-open')) { renderLegend(); renderPlan(); } });

  /* ───────── открыть / закрыть ───────── */
  var lastFocus = null;
  function open(sectionId, floor) {
    lastFocus = document.activeElement;
    root.classList.add('is-open'); root.inert = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ch-open');
    var nav = document.getElementById('nav'); if (nav) nav.classList.remove('is-open');
    if (floor) S.floor = floor;
    setSection(sectionId || S.b.id);
    setTimeout(function () { $('#chTitle').focus({ preventScroll: true }); }, 50);
  }
  function close() {
    root.classList.remove('is-open'); root.inert = true; root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ch-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  // что было открыто поверх в момент нажатия (до того, как другие окна закроются по этому же Esc)
  window.addEventListener('keydown', function (e) {
    var c = document.body.classList;
    e.__over = c.contains('picker-open') || c.contains('walk-open') || c.contains('cat-open') || c.contains('tour-open');
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('is-open') || e.__over) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowUp' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); setFloor(S.floor + 1, true); }
    else if (e.key === 'ArrowDown' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); setFloor(S.floor - 1, true); }
  });
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-floors]'); if (!c) return;
    e.preventDefault(); e.stopPropagation();
    open(+c.dataset.floors || null);
  }, true);

  window.ALTA_openFloors = open;
})();
