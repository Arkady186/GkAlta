/* Раздел «Документы»: проектная декларация (ссылка на наш.дом.рф), разрешительные документы, сведения о застройщике.
   Всё берётся из window.ALTA.docs (data.js) — пустые поля и группы не показываются. Ссылка на окно: #dokumenty */
(function () {
  'use strict';
  var D = window.ALTA, root = document.getElementById('docs');
  if (!D || !root) return;
  var X = D.docs || {}, dev = X.developer || {}, files = X.files || [], decl = X.declaration;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var MAIL = dev.email || (D.contacts && D.contacts.email) || '';
  var DOMRF = 'https://наш.дом.рф/сервисы/каталог-новостроек/список-объектов/список';

  /* ───────── разметка ───────── */
  function row(k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; }
  function ext(href, text) { return '<a class="dc-ext" href="' + esc(href) + '" target="_blank" rel="noopener">' + text + '</a>'; }

  function declHTML() {
    if (decl && decl.url) {
      return '<section class="dc-decl" aria-labelledby="dcDeclT">' +
        '<h3 id="dcDeclT">Проектная декларация</h3>' +
        '<p>Опубликована в Единой информационной системе жилищного строительства' + (decl.date ? ', редакция от ' + esc(decl.date) : '') + '. Там же — разрешение на строительство, сведения о застройщике и фотографии стройки.</p>' +
        '<a class="btn dc-decl-b" href="' + esc(decl.url) + '" target="_blank" rel="noopener">Открыть на наш.дом.рф</a>' +
      '</section>';
    }
    return '<section class="dc-decl is-wait" aria-labelledby="dcDeclT">' +
      '<h3 id="dcDeclT">Проектная декларация</h3>' +
      '<p>Публикуется в Единой информационной системе жилищного строительства — на сайте наш.дом.рф. Ссылка на декларацию появится здесь сразу после публикации.</p>' +
    '</section>';
  }

  function kind(f) { var m = /\.([a-z0-9]+)$/i.exec(f.file || ''); return m ? m[1].toUpperCase() : 'PDF'; }
  function filesHTML() {
    if (!files.length) {
      var subj = encodeURIComponent('Документы по ЖК в Краснодоне');
      return '<section class="dc-files is-empty" aria-labelledby="dcFilesT">' +
        '<h3 id="dcFilesT">Разрешительные документы</h3>' +
        '<p>Разрешение на строительство и другие документы по проекту мы разместим здесь по мере получения. Если копия нужна раньше — напишите, ответим и пришлём то, что уже готово.</p>' +
        (MAIL ? '<a class="btn dc-ask" href="mailto:' + MAIL + '?subject=' + subj + '">Запросить документы</a>' : '') +
      '</section>';
    }
    var groups = [], by = {};
    files.forEach(function (f) { var g = f.group || 'Документы'; if (!by[g]) { by[g] = []; groups.push(g); } by[g].push(f); });
    return groups.map(function (g, gi) {
      return '<section class="dc-files" aria-labelledby="dcG' + gi + '"><h3 id="dcG' + gi + '">' + esc(g) + '</h3><ul class="dc-list">' +
        by[g].map(function (f) {
          var meta = [f.no ? '№ ' + esc(f.no) : '', f.date ? 'от ' + esc(f.date) : ''].filter(Boolean).join(' ');
          var info = [meta, f.size ? kind(f) + ', ' + esc(f.size) : kind(f)].filter(Boolean).join('. ');
          return '<li class="dc-doc">' +
            '<span class="dc-ic" aria-hidden="true">' + kind(f) + '</span>' +
            '<span class="dc-doc-t"><a href="' + esc(f.file) + '" target="_blank" rel="noopener">' + esc(f.title) + '</a><small>' + info + '</small></span>' +
            '<a class="dc-dl" href="' + esc(f.file) + '" download aria-label="Скачать: ' + esc(f.title) + '"><i></i>Скачать</a>' +
          '</li>';
        }).join('') + '</ul></section>';
    }).join('');
  }

  function devHTML() {
    var req = [dev.inn ? 'ИНН ' + esc(dev.inn) : '', dev.ogrn ? 'ОГРН ' + esc(dev.ogrn) : ''].filter(Boolean).join('<br>');
    return '<section class="dc-dev" aria-labelledby="dcDevT"><h3 id="dcDevT">Застройщик</h3><dl class="dc-dl-rows">' +
      row('Наименование', esc(dev.name || dev.short || '')) +
      row('Реквизиты', req) +
      row('Адрес', esc(dev.address || '')) +
      row('Генеральный директор', esc(dev.director || '')) +
      row('Почта', MAIL ? '<a href="mailto:' + MAIL + '">' + MAIL + '</a>' : '') +
      row('Объект', esc(X.object || '')) +
    '</dl></section>';
  }

  function checkHTML() {
    return '<section class="dc-check" aria-labelledby="dcChkT"><h3 id="dcChkT">Как проверить застройщика</h3><ul>' +
      '<li>' + ext(decl && decl.url ? decl.url : DOMRF, 'наш.дом.рф') + '<span>Проектная декларация, разрешение на строительство и ход работ по каждому дому.</span></li>' +
      '<li>' + ext('https://egrul.nalog.ru/', 'Выписка из ЕГРЮЛ') + '<span>Регистрация компании, руководитель и адрес — бесплатно на сайте ФНС' + (dev.inn ? ' по ИНН ' + esc(dev.inn) : '') + '.</span></li>' +
    '</ul></section>';
  }

  $('#docsBody').innerHTML =
    '<div class="dc-main">' + declHTML() + filesHTML() + '</div>' +
    '<aside class="dc-side">' + devHTML() + checkHTML() + '</aside>';

  // подвал: место размещения проектной декларации и вход в раздел
  var foot = $('#footDocs');
  if (foot) foot.innerHTML = '<a href="#dokumenty" data-docs>Документы застройщика</a>' +
    (decl && decl.url ? '. Проектная декларация размещена на ' + ext(decl.url, 'наш.дом.рф') : '');

  /* ───────── открыть / закрыть ───────── */
  var lastFocus = null;
  function setHash(h) { try { history.replaceState(null, '', h || location.pathname + location.search); } catch (e) {} }
  function open(silent) {
    lastFocus = document.activeElement;
    root.classList.add('is-open'); root.inert = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('docs-open');
    var nav = document.getElementById('nav'); if (nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); var bg = document.getElementById('burger'); if (bg) bg.setAttribute('aria-expanded', 'false'); }
    $('.docs-body', root).scrollTop = 0;
    if (!silent && !document.body.classList.contains('cat-open')) setHash('#dokumenty');
    setTimeout(function () { $('#docsTitle').focus({ preventScroll: true }); }, 60);
  }
  function close() {
    root.classList.remove('is-open'); root.inert = true; root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('docs-open');
    if (location.hash === '#dokumenty') setHash('');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#docsClose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-open')) { e.stopImmediatePropagation(); close(); } }, true);
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-docs]'); if (!c) return;
    e.preventDefault(); e.stopPropagation(); open();
  }, true);
  function fromHash(h) { if (decodeURIComponent(h || '') === '#dokumenty') { open(true); setHash('#dokumenty'); } }
  window.addEventListener('hashchange', function () { fromHash(location.hash); });
  fromHash(window.ALTA_hash0 || location.hash);

  window.ALTA_openDocs = open;
  window.ALTA_docsNote = function () {           // строка для карточки квартиры
    return decl && decl.url ? 'Проектная декларация размещена на ' + ext(decl.url, 'наш.дом.рф') + '. ' : '';
  };
})();
