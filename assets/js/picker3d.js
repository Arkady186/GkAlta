/* Выбор квартиры в 3D: секция → этаж → квартира. Геометрия этажей — из чертежей (assets/js/floors.js). */
(function () {
  'use strict';
  var D = window.ALTA, F = window.ALTA_FLOORS;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n, d) { return n.toLocaleString('ru-RU', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d }); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TYPES = {
    '1С': { name: 'Студия', short: 'Студия', color: '#b6a6d8' },
    '1К': { name: 'Однокомнатная', short: '1-комн.', color: '#98bad3' },
    '2Е': { name: 'Евродвушка', short: 'Евро-2', color: '#a6c69c' },
    '2К': { name: 'Двухкомнатная', short: '2-комн.', color: '#e2c88b' },
    '3Е': { name: 'Евротрёшка', short: 'Евро-3', color: '#e0a179' },
    '3К': { name: 'Трёхкомнатная', short: '3-комн.', color: '#d9979a' }
  };
  var ORDER = ['1С', '1К', '2Е', '2К', '3Е', '3К'];
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  var FLOORS = 16, FH = 3.1;
  var HOMES = D.buildings.filter(function (b) { return b.kind === 'home'; });

  var tourEl = $('#tour');
  var root = $('#picker'), canvas = $('#pkCanvas'), labelsEl = $('#pkLabels'), card = $('#pkCard'),
      chess = $('#pkChess'), crumbs = $('#pkCrumbs'), tip = $('#pkTip'), hint = $('#pkHint');

  var st = { b: null, floor: null, apt: null, mode: 'tower', hoverFloor: null, hoverApt: null };
  var T, renderer, scene, camera, sun, inited = false, running = false, last = 0;
  var cam = { az: -0.75, el: 0.3, r: 120, x: 0, y: 24, z: 0 }, camT = Object.assign({}, cam);
  var tower = null, interior = null, towers = {}, interiors = {};

  /* ───────── геометрия ───────── */
  function shape(poly, holes) {
    var s = new T.Shape();
    poly.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
    (holes || []).forEach(function (hp) {
      var path = new T.Path();
      hp.forEach(function (p, i) { if (i) path.lineTo(p[0], -p[1]); else path.moveTo(p[0], -p[1]); });
      s.holes.push(path);
    });
    return s;
  }
  function extrude(s, depth) {
    var g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function centroid(poly) {
    var a = 0, x = 0, y = 0;
    for (var i = 0, n = poly.length; i < n; i++) {
      var p = poly[i], q = poly[(i + 1) % n], c = p[0] * q[1] - q[0] * p[1];
      a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c;
    }
    a *= 0.5;
    return a ? { x: x / (6 * a), z: y / (6 * a), area: Math.abs(a) } : { x: poly[0][0], z: poly[0][1], area: 0 };
  }

  // canvas → текстура; поверх подгружается та же картинка файлом (браузеры с защитой от отпечатков портят canvas)
  function fileTex(c, name) {
    var t = new T.CanvasTexture(c);
    (window.__texReg = window.__texReg || {})[name] = c;
    var im = new Image();
    im.onload = function () { t.image = im; t.needsUpdate = true; if (window.ALTA_pickerRender) window.ALTA_pickerRender(); };
    im.src = 'assets/tex/' + name + '.png';
    return t;
  }
  /* фасад: 4 оси по 3,2 м на один этаж — светлые панели, панорамное остекление, часть окон светится */
  function facadeTex(seed, ground) {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    var e = document.createElement('canvas'); e.width = 1024; e.height = 256;
    var x = c.getContext('2d'), y = e.getContext('2d'), r = seed;
    var rnd = function () { r = (r * 16807) % 2147483647; return r / 2147483647; };
    x.fillStyle = ground ? '#2f3d34' : '#efe9dc'; x.fillRect(0, 0, 1024, 256);
    y.fillStyle = '#000'; y.fillRect(0, 0, 1024, 256);
    for (var b = 0; b < 4; b++) {
      var bx = b * 256;
      if (ground) {                                       // витрины первого этажа
        var gg = x.createLinearGradient(0, 24, 0, 256); gg.addColorStop(0, '#f2cf8f'); gg.addColorStop(1, '#c99a55');
        x.fillStyle = gg; x.fillRect(bx + 8, 24, 240, 232);
        x.fillStyle = '#5a4526'; x.fillRect(bx + 126, 24, 4, 232); x.fillRect(bx + 8, 24, 240, 5);
        y.fillStyle = '#ffcf8a'; y.fillRect(bx + 8, 28, 240, 228);
        continue;
      }
      if (b === 1 || b === 3) { x.fillStyle = '#0f4a2b'; x.fillRect(bx, 0, 14, 256); }       // зелёные пилоны
      var wx = bx + 44, wy = 34, ww = 176, wh = 190, lit = rnd() < 0.42;
      var gl = x.createLinearGradient(0, wy, 0, wy + wh);
      if (lit) { gl.addColorStop(0, '#fbe3b0'); gl.addColorStop(1, '#e7b56c'); }
      else { gl.addColorStop(0, '#a9bcc4'); gl.addColorStop(0.5, '#5f7884'); gl.addColorStop(1, '#2f4450'); }
      x.fillStyle = gl; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + 70, wy); x.lineTo(wx, wy + 90); x.fill();   // блик
      x.fillStyle = '#6d5735'; x.fillRect(wx, wy, ww, 4); x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy, 4, wh); x.fillRect(wx + ww - 4, wy, 4, wh);
      x.fillStyle = 'rgba(201,169,106,.9)'; x.fillRect(wx - 6, wy + wh - 52, ww + 12, 3);      // латунный поручень
      x.fillStyle = 'rgba(210,225,230,.22)'; x.fillRect(wx - 6, wy + wh - 50, ww + 12, 50);   // стеклянное ограждение
      if (lit) { y.fillStyle = rnd() < 0.5 ? '#ffcd85' : '#ffe0ad'; y.fillRect(wx + 4, wy + 4, ww - 8, wh - 8); }
    }
    x.fillStyle = '#d9d1bf'; x.fillRect(0, 244, 1024, 12);                                     // межэтажный пояс
    var t1 = fileTex(c, 'pk-a-' + seed), t2 = fileTex(e, 'pk-e-' + seed);
    [t1, t2].forEach(function (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 12.8, 1 / (FH - 0.2)); t.anisotropy = 8; });
    if ('colorSpace' in t1) t1.colorSpace = T.SRGBColorSpace;
    return [t1, t2];
  }

  function buildTower(stype) {
    if (towers[stype]) return towers[stype];
    var f = F[stype], g = new T.Group(), floors = [];
    var fs = shape(f.foot), geo = extrude(fs, FH - 0.2), edges = new T.EdgesGeometry(geo, 30);
    var texA = facadeTex(11), texB = facadeTex(97), texG = facadeTex(5, true);
    for (var i = 1; i <= FLOORS; i++) {
      var tx = i === 1 ? texG : (i % 2 ? texA : texB);
      var side = new T.MeshStandardMaterial({ map: tx[0], emissiveMap: tx[1], emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.55, metalness: 0.05, transparent: true });
      var cap = new T.MeshStandardMaterial({ color: i === FLOORS ? 0x8f998c : 0x55665a, roughness: 0.9, transparent: true });
      var m = new T.Mesh(geo, [cap, side]);
      m.castShadow = true; m.receiveShadow = true;
      var line = new T.LineSegments(edges, new T.LineBasicMaterial({ color: 0xe6cf9c, transparent: true, opacity: 0 }));
      var fl = new T.Group();
      fl.add(m); fl.add(line);
      fl.position.y = (i - 1) * FH;
      fl.userData = { i: i, mesh: m, line: line, mats: [cap, side], y: (i - 1) * FH, ty: (i - 1) * FH, op: 1, top: 1, glow: 0, tglow: 0 };
      m.userData.floor = i;
      g.add(fl); floors.push(fl);
    }
    towers[stype] = { group: g, floors: floors };
    return towers[stype];
  }

  function buildInterior(stype) {
    if (interiors[stype]) return interiors[stype];
    var f = F[stype], g = new T.Group(), apts = [], mats = [];
    function mat(o) { var m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, transparent: true, opacity: 0 }, o)); mats.push(m); return m; }
    var slab = new T.Mesh(extrude(shape(f.foot), 0.35), mat({ color: 0x1d2f24 }));
    slab.position.y = -0.35; slab.receiveShadow = true; g.add(slab);
    var coreM = mat({ color: 0x40564a });
    f.core.forEach(function (p) { var m = new T.Mesh(extrude(shape(p), 0.03), coreM); m.receiveShadow = true; g.add(m); });
    f.apts.forEach(function (a) {
      var t = TYPES[a.type], col = new T.Color(t.color);
      var m = mat({ color: col, emissive: col, emissiveIntensity: 0 });
      var ag = new T.Group(), best = null;
      a.poly.forEach(function (p) {
        var me = new T.Mesh(extrude(shape(p), 0.08), m);
        me.receiveShadow = true; me.userData.apt = a.n;
        ag.add(me);
        var c = centroid(p);
        if (!best || c.area > best.area) best = c;
      });
      var lm = new T.LineBasicMaterial({ color: 0xf0d9a4, transparent: true, opacity: 0 });
      a.poly.forEach(function (p) {
        var pts = p.map(function (q) { return new T.Vector3(q[0], 0.1, q[1]); });
        pts.push(pts[0].clone());
        ag.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), lm));
      });
      g.add(ag);
      apts.push({ a: a, group: ag, mat: m, line: lm, base: col.clone(), c: best, lift: 0, tlift: 0, glow: 0, tglow: 0 });
    });
    var wallM = mat({ color: 0xefe9dc, roughness: 0.92 });
    f.walls.forEach(function (w) {
      var m = new T.Mesh(extrude(shape(w.o, w.h), 1.35), wallM);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    });
    g.visible = false;
    interiors[stype] = { group: g, apts: apts, mats: mats, op: 0, top: 0 };
    return interiors[stype];
  }

  /* ───────── сцена ───────── */
  function init() {
    if (inited) return true;
    T = window.THREE;
    if (!T || !F) return false;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    if ('toneMapping' in renderer) { renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
    scene = new T.Scene();
    scene.fog = new T.Fog(0x06170d, 420, 950);
    camera = new T.PerspectiveCamera(32, 1, 0.5, 2000);
    scene.add(new T.HemisphereLight(0xfff3dc, 0x0b2416, 1.25));
    sun = new T.DirectionalLight(0xffe2b5, 2.4);
    sun.position.set(-60, 110, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 300;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    var fill = new T.DirectionalLight(0x9fc4ff, 0.35); fill.position.set(60, 40, -60); scene.add(fill);
    // земля: мягкое пятно и тень
    var gc = document.createElement('canvas'); gc.width = gc.height = 512;
    var gx = gc.getContext('2d'), grd = gx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, 'rgba(24,52,34,.95)'); grd.addColorStop(0.5, 'rgba(12,33,20,.7)'); grd.addColorStop(1, 'rgba(6,23,13,0)');
    gx.fillStyle = grd; gx.fillRect(0, 0, 512, 512);
    var gt = fileTex(gc, 'pk-ground');
    if ('colorSpace' in gt) gt.colorSpace = T.SRGBColorSpace;
    var ground = new T.Mesh(new T.CircleGeometry(160, 64), new T.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; scene.add(ground);
    var sh = new T.Mesh(new T.PlaneGeometry(400, 400), new T.ShadowMaterial({ opacity: 0.35 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -0.39; sh.receiveShadow = true; scene.add(sh);
    bindInput();
    inited = true;
    return true;
  }

  function resize() {
    var w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ───────── режимы ───────── */
  // ракурсы: секция целиком; этаж — сверху, длинной стороной вдоль экрана; квартира — крупно
  function view(mode) {
    var phone = innerWidth < 860, wide = root.clientWidth / root.clientHeight, f = F[st.b.st];
    var fit = phone ? 1.45 : Math.max(1, 1.55 / wide);    // на узком экране отъезжаем дальше
    if (mode === 'tower') { camT.r = 150 * fit; camT.el = 0.26; camT.x = 0; camT.y = 23; camT.z = 0; }
    if (mode === 'floor') {
      camT.r = phone ? f.w * 4.3 : (f.w * 2.55 + 14) * fit; camT.el = 1.08;
      camT.az = Math.round(camT.az / Math.PI) * Math.PI;  // ближайший «прямой» ракурс
      camT.x = 0; camT.y = (st.floor - 1) * FH; camT.z = phone ? 6 : 1.5;
    }
    if (mode === 'apt') {
      var A = interior.apts.filter(function (x) { return x.a.n === st.apt; })[0], mir = interior.group.scale.x;
      camT.r = (phone ? 62 : 40); camT.el = 0.95;
      camT.x = A.c.x * mir; camT.y = (st.floor - 1) * FH; camT.z = A.c.z + (phone ? 8 : 0);
    }
  }

  function openSection(b) {
    st.b = b; st.floor = null; st.apt = null; st.mode = 'tower';
    if (tower) scene.remove(tower.group);
    if (interior) { scene.remove(interior.group); interior.group.visible = false; }
    labelsEl.innerHTML = '';
    tower = buildTower(b.st); interior = buildInterior(b.st);
    tower.floors.forEach(function (fl) { var u = fl.userData; u.ty = u.y; u.top = 1; u.tglow = 0; fl.visible = true; });
    interior.top = 0; interior.op = 0;
    scene.add(tower.group); scene.add(interior.group);
    // секции 1.1, 2.1, 4.1 — зеркальные варианты типовых
    var mirror = /\.1$/.test(b.type) ? -1 : 1;
    tower.group.scale.x = interior.group.scale.x = mirror;
    view('tower');
    render();
  }

  function selectFloor(i) {
    if (i < 2) return;
    st.floor = i; st.apt = null; st.mode = 'floor';
    tower.floors.forEach(function (fl) {
      var u = fl.userData, k = u.i;
      if (k > i) { u.ty = u.y + 34 + (k - i) * 1.4; u.top = 0; }
      else if (k === i) { u.ty = u.y; u.top = 0; }
      else { u.ty = u.y; u.top = 0.22; }
      u.tglow = 0;
    });
    interior.group.position.y = (i - 1) * FH;
    interior.group.visible = true;
    interior.top = 1;
    interior.apts.forEach(function (A) { A.tlift = 0; A.tglow = 0; A.mat.color.copy(A.base); });
    view('floor');
    render();
  }

  function backToTower() {
    st.floor = null; st.apt = null; st.mode = 'tower';
    tower.floors.forEach(function (fl) { var u = fl.userData; u.ty = u.y; u.top = 1; });
    interior.top = 0;
    view('tower');
    render();
  }

  function selectApt(n) {
    st.apt = n; st.mode = 'apt';
    interior.apts.forEach(function (A) {
      var on = A.a.n === n;
      A.tlift = on ? 0.45 : 0;
      A.tglow = on ? 0.45 : 0;
      A.mat.color.copy(A.base);
      if (!on) A.mat.color.lerp(new T.Color(0x22352a), 0.72);
    });
    view('apt');
    render();
  }

  function backToFloor() { selectFloor(st.floor); }

  /* ───────── карточка, шахматка, хлебные крошки ───────── */
  function typeCounts(stype) {
    var c = {};
    F[stype].apts.forEach(function (a) { c[a.type] = (c[a.type] || 0) + 1; });
    return c;
  }
  function legend(stype) {
    var c = typeCounts(stype);
    return '<ul class="pk-legend">' + ORDER.filter(function (t) { return c[t]; }).map(function (t) {
      return '<li><i style="background:' + TYPES[t].color + '"></i>' + TYPES[t].name + '<b>' + c[t] + '</b></li>';
    }).join('') + '</ul>';
  }
  function rows(list) { return '<dl class="pk-rows">' + list.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>'; }

  function renderUI() {
    var b = st.b, f = F[b.st], html;
    var cr = ['<button data-pk="close">Квартал</button>', '<button data-pk="tower">Секция ' + b.id + '</button>'];
    if (st.floor) cr.push('<button data-pk="floor">Этаж ' + st.floor + '</button>');
    if (st.apt) cr.push('<span>Квартира ' + st.apt + '</span>');
    crumbs.innerHTML = cr.join('<i></i>');

    if (st.mode === 'tower') {
      html = '<p class="pk-kicker">' + ROMAN[b.phase] + ' очередь</p><h2>Секция ' + b.id + '</h2>' +
        rows([['Этажей', '16, жилые со 2-го'], ['Квартир', fmt(b.flats)], ['На этаже', f.apts.length + ' квартир']]) +
        '<p class="pk-sub">Квартиры на этаже</p>' + legend(b.st) +
        '<p class="pk-note">Наведите на этаж и нажмите — он раскроется.</p>';
      hint.textContent = 'Выберите этаж на модели или в шахматке';
    } else if (st.mode === 'floor') {
      html = '<p class="pk-kicker">Секция ' + b.id + '</p><h2>Этаж ' + st.floor + '</h2>' +
        rows([['Квартир на этаже', f.apts.length], ['Этажей в секции', '16']]) +
        '<p class="pk-sub">Планировки</p>' + legend(b.st) +
        '<div class="pk-actions"><button class="btn btn-line" data-pk="tower">Ко всей секции</button></div>';
      hint.textContent = 'Нажмите на квартиру';
    } else {
      var a = f.apts.filter(function (x) { return x.n === st.apt; })[0], t = TYPES[a.type];
      var subj = encodeURIComponent('Квартира ' + a.n + ', этаж ' + st.floor + ', секция ' + b.id);
      html = '<p class="pk-kicker"><i style="background:' + t.color + '"></i>' + t.name + '</p>' +
        '<h2>Квартира ' + a.n + '</h2>' +
        '<p class="pk-area"><b>' + fmt(a.total, 2) + '</b> м²</p>' +
        rows([['Этаж', st.floor + ' из 16'], ['Секция', b.id + ', ' + ROMAN[b.phase] + ' очередь'], ['Площадь квартиры', fmt(a.flat, 2) + ' м²'], ['Жилая площадь', fmt(a.live, 2) + ' м²']]) +
        '<div class="pk-actions">' +
        '<button class="btn btn-solid" data-pk="walk">Прогуляться в 3D</button>' +
        '<button class="btn btn-line" data-pk="tour">Фото-прогулка</button>' +
        '<a class="pk-link" href="mailto:gk.alta.2026@mail.ru?subject=' + subj + '">Узнать стоимость</a>' +
        '<button class="pk-link" data-pk="plan">План этажа</button>' +
        '</div><p class="pk-note">Номер квартиры — порядковый на этаже по проекту. Общая площадь — с учётом лоджий и балконов.</p>';
      hint.textContent = '';
    }
    card.innerHTML = html;
    card.classList.remove('is-swap'); void card.offsetWidth; card.classList.add('is-swap');
    renderChess();
  }

  function renderChess() {
    var b = st.b, f = F[b.st], idx = HOMES.indexOf(b);
    var apts = f.apts.slice().sort(function (x, y) { return x.n - y.n; });
    var h = '<div class="pk-chess-head"><button data-pk="sec-prev" aria-label="Предыдущая секция">‹</button><span>Секция ' + b.id + '</span><button data-pk="sec-next" aria-label="Следующая секция">›</button></div><div class="pk-chess-grid">';
    for (var i = FLOORS; i >= 1; i--) {
      h += '<div class="pk-row' + (st.floor === i ? ' is-on' : '') + (i === 1 ? ' is-ground' : '') + '" data-floor="' + i + '"><span class="pk-fl">' + i + '</span>';
      if (i === 1) h += '<span class="pk-ground">Коммерческие помещения</span>';
      else apts.forEach(function (a) {
        h += '<button class="pk-cell' + (st.floor === i && st.apt === a.n ? ' is-on' : '') + '" data-floor="' + i + '" data-apt="' + a.n + '" style="--c:' + TYPES[a.type].color + '" aria-label="Этаж ' + i + ', квартира ' + a.n + ', ' + TYPES[a.type].name + ', ' + fmt(a.total, 2) + ' м²"></button>';
      });
      h += '</div>';
    }
    chess.innerHTML = h + '</div>';
  }

  function action(k, el) {
    if (k === 'close') close();
    else if (k === 'tower') { backToTower(); renderUI(); }
    else if (k === 'floor') { backToFloor(); renderUI(); }
    else if (k === 'tour') {
      var a = F[st.b.st].apts.filter(function (x) { return x.n === st.apt; })[0];
      window.ALTA_openTour && window.ALTA_openTour({ type: a.type, name: TYPES[a.type].name, n: a.n, floor: st.floor, section: st.b.id, total: a.total });
    } else if (k === 'walk') {
      var a2 = F[st.b.st].apts.filter(function (x) { return x.n === st.apt; })[0];
      var tinfo = { type: a2.type, name: TYPES[a2.type].name, n: a2.n, floor: st.floor, section: st.b.id, total: a2.total };
      window.ALTA_openWalk && window.ALTA_openWalk({ st: st.b.st, n: a2.n, mirror: tower.group.scale.x < 0, floor: st.floor, section: st.b.id, name: TYPES[a2.type].name, total: a2.total, tour: tinfo });
    } else if (k === 'plan') { window.ALTA_showFloorPlan && window.ALTA_showFloorPlan(st.b.st); }
    else if (k === 'sec-prev' || k === 'sec-next') {
      var i = HOMES.indexOf(st.b) + (k === 'sec-next' ? 1 : -1);
      i = (i + HOMES.length) % HOMES.length;
      openSection(HOMES[i]); renderUI();
    }
  }
  root.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-pk]');
    if (t) { action(t.dataset.pk, t); return; }
    var c = ev.target.closest('.pk-cell');
    if (c) { selectFloor(+c.dataset.floor); selectApt(+c.dataset.apt); renderUI(); return; }
    var r = ev.target.closest('.pk-row');
    if (r && +r.dataset.floor > 1) { selectFloor(+r.dataset.floor); renderUI(); }
  });
  chess.addEventListener('pointerover', function (ev) {
    var r = ev.target.closest('.pk-row');
    if (st.mode === 'tower' && r) { setHoverFloor(+r.dataset.floor); }
  });
  chess.addEventListener('pointerleave', function () { if (st.mode === 'tower') setHoverFloor(null); });

  /* ───────── ввод ───────── */
  var ray, ptr, drag = null;
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ptr.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (st.mode === 'tower') {
      var hits = ray.intersectObjects(tower.floors.map(function (f) { return f.userData.mesh; }), false);
      return hits.length ? { floor: hits[0].object.userData.floor } : null;
    }
    var ms = [];
    interior.apts.forEach(function (A) { ms = ms.concat(A.group.children.filter(function (o) { return o.isMesh; })); });
    var h2 = ray.intersectObjects(ms, false);
    return h2.length ? { apt: h2[0].object.userData.apt } : null;
  }
  function setHoverFloor(i) {
    st.hoverFloor = i;
    tower.floors.forEach(function (fl) { fl.userData.tglow = fl.userData.i === i && i > 1 ? 1 : 0; });
    $$('.pk-row', chess).forEach(function (r) { r.classList.toggle('is-hover', +r.dataset.floor === i); });
    render();
  }
  function setHoverApt(n) {
    st.hoverApt = n;
    interior.apts.forEach(function (A) {
      if (st.mode === 'apt' && A.a.n === st.apt) return;
      A.tlift = A.a.n === n ? 0.25 : 0;
      A.tglow = A.a.n === n ? 0.22 : 0;
    });
    render();
  }
  function showTip(ev, html) {
    if (!html) { tip.classList.remove('is-on'); return; }
    tip.innerHTML = html;
    tip.style.transform = 'translate(' + (ev.clientX + 18) + 'px,' + (ev.clientY + 14) + 'px)';
    tip.classList.add('is-on');
  }
  function bindInput() {
    ray = new T.Raycaster(); ptr = new T.Vector2();
    canvas.addEventListener('pointerdown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, az: camT.az, el: camT.el, moved: false, id: ev.pointerId };
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (drag && ev.pointerId === drag.id) {
        var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        camT.az = drag.az - dx * 0.006;
        camT.el = Math.min(1.35, Math.max(0.08, drag.el + dy * 0.004));
        showTip(ev, null);
        render();
        return;
      }
      if (ev.pointerType === 'touch') return;
      var h = pick(ev), f = F[st.b.st];
      if (st.mode === 'tower') {
        var i = h ? h.floor : null;
        if (i !== st.hoverFloor) setHoverFloor(i);
        canvas.style.cursor = i > 1 ? 'pointer' : '';
        showTip(ev, i ? (i === 1 ? '<b>1 этаж</b>Коммерческие помещения' : '<b>Этаж ' + i + '</b>' + f.apts.length + ' квартир') : null);
      } else {
        var n = h ? h.apt : null;
        if (n !== st.hoverApt) setHoverApt(n);
        canvas.style.cursor = n ? 'pointer' : '';
        var a = n && f.apts.filter(function (x) { return x.n === n; })[0];
        showTip(ev, a ? '<b>' + TYPES[a.type].name + '</b>' + fmt(a.total, 2) + ' м², квартира ' + a.n : null);
      }
    });
    canvas.addEventListener('pointerup', function (ev) {
      var d = drag; drag = null;
      if (!d || d.moved) return;
      var h = pick(ev);
      if (st.mode === 'tower' && h && h.floor > 1) { showTip(ev, null); selectFloor(h.floor); renderUI(); }
      else if (st.mode !== 'tower' && h && h.apt) { showTip(ev, null); selectApt(h.apt); renderUI(); }
    });
    canvas.addEventListener('pointerleave', function () { tip.classList.remove('is-on'); if (st.mode === 'tower') setHoverFloor(null); else setHoverApt(null); });
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      camT.r = Math.min(260, Math.max(18, camT.r * (1 + Math.sign(ev.deltaY) * 0.09)));
      render();
    }, { passive: false });
    window.addEventListener('resize', function () { if (root.classList.contains('is-open')) { resize(); render(); } });
    window.addEventListener('keydown', function (ev) {
      if (!root.classList.contains('is-open') || ev.key !== 'Escape') return;
      if (document.getElementById('tour').classList.contains('is-open') || document.body.classList.contains('walk-open')) return;
      ev.preventDefault();
      if (st.mode === 'apt') { backToFloor(); renderUI(); }
      else if (st.mode === 'floor') { backToTower(); renderUI(); }
      else close();
    });
  }

  /* ───────── цикл: всё плавно догоняет цели ───────── */
  var v3;
  function render() {
    if (running) return;
    running = true; last = performance.now();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!root.classList.contains('is-open') || tourEl.classList.contains('is-open') || document.body.classList.contains('walk-open')) { running = false; return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var k = reduce ? 1 : 1 - Math.pow(0.0025, dt), k2 = reduce ? 1 : 1 - Math.pow(0.02, dt), moving = false;
    function ease(o, key, tk, kk) { var d = o[tk] - o[key]; if (Math.abs(d) > 1e-3) { o[key] += d * kk; moving = true; } else o[key] = o[tk]; }
    if (st.mode === 'tower' && !drag && !reduce && !st.hoverFloor) { camT.az += dt * 0.05; moving = true; }
    ['az', 'el', 'r', 'x', 'y', 'z'].forEach(function (p) { var d = camT[p] - cam[p]; if (Math.abs(d) > 1e-4) { cam[p] += d * k; moving = true; } });
    tower.floors.forEach(function (fl) {
      var u = fl.userData;
      var dy = u.ty - fl.position.y; if (Math.abs(dy) > 1e-3) { fl.position.y += dy * k2; moving = true; }
      ease(u, 'op', 'top', k); ease(u, 'glow', 'tglow', k2);
      u.mats[0].opacity = u.mats[1].opacity = u.op;
      u.mesh.visible = u.op > 0.01;
      u.mats[0].depthWrite = u.mats[1].depthWrite = u.op > 0.95;
      u.mats[1].emissiveIntensity = 0.6 + u.glow * 0.5;
      u.mats[1].color.setRGB(1, 1 - u.glow * 0.06, 1 - u.glow * 0.2);
      u.line.material.opacity = u.glow * u.op;
      u.mesh.castShadow = u.op > 0.5;
    });
    ease(interior, 'op', 'top', k);
    interior.group.visible = interior.op > 0.01;
    interior.mats.forEach(function (m) { m.opacity = interior.op; m.depthWrite = interior.op > 0.95; });
    interior.apts.forEach(function (A) {
      ease(A, 'lift', 'tlift', k2); ease(A, 'glow', 'tglow', k2);
      A.group.position.y = A.lift;
      A.mat.emissiveIntensity = A.glow;
      A.line.opacity = Math.min(1, A.glow * 4) * interior.op;
    });
    camera.position.set(cam.x + cam.r * Math.cos(cam.el) * Math.sin(cam.az), cam.y + cam.r * Math.sin(cam.el), cam.z + cam.r * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.x, cam.y, cam.z);
    if (innerWidth >= 860) camera.setViewOffset(root.clientWidth, root.clientHeight, -Math.round(root.clientWidth * 0.025), 0, root.clientWidth, root.clientHeight);
    else camera.setViewOffset(root.clientWidth, root.clientHeight, 0, Math.round(root.clientHeight * 0.2), root.clientWidth, root.clientHeight);   // на телефоне модель — над карточкой
    sun.position.set(cam.x - 60, cam.y + 110, cam.z + 50); sun.target.position.set(cam.x, cam.y, cam.z);
    renderer.render(scene, camera);
    placeLabels();
    if (moving || drag) requestAnimationFrame(tick); else running = false;
  }

  function placeLabels() {
    var show = st.mode !== 'tower' && interior.op > 0.6;
    labelsEl.classList.toggle('is-on', show);
    if (!show) return;
    if (!v3) v3 = new T.Vector3();
    var w = root.clientWidth, h = root.clientHeight, mir = interior.group.scale.x;
    if (labelsEl.children.length !== interior.apts.length) {
      labelsEl.innerHTML = interior.apts.map(function (A) { return '<span class="pk-num" data-n="' + A.a.n + '">' + A.a.n + '</span>'; }).join('');
    }
    var els = labelsEl.children;
    interior.apts.forEach(function (A, i) {
      v3.set(A.c.x * mir, interior.group.position.y + 1.8 + A.lift, A.c.z).project(camera);
      var el = els[i];
      el.style.transform = 'translate(' + ((v3.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v3.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-50%)';
      el.classList.toggle('is-on', A.a.n === st.apt);
      el.classList.toggle('is-dim', st.mode === 'apt' && A.a.n !== st.apt);
    });
  }

  /* ───────── открыть / закрыть ───────── */
  function open(sectionId, floor, apt) {
    if (!init()) { alert('Трёхмерный выбор недоступен в этом браузере.'); return; }
    var b = HOMES.filter(function (x) { return x.id === sectionId; })[0] || HOMES[0];
    root.classList.add('is-open');
    root.inert = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('picker-open');
    resize();
    openSection(b);
    cam = Object.assign({}, camT, { r: camT.r * 1.6, el: 0.55, az: camT.az - 0.6 });
    if (floor) { selectFloor(floor); if (apt) selectApt(apt); }
    renderUI();
    render();
  }
  function close() {
    root.classList.remove('is-open');
    root.inert = true; root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('picker-open');
    tip.classList.remove('is-on');
  }
  window.ALTA_openPicker = open;
  window.ALTA_closePicker = close;
  window.ALTA_pickerRender = function () { if (inited && root.classList.contains('is-open')) render(); };
  $('#pkClose').addEventListener('click', close);
  $('#pkChessToggle').addEventListener('click', function () { chess.classList.toggle('is-open'); });
})();
