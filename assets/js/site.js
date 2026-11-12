/* ГК Альта: полноэкранные сцены и видео-пролёты между ними */
(function () {
  'use strict';
  window.ALTA_hash0 = location.hash;                 // ссылка на квартиру (#kv-…) — её откроет каталог
  var D = window.ALTA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var once = function (el, ev) { return new Promise(function (r) { el.addEventListener(ev, r, { once: true }); }); };
  var within = function (p, ms) { return Promise.race([p, wait(ms)]); };
  var fmt = function (n, d) { return n.toLocaleString('ru-RU', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 2 : d }); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // телефон: отдельная мобильная версия — обычная прокрутка, без видео-переходов и полноэкранных сцен
  var M = document.documentElement.classList.contains('m');

  var SC = D.scenes;
  var IDS = SC.map(function (s) { return s.id; });
  var idx = function (id) { return IDS.indexOf(id); };
  var views = {};
  IDS.forEach(function (id) { views[id] = document.getElementById(id); });

  var body = document.body;
  var platesEl = $('#plates'), transit = $('#transit'), flash = $('#flash'), stageInner = $('#stageInner');
  var current = null, shown = null, busy = false, lockUntil = 0;

  /* ───────── Кадры сцен ───────── */
  // облегчённые кадры и ролики для телефонов
  var LITE = Math.min(screen.width, screen.height) <= 820 || (navigator.connection && navigator.connection.saveData);
  function lite(u) { return LITE ? u.replace(/assets\/(img|video)\//, 'assets/$1/m/') : u; }
  var plates = {};
  SC.forEach(function (s) {
    var p = document.createElement('div');
    p.className = 'plate';
    var img = new Image();
    img.alt = ''; img.decoding = 'async';
    p.appendChild(img);
    p._img = img; p._src = lite(s.img);
    if (s.loop && !reduce && !M) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.src = lite(s.loop);
      v.addEventListener('playing', function () { v.classList.add('is-playing'); });
      v.addEventListener('error', function () { v.remove(); p._loop = null; });
      p.appendChild(v);
      p._loop = v;
    }
    platesEl.appendChild(p);
    plates[s.id] = p;
  });

  function loadPlate(id) {
    var p = plates[id];
    if (!p) return Promise.resolve();
    if (!p._ready) {
      p._ready = new Promise(function (r) { p._img.onload = p._img.onerror = r; p._img.src = p._src; })
        .then(function () { return p._img.decode ? p._img.decode().catch(function () {}) : null; });
    }
    return p._ready;
  }

  function showPlate(id) {
    IDS.forEach(function (k) {
      var p = plates[k], on = k === id;
      p.classList.toggle('is-on', on);
      p.style.zIndex = '';
    });
    shown = id;
    var loop = plates.top._loop;
    if (loop) {
      if (id === 'top') { var pr = loop.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else loop.pause();
    }
  }

  /* ───────── Видео-пролёты ───────── */
  var vids = {}, bad = {};

  // ролик для перехода между соседними сценами
  function legOf(from, to) {
    var a = idx(from), b = idx(to), s;
    if (b === a + 1) { s = SC[b]; return s.via ? { name: s.via, rate: s.rate || 1 } : null; }
    if (b === a - 1) { s = SC[a]; return s.via && s.back ? { name: s.via + '-back', rate: s.rate || 1 } : null; }
    return null;
  }
  function getVid(name) {
    if (bad[name]) return null;
    var v = vids[name];
    if (!v) {
      v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'none';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.addEventListener('error', function () { bad[name] = true; });
      v.src = lite('assets/video/' + name + '.mp4');
      transit.appendChild(v);
      vids[name] = v;
    }
    return v;
  }
  function warm(from, to) {
    var l = legOf(from, to), v = l && getVid(l.name);
    if (v && v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
  }
  function warmAround(id) {
    var i = idx(id);
    [IDS[i + 1], IDS[i - 1]].forEach(function (n) { if (n) { warm(id, n); loadPlate(n); } });
  }
  function ready(v, ms) {
    if (!v) return Promise.resolve(false);
    if (v.readyState >= 3) return Promise.resolve(true);
    if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
    return new Promise(function (r) {
      var t;
      function done(x) { clearTimeout(t); v.removeEventListener('canplay', ok); v.removeEventListener('error', no); r(x); }
      function ok() { done(true); }
      function no() { done(false); }
      v.addEventListener('canplay', ok);
      v.addEventListener('error', no);
      t = setTimeout(function () { done(v.readyState >= 2); }, ms);
    });
  }
  function firstFrame(v) {
    return new Promise(function (r) {
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(function () { r(); });
      else once(v, 'playing').then(function () { setTimeout(r, 30); });
      setTimeout(r, 600);
    });
  }

  async function playLeg(v, rate, to) {
    try { v.currentTime = 0; } catch (e) {}
    v.playbackRate = rate;
    var ok = await v.play().then(function () { return true; }, function () { return false; });
    if (!ok) return false;
    await firstFrame(v);
    v.classList.remove('is-out');
    v.classList.add('is-on');
    $$('video.is-on', transit).forEach(function (o) { if (o !== v) { o.classList.remove('is-on'); o.pause(); } });
    await wait(100);
    showPlate(to);                                   // новый кадр уже лежит под видео
    var dur = ((v.duration || 2) / rate) * 1000;
    var t = setTimeout(function () { arrive(to); }, Math.max(0, dur - 620));   // текст проявляется на последних кадрах
    await within(once(v, 'ended'), dur + 900);
    clearTimeout(t);
    if (current !== to) arrive(to);
    v.classList.add('is-out');
    v.classList.remove('is-on');
    setTimeout(function () { v.pause(); }, 420);
    return true;
  }

  // Пролёт по фото, если ролика нет: кадр уносится на зрителя, новый «наплывает»
  async function fly(from, to, quick) {
    await within(loadPlate(to), 2500);
    if (reduce || from === to) { showPlate(to); if (!quick) arrive(to); return; }
    var a = plates[from], b = plates[to], T = quick ? 520 : 900;
    a.classList.add('is-on'); b.classList.add('is-on');
    a.style.zIndex = 2; b.style.zIndex = 1;
    var anA = a.animate([
      { transform: 'scale(1)', filter: 'blur(0px) brightness(1)', opacity: 1 },
      { transform: 'scale(1.5)', filter: 'blur(24px) brightness(1.7)', opacity: 0 }
    ], { duration: T * 0.72, easing: 'cubic-bezier(.55,.05,.8,.35)', fill: 'forwards' });
    var anB = b.animate([
      { transform: 'scale(1.32)', filter: 'blur(18px) brightness(1.4)' },
      { transform: 'scale(1)', filter: 'blur(0px) brightness(1)' }
    ], { duration: T, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    flash.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.42 }, { opacity: 0 }], { duration: T * 0.95, easing: 'ease-in-out' });
    var t = quick ? 0 : setTimeout(function () { arrive(to); }, T * 0.4);
    await anB.finished.catch(function () {});
    clearTimeout(t);
    anA.cancel(); anB.cancel();
    showPlate(to);
    if (!quick && current !== to) arrive(to);
  }

  /* ───────── Сцены: вход и выход ───────── */
  var navLinks = $$('.nav a');
  var rail = $('#rail'), nextBtn = $('#next'), nextLabel = $('#nextLabel');
  rail.innerHTML = SC.map(function (s, i) {
    return '<button type="button" data-go="' + s.id + '" aria-label="' + s.name + '"><span>' + s.name + '</span><i></i></button>';
  }).join('');
  var railBtns = $$('button', rail);

  // кнопка «дальше» в конце каждой сцены (на телефоне)
  SC.forEach(function (s, i) {
    var n = SC[i + 1];
    if (!n) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'view-next'; b.dataset.go = n.id;
    b.innerHTML = '<span>Дальше</span><b>' + n.name + '</b>';
    $('.view-scroll', views[s.id]).appendChild(b);
  });

  // порядковые задержки для появления элементов
  IDS.forEach(function (id) { $$('[data-in]', views[id]).forEach(function (el, i) { el.style.setProperty('--i', i); }); });

  function setActive(id) {
    IDS.forEach(function (k) {
      var on = k === id, el = views[k];
      if (M) return;
      el.classList.toggle('is-active', on);
      el.inert = !on;
      el.setAttribute('aria-hidden', String(!on));
    });
    current = id;
    body.dataset.view = id;
    navLinks.forEach(function (a) { a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id)); });
    railBtns.forEach(function (b) { b.setAttribute('aria-current', String(b.dataset.go === id)); });
    var n = SC[idx(id) + 1];
    body.classList.toggle('is-last', !n);
    nextLabel.textContent = n ? n.name : '';
    if (!M) try { history.replaceState(null, '', id === 'top' ? location.pathname + location.search : '#' + id); } catch (e) {}
    window.dispatchEvent(new CustomEvent('alta:view', { detail: id }));
  }

  function arrive(id) {
    var v = views[id];
    setActive(id);
    v.classList.remove('is-in');
    var sc = $('.view-scroll', v);
    if (sc) sc.scrollTop = 0;
    void v.offsetWidth;
    v.classList.add('is-in');
    countUp(v);
    warmAround(id);
  }

  function leave(id) { if (id && views[id]) views[id].classList.remove('is-in'); }

  function countUp(v) {
    if (reduce) return;
    $$('[data-count]', v).forEach(function (el) {
      var to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now();
      (function tick(now) {
        var k = Math.min(1, Math.max(0, (now - t0 - 380) / 1500));
        var e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(Math.round(to * e), 0) + suf;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  async function go(target) {
    if (target === 'next') target = IDS[idx(current) + 1];
    if (target === 'prev') target = IDS[idx(current) - 1];
    if (!target || !views[target] || target === current || busy) return;
    busy = true;
    body.classList.add('is-moving');
    closeMenu();
    var from = current, a = idx(from), b = idx(target), dir = b > a ? 1 : -1;
    try {
      leave(from);
      var legFrom = IDS[b - dir];                    // соседняя с целью сцена: из неё идёт последний ролик
      var leg = legOf(legFrom, target);
      var v = leg && !reduce && Math.abs(b - a) === 1 ? getVid(leg.name) : null;
      var ok = !!v && await ready(v, 1600);
      await within(loadPlate(target), 2500);
      if (ok) { await wait(90); ok = await playLeg(v, leg.rate, target); }
      if (!ok) await fly(shown, target, false);
      if (current !== target) arrive(target);
    } finally {
      busy = false;
      body.classList.remove('is-moving');
      lockUntil = performance.now() + 300;
    }
  }

  /* ───────── Управление: колесо, свайп, клавиши, ссылки ───────── */
  function canScroll(el, dy) {
    var stop = views[current];
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.nodeType !== 1) continue;
      var oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 2) {
        if (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 2) return true;
        if (dy < 0 && n.scrollTop > 2) return true;
      }
      if (n === stop) break;
    }
    return false;
  }

  function modalOpen() { var c = body.classList; return c.contains('picker-open') || c.contains('cat-open') || c.contains('walk-open'); }
  var acc = 0, lastWheel = 0, blocked = false;
  window.addEventListener('wheel', function (ev) {
    if (M || lb.open || modalOpen()) return;
    if (Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
    if (canScroll(ev.target, ev.deltaY)) return;
    ev.preventDefault();
    var now = performance.now(), gap = now - lastWheel;
    lastWheel = now;
    if (blocked) { if (gap > 240) blocked = false; else return; }   // гасим инерцию тачпада
    if (busy || now < lockUntil) return;
    if (gap > 220) acc = 0;
    acc += ev.deltaY * (ev.deltaMode === 1 ? 30 : 1);
    if (Math.abs(acc) > 40) { blocked = true; var d = acc > 0 ? 'next' : 'prev'; acc = 0; go(d); }
  }, { passive: false });

  var ts = null;
  window.addEventListener('touchstart', function (e) {
    if (M || e.touches.length !== 1 || lb.open || modalOpen()) { ts = null; return; }
    var t = e.touches[0];
    ts = { x: t.clientX, y: t.clientY, down: canScroll(e.target, 1), up: canScroll(e.target, -1) };
  }, { passive: true });
  window.addEventListener('touchend', function (e) {
    if (!ts) return;
    var t = e.changedTouches[0], s = ts;
    ts = null;
    var dx = t.clientX - s.x, dy = s.y - t.clientY;
    if (Math.abs(dy) < 70 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    if (dy > 0 && !s.down) go('next');
    else if (dy < 0 && !s.up) go('prev');
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (M || lb.open || modalOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target.tagName || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var k = e.key, dir = 0;
    if (k === ' ' && /BUTTON|A/.test(tag)) return;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
    else if (k === 'Home') { e.preventDefault(); go('top'); return; }
    else if (k === 'End') { e.preventDefault(); go(IDS[IDS.length - 1]); return; }
    if (!dir) return;
    if (canScroll($('.view-scroll', views[current]), dir)) return;
    e.preventDefault();
    go(dir > 0 ? 'next' : 'prev');
  });

  document.addEventListener('click', function (e) {
    var pk = e.target.closest('[data-picker]');
    if (pk) { e.preventDefault(); if (window.ALTA_openPicker) window.ALTA_openPicker(+pk.dataset.picker); return; }
    if (modalOpen()) return;
    var el = e.target.closest('[data-go], a[href^="#"]');
    if (!el) return;
    var id = el.dataset.go || el.getAttribute('href').slice(1);
    if (!views[id]) return;
    e.preventDefault();
    if (M) { closeMenu(); scrollToView(id); } else go(id);
  });
  nextBtn.addEventListener('click', function () { go('next'); });

  var nav = $('#nav'), burger = $('#burger');
  function closeMenu() { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Открыть меню'); }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  });

  /* лёгкий параллакс за курсором — двигает кадр и видео вместе */
  var mx = 0, my = 0, tx = 0, ty = 0;
  if (!reduce) {
    window.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      tx = ev.clientX / innerWidth - 0.5; ty = ev.clientY / innerHeight - 0.5;
    }, { passive: true });
    (function loop() {
      var c = document.body.classList;
      if (!c.contains('picker-open') && !c.contains('walk-open') && (Math.abs(tx - mx) > 1e-4 || Math.abs(ty - my) > 1e-4)) {
        mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
        stageInner.style.transform = 'translate3d(' + (-mx * 14).toFixed(2) + 'px,' + (-my * 9).toFixed(2) + 'px,0)';
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ───────── Квартиры ───────── */
  var total = D.flats.reduce(function (s, f) { return s + f.count; }, 0);
  var maxCount = Math.max.apply(null, D.flats.map(function (f) { return f.count; }));
  $('#kvList').innerHTML = D.flats.map(function (f, i) {
    return '<button type="button" class="kv-row" data-catalog="' + f.code + '" style="--i:' + i + '" aria-label="' + f.name + ': показать все квартиры">' +
      '<div class="kv-name">' + f.name + '</div>' +
      '<div class="kv-area">' + fmt(f.min, 1) + '–' + fmt(f.max, 1) + ' м²</div>' +
      '<div class="kv-count"><b>' + fmt(f.count) + '</b> · ' + fmt(f.count / total * 100, 0) + '%</div>' +
      '<div class="kv-bar"><i style="--w:' + (f.count / maxCount).toFixed(3) + '"></i></div>' +
      '<span class="kv-arrow" aria-hidden="true"></span>' +
      '</button>';
  }).join('');

  var planType = $('#planType'), planFloor = $('#planFloor'), planImg = $('#planImg'), planCap = $('#planCap');
  var pState = { type: 1, floor: 'typical' };
  planType.innerHTML = D.sectionTypes.map(function (t, i) {
    return '<button class="chip' + (i === 0 ? ' is-on' : '') + '" data-type="' + t.id + '">' + t.label + '</button>';
  }).join('');
  function showPlan() {
    var t = D.sectionTypes.filter(function (x) { return x.id === pState.type; })[0];
    var src = 'assets/plans/s' + t.id + '-' + pState.floor + '.webp';
    planImg.classList.add('is-swap');
    var pre = new Image();
    pre.onload = function () { planImg.src = src; planImg.classList.remove('is-swap'); };
    pre.src = src;
    planImg.alt = (pState.floor === 'typical' ? 'План жилого этажа' : 'План первого этажа') + ', секция типа ' + t.id;
    planCap.textContent = pState.floor === 'typical'
      ? t.label + ': секции ' + t.sections + '. На этаже ' + t.perFloor + ' квартир — ' + t.mix + '.'
      : t.label + ': секции ' + t.sections + '. Первый этаж — коммерческие помещения, холл, лифты, колясочная.';
  }
  function markPlan() {
    $$('button', planType).forEach(function (x) { x.classList.toggle('is-on', +x.dataset.type === pState.type); });
    $$('button', planFloor).forEach(function (x) { x.classList.toggle('is-on', x.dataset.floor === pState.floor); });
  }
  planType.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    pState.type = +b.dataset.type; markPlan(); showPlan();
  });
  planFloor.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    pState.floor = b.dataset.floor; markPlan(); showPlan();
  });
  showPlan();
  /* План этажа прямо в генплане: шторка поверх 3D-модели */
  var gpPlan = $('#gpPlan'), gpImg = $('#gpPlanImg'), gpFloor = $('#gpPlanFloor');
  var g = { sec: 0, type: 1, floor: 'typical' };
  function renderGpPlan() {
    var t = D.sectionTypes.filter(function (x) { return x.id === g.type; })[0];
    var src = 'assets/plans/s' + t.id + '-' + g.floor + '.webp';
    $('#gpPlanTitle').textContent = 'Секция ' + g.sec;
    $$('button', gpFloor).forEach(function (x) { x.classList.toggle('is-on', x.dataset.floor === g.floor); });
    gpImg.classList.add('is-swap');
    var pre = new Image();
    pre.onload = function () { gpImg.src = src; gpImg.classList.remove('is-swap'); };
    pre.src = src;
    gpImg.alt = (g.floor === 'typical' ? 'План жилого этажа' : 'План первого этажа') + ', секция ' + g.sec;
    $('#gpPlanCap').textContent = g.floor === 'typical'
      ? 'Этажи 2–16, ' + t.perFloor + ' квартир на этаже: ' + t.mix + '.'
      : 'Первый этаж: коммерческие помещения, холл, лифты, колясочная.';
  }
  window.ALTA_openPlan = function (sec, typeId) {
    g.sec = sec; g.type = typeId; g.floor = 'typical';
    renderGpPlan();
    gpPlan.inert = false;
    gpPlan.setAttribute('aria-hidden', 'false');
    gpPlan.classList.add('is-open');
  };
  window.ALTA_closePlan = function () {
    gpPlan.classList.remove('is-open');
    gpPlan.inert = true;
    gpPlan.setAttribute('aria-hidden', 'true');
  };
  gpFloor.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    g.floor = b.dataset.floor; renderGpPlan();
  });
  $('#gpPlanClose').addEventListener('click', window.ALTA_closePlan);
  $('#gpPlanFrame').addEventListener('click', function () {
    lbImg.src = gpImg.src; lbImg.alt = gpImg.alt;
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  });
  window.addEventListener('alta:view', function (e) { if (e.detail !== 'genplan') window.ALTA_closePlan(); });
  // план типового этажа крупно (из 3D-выбора квартиры)
  window.ALTA_showFloorPlan = function (stype) {
    lbImg.src = 'assets/plans/s' + stype + '-typical.webp'; lbImg.alt = 'План жилого этажа, секция типа ' + stype;
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  };

  var lb = $('#lightbox'), lbImg = $('#lightboxImg');
  $('#planFrame').addEventListener('click', function () {
    lbImg.src = planImg.src; lbImg.alt = planImg.alt;
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  });
  $('#lightboxClose').addEventListener('click', function () { if (lb.close) lb.close(); else lb.removeAttribute('open'); });

  /* ───────── Мобильная версия ───────── */
  function scrollToView(id) {
    var v = views[id]; if (!v) return;
    var y = id === 'top' ? 0 : v.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  var NOPIC = { top: 1, genplan: 1, kvartiry: 1 };
  function mobileStart(startId) {
    body.classList.add('is-m');
    SC.forEach(function (s) {
      var v = views[s.id]; if (!v) return;
      v.classList.add('is-active', 'is-in'); v.inert = false; v.removeAttribute('aria-hidden');
      if (s.id === 'top') {
        var hi = new Image(); hi.className = 'm-hero-img'; hi.alt = ''; hi.decoding = 'async';
        try { hi.fetchPriority = 'high'; } catch (e) {}
        hi.src = lite(s.img); v.insertBefore(hi, v.firstChild); return;
      }
      if (NOPIC[s.id]) return;
      var fig = document.createElement('figure'); fig.className = 'm-pic';
      fig.innerHTML = '<img src="' + lite(s.img) + '" alt="" loading="lazy" decoding="async">';
      var sc = $('.view-scroll', v); sc.insertBefore(fig, sc.firstChild);
    });
    // загрузка: ждём только картинку первого экрана
    var hero = $('.m-hero-img');
    within(new Promise(function (r) { if (hero.complete) r(); else hero.onload = hero.onerror = r; }), 3000).then(function () {
      bar.style.width = '100%'; return wait(150);
    }).then(function () { document.documentElement.classList.add('is-ready'); });
    // какая секция на экране: подсветка меню, счётчики, 3D-генплан рисуется только когда виден
    var seen = {};
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id;
          if (!seen[id]) { seen[id] = 1; countUp(en.target); }
          if (current !== id) setActive(id);
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      IDS.forEach(function (id) { io.observe(views[id]); });
    }
    setActive('top');
    window.addEventListener('scroll', function () { body.classList.toggle('is-scrolled', window.scrollY > 30); }, { passive: true });
    if (startId !== 'top') setTimeout(function () { scrollToView(startId); }, 400);
  }

  // генплан на телефоне: кадр + список секций; 3D запускается только по кнопке
  var HOMES = D.buildings.filter(function (b) { return b.kind === 'home'; });
  var ROMAN = ['', 'I', 'II', 'III', 'IV'];
  $('#gpList').innerHTML = '<p class="gp-list-l">Секции</p><div class="gp-list-g">' + HOMES.map(function (b) {
    return '<button type="button" class="gp-li" data-floors="' + b.id + '"><b>' + b.id + '</b><span>' + ROMAN[b.phase] + ' очередь<br>' + fmt(b.flats) + ' квартир</span></button>';
  }).join('') + '</div>';
  $('#gpPoster').addEventListener('click', function () {
    body.classList.add('gp-3d');
    if (window.ALTA_gpStart) window.ALTA_gpStart();
    current = null; setActive('genplan');
    requestAnimationFrame(function () { $('#gpView').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); });
  });

  // нижняя панель: телефон и мессенджеры из data.js
  var C = D.contacts || {}, ws = $('#writeSheet');
  if (C.phone) { var call = $('#tabCall'); call.hidden = false; call.href = 'tel:' + C.phone.replace(/[^\d+]/g, ''); }
  var ways = [];
  if (C.telegram) ways.push(['Telegram', 'https://t.me/' + C.telegram.replace(/^@/, '')]);
  if (C.whatsapp) ways.push(['WhatsApp', 'https://wa.me/' + C.whatsapp.replace(/\D/g, '')]);
  if (C.phone) ways.push(['Позвонить ' + C.phone, 'tel:' + C.phone.replace(/[^\d+]/g, '')]);
  if (C.email) ways.push(['Почта ' + C.email, 'mailto:' + C.email]);
  function sheet(on) { ws.classList.toggle('is-open', on); ws.inert = !on; ws.setAttribute('aria-hidden', String(!on)); }
  if (ways.length > 1) {
    $('#writeList').innerHTML = ways.map(function (w) { return '<a class="m-way" href="' + w[1] + '"' + (/^http/.test(w[1]) ? ' target="_blank" rel="noopener"' : '') + '>' + w[0] + '</a>'; }).join('');
    $('#tabWrite').addEventListener('click', function (e) { e.preventDefault(); sheet(true); });
  } else if (C.email) $('#tabWrite').href = 'mailto:' + C.email;
  ws.addEventListener('click', function (e) { if (e.target.closest('[data-ws="close"]') || e.target.closest('.m-way')) sheet(false); });

  /* ───────── Коммерция и компании ───────── */
  var sum = D.retail.reduce(function (s, r) { return s + r.area; }, 0);
  $('#komRows').innerHTML = D.retail.map(function (r) {
    return '<tr><td>' + r.name + '</td><td>' + r.phase + '</td><td>' + r.floors + '</td><td class="num">' + fmt(r.area) + '</td></tr>';
  }).join('');
  $('#komRows').parentNode.insertAdjacentHTML('beforeend', '<tfoot><tr><td colspan="3">Итого</td><td class="num">' + fmt(sum) + '</td></tr></tfoot>');
  $('#companies').innerHTML = D.companies.map(function (c) {
    return '<div class="company"><b>' + c.name + '</b><em>' + c.role + '</em><span>' + c.text + '</span></div>';
  }).join('');

  /* ───────── Старт ───────── */
  var bar = $('#loaderBar');
  var startId = views[location.hash.slice(1)] ? location.hash.slice(1) : 'top';
  if (M) { mobileStart(startId); return; }
  setActive(startId);
  var first = loadPlate(startId).then(function () { bar.style.width = '60%'; });
  var loop = plates.top._loop;
  var heroReady = startId === 'top' && loop ? within(ready(loop, 2500), 2600) : Promise.resolve();
  Promise.all([within(first, 4000), heroReady]).then(function () {
    bar.style.width = '100%';
    return wait(350);
  }).then(function () {
    showPlate(startId);
    document.documentElement.classList.add('is-ready');
    setTimeout(function () { arrive(startId); }, 250);
  });
})();
