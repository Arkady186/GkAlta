/* Трёхмерный генплан: объёмы секций по схеме генерального плана. three.js r160 */
(function () {
  'use strict';
  var D = window.ALTA, T = window.THREE;
  var view = document.getElementById('gpView');
  var canvas = document.getElementById('gpCanvas');
  var labelsEl = document.getElementById('gpLabels');
  var card = document.getElementById('gpCard');
  var chips = document.getElementById('phaseChips');
  var hint = document.getElementById('gpHint');
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  var fmt = function (n, d) { return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 1 : d }); };
  var state = { phase: 0, sel: null, hover: null };

  /* ───── карточка ───── */
  function rows(list) {
    return '<dl>' + list.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  function renderCard() {
    var b = state.sel, html;
    if (b && b.kind === 'home') {
      html = '<h3>Секция ' + b.id + '</h3><p class="sub">' + ROMAN[b.phase] + ' очередь, тип ' + b.type + '</p>' + rows([
        ['Этажей', '16, из них 15 жилых'],
        ['Квартир', fmt(b.flats)],
        ['Квартир на этаже', b.perFloor],
        ['Площадь квартир', fmt(b.living) + ' м²'],
        ['Коммерция на 1 этаже', fmt(b.retail) + ' м²']
      ]) + '<div class="gp-card-foot"><button class="btn btn-solid" data-picker="' + b.id + '">Выбрать квартиру</button><button class="btn btn-line" data-plan="' + b.st + '" data-sec="' + b.id + '">План этажа</button><button class="gp-link" data-reset>Весь квартал</button></div>';
    } else if (b) {
      html = '<h3>Здание № ' + b.id + '</h3><p class="sub">' + ROMAN[b.phase] + ' очередь, отдельно стоящее</p>' + rows([
        ['Назначение', 'Коммерческое'],
        ['Этажей', b.floors],
        ['Площадь', fmt(b.retail) + ' м²']
      ]) + '<div class="gp-card-foot"><a class="btn btn-solid" href="#kommerciya">Все помещения</a><button class="btn btn-line" data-reset>Весь квартал</button></div>';
    } else if (state.phase) {
      var p = state.phase, hs = D.buildings.filter(function (x) { return x.phase === p && x.kind === 'home'; });
      var ss = D.buildings.filter(function (x) { return x.phase === p && x.kind === 'shop'; });
      var retail = D.retail.filter(function (r) { return r.phase === ROMAN[p]; }).reduce(function (s, r) { return s + r.area; }, 0);
      var list = [
        ['Секции', hs.map(function (x) { return x.id; }).join(', ')],
        ['Квартир', fmt(hs.reduce(function (s, x) { return s + x.flats; }, 0))],
        ['Площадь квартир', fmt(hs.reduce(function (s, x) { return s + x.living; }, 0), 0) + ' м²'],
        ['Коммерция', fmt(retail) + ' м²']
      ];
      if (ss.length) list.push(['Отдельные здания', ss.map(function (x) { return '№ ' + x.id; }).join(', ')]);
      html = '<h3>' + ROMAN[p] + ' очередь</h3><p class="sub">Этап строительства квартала</p>' + rows(list) +
        '<div class="gp-card-foot"><a class="btn btn-line" href="#kvartiry">Форматы квартир</a></div>';
    } else {
      html = '<h3>Квартал</h3><p class="sub">Краснодон, улица Красных Шахтёров</p>' + rows([
        ['Жилых секций', '11'],
        ['Этажей', '16'],
        ['Квартир', '2 055'],
        ['Площадь квартир', '89 003 м²'],
        ['Коммерция', '9 850 м²'],
        ['Отдельных зданий', '3']
      ]) + '<div class="gp-card-foot"><a class="btn btn-line" href="#kvartiry">Форматы квартир</a></div>';
    }
    card.innerHTML = html;
  }
  card.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-plan],[data-reset]'); if (!t) return;
    if (t.hasAttribute('data-reset')) { select(null); return; }
    window.ALTA_openPlan(+t.dataset.sec, +t.dataset.plan);
  });
  chips.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    state.phase = +b.dataset.phase; state.sel = null;
    if (window.ALTA_closePlan) window.ALTA_closePlan();
    [].forEach.call(chips.children, function (x) { x.classList.toggle('is-on', x === b); });
    renderCard(); restyle();
  });
  renderCard();

  if (!T) { view.classList.add('no-gl'); return; }
  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { hint.textContent = 'Трёхмерная модель недоступна в этом браузере'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(34, 1, 10, 9000);
  scene.add(new T.HemisphereLight(0xfff1d6, 0x0a2014, 1.5));
  var sun = new T.DirectionalLight(0xffd9a0, 2.2); sun.position.set(-900, 1100, 700); scene.add(sun);

  var OX = 1100, OY = 660, H_HOME = 250, H_SHOP = 42;

  /* земля — схема генплана */
  var gImg = new Image();
  gImg.onload = function () {
    var tex = new T.Texture(gImg); tex.needsUpdate = true;
    if ('colorSpace' in tex) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var g = new T.Mesh(new T.PlaneGeometry(1987, 1404), new T.MeshBasicMaterial({ map: tex, transparent: true }));
    g.rotation.x = -Math.PI / 2; g.position.set(993.5 - OX, 0, 702 - OY);
    scene.add(g);
  };
  gImg.src = window.ALTA_GROUND;

  /* фасадная текстура: 4 оси × 16 этажей */
  function facade(seed, emissive) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 512;
    var x = c.getContext('2d'), r = seed;
    var rnd = function () { r = (r * 16807) % 2147483647; return r / 2147483647; };
    x.fillStyle = emissive ? '#000' : '#e9e1cd'; x.fillRect(0, 0, 128, 512);
    for (var f = 0; f < 16; f++) {
      var y = 512 - (f + 1) * 32;
      for (var b = 0; b < 4; b++) {
        var bx = b * 32;
        if (f === 0) {
          x.fillStyle = emissive ? '#ffc56e' : '#f2cf8e'; x.fillRect(bx + 2, y + 3, 28, 29);
          if (!emissive) { x.fillStyle = '#6b5632'; x.fillRect(bx + 15, y + 3, 2, 29); }
          continue;
        }
        if (!emissive && b === 2) { x.fillStyle = '#0d4a28'; x.fillRect(bx, y, 5, 32); }
        var lit = rnd() < 0.3;
        if (emissive) { if (lit) { x.fillStyle = rnd() < 0.5 ? '#ffcf87' : '#ffe2b0'; x.fillRect(bx + 8, y + 7, 17, 19); } }
        else { x.fillStyle = lit ? '#f7d596' : '#22382f'; x.fillRect(bx + 8, y + 7, 17, 19); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(bx, y + 31, 32, 1); }
      }
    }
    var t = new T.CanvasTexture(c);
    t.wrapS = T.RepeatWrapping; t.anisotropy = 4;
    if (!emissive && 'colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  var texA = [facade(7), facade(91), facade(333)], texE = [facade(7, true), facade(91, true), facade(333, true)];
  function sideMat(len, v) {
    var m = texA[v].clone(), e = texE[v].clone();
    m.needsUpdate = e.needsUpdate = true;
    m.repeat.x = e.repeat.x = Math.max(1, Math.round(len / 68));
    return new T.MeshLambertMaterial({ map: m, emissiveMap: e, emissive: 0xffffff, emissiveIntensity: 0.7, transparent: true });
  }

  var groups = [], pickables = [];
  D.buildings.forEach(function (b, bi) {
    var g = new T.Group(); g.userData.b = b;
    var mats = [], h = b.kind === 'home' ? H_HOME : H_SHOP;
    b.parts.forEach(function (p, pi) {
      var w = p[2], d = p[3], m;
      if (b.kind === 'home') {
        var roof = new T.MeshLambertMaterial({ color: 0x8d9686, transparent: true });
        var sx = sideMat(d, (bi + pi) % 3), sz = sideMat(w, (bi + pi + 1) % 3);
        m = [sx, sx, roof, roof, sz, sz];
        mats.push(sx, sz, roof);
      } else {
        var glass = new T.MeshLambertMaterial({ color: 0xd9c08a, emissive: 0xffb95e, emissiveIntensity: 0.55, transparent: true });
        var top = new T.MeshLambertMaterial({ color: 0x8f9f8a, transparent: true });
        m = [glass, glass, top, top, glass, glass];
        mats.push(glass, top);
      }
      var mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      mesh.position.set(p[0] - OX, h / 2, p[1] - OY);
      mesh.rotation.y = -p[4] * Math.PI / 180;
      mesh.userData.b = b;
      var edges = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: 0xc9a96a, transparent: true, opacity: 0 }));
      mesh.add(edges); mesh.userData.edges = edges;
      g.add(mesh); pickables.push(mesh);
    });
    g.userData.mats = mats; g.userData.h = h; g.userData.lift = 0;
    scene.add(g); groups.push(g);

    var el = document.createElement('div');
    el.className = 'gp-label';
    el.textContent = b.kind === 'home' ? b.id : '№ ' + b.id;
    labelsEl.appendChild(el); g.userData.label = el;
    g.userData.anchor = new T.Vector3(b.parts[0][0] - OX, h + 14, b.parts[0][1] - OY);
  });

  function restyle() {
    groups.forEach(function (g) {
      var b = g.userData.b;
      var dim = state.phase && b.phase !== state.phase;
      var on = state.sel === b, hov = state.hover === b;
      g.userData.mats.forEach(function (m) { m.opacity = dim ? 0.14 : 1; m.depthWrite = !dim; });
      g.children.forEach(function (mesh) { mesh.userData.edges.material.opacity = on ? 1 : hov ? 0.7 : 0; });
      g.userData.label.classList.toggle('is-on', on);
      g.userData.label.classList.toggle('is-dim', !!dim);
      g.userData.target = on ? 16 : 0;
    });
  }
  function select(b) {
    if (!b || b.kind !== 'home') { if (window.ALTA_closePlan) window.ALTA_closePlan(); }
    state.sel = b;
    if (b && state.phase && b.phase !== state.phase) {
      state.phase = 0;
      [].forEach.call(chips.children, function (x) { x.classList.toggle('is-on', x.dataset.phase === '0'); });
    }
    renderCard(); restyle();
  }

  /* ───── камера: вращение перетаскиванием ───── */
  var az = -0.62, el = 0.6, taz = az, tel = el, auto = true, lastTouch = 0;
  var target = new T.Vector3(90, 70, 0);
  function resize() {
    var w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function placeCamera() {
    var R = 1780 / Math.min(1, camera.aspect / 1.5);
    camera.position.set(target.x + R * Math.cos(el) * Math.sin(az), target.y + R * Math.sin(el), target.z + R * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
  }
  var ray = new T.Raycaster(), ptr = new T.Vector2();
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ptr.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    var hits = ray.intersectObjects(pickables, false);
    for (var i = 0; i < hits.length; i++) {
      var b = hits[i].object.userData.b;
      if (!state.phase || b.phase === state.phase) return b;
    }
    return hits.length ? hits[0].object.userData.b : null;
  }
  var drag = null;
  view.addEventListener('pointerdown', function (ev) {
    drag = { x: ev.clientX, y: ev.clientY, az: taz, el: tel, moved: false, id: ev.pointerId, touch: ev.pointerType === 'touch' };
  });
  addEventListener('pointermove', function (ev) {
    if (drag && ev.pointerId === drag.id) {
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (!drag.moved && drag.touch && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // вертикальный жест — прокрутка страницы
      drag.moved = true; auto = false; view.classList.add('is-drag'); hint.classList.add('is-off');
      taz = drag.az - dx * 0.006;
      if (!drag.touch) tel = Math.min(1.25, Math.max(0.28, drag.el + dy * 0.004));
      return;
    }
    if (ev.pointerType !== 'touch' && ev.target === canvas) {
      var b = pick(ev);
      if (b !== state.hover) { state.hover = b; view.style.cursor = b ? 'pointer' : ''; restyle(); }
    }
  });
  addEventListener('pointerup', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag; drag = null; view.classList.remove('is-drag');
    if (!d.moved && ev.target === canvas) { var b = pick(ev); select(b === state.sel ? null : b); auto = false; hint.classList.add('is-off'); }
  });
  addEventListener('pointercancel', function () { drag = null; view.classList.remove('is-drag'); });
  canvas.addEventListener('pointerleave', function () { if (state.hover) { state.hover = null; view.style.cursor = ''; restyle(); } });

  /* ───── цикл ───── */
  var visible = false, v = new T.Vector3(), last = performance.now();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* рисуем только когда открыта сцена генплана */
  function onView(id) {
    visible = id === 'genplan';
    if (visible) { resize(); last = performance.now(); loop(); }
  }
  addEventListener('alta:view', function (e) { onView(e.detail); });
  var running = false;
  // пока поверх открыт выбор квартиры, прогулка или фото — генплан не рисуем
  function covered() { var c = document.body.classList; return c.contains('picker-open') || c.contains('walk-open'); }
  new MutationObserver(function () { if (visible && !covered()) { last = performance.now(); loop(); } }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  function loop() {
    if (running) return; running = true;
    requestAnimationFrame(function tick(now) {
      if (!visible || covered()) { running = false; return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (auto && !reduce) taz += dt * 0.07;
      az += (taz - az) * 0.1; el += (tel - el) * 0.1;
      placeCamera();
      var w = view.clientWidth, h = view.clientHeight;
      groups.forEach(function (g) {
        var u = g.userData;
        u.lift += ((u.target || 0) - u.lift) * 0.14; g.position.y = u.lift;
        v.copy(u.anchor); v.y += u.lift; v.project(camera);
        u.label.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-100%)';
      });
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    });
  }
  window.addEventListener('resize', function () { resize(); });
  resize(); restyle(); placeCamera();
  onView(document.body.dataset.view);
})();
