/* Каталог квартир: вкладки по комнатности, фильтры, карточки с планировками, окно квартиры и ссылка на неё.
   Данные: секции — window.ALTA.buildings, квартиры этажа — window.ALTA_FLOORS, комнаты и мебель — window.ALTA_WALK. */
(function () {
  'use strict';
  var D = window.ALTA, F = window.ALTA_FLOORS, W = window.ALTA_WALK || {};
  if (!D || !F) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n, d) { return n.toLocaleString('ru-RU', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d }); };
  var MAIL = 'gk.alta.2026@mail.ru';
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  var FLOOR_MIN = 2, FLOOR_MAX = 16;

  var TYPES = {
    '1С': { name: 'Студия', rooms: 0, euro: false },
    '1К': { name: 'Однокомнатная', rooms: 1, euro: false },
    '2Е': { name: 'Евродвушка', rooms: 2, euro: true },
    '2К': { name: 'Двухкомнатная', rooms: 2, euro: false },
    '3Е': { name: 'Евротрёшка', rooms: 3, euro: true },
    '3К': { name: 'Трёхкомнатная', rooms: 3, euro: false }
  };
  var TABS = [
    { id: 'all', label: 'Все' },
    { id: '0', label: 'Студии' },
    { id: '1', label: '1-комнатные' },
    { id: '2', label: '2-комнатные' },
    { id: '3', label: '3-комнатные' }
  ];

  /* ───────── все квартиры комплекса ───────── */
  var HOMES = D.buildings.filter(function (b) { return b.kind === 'home'; });
  var ALL = [];
  HOMES.forEach(function (b) {
    var mir = /\.1$/.test(b.type);
    for (var fl = FLOOR_MIN; fl <= FLOOR_MAX; fl++) {
      F[b.st].apts.forEach(function (a) {
        ALL.push({ id: b.id + '-' + fl + '-' + a.n, b: b, sec: b.id, st: b.st, mir: mir, floor: fl, n: a.n, type: a.type,
          total: a.total, flat: a.flat, live: a.live, phase: b.phase });
      });
    }
  });
  var BY_ID = {}; ALL.forEach(function (f) { BY_ID[f.id] = f; });
  var AREA_MIN = Math.floor(Math.min.apply(null, ALL.map(function (f) { return f.total; })));
  var AREA_MAX = Math.ceil(Math.max.apply(null, ALL.map(function (f) { return f.total; })));

  // цена: появится, когда в data.js будет заполнен блок prices (цена за м² по секциям или по типам)
  function priceOf(f) {
    var P = D.prices; if (!P) return null;
    var m2 = (P.bySection && P.bySection[f.sec]) || (P.byType && P.byType[f.type]) || P.perM2;
    if (!m2) return null;
    if (P.floorStep) m2 += (f.floor - FLOOR_MIN) * P.floorStep;
    return { m2: m2, sum: Math.round(m2 * f.total / 1000) * 1000 };
  }
  function handover(f) { return D.handover && D.handover[f.phase] || null; }

  /* ───────── планировка квартиры: SVG по чертежу ───────── */
  var ROOMFILL = { bath: '#e4ecee', loggia: '#ece5d4', hall: '#f4efe4', closet: '#f1ebdd' };
  var NOFURN = { rug: 1, rugr: 1, accent: 1, headpanel: 1, slats: 1, pendant: 1, curtain: 1, mirror: 1, floorlamp: 1, lamp: 1 };
  var svgCache = {};
  function clipRect(r, b) {
    var x0 = Math.max(r[0], b[0]), z0 = Math.max(r[1], b[1]), x1 = Math.min(r[2], b[2]), z1 = Math.min(r[3], b[3]);
    return x1 > x0 && z1 > z0 ? [x0, z0, x1, z1] : null;
  }
  function planSVG(st, n, mir, opts) {
    opts = opts || {};
    var key = st + '|' + n + '|' + mir + '|' + (opts.labels ? 1 : 0);
    if (svgCache[key]) return svgCache[key];
    var w = W[st], a = w && w.apts[n];
    if (!a) return '';
    var s = mir ? -1 : 1, P = 0.45;
    var bx = a.box, x0 = bx[0] - P, z0 = bx[1] - P, x1 = bx[2] + P, z1 = bx[3] + P;
    var vx = s > 0 ? x0 : -x1, vw = x1 - x0, vh = z1 - z0;
    var X = function (x) { return (s * x).toFixed(3); }, Z = function (z) { return z.toFixed(3); };
    var poly = function (p) { return p.map(function (q) { return X(q[0]) + ',' + Z(q[1]); }).join(' '); };
    var rect = function (r, cls) {
      var xa = s * r[0], xb = s * r[2];
      return '<rect class="' + cls + '" x="' + Math.min(xa, xb).toFixed(3) + '" y="' + Z(r[1]) + '" width="' + Math.abs(xb - xa).toFixed(3) + '" height="' + (r[3] - r[1]).toFixed(3) + '"/>';
    };
    var cid = 'cp' + st + '_' + n + (mir ? 'm' : '') + (opts.labels ? 'l' : '');
    var h = '<svg class="plan-svg" viewBox="' + vx.toFixed(2) + ' ' + z0.toFixed(2) + ' ' + vw.toFixed(2) + ' ' + vh.toFixed(2) + '" role="img" aria-label="Планировка">';
    h += '<defs><clipPath id="' + cid + '">' + a.rooms.map(function (r) { return (r.fp || r.poly).map(function (p) { return '<polygon points="' + poly(p) + '"/>'; }).join(''); }).join('') + '</clipPath></defs>';
    // комнаты
    a.rooms.forEach(function (r) {
      var fill = ROOMFILL[r.k] || '#fbf9f3';
      (r.fp || r.poly).forEach(function (p) { h += '<polygon points="' + poly(p) + '" fill="' + fill + '"/>'; });
    });
    // мебель
    h += '<g class="pf">';
    a.furn.forEach(function (f) {
      if (NOFURN[f[0]]) return;
      var ww = f[3], dd = f[4], rot = f[5], sw = rot % 2 ? dd : ww, sd = rot % 2 ? ww : dd;
      if (f[0] === 'plant') { h += '<circle cx="' + X(f[1]) + '" cy="' + Z(f[2]) + '" r="' + (Math.min(ww, dd) / 2).toFixed(3) + '"/>'; return; }
      var rr = /tub|toilet|vanity|wcsink|chair|armch|sofa|bed|pouf|stool/.test(f[0]) ? 0.08 : 0.03;
      h += '<rect x="' + (s * f[1] - sw / 2).toFixed(3) + '" y="' + (f[2] - sd / 2).toFixed(3) + '" width="' + sw.toFixed(3) + '" height="' + sd.toFixed(3) + '" rx="' + rr + '"/>';
    });
    h += '</g>';
    // стены, окна, входная дверь — только в пределах квартиры
    var cb = [x0, z0, x1, z1];
    h += '<g clip-path="url(#' + cid + ')">';
    w.walls.forEach(function (r) { var c = clipRect(r, cb); if (c) h += rect(c, 'pw'); });
    w.win.forEach(function (r) { var c = clipRect(r, cb); if (c) h += rect(c, 'pn'); });
    (w.entr || []).forEach(function (r) { var c = clipRect(r, cb); if (c) h += rect(c, 'pe'); });
    h += '</g>';
    // площади комнат
    a.rooms.forEach(function (r) {
      if (!r.c || r.a < 1.2) return;
      var fs = Math.max(0.3, Math.min(0.46, Math.sqrt(r.a) * 0.12));
      if (opts.labels) {
        h += '<text class="pt-n" x="' + X(r.c[0]) + '" y="' + (r.c[1] - fs * 0.25).toFixed(3) + '" font-size="' + (fs * 0.78).toFixed(3) + '">' + r.name + '</text>';
        h += '<text class="pt" x="' + X(r.c[0]) + '" y="' + (r.c[1] + fs * 0.95).toFixed(3) + '" font-size="' + fs.toFixed(3) + '">' + fmt(r.a, 1) + '</text>';
      } else {
        h += '<text class="pt" x="' + X(r.c[0]) + '" y="' + (r.c[1] + fs * 0.35).toFixed(3) + '" font-size="' + fs.toFixed(3) + '">' + fmt(r.a, 1) + '</text>';
      }
    });
    h += '</svg>';
    return (svgCache[key] = h);
  }

  /* ───────── разметка ───────── */
  var root = $('#catalog');
  if (!root) return;
  var listEl = $('#catList'), countEl = $('#catCount'), tabsEl = $('#catTabs'), subEl = $('#catSub'),
      moreBtn = $('#catMore'), sheet = $('#catSheet'), filtersEl = $('#catFilters'), fBtn = $('#catFilterBtn'),
      modal = $('#flat'), toast = $('#catToast');

  var S = { tab: 'all', sub: 'any', secs: [], fl: [FLOOR_MIN, FLOOR_MAX], ar: [AREA_MIN, AREA_MAX], sort: 'area-asc', shown: 0, view: 'flats' };
  var PAGE = 24, current = [];

  tabsEl.innerHTML = TABS.map(function (t) {
    var c = ALL.filter(function (f) { return t.id === 'all' || TYPES[f.type].rooms === +t.id; }).length;
    return '<button class="cat-tab" type="button" role="tab" data-tab="' + t.id + '" aria-selected="' + (t.id === 'all') + '">' + t.label + '<span>' + fmt(c) + '</span></button>';
  }).join('');

  function dual(id, lo, hi, step, unit) {
    return '<div class="cat-range" data-range="' + id + '">' +
      '<div class="cat-range-v"><span data-v="0"></span><span data-v="1"></span></div>' +
      '<div class="cat-range-t"><i></i><input type="range" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + lo + '" aria-label="' + unit + ' от">' +
      '<input type="range" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + hi + '" aria-label="' + unit + ' до"></div></div>';
  }
  filtersEl.innerHTML =
    '<div class="cat-f"><p class="cat-f-l">Секция</p><div class="cat-secs" id="catSecs">' +
      HOMES.map(function (b) { return '<button type="button" class="cat-sec" data-sec="' + b.id + '" aria-pressed="false">' + b.id + '</button>'; }).join('') +
    '</div></div>' +
    '<div class="cat-f"><p class="cat-f-l">Этаж</p>' + dual('fl', FLOOR_MIN, FLOOR_MAX, 1, 'Этаж') + '</div>' +
    '<div class="cat-f"><p class="cat-f-l">Площадь, м²</p>' + dual('ar', AREA_MIN, AREA_MAX, 1, 'Площадь') + '</div>' +
    '<div class="cat-f cat-f-sort"><p class="cat-f-l">Сортировка</p><select id="catSort" class="cat-select">' +
      '<option value="area-asc">Сначала меньше площадь</option><option value="area-desc">Сначала больше площадь</option>' +
      '<option value="floor-desc">Сначала выше этаж</option><option value="floor-asc">Сначала ниже этаж</option>' +
      '<option value="sec">По секциям</option></select></div>' +
    '<button type="button" class="cat-reset" id="catReset">Сбросить фильтры</button>';

  function syncRange(id) {
    var box = $('[data-range="' + id + '"]', filtersEl), ins = $$('input', box), v = S[id];
    ins[0].value = v[0]; ins[1].value = v[1];
    var lo = +ins[0].min, hi = +ins[0].max, a = (v[0] - lo) / (hi - lo) * 100, b = (v[1] - lo) / (hi - lo) * 100;
    $('i', box).style.cssText = 'left:' + a + '%;right:' + (100 - b) + '%';
    $('[data-v="0"]', box).textContent = 'от ' + v[0];
    $('[data-v="1"]', box).textContent = 'до ' + v[1];
  }
  $$('.cat-range', filtersEl).forEach(function (box) {
    var id = box.dataset.range, ins = $$('input', box);
    ins.forEach(function (inp, k) {
      inp.addEventListener('input', function () {
        var a = +ins[0].value, b = +ins[1].value;
        if (a > b) { if (k === 0) a = b; else b = a; }
        S[id] = [a, b]; syncRange(id); apply();
      });
    });
    syncRange(id);
  });

  /* ───────── фильтрация и вывод ───────── */
  function match(f) {
    var t = TYPES[f.type];
    if (S.tab !== 'all' && t.rooms !== +S.tab) return false;
    if (S.sub === 'euro' && !t.euro) return false;
    if (S.sub === 'classic' && t.euro) return false;
    if (S.secs.length && S.secs.indexOf(f.sec) < 0) return false;
    if (f.floor < S.fl[0] || f.floor > S.fl[1]) return false;
    if (f.total < S.ar[0] - 0.001 || f.total > S.ar[1] + 0.999) return false;
    return true;
  }
  var SORTS = {
    'area-asc': function (a, b) { return a.total - b.total || a.sec - b.sec || a.floor - b.floor; },
    'area-desc': function (a, b) { return b.total - a.total || a.sec - b.sec || a.floor - b.floor; },
    'floor-desc': function (a, b) { return b.floor - a.floor || a.total - b.total; },
    'floor-asc': function (a, b) { return a.floor - b.floor || a.total - b.total; },
    'sec': function (a, b) { return a.sec - b.sec || a.floor - b.floor || a.n - b.n; }
  };
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

  function activeCount() {
    return (S.secs.length ? 1 : 0) + (S.fl[0] !== FLOOR_MIN || S.fl[1] !== FLOOR_MAX ? 1 : 0) + (S.ar[0] !== AREA_MIN || S.ar[1] !== AREA_MAX ? 1 : 0);
  }

  function card(f) {
    var t = TYPES[f.type], p = priceOf(f);
    return '<article class="cat-card" data-flat="' + f.id + '">' +
      '<button type="button" class="cat-card-hit" data-open="' + f.id + '" aria-label="' + t.name + ', ' + fmt(f.total, 2) + ' м², секция ' + f.sec + ', этаж ' + f.floor + '"></button>' +
      '<div class="cat-plan">' + planSVG(f.st, f.n, f.mir) + '</div>' +
      '<div class="cat-info">' +
        '<p class="cat-type">' + t.name + '</p>' +
        '<p class="cat-area">' + fmt(f.total, 2) + '<span> м²</span></p>' +
        '<dl class="cat-meta"><div><dt>Этаж</dt><dd>' + f.floor + '<small> из 16</small></dd></div><div><dt>Секция</dt><dd>' + f.sec + '</dd></div><div><dt>Очередь</dt><dd>' + ROMAN[f.phase] + '</dd></div></dl>' +
        (p ? '<p class="cat-price">' + fmt(p.sum) + ' ₽</p>' : '<p class="cat-price is-ask">Цена по запросу</p>') +
      '</div>' +
      '<button type="button" class="cat-3d" data-walk="' + f.id + '" aria-label="3D-прогулка">3D</button>' +
      '</article>';
  }

  // режим «Планировки»: одинаковые квартиры (та же планировка, та же сторона) — одной карточкой
  function groupPlans(list) {
    var g = {}, out = [];
    list.forEach(function (f) {
      var k = f.st + '|' + f.n + '|' + f.mir, x = g[k];
      if (!x) { x = g[k] = { rep: f, n: 0, secs: [], lo: 99, hi: 0 }; out.push(x); }
      x.n++; if (x.secs.indexOf(f.sec) < 0) x.secs.push(f.sec);
      x.lo = Math.min(x.lo, f.floor); x.hi = Math.max(x.hi, f.floor);
      if (f.floor < x.rep.floor && f.sec === x.rep.sec) x.rep = f;
    });
    return out;
  }
  function planCard(x) {
    var f = x.rep, t = TYPES[f.type];
    x.secs.sort(function (a, b) { return a - b; });
    return '<article class="cat-card" data-flat="' + f.id + '">' +
      '<button type="button" class="cat-card-hit" data-open="' + f.id + '" aria-label="' + t.name + ', ' + fmt(f.total, 2) + ' м², ' + x.n + ' квартир"></button>' +
      '<div class="cat-plan">' + planSVG(f.st, f.n, f.mir) + '</div>' +
      '<div class="cat-info">' +
        '<p class="cat-type">' + t.name + '</p>' +
        '<p class="cat-area">' + fmt(f.total, 2) + '<span> м²</span></p>' +
        '<dl class="cat-meta"><div><dt>' + (x.secs.length > 1 ? 'Секции' : 'Секция') + '</dt><dd>' + x.secs.join(', ') + '</dd></div><div><dt>Этажи</dt><dd>' + (x.lo === x.hi ? x.lo : x.lo + '–' + x.hi) + '</dd></div></dl>' +
        '<p class="cat-price is-ask">' + fmt(x.n) + ' ' + plural(x.n, 'квартира', 'квартиры', 'квартир') + ' с такой планировкой</p>' +
      '</div>' +
      '<button type="button" class="cat-3d" data-walk="' + f.id + '" aria-label="3D-прогулка">3D</button>' +
      '</article>';
  }

  function apply(keepScroll) {
    var flats = ALL.filter(match).sort(SORTS[S.sort]);
    current = S.view === 'plans' ? groupPlans(flats) : flats;
    var n = flats.length;
    countEl.textContent = n ? 'Найдено ' + fmt(n) + ' ' + plural(n, 'квартира', 'квартиры', 'квартир') +
      (S.view === 'plans' ? ', ' + current.length + ' ' + plural(current.length, 'планировка', 'планировки', 'планировок') : '') : 'Таких квартир нет';
    $('#catApply').textContent = n ? 'Показать ' + fmt(n) + ' ' + plural(n, 'квартиру', 'квартиры', 'квартир') : 'Ничего не найдено';
    var ac = activeCount();
    fBtn.querySelector('b').textContent = ac ? ac : '';
    fBtn.classList.toggle('has-n', !!ac);
    S.shown = 0; listEl.innerHTML = '';
    if (!n) listEl.innerHTML = '<div class="cat-empty"><p>По этим условиям квартир нет.</p><button type="button" class="btn btn-line" data-reset>Сбросить фильтры</button></div>';
    more();
    if (!keepScroll) $('.cat-body', root).scrollTop = 0;
  }
  function more() {
    var next = current.slice(S.shown, S.shown + PAGE);
    listEl.insertAdjacentHTML('beforeend', next.map(S.view === 'plans' ? planCard : card).join(''));
    S.shown += next.length;
    moreBtn.hidden = S.shown >= current.length;
    moreBtn.textContent = 'Показать ещё ' + Math.min(PAGE, current.length - S.shown);
  }
  moreBtn.addEventListener('click', more);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { if (es[0].isIntersecting && !moreBtn.hidden && root.classList.contains('is-open')) more(); },
      { root: $('.cat-body', root), rootMargin: '600px 0px' }).observe(moreBtn);
  }

  function setTab(id) {
    S.tab = id; if (id === 'all' || id === '0' || id === '1') S.sub = 'any';
    $$('.cat-tab', tabsEl).forEach(function (b) {
      var on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on));
      if (on && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollTo({ left: b.offsetLeft - (tabsEl.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    });
    var showSub = id === '2' || id === '3';
    subEl.hidden = !showSub;
    if (showSub) {
      var euro = id === '2' ? 'Евродвушки' : 'Евротрёшки';
      subEl.innerHTML = [['any', 'Все'], ['euro', euro + ' (кухня-гостиная)'], ['classic', 'С отдельной кухней']].map(function (o) {
        return '<button type="button" class="cat-chip" data-sub="' + o[0] + '" aria-pressed="' + (S.sub === o[0]) + '">' + o[1] + '</button>';
      }).join('');
    }
    apply();
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  subEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sub]'); if (!b) return;
    S.sub = b.dataset.sub; $$('[data-sub]', subEl).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); apply();
  });
  $('#catSecs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sec]'); if (!b) return;
    var id = +b.dataset.sec, i = S.secs.indexOf(id);
    if (i < 0) S.secs.push(id); else S.secs.splice(i, 1);
    b.setAttribute('aria-pressed', String(i < 0)); apply();
  });
  $('#catSort').addEventListener('change', function (e) { S.sort = e.target.value; apply(); });
  $('#catView').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]'); if (!b || b.dataset.view === S.view) return;
    S.view = b.dataset.view;
    $$('[data-view]', this).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    apply();
  });
  function reset() {
    S.secs = []; S.fl = [FLOOR_MIN, FLOOR_MAX]; S.ar = [AREA_MIN, AREA_MAX];
    $$('[data-sec]', filtersEl).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    syncRange('fl'); syncRange('ar'); apply();
  }
  $('#catReset').addEventListener('click', reset);
  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-reset]')) { reset(); return; }
    var w = e.target.closest('[data-walk]'); if (w) { walk(BY_ID[w.dataset.walk]); return; }
    var o = e.target.closest('[data-open]'); if (o) { openFlat(o.dataset.open); return; }
  });

  // шторка фильтров на телефоне
  function sheetOpen(on) {
    root.classList.toggle('is-sheet', on);
    fBtn.setAttribute('aria-expanded', String(on));
  }
  fBtn.addEventListener('click', function () { sheetOpen(!root.classList.contains('is-sheet')); });
  $('#catApply').addEventListener('click', function () { sheetOpen(false); });
  $('#catSheetBg').addEventListener('click', function () { sheetOpen(false); });

  /* ───────── открыть / закрыть каталог ───────── */
  var lastFocus = null;
  function open(opts) {
    opts = opts || {};
    lastFocus = document.activeElement;
    root.classList.add('is-open'); root.inert = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cat-open');
    var nav = document.getElementById('nav'); if (nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); var bg = document.getElementById('burger'); if (bg) bg.setAttribute('aria-expanded', 'false'); }
    if (opts.type) { var t = TYPES[opts.type]; S.sub = t.rooms >= 2 ? (t.euro ? 'euro' : 'classic') : 'any'; setTab(String(t.rooms)); }
    else if (opts.tab != null) setTab(String(opts.tab));
    else if (!current.length) apply();
    if (!opts.silent) setHash('#kvartiry-vse');
    setTimeout(function () { $('#catTitle').focus({ preventScroll: true }); }, 60);
  }
  function close() {
    closeFlat(true);
    sheetOpen(false);
    root.classList.remove('is-open', 'is-solo'); root.inert = true; root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cat-open'); solo = false;
    setHash('');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#catClose').addEventListener('click', close);
  function setHash(h) {
    try { history.replaceState(null, '', h || location.pathname + location.search); } catch (e) {}
  }

  /* ───────── окно квартиры ───────── */
  var fl = null, solo = false;
  function rowsHTML(list) { return '<dl class="fl-rows">' + list.filter(Boolean).map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function openFlat(id, silent) {
    var f = BY_ID[id]; if (!f) return;
    fl = f;
    var t = TYPES[f.type], p = priceOf(f), ho = handover(f), wa = W[f.st] && W[f.st].apts[f.n];
    var rooms = wa ? wa.rooms.slice().sort(function (a, b) { return b.a - a.a; }) : [];
    var subj = encodeURIComponent('Квартира: ' + t.name + ', ' + fmt(f.total, 2) + ' м², секция ' + f.sec + ', этаж ' + f.floor);
    var body = encodeURIComponent('Здравствуйте! Интересует квартира: ' + t.name + ', ' + fmt(f.total, 2) + ' м², секция ' + f.sec + ', этаж ' + f.floor + '.\n' + location.origin + location.pathname + '#kv-' + f.id + '\n\nМой телефон: ');
    var floors = '';
    for (var k = FLOOR_MIN; k <= FLOOR_MAX; k++) floors += '<button type="button" class="fl-floor' + (k === f.floor ? ' is-on' : '') + '" data-floor="' + k + '" aria-pressed="' + (k === f.floor) + '">' + k + '</button>';
    $('#flatBody').innerHTML =
      '<div class="fl-plan">' + planSVG(f.st, f.n, f.mir, { labels: true }) + '</div>' +
      '<div class="fl-side">' +
        '<p class="fl-type">' + t.name + '</p>' +
        '<h2 class="fl-area" id="flatTitle">' + fmt(f.total, 2) + ' <span>м²</span></h2>' +
        (p ? '<p class="fl-price">' + fmt(p.sum) + ' ₽<span>' + fmt(p.m2) + ' ₽ за м²</span></p>' : '') +
        rowsHTML([['Этаж', f.floor + ' из 16'], ['Секция', String(f.sec)], ['Очередь', ROMAN[f.phase]], ho ? ['Срок сдачи', ho] : null,
          ['Площадь квартиры', fmt(f.flat, 2) + ' м²'], ['Жилая площадь', fmt(f.live, 2) + ' м²']]) +
        (rooms.length ? '<p class="fl-sub">Комнаты</p><ul class="fl-rooms">' + rooms.map(function (r) { return '<li><span>' + r.name + '</span><b>' + fmt(r.a, 1) + ' м²</b></li>'; }).join('') + '</ul>' : '') +
        '<p class="fl-sub">Та же планировка на других этажах</p><div class="fl-floors" id="flFloors">' + floors + '</div>' +
        '<p class="fl-note">Общая площадь — с учётом лоджий и балконов. Планировка по проекту, мебель показана для примера.</p>' +
      '</div>';
    $('#flatActs').innerHTML =
      '<button type="button" class="btn btn-solid" data-act="walk">Прогуляться в 3D</button>' +
      '<a class="btn btn-line" data-act="price" href="mailto:' + MAIL + '?subject=' + subj + '&body=' + body + '">' + (p ? 'Забронировать' : 'Узнать цену') + '</a>' +
      '<button type="button" class="fl-link" data-act="floor">Показать на этаже</button>' +
      '<button type="button" class="fl-link" data-act="share">Поделиться</button>';
    modal.classList.add('is-open'); modal.inert = false; modal.setAttribute('aria-hidden', 'false');
    if (!silent) setHash('#kv-' + f.id);
    document.title = t.name + ' ' + fmt(f.total, 2) + ' м² — ЖК в Краснодоне';
    setTimeout(function () { $('#flatClose').focus({ preventScroll: true }); }, 40);
  }
  var baseTitle = document.title;
  function closeFlat(quiet) {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open'); modal.inert = true; modal.setAttribute('aria-hidden', 'true');
    document.title = baseTitle;
    if (solo && !quiet) { close(); return; }
    if (!quiet) setHash('#kvartiry-vse');
    var c = fl && $('[data-flat="' + fl.id + '"] .cat-card-hit', listEl); if (c && !quiet) c.focus({ preventScroll: true });
  }
  $('#flatClose').addEventListener('click', function () { closeFlat(); });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) { closeFlat(); return; }
    var b = e.target.closest('[data-floor]');
    if (b && fl) { openFlat(fl.sec + '-' + b.dataset.floor + '-' + fl.n); return; }
    var a = e.target.closest('[data-act]'); if (!a || !fl) return;
    var act = a.dataset.act;
    if (act === 'walk') walk(fl);
    else if (act === 'floor') { if (window.ALTA_openPicker) window.ALTA_openPicker(fl.sec, fl.floor, fl.n); }
    else if (act === 'share') share(fl);
  });

  function walk(f) {
    if (!f || !window.ALTA_openWalk) return;
    var t = TYPES[f.type];
    window.ALTA_openWalk({ st: f.st, n: f.n, mirror: f.mir, floor: f.floor, section: f.sec, name: t.name, total: f.total,
      tour: { type: f.type, name: t.name, n: f.n, floor: f.floor, section: f.sec, total: f.total } });
  }
  function say(msg) {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  }
  function share(f) {
    var t = TYPES[f.type], url = location.origin + location.pathname + '#kv-' + f.id,
        text = t.name + ' ' + fmt(f.total, 2) + ' м², секция ' + f.sec + ', этаж ' + f.floor;
    if (navigator.share) { navigator.share({ title: text, text: text, url: url }).catch(function () {}); return; }
    var done = function () { say('Ссылка на квартиру скопирована'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('Ссылка на квартиру', url); });
    else prompt('Ссылка на квартиру', url);
  }

  // Esc: сначала окно квартиры, потом шторка, потом каталог (если поверх не открыт 3D-выбор или прогулка)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !root.classList.contains('is-open')) return;
    if (document.body.classList.contains('picker-open') || document.body.classList.contains('walk-open') || document.body.classList.contains('tour-open')) return;
    if (modal.classList.contains('is-open')) closeFlat();
    else if (root.classList.contains('is-sheet')) sheetOpen(false);
    else close();
  });

  /* ───────── входы в каталог ───────── */
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-catalog]');
    if (!c) return;
    e.preventDefault(); e.stopPropagation();
    var v = c.dataset.catalog;
    if (TYPES[v]) open({ type: v }); else if (/^[0-3]$/.test(v)) open({ tab: v }); else open({ tab: 'all' });
  }, true);

  function fromHash(h) {
    h = decodeURIComponent(typeof h === 'string' ? h : location.hash || '');
    var m = /^#kv-(\d+-\d+-\d+)$/.exec(h);
    if (m && BY_ID[m[1]]) { open({ silent: true }); openFlat(m[1]); return true; }
    if (h === '#kvartiry-vse') { open(); return true; }
    return false;
  }
  window.addEventListener('hashchange', function () { fromHash(); });
  fromHash(window.ALTA_hash0 || location.hash);

  window.ALTA_openCatalog = open;
  // solo — только окно квартиры поверх того, откуда его открыли (выбор по этажам, 3D-выбор); закрытие возвращает туда же
  window.ALTA_openFlat = function (id, o) {
    if (o && o.solo && !root.classList.contains('is-open')) { solo = true; root.classList.add('is-solo'); }
    open({ silent: true }); openFlat(id);
  };
  window.ALTA_planSVG = planSVG;
})();
