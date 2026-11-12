/* Прогулка по квартире: комнаты на весь экран, камера медленно «идёт» вперёд, между комнатами — пролёт */
(function () {
  'use strict';
  var D = window.ALTA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = $('#tour'), stage = $('#tourStage'), cap = $('#tourCap'), title = $('#tourTitle'), roomsEl = $('#tourRooms'), playBtn = $('#tourPlay');
  var rooms = [], cur = -1, layers = [], timer = null, playing = true, busy = false, STEP = 6500;
  var DRIFT = [[-1.5, -1], [1.5, -0.8], [-1, 1], [1.2, 0.6], [0, -1.4]];

  function fmt(n) { return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function layer(r, i) {
    var el = document.createElement('div');
    el.className = 'tour-layer';
    var d = DRIFT[i % DRIFT.length];
    el.style.setProperty('--dx', d[0] + '%');
    el.style.setProperty('--dy', d[1] + '%');
    if (r.video) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.poster = r.img;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.src = r.video; el.appendChild(v); el._v = v;
    } else {
      var im = new Image(); im.alt = ''; im.decoding = 'async'; im.src = r.img; el.appendChild(im);
    }
    stage.appendChild(el);
    return el;
  }

  function caption(i) {
    var r = rooms[i];
    cap.innerHTML = '<p class="tour-step">' + (i + 1) + ' из ' + rooms.length + '</p><h2><span>' + r.name + '</span></h2>' + (r.text ? '<p>' + r.text + '</p>' : '');
    cap.classList.remove('is-in'); void cap.offsetWidth; cap.classList.add('is-in');
    Array.prototype.forEach.call(roomsEl.children, function (b, k) { b.setAttribute('aria-current', String(k === i)); b.classList.remove('is-run'); });
    if (playing && !reduce) { void roomsEl.children[i].offsetWidth; roomsEl.children[i].classList.add('is-run'); }
  }

  function show(i, dir) {
    if (busy || i === cur || i < 0 || i >= rooms.length) return;
    busy = true;
    var prev = layers[cur], next = layers[i];
    cur = i;
    caption(i);
    next.classList.remove('is-out', 'is-on');
    next.classList.add('is-on');
    if (next._v) { try { next._v.currentTime = 0; } catch (e) {} var p = next._v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!prev || reduce) {
      next.classList.add('is-kb');
      if (prev) { prev.classList.remove('is-on', 'is-kb'); }
      busy = false; schedule(); return;
    }
    // уходящая комната «пролетает» на зрителя, новая наплывает из глубины
    prev.classList.add('is-out');
    next.classList.add('is-enter');
    next.style.zIndex = 1; prev.style.zIndex = 2;
    requestAnimationFrame(function () { requestAnimationFrame(function () { next.classList.remove('is-enter'); next.classList.add('is-kb'); }); });
    setTimeout(function () {
      prev.classList.remove('is-on', 'is-out', 'is-kb');
      prev.style.zIndex = next.style.zIndex = '';
      if (prev._v) prev._v.pause();
      busy = false;
      schedule();
    }, 900);
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing || reduce) return;
    timer = setTimeout(function () { show((cur + 1) % rooms.length, 1); }, STEP);
  }
  function setPlay(on) {
    playing = on;
    playBtn.textContent = on ? 'Пауза' : 'Автопрогулка';
    playBtn.setAttribute('aria-pressed', String(on));
    root.classList.toggle('is-paused', !on);
    caption(cur);
    schedule();
  }

  function open(info) {
    rooms = (D.tours && D.tours[info.type]) || [];
    if (!rooms.length) return;
    stage.innerHTML = ''; layers = []; cur = -1;
    rooms.forEach(function (r, i) { layers.push(layer(r, i)); });
    title.innerHTML = '<b>Квартира ' + info.n + '</b><span>' + info.name + ', ' + fmt(info.total) + ' м², этаж ' + info.floor + ', секция ' + info.section + '</span>';
    roomsEl.innerHTML = rooms.map(function (r, i) {
      return '<button type="button" data-i="' + i + '"><img src="' + r.img + '" alt=""><span>' + r.name + '</span><i></i></button>';
    }).join('');
    root.classList.add('is-open'); document.body.classList.add('tour-open');
    root.inert = false; root.setAttribute('aria-hidden', 'false');
    playing = true; playBtn.textContent = 'Пауза'; root.classList.remove('is-paused');
    show(0, 1);
  }
  function close() {
    clearTimeout(timer);
    root.classList.remove('is-open'); document.body.classList.remove('tour-open');
    root.inert = true; root.setAttribute('aria-hidden', 'true');
    layers.forEach(function (l) { if (l._v) l._v.pause(); });
    if (window.ALTA_pickerRender) window.ALTA_pickerRender();
  }

  roomsEl.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) { show(+b.dataset.i, 1); } });
  $('#tourPrev').addEventListener('click', function () { show((cur - 1 + rooms.length) % rooms.length, -1); });
  $('#tourNext').addEventListener('click', function () { show((cur + 1) % rooms.length, 1); });
  $('#tourClose').addEventListener('click', close);
  playBtn.addEventListener('click', function () { setPlay(!playing); });
  window.addEventListener('keydown', function (ev) {
    if (!root.classList.contains('is-open')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); show((cur + 1) % rooms.length, 1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); show((cur - 1 + rooms.length) % rooms.length, -1); }
    else if (ev.key === ' ') { ev.preventDefault(); setPlay(!playing); }
  });
  var sx = null;
  root.addEventListener('touchstart', function (e) { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 60) show((cur + (dx < 0 ? 1 : -1) + rooms.length) % rooms.length, dx < 0 ? 1 : -1);
  }, { passive: true });

  window.ALTA_openTour = open;
})();
