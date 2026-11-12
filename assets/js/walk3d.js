/* 3D-прогулка по квартире от первого лица. Стены, проёмы, комнаты и мебель — из assets/js/walk-data.js (по чертежам). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = $('#walk'), canvas = $('#wkCanvas'), mapC = $('#wkMap'), roomEl = $('#wkRoom'), help = $('#wkHelp'), stick = $('#wkStick'), furnBtn = $('#wkFurn');
  var T, renderer, scene, camera, clock, inited = false, running = false;
  var world, furnGroup, items = [], floors = [], A, W, info, mir = 1;
  var H = 2.7, EYE = 1.62, R = 0.18, doorZ = [], thinW = [], ghost = {};
  var pos = { x: 0, z: 0 }, yaw = 0, pitch = -0.05, keys = {}, mv = { x: 0, y: 0 }, target = null, furnOn = true, lastRoom = '';
  var phone = function () { return innerWidth < 860 || matchMedia('(pointer: coarse)').matches; };

  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  /* ───────── материалы ───────── */
  var M = {};
  // текстуры — готовыми картинками: в части браузеров (Яндекс, Brave и др.) защита от отпечатков
  // портит рисование на canvas, и квартира становится чёрной
  var texWait = [];
  function img(name, rep, color) {
    var t = new T.Texture();
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
    if (rep) t.repeat.set(rep[0], rep[1]);
    if (color !== false && 'colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    texWait.push(new Promise(function (res) {
      var im = new Image();
      im.onload = function () { t.image = im; t.needsUpdate = true; res(); };
      im.onerror = function () { res(); };
      im.src = 'assets/tex/' + name;
    }));
    return t;
  }
  function data(w, h, fill) {                               // текстура из массива (без canvas)
    var a = new Uint8Array(w * h * 4);
    for (var i = 0; i < h; i++) for (var j = 0; j < w; j++) { var v = fill(i, j), k = (i * w + j) * 4; a[k] = a[k + 1] = a[k + 2] = v; a[k + 3] = 255; }
    var t = new T.DataTexture(a, w, h, T.RGBAFormat); t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true;
    return t;
  }
  function mats() {
    var S = function (o) { return new T.MeshStandardMaterial(o); };
    M.wall = S({ color: 0xe9e3d8, roughness: 0.95 });
    M.ceil = S({ color: 0xf7f5f0, roughness: 1, side: T.DoubleSide, emissive: 0x77726a });
    var pq = img('parquet.jpg'); M.parquet = S({ map: pq, roughness: 0.62 });
    var tl = img('tile.jpg'); M.tile = S({ map: tl, roughness: 0.35 });
    var tg = img('tileg.jpg'); M.tileg = S({ map: tg, roughness: 0.5 });
    M.glass = new T.MeshPhysicalMaterial({ color: 0xdfeef3, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, side: T.DoubleSide, depthWrite: false });
    M.frame = S({ color: 0x5a4a35, roughness: 0.5, metalness: 0.35 });
    M.sill = S({ color: 0xe8e1d2, roughness: 0.4 });
    M.oak = S({ color: 0xb59c7c, roughness: 0.6 });
    M.oakd = S({ color: 0x5f4a38, roughness: 0.55 });
    M.ivory = S({ color: 0xeee6d6, roughness: 0.85 });
    M.boucle = S({ map: img('boucle.png', [3, 3]), roughness: 1 });
    M.velvet = S({ map: img('velvet.png', [3, 3]), roughness: 0.8 });
    M.linen = S({ map: img('linen.png', [3, 3]), roughness: 1 });
    M.trav = S({ color: 0xd8cbb2, roughness: 0.45 });
    M.brass = S({ color: 0xc9a96a, roughness: 0.3, metalness: 0.9 });
    M.white = S({ color: 0xf6f4f0, roughness: 0.25 });
    M.black = S({ color: 0x15161a, roughness: 0.35, metalness: 0.3 });
    M.steel = S({ color: 0xc7cbcf, roughness: 0.35, metalness: 0.7 });
    M.stone = S({ color: 0xd9d1c4, roughness: 0.3 });
    M.leaf = S({ color: 0x2f5a35, roughness: 0.8 });
    M.rug = S({ map: img('rug.jpg'), roughness: 1 });
    M.book = [0x6d2f2f, 0x1f4a3a, 0xc9a96a, 0x2c3e55, 0xd8cbb2].map(function (c) { return S({ color: c, roughness: 0.8 }); });
    M.door = S({ color: 0x4a3a2c, roughness: 0.5 });
    M.water = S({ color: 0xbfd6dc, roughness: 0.1, metalness: 0.1 });
    M.mirror = S({ color: 0xdfe6e8, roughness: 0.03, metalness: 1 });
    M.leaf2 = S({ color: 0x46703f, roughness: 0.7 });
    M.trim = S({ color: 0xf4f1ea, roughness: 0.55 });
    M.pvc = S({ color: 0xf5f4f0, roughness: 0.35 });
    M.doorglass = new T.MeshPhysicalMaterial({ color: 0xd8e6ea, transparent: true, opacity: 0.09, roughness: 0.15, metalness: 0, side: T.DoubleSide, depthWrite: false });
    M.doorleaf = S({ color: 0xefeae1, roughness: 0.5 });
    M.whitem = S({ color: 0xf0ece4, roughness: 0.7 });
    M.curtain = S({ map: img('curtain.png'), roughness: 1, color: 0xf2ebdf });
    M.lamp = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1dc, emissiveIntensity: 1.6, roughness: 0.4 });
    M.wallAO = data(1, 256, function (i) {                  // строка 0 — пол, 255 — потолок
      var v = i / 255, k = v < 0.06 ? 205 + (250 - 205) * v / 0.06 : v < 0.88 ? 250 + 5 * (v - 0.06) / 0.82 : v < 0.96 ? 255 - 20 * (v - 0.88) / 0.08 : 235 - 45 * (v - 0.96) / 0.04;
      return Math.round(k);
    });
    M.wallAO.channel = 1;
    var tw = img('tilewall.jpg', [1 / 1.2, 1 / 1.2]);
    M.tilewall = S({ map: tw, roughness: 0.22, aoMap: M.wallAO });
    M.sky = new T.MeshBasicMaterial({ map: img('sky.jpg'), side: T.BackSide, fog: false });
    M.ground = S({ color: 0x7c8668, roughness: 1 });
    for (var k in M) if (M[k] && M[k].isMeshStandardMaterial) M[k].envMapIntensity = { glass: 1, white: 0.9, brass: 1, steel: 1, black: 0.8 }[k] || 0.6;
  }

  var BOX, LAMP, SKYGEO, GROUNDGEO, LEAF;
  function box(w, h, d, m, x, y, z, g) {
    var me = new T.Mesh(BOX, m); me.scale.set(w, h, d); me.position.set(x || 0, (y || 0) + h / 2, z || 0); (g || this).add(me); return me;
  }
  function cyl(rt, rb, h, m, x, y, z, g, seg) {
    var me = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m); me.position.set(x || 0, (y || 0) + h / 2, z || 0); g.add(me); return me;
  }

  /* ───────── мебель (локально: ширина по x, глубина по z, спина в −z) ───────── */
  var F = {
    bed: function (g, w, d) {
      box(w, 0.28, d, M.oak, 0, 0, 0, g);
      box(w - 0.06, 0.24, d - 0.12, M.linen, 0, 0.28, 0.04, g);
      box(w - 0.02, 0.06, d * 0.62, M.boucle, 0, 0.5, d * 0.17, g);
      for (var s = -1; s <= 1; s += 2) box(w / 2 - 0.12, 0.13, 0.36, M.linen, s * w / 4, 0.52, -d / 2 + 0.32, g);
      box(w + 0.1, 1.1, 0.1, M.velvet, 0, 0, -d / 2 + 0.05, g);
    },
    bed1: function (g, w, d) { F.bed(g, w, d); },
    nightstand: function (g, w, d) {
      box(w, 0.5, d, M.oak, 0, 0, 0, g);
      cyl(0.06, 0.08, 0.32, M.brass, 0, 0.5, 0, g);
      cyl(0.11, 0.16, 0.18, M.ivory, 0, 0.82, 0, g);
    },
    wardrobe: function (g, w, d) {
      box(w, 0.08, d - 0.04, M.oakd, 0, 0, -0.02, g);
      box(w, 2.32, d, M.whitem, 0, 0.08, 0, g);
      var n = Math.max(2, Math.round(w / 0.5));
      for (var i = 1; i < n; i++) box(0.006, 2.3, 0.004, M.oakd, -w / 2 + i * w / n, 0.09, d / 2 + 0.001, g);
      for (var j = 0; j < n; j++) box(0.014, 0.42, 0.02, M.brass, -w / 2 + (j + 0.5) * w / n + (j % 2 ? -0.38 : 0.38) * w / n, 0.95, d / 2 + 0.012, g);
    },
    sofa: function (g, w, d) {
      box(w, 0.4, d, M.boucle, 0, 0.05, 0, g);
      box(w, 0.48, 0.24, M.boucle, 0, 0.42, -d / 2 + 0.12, g);
      box(0.2, 0.28, d, M.boucle, -w / 2 + 0.1, 0.42, 0, g); box(0.2, 0.28, d, M.boucle, w / 2 - 0.1, 0.42, 0, g);
      for (var i = 0; i < 2; i++) box(w / 2 - 0.22, 0.14, d - 0.32, M.boucle, (i ? 1 : -1) * (w / 4 - 0.05), 0.45, 0.08, g);
      box(0.4, 0.4, 0.12, M.velvet, -w / 2 + 0.45, 0.55, -d / 2 + 0.3, g).rotation.z = 0.15;
      box(w - 0.1, 0.05, d - 0.1, M.oakd, 0, 0, 0, g);
    },
    armchair: function (g, w, d) {
      box(w, 0.4, d, M.velvet, 0, 0.05, 0, g); box(w, 0.42, 0.18, M.velvet, 0, 0.45, -d / 2 + 0.09, g);
      box(0.14, 0.22, d, M.velvet, -w / 2 + 0.07, 0.45, 0, g); box(0.14, 0.22, d, M.velvet, w / 2 - 0.07, 0.45, 0, g);
    },
    coffee: function (g, w, d) { box(w, 0.06, d, M.trav, 0, 0.32, 0, g); box(w * 0.5, 0.32, d * 0.5, M.trav, 0, 0, 0, g); box(0.18, 0.04, 0.24, M.book[1], 0.15, 0.38, 0, g); },
    rug: function (g, w, d) { var p = new T.Mesh(new T.PlaneGeometry(w, d), M.rug); p.rotation.x = -Math.PI / 2; p.position.y = 0.008; g.add(p); },
    rugr: function (g, w) { var p = new T.Mesh(new T.CircleGeometry(w / 2, 48), M.rug); p.rotation.x = -Math.PI / 2; p.position.y = 0.008; g.add(p); },
    tv: function (g, w, d) {
      box(w, 0.42, d, M.oak, 0, 0.12, 0, g); box(w, 0.12, d - 0.04, M.oakd, 0, 0, 0, g);
      box(Math.min(1.3, w - 0.2), 0.74, 0.04, M.black, 0, 1.05, -d / 2 + 0.02, g);
    },
    shelf: function (g, w, d) {
      box(0.03, 1.9, d, M.oak, -w / 2, 0, 0, g); box(0.03, 1.9, d, M.oak, w / 2, 0, 0, g);
      for (var i = 0; i < 5; i++) {
        box(w, 0.025, d, M.oak, 0, i * 0.46, 0, g);
        if (i < 4) for (var b = 0; b < 6; b++) if (rnd() < 0.7) box(0.035 + rnd() * 0.03, 0.22 + rnd() * 0.08, d * 0.8, M.book[(b + i) % 5], -w / 2 + 0.08 + b * (w - 0.16) / 6, i * 0.46 + 0.025, 0, g);
      }
    },
    plant: function (g, w) {
      cyl(w * 0.32, w * 0.26, 0.4, M.trav, 0, 0, 0, g);
      for (var i = 0; i < 26; i++) {
        var s = new T.Mesh(LEAF, i % 3 ? M.leaf : M.leaf2), a = rnd() * 6.28, rr = 0.05 + rnd() * 0.2, y = 0.75 + rnd() * 0.75;
        s.scale.set(0.045 + rnd() * 0.025, 0.13 + rnd() * 0.07, 0.008); s.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        s.rotation.set((rnd() - 0.5) * 0.9, a, (rnd() - 0.5) * 1.2); g.add(s);
      }
      cyl(0.01, 0.015, 0.7, M.oakd, 0, 0.4, 0, g);
    },
    counter: function (g, w, d) {
      box(w, 0.1, d - 0.05, M.oakd, 0, 0, -0.02, g);
      box(w, 0.76, d - 0.02, M.ivory, 0, 0.1, -0.01, g);
      var n = Math.max(2, Math.round(w / 0.6));
      for (var i = 1; i < n; i++) box(0.006, 0.74, 0.005, M.oakd, -w / 2 + i * w / n, 0.11, d / 2 - 0.02, g);
      box(w + 0.02, 0.04, d + 0.02, M.stone, 0, 0.86, 0, g);
      box(0.56, 0.008, 0.48, M.black, -w / 2 + 0.6, 0.9, 0.02, g);                  // варочная панель
      box(0.5, 0.01, 0.4, M.steel, Math.min(w / 2 - 0.4, 0.5), 0.9, 0.02, g);       // мойка
      cyl(0.015, 0.015, 0.3, M.brass, Math.min(w / 2 - 0.4, 0.5), 0.9, -d / 2 + 0.1, g);
      box(w, 0.72, 0.34, M.whitem, 0, 1.45, -d / 2 + 0.17, g);                       // верхние шкафы
      box(w, 0.02, 0.3, M.oak, 0, 1.43, -d / 2 + 0.15, g);
      box(w, 0.55, 0.01, M.stone, 0, 0.9, -d / 2 + 0.005, g);                         // фартук
    },
    fridge: function (g, w, d) { box(w, 2.0, d, M.ivory, 0, 0, 0, g); box(0.02, 0.5, 0.03, M.brass, -w / 2 + 0.08, 1.1, d / 2 + 0.015, g); box(w - 0.02, 0.006, 0.01, M.oakd, 0, 1.25, d / 2 + 0.003, g); },
    table: function (g, w, d) {
      box(w, 0.04, d, M.oak, 0, 0.72, 0, g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { box(0.045, 0.72, 0.045, M.oakd, p[0] * (w / 2 - 0.06), 0, p[1] * (d / 2 - 0.06), g); });
      cyl(0.05, 0.07, 0.22, M.ivory, 0, 0.76, 0, g);
    },
    chair: function (g, w, d) {
      box(w, 0.04, d - 0.06, M.oak, 0, 0.44, 0.02, g);
      box(w, 0.42, 0.04, M.oak, 0, 0.46, -d / 2 + 0.03, g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { box(0.03, 0.44, 0.03, M.oakd, p[0] * (w / 2 - 0.04), 0, p[1] * (d / 2 - 0.05), g); });
      box(w - 0.06, 0.03, d - 0.12, M.velvet, 0, 0.48, 0.03, g);
    },
    desk: function (g, w, d) {
      box(w, 0.035, d, M.oak, 0, 0.73, 0, g); box(0.04, 0.73, d, M.oakd, -w / 2 + 0.02, 0, 0, g); box(0.04, 0.73, d, M.oakd, w / 2 - 0.02, 0, 0, g);
      cyl(0.08, 0.1, 0.03, M.brass, w / 2 - 0.2, 0.765, -d / 2 + 0.15, g); cyl(0.01, 0.01, 0.4, M.brass, w / 2 - 0.2, 0.79, -d / 2 + 0.15, g);
      var c = new T.Group(); F.chair(c, 0.46, 0.5); c.position.z = d / 2 + 0.15; c.rotation.y = Math.PI; g.add(c);
    },
    bench: function (g, w, d) { box(w, 0.06, d, M.oak, 0, 0.4, 0, g); box(w - 0.1, 0.06, d - 0.06, M.velvet, 0, 0.46, 0, g); box(0.05, 0.4, d - 0.06, M.oakd, -w / 2 + 0.06, 0, 0, g); box(0.05, 0.4, d - 0.06, M.oakd, w / 2 - 0.06, 0, 0, g); box(w, 0.9, 0.03, M.trav, 0, 1.1, -d / 2 - 0.02, g); },
    tub: function (g, w, d) { box(w, 0.56, d, M.white, 0, 0, 0, g); box(w - 0.12, 0.02, d - 0.12, M.water, 0, 0.5, 0, g); cyl(0.02, 0.02, 0.3, M.brass, -w / 2 + 0.1, 0.56, -d / 2 + 0.1, g); },
    shower: function (g, w, d) {
      box(w, 0.05, d, M.white, 0, 0, 0, g);
      var gl = box(0.01, 2.0, d, M.glass, w / 2, 0.05, 0, g); var gl2 = box(w, 2.0, 0.01, M.glass, 0, 0.05, d / 2, g);
      cyl(0.12, 0.12, 0.02, M.brass, 0, 2.1, -d / 2 + 0.25, g);
    },
    toilet: function (g, w, d) { box(w, 0.4, d * 0.65, M.white, 0, 0, d * 0.12, g); box(w + 0.02, 0.05, d * 0.7, M.white, 0, 0.4, d * 0.12, g); box(w + 0.05, 0.38, 0.16, M.white, 0, 0.35, -d / 2 + 0.08, g); },
    vanity: function (g, w, d) {
      box(w, 0.45, d, M.oak, 0, 0.42, 0, g); box(w + 0.02, 0.06, d + 0.02, M.stone, 0, 0.87, 0, g);
      cyl(0.02, 0.02, 0.22, M.brass, 0, 0.93, -d / 2 + 0.06, g);
      var mr = new T.Mesh(new T.CircleGeometry(0.33, 48), M.mirror);
      mr.position.set(0, 1.55, -d / 2 + 0.01); g.add(mr);
    },
    washer: function (g, w, d) { box(w, 0.85, d, M.white, 0, 0, 0, g); var c = new T.Mesh(new T.CircleGeometry(0.2, 32), M.black); c.position.set(0, 0.45, d / 2 + 0.002); g.add(c); },
    tablet: function (g, w) { cyl(w / 2, w / 2, 0.03, M.trav, 0, 0.6, 0, g); cyl(0.03, 0.12, 0.6, M.brass, 0, 0, 0, g); },
    lchair: function (g, w, d) { cyl(w / 2, w / 2.4, 0.42, M.oak, 0, 0, 0, g); box(w * 0.9, 0.35, 0.06, M.oak, 0, 0.42, -d / 2 + 0.05, g); cyl(w / 2 - 0.03, w / 2 - 0.03, 0.06, M.boucle, 0, 0.42, 0, g); }
  };
  var NOCOLLIDE = { rug: 1, rugr: 1, curtain: 1 };
  var ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

  /* ───────── сборка квартиры ───────── */
  function shapeOf(poly) {
    var s = new T.Shape();
    poly.forEach(function (p, i) { if (i) s.lineTo(p[0], -p[1]); else s.moveTo(p[0], -p[1]); });
    return s;
  }
  function inBox(r, b, m) { return r[2] > b[0] - m && r[0] < b[2] + m && r[3] > b[1] - m && r[1] < b[3] + m; }
  // окна/двери в данных порезаны на полоски — склеиваем касающиеся в один проём
  function merge(list) {
    var P = list.map(function (_, i) { return i; });
    var f = function (i) { while (P[i] !== i) i = P[i] = P[P[i]]; return i; };
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) if (inBox(list[i], list[j], 0.02)) P[f(i)] = f(j);
    var g = {};
    list.forEach(function (r, i) { var k = f(i), q = g[k]; if (!q) g[k] = r.slice(); else { q[0] = Math.min(q[0], r[0]); q[1] = Math.min(q[1], r[1]); q[2] = Math.max(q[2], r[2]); q[3] = Math.max(q[3], r[3]); } });
    return Object.keys(g).map(function (k) { return g[k]; });
  }
  function own(o) { o.userData.own = true; return o; }
  function instanced(list, mat, fn) {
    if (!list.length) return;
    var im = new T.InstancedMesh(BOX, mat, list.length), o = new T.Object3D();
    list.forEach(function (r, i) { fn(r, o); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = im.receiveShadow = true;
    world.add(im);
    return im;
  }
  // список коробок [cx, cy(низ), cz, sx, sy, sz] → один InstancedMesh
  function boxes(list, mat, shadow) {
    return instanced(list, mat, function (q, o) { o.scale.set(q[3], q[4], q[5]); o.position.set(q[0], q[1] + q[4] / 2, q[2]); });
  }

  // сборщик плоских граней в одну геометрию: uv — в метрах, uv1 — 0..1 по грани (для AO)
  function Quads() { this.p = []; this.n = []; this.uv = []; this.uv1 = []; this.ix = []; }
  Quads.prototype.add = function (a, u, v, n, su, sv) {
    var k = this.p.length / 3, P = this.p;
    P.push(a[0], a[1], a[2], a[0] + u[0], a[1] + u[1], a[2] + u[2], a[0] + u[0] + v[0], a[1] + u[1] + v[1], a[2] + u[2] + v[2], a[0] + v[0], a[1] + v[1], a[2] + v[2]);
    for (var i = 0; i < 4; i++) this.n.push(n[0], n[1], n[2]);
    this.uv.push(0, 0, su, 0, su, sv, 0, sv); this.uv1.push(0, 0, 1, 0, 1, 1, 0, 1);
    var cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) this.ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
    else this.ix.push(k, k + 2, k + 1, k, k + 3, k + 2);
  };
  Quads.prototype.mesh = function (mat) {
    if (!this.ix.length) return null;
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('uv1', new T.Float32BufferAttribute(this.uv1, 2));
    g.setIndex(this.ix);
    var m = new T.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false;
    world.add(m); return m;
  };
  var NRM = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  // полоса вдоль грани стены: от высоты y0 до y1, на отступе d от стены (фронт + торец сверху/снизу)
  function strip(Q, sg, y0, y1, d, cap) {
    var n = NRM[sg[4]], ux = sg[2] - sg[0], uz = sg[3] - sg[1], L = Math.hypot(ux, uz);
    var a = [sg[0] + n[0] * d, y0, sg[1] + n[2] * d];
    Q.add(a, [ux, 0, uz], [0, y1 - y0, 0], n, L, y1 - y0);
    if (cap) {                                           // торцы: верх у плинтуса, низ у карниза
      var y = cap > 0 ? y1 : y0;
      Q.add([sg[0], y, sg[1]], [ux, 0, uz], [n[0] * d, 0, n[2] * d], [0, cap, 0], L, d);
    }
  }

  // AO пола: стены (и мебель) затемняют пол вокруг себя
  var AO_S = 0.05;
  function aoTex(withFurn) {
    var b = A.box, w = Math.ceil((b[2] - b[0]) / AO_S), h = Math.ceil((b[3] - b[1]) / AO_S);
    var occ = new Float32Array(w * h);
    function fill(x0, z0, x1, z1, v) {
      var i0 = Math.max(0, Math.floor((z0 - b[1]) / AO_S)), i1 = Math.min(h, Math.ceil((z1 - b[1]) / AO_S));
      var j0 = Math.max(0, Math.floor((x0 - b[0]) / AO_S)), j1 = Math.min(w, Math.ceil((x1 - b[0]) / AO_S));
      for (var i = i0; i < i1; i++) for (var j = j0; j < j1; j++) occ[i * w + j] = Math.max(occ[i * w + j], v);
    }
    W.walls.forEach(function (r) { if (inBox(r, b, 0.3)) fill(r[0], r[1], r[2], r[3], 1); });
    W.win.forEach(function (r) { if (inBox(r, b, 0.3)) fill(r[0], r[1], r[2], r[3], 0.8); });
    if (withFurn) A.furn.forEach(function (f) {
      if (NOCOLLIDE[f[0]]) return;
      var hw = (f[5] % 2 ? f[4] : f[3]) / 2 - 0.03, hd = (f[5] % 2 ? f[3] : f[4]) / 2 - 0.03;
      var v = { chair: 0.35, table: 0.3, desk: 0.35, coffee: 0.5, plant: 0.6, tablet: 0.3, lchair: 0.6 }[f[0]] || 0.85;
      fill(f[1] - hw, f[2] - hd, f[1] + hw, f[2] + hd, v);
    });
    var tmp = new Float32Array(w * h);
    function blur(src, dst, rad) {                      // разделимое box-размытие
      for (var i = 0; i < h; i++) { var acc = 0, row = i * w; for (var j = -rad; j < w + rad; j++) { if (j + rad < w && j + rad >= 0) acc += src[row + j + rad]; if (j - rad - 1 >= 0 && j - rad - 1 < w) acc -= src[row + j - rad - 1]; if (j >= 0 && j < w) tmp[row + j] = acc / (2 * rad + 1); } }
      for (var jj = 0; jj < w; jj++) { var ac = 0; for (var ii = -rad; ii < h + rad; ii++) { if (ii + rad < h && ii + rad >= 0) ac += tmp[(ii + rad) * w + jj]; if (ii - rad - 1 >= 0 && ii - rad - 1 < h) ac -= tmp[(ii - rad - 1) * w + jj]; if (ii >= 0 && ii < h) dst[ii * w + jj] = ac / (2 * rad + 1); } }
    }
    var o1 = new Float32Array(w * h), o2 = new Float32Array(w * h);
    blur(occ, o1, 3); blur(o1, o2, 3); blur(o2, o1, 2);
    var t = data(w, h, function (i, j) { return Math.round(255 * (1 - 0.62 * Math.min(1, o1[i * w + j] * 1.25))); });
    t.channel = 1;
    return t;
  }

  var PAINT = { living: 0xe7dfd1, kitliv: 0xe9e2d5, bedroom: 0xe2dbd0, kids: 0xe4e1d4, studio: 0xe8e1d4, kitchen: 0xece6dc, hall: 0xe3dbcd, closet: 0xe3dbcd, loggia: 0xeae6dc };
  var paintMats = {};
  function paint(k) {
    if (k === 'bath') return M.tilewall;
    var c = PAINT[k] || 0xe8e2d6;
    if (!paintMats[c]) { paintMats[c] = new T.MeshStandardMaterial({ color: c, roughness: 0.92, aoMap: M.wallAO, aoMapIntensity: 1, envMapIntensity: 0.55 }); }
    return paintMats[c];
  }

  function dispose() {
    if (!world) return;
    scene.remove(world);
    world.traverse(function (o) {
      if (o.geometry && o.geometry !== BOX && o.geometry !== LEAF && o.geometry !== LAMP && o.geometry !== SKYGEO && o.geometry !== GROUNDGEO) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.material && o.material.userData && o.material.userData.own) o.material.dispose();
    });
    if (aoT) { aoT[0].dispose(); aoT[1].dispose(); aoT = null; }
    world = null;
  }

  var aoT = null, solids = [];
  function build() {
    dispose();
    var gd = A.grid;
    if (!gd.bytes) { var raw = atob(gd.b); gd.bytes = new Uint8Array(raw.length); for (var q = 0; q < raw.length; q++) gd.bytes[q] = raw.charCodeAt(q); }
    world = new T.Group(); world.scale.x = mir; scene.add(world);
    // межкомнатные проёмы проходимы насквозь (полоса чуть шире толщины стены)
    doorZ = merge(W.door.filter(function (r) { return inBox(r, A.box, 0); })).map(function (r) {
      var t = (r[2] - r[0]) < (r[3] - r[1]);
      return t ? [r[0] - 0.12, r[1] + 0.02, r[2] + 0.12, r[3] - 0.02] : [r[0] + 0.02, r[1] - 0.12, r[2] - 0.02, r[3] + 0.12];
    });
    thinW = thinWalls();
    thinW.forEach(function (q) { doorZ.push([q[0] - 0.04, q[1] - 0.04, q[2] + 0.04, q[3] + 0.04]); });
    ghost = {}; connect(); connectFurn();
    items = []; floors = []; solids = [];
    var b = A.box, bw = b[2] - b[0], bh = b[3] - b[1];
    aoT = [aoTex(false), aoTex(true)];
    [M.parquet, M.tile, M.tileg].forEach(function (m) { m.aoMap = aoT[furnOn ? 1 : 0]; m.aoMapIntensity = 1; m.needsUpdate = true; });
    // полы и потолки — без щелей (полигон комнаты продлён под стены и в проёмы)
    var cq = [];
    A.rooms.forEach(function (rm, ri) {
      var m = { bath: M.tile, loggia: M.tileg, hall: M.tile, kitchen: M.tile }[rm.k] || M.parquet;
      (rm.fp || rm.poly).forEach(function (p) {
        var g = new T.ShapeGeometry(shapeOf(p));
        g.rotateX(-Math.PI / 2);
        var pa = g.attributes.position, uv = g.attributes.uv, u1 = new Float32Array(pa.count * 2);
        for (var i = 0; i < pa.count; i++) {
          uv.setXY(i, pa.getX(i) / 1.2, pa.getZ(i) / 1.2);
          u1[i * 2] = (pa.getX(i) - b[0]) / bw; u1[i * 2 + 1] = (pa.getZ(i) - b[1]) / bh;
        }
        g.setAttribute('uv1', new T.BufferAttribute(u1, 2));
        var f = new T.Mesh(g, m); f.position.y = ri * 0.0004; f.receiveShadow = true; f.userData.room = rm; world.add(f); floors.push(f);
        if (rm.k !== 'loggia') { var ce = new T.Mesh(g, M.ceil); ce.position.y = H; world.add(ce); }
      });
    });
    // несущие «тела» стен
    var near = function (list) { return list.filter(function (r) { return inBox(r, b, 1.2); }); };
    instanced(near(W.walls).filter(function (r) { return thinW.indexOf(r) < 0; }), M.wall, function (r, o) { o.scale.set(r[2] - r[0] + 0.004, H, r[3] - r[1] + 0.004); o.position.set((r[0] + r[2]) / 2, H / 2, (r[1] + r[3]) / 2); });
    // отделка стен по комнатам: краска / плитка, плинтус, карниз
    var byMat = new Map(), base = new Quads(), corn = new Quads();
    A.rooms.forEach(function (rm) {
      if (!rm.sk) return;
      var mt = paint(rm.k), Q = byMat.get(mt); if (!Q) { Q = new Quads(); byMat.set(mt, Q); }
      rm.sk.forEach(function (sg) {
        strip(Q, sg, 0, H, 0.004, 0);
        if (rm.k !== 'bath') strip(base, sg, 0, 0.08, 0.016, 1);
        if (rm.k !== 'bath' && rm.k !== 'loggia') strip(corn, sg, H - 0.06, H, 0.03, -1);
      });
    });
    byMat.forEach(function (Q, mt) { Q.mesh(mt); });
    base.mesh(M.trim); corn.mesh(M.trim);
    // окна: подоконная часть, перемычка, ПВХ-рамы с импостами, стекло, подоконник
    var wins = merge(near(W.win)), doors = merge(near(W.door)), ents = merge(near(W.entr));
    var low = [], top = [], pvc = [], glass = [], sill = [], curt = [];
    wins.forEach(function (r) {
      var t = (r[2] - r[0]) < (r[3] - r[1]), cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
      var L = t ? r[3] - r[1] : r[2] - r[0], D = t ? r[2] - r[0] : r[3] - r[1];
      var y0 = 0.86, y1 = H - 0.28, hh = y1 - y0;
      var B = function (along, y, len, hgt, dep) { return t ? [cx, y, along, dep, hgt, len] : [along, y, cz, len, hgt, dep]; };
      var s0 = t ? r[1] : r[0];
      low.push(B(s0 + L / 2, 0, L, 0.82, D)); top.push(B(s0 + L / 2, y1, L, H - y1, D));
      pvc.push(B(s0 + 0.03, y0, 0.06, hh, 0.07), B(s0 + L - 0.03, y0, 0.06, hh, 0.07), B(s0 + L / 2, y0, L, 0.06, 0.07), B(s0 + L / 2, y1 - 0.06, L, 0.06, 0.07));
      var n = Math.max(1, Math.round(L / 0.95));
      for (var i = 1; i < n; i++) pvc.push(B(s0 + i * L / n, y0, 0.07, hh, 0.07));
      if (n === 1 && L > 0.7 || n > 1) pvc.push(B(s0 + L / 2, y0 + hh * 0.72, L, 0.05, 0.07));
      glass.push(B(s0 + L / 2, y0, L, hh, 0.012));
      // в какую сторону комната: подоконник и шторы туда
      var probe = function (sg) { var px = t ? (sg > 0 ? r[2] : r[0]) + sg * 0.35 : cx, pz = t ? cz : (sg > 0 ? r[3] : r[1]) + sg * 0.35; return freeL(px, pz, false); };
      var side = probe(1) ? 1 : probe(-1) ? -1 : 0;
      var sd = side || 1, face = t ? (sd > 0 ? r[2] : r[0]) : (sd > 0 ? r[3] : r[1]);
      var sOff = face - (t ? cx : cz) + sd * 0.04;
      sill.push(t ? [cx + sOff / 2, 0.82, cz, Math.abs(sOff) + D / 2 + 0.02, 0.035, L + 0.08] : [cx, 0.82, cz + sOff / 2, L + 0.08, 0.035, Math.abs(sOff) + D / 2 + 0.02]);
      var rm = side && roomAtL(t ? face + side * 0.5 : cx, t ? cz : face + side * 0.5);
      if (rm && /living|kitliv|bedroom|kids|studio/.test(rm.k) && L > 0.6) curt.push({ t: t, s: side, face: face, a: s0, L: L });
    });
    boxes(low, M.wall); boxes(top, M.wall); boxes(pvc, M.pvc); boxes(sill, M.sill);
    var gm = boxes(glass, M.glass); if (gm) gm.castShadow = false;
    // двери: наличники и открытые полотна
    var jam = [], leaf = [], frame = [], handles = [];   // стеклянные двери: видно насквозь, проходить не мешают
    doors.concat(ents).forEach(function (r) {
      var t = (r[2] - r[0]) < (r[3] - r[1]), cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
      var L = t ? r[3] - r[1] : r[2] - r[0], D = t ? r[2] - r[0] : r[3] - r[1];
      if (L < 0.5 || L > 1.6) return;
      var B = function (along, y, len, hgt, dep) { return t ? [cx, y, along, dep, hgt, len] : [along, y, cz, len, hgt, dep]; };
      var s0 = t ? r[1] : r[0];
      jam.push(B(s0, 0, 0.08, 2.1, D + 0.03), B(s0 + L, 0, 0.08, 2.1, D + 0.03), B(s0 + L / 2, 2.06, L + 0.08, 0.08, D + 0.03));
      if (ents.indexOf(r) >= 0 || !inBox(r, b, 0)) return;
      if (wins.some(function (w) { return inBox(w, r, 0.3); })) return;      // выход на лоджию — без полотна
      // полотно открыто на 90°: выбираем петлю и сторону, где не мешает стене и мебели
      var Lw = L - 0.04, done = false;
      [[0, 1], [1, 1], [0, -1], [1, -1]].some(function (c) {
        var hz = c[0] ? s0 + L - 0.035 : s0 + 0.035, sd = c[1], fc = t ? (sd > 0 ? r[2] : r[0]) : (sd > 0 ? r[3] : r[1]);
        for (var d = 0.06; d <= Lw; d += 0.08) {
          var px = t ? fc + sd * d : hz, pz = t ? hz : fc + sd * d;
          var qx = t ? px : hz + (c[0] ? -0.12 : 0.12), qz = t ? hz + (c[0] ? -0.12 : 0.12) : pz;
          if (!freeL(px, pz, true) || !freeL(t ? px : px, t ? pz : pz, true)) return false;
        }
        var m0 = fc + sd * Lw / 2;
        var e0 = fc + sd * 0.025, e1 = fc + sd * (Lw - 0.025);
        if (t) { leaf.push([m0, 0.06, hz, Lw - 0.1, 1.91, 0.012]); frame.push([e0, 0.004, hz, 0.05, 2.03, 0.04], [e1, 0.004, hz, 0.05, 2.03, 0.04], [m0, 0.004, hz, Lw, 0.06, 0.04], [m0, 1.974, hz, Lw, 0.06, 0.04]); handles.push([fc + sd * (Lw - 0.07), 0.98, hz, 0.025, 0.025, 0.16]); }
        else { leaf.push([hz, 0.06, m0, 0.012, 1.91, Lw - 0.1]); frame.push([hz, 0.004, e0, 0.04, 2.03, 0.05], [hz, 0.004, e1, 0.04, 2.03, 0.05], [hz, 0.004, m0, 0.04, 0.06, Lw], [hz, 1.974, m0, 0.04, 0.06, Lw]); handles.push([hz, 0.98, fc + sd * (Lw - 0.07), 0.16, 0.025, 0.025]); }
        done = true; return true;
      });
    });
    boxes(jam, M.trim); var dg = boxes(leaf, M.doorglass); if (dg) dg.castShadow = false; boxes(frame, M.trim); boxes(handles, M.brass);
    instanced(ents, M.door, function (r, o) { var t = (r[2] - r[0]) < (r[3] - r[1]); o.scale.set(t ? 0.06 : r[2] - r[0], 2.06, t ? r[3] - r[1] : 0.06); o.position.set((r[0] + r[2]) / 2, 1.03, (r[1] + r[3]) / 2); });
    instanced(doors.concat(ents), M.wall, function (r, o) { o.scale.set(r[2] - r[0], H - 2.1, r[3] - r[1]); o.position.set((r[0] + r[2]) / 2, 2.1 + (H - 2.1) / 2, (r[1] + r[3]) / 2); });
    // мебель
    furnGroup = new T.Group(); world.add(furnGroup);
    seed = 11;
    var addItem = function (kind, x, z, hw, hd, g) {
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.userData = { kind: kind, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, s: furnOn ? 1 : 0.0001, t: furnOn ? 1 : 0, delay: 0 };
      g.scale.setScalar(g.userData.s); g.visible = furnOn;
      furnGroup.add(g); items.push(g);
    };
    A.furn.forEach(function (f, fi) {
      var mk = F[f[0]]; if (!mk) return;
      var g = new T.Group(), inner = new T.Group();
      mk(inner, f[3], f[4]);
      g.add(inner);
      g.position.set(f[1], 0, f[2]);
      g.rotation.y = ROT[f[5]];
      addItem(f[0], f[1], f[2], (f[5] % 2 ? f[4] : f[3]) / 2, (f[5] % 2 ? f[3] : f[4]) / 2, g);
      if (ghost[fi]) g.userData.ghost = true;
    });
    // шторы на окнах жилых комнат
    curt.forEach(function (c) {
      var g = new T.Group(), off = c.face + c.s * 0.11, hgt = H - 0.1;
      [c.a - 0.06, c.a + c.L + 0.06].forEach(function (e, k) {
        var wdt = 0.36, along = k ? e - wdt / 2 : e + wdt / 2;
        var m = new T.Mesh(BOX, M.curtain);
        m.scale.set(c.t ? 0.1 : wdt, hgt - 0.02, c.t ? wdt : 0.1);
        m.position.set(c.t ? off : along, (hgt - 0.02) / 2, c.t ? along : off); g.add(m);
      });
      var rod = new T.Mesh(BOX, M.brass); rod.scale.set(c.t ? 0.02 : c.L + 0.4, 0.02, c.t ? c.L + 0.4 : 0.02);
      rod.position.set(c.t ? off : c.a + c.L / 2, hgt + 0.02, c.t ? c.a + c.L / 2 : off); g.add(rod);
      var cxm = c.t ? off : c.a + c.L / 2, czm = c.t ? c.a + c.L / 2 : off;
      g.children.forEach(function (ch) { ch.position.x -= cxm; ch.position.z -= czm; });
      g.position.set(cxm, 0, czm);
      addItem('curtain', cxm, czm, 0.05, 0.05, g);
    });
    // светильники: плоские тарелки на потолке (свет — от окна и окружения)
    var lamps = [];
    A.rooms.forEach(function (rm) { if (rm.k !== 'loggia' && rm.a >= 2) lamps.push(rm.c); });
    if (lamps.length) {
      var lm = new T.InstancedMesh(LAMP, M.lamp, lamps.length), o = new T.Object3D();
      lamps.forEach(function (c, i) { o.position.set(c[0], H - 0.02, c[1]); o.updateMatrix(); lm.setMatrixAt(i, o.matrix); });
      world.add(lm);
    }
    // улица
    var fy = ((info.floor || 9) - 1) * 3.1;
    var sky = new T.Mesh(SKYGEO, M.sky);
    sky.position.set((b[0] + b[2]) / 2, EYE - 120 * 0.4 + 60, (b[1] + b[3]) / 2); world.add(sky);
    var ground = new T.Mesh(GROUNDGEO, M.ground);
    ground.position.set((b[0] + b[2]) / 2, -fy - 0.3, (b[1] + b[3]) / 2); world.add(ground);
  }
  // тонкие линии на чертеже (нарисованные полотна дверей) — не стены
  function thinWalls() {
    var ws = W.walls.filter(function (r) { return inBox(r, A.box, 0.3); });
    var inWall = function (x, z, self) { for (var i = 0; i < ws.length; i++) { var q = ws[i]; if (q !== self && x > q[0] - 0.005 && x < q[2] + 0.005 && z > q[1] - 0.005 && z < q[3] + 0.005) return true; } return false; };
    return ws.filter(function (r) {
      var dx = r[2] - r[0], dz = r[3] - r[1], t = Math.min(dx, dz), L = Math.max(dx, dz);
      if (t > 0.071 || L < 0.35 || L > 1.4) return false;
      for (var k = 1; k < 4; k++) {
        var a = k / 4;
        if (dx > dz) { var x = r[0] + dx * a; if (inWall(x, r[1] - 0.06, r) || inWall(x, r[3] + 0.06, r)) return false; }
        else { var z = r[1] + dz * a; if (inWall(r[0] - 0.06, z, r) || inWall(r[2] + 0.06, z, r)) return false; }
      }
      return true;
    });
  }
  // если в данные не попал проём (бывает на чертежах), прорубаем кратчайший проход к недоступной комнате
  function connect() {
    var b = A.box, st = 0.1, w = Math.ceil((b[2] - b[0]) / st), h = Math.ceil((b[3] - b[1]) / st), N = w * h;
    var cx = function (j) { return b[0] + (j + 0.5) * st; }, cz = function (i) { return b[1] + (i + 0.5) * st; };
    var roomOf = new Int8Array(N).fill(-1);
    for (var i = 0; i < h; i++) for (var j = 0; j < w; j++) { var rm = roomAtL(cx(j), cz(i)); if (rm) roomOf[i * w + j] = A.rooms.indexOf(rm); }
    var soft = new Uint8Array(N);                       // проёмы и окна дешевле стен
    W.door.concat(W.win).forEach(function (r) { if (!inBox(r, b, 0)) return; for (var i = Math.max(0, Math.floor((r[1] - b[1]) / st)); i < Math.min(h, Math.ceil((r[3] - b[1]) / st)); i++) for (var j = Math.max(0, Math.floor((r[0] - b[0]) / st)); j < Math.min(w, Math.ceil((r[2] - b[0]) / st)); j++) soft[i * w + j] = 1; });
    var fo = furnOn; furnOn = false;
    for (var iter = 0; iter < 8; iter++) {
      var okm = new Uint8Array(N);
      for (var k = 0; k < N; k++) okm[k] = ok(cx(k % w) * mir, cz((k / w) | 0)) ? 1 : 0;
      // достижимое от входа
      var reach = new Uint8Array(N), q = [], s0 = -1, sj = Math.floor((A.spawn[0] - b[0]) / st), si = Math.floor((A.spawn[1] - b[1]) / st);
      for (var rr = 0; rr < 12 && s0 < 0; rr++) for (var di = -rr; di <= rr && s0 < 0; di++) for (var dj = -rr; dj <= rr; dj++) { var ii = si + di, jj = sj + dj; if (ii >= 0 && jj >= 0 && ii < h && jj < w && okm[ii * w + jj]) { s0 = ii * w + jj; break; } }
      if (s0 < 0) break;
      reach[s0] = 1; q.push(s0);
      while (q.length) { var c = q.pop(), ci = (c / w) | 0, cj = c % w; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var i2 = ci + d[0], j2 = cj + d[1]; if (i2 < 0 || j2 < 0 || i2 >= h || j2 >= w) return; var n2 = i2 * w + j2; if (!reach[n2] && okm[n2]) { reach[n2] = 1; q.push(n2); } }); }
      var got = {}; for (k = 0; k < N; k++) if (reach[k] && roomOf[k] >= 0) got[roomOf[k]] = 1;
      var miss = A.rooms.map(function (_, i) { return i; }).filter(function (i) { return !got[i]; });
      if (!miss.length) break;
      // Дейкстра (стоимости 1/3/6) от достижимого к любой проходимой клетке недоступной комнаты
      var want = {}; miss.forEach(function (i) { want[i] = 1; });
      var dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), B = [[]], found = -1;
      for (k = 0; k < N; k++) if (reach[k]) { dist[k] = 0; B[0].push(k); }
      for (var dcur = 0; dcur < B.length && found < 0; dcur++) {
        var bucket = B[dcur]; if (!bucket) continue;
        for (var bi = 0; bi < bucket.length && found < 0; bi++) {
          var u = bucket[bi]; if (dist[u] !== dcur) continue;
          if (okm[u] && want[roomOf[u]]) { found = u; break; }
          var ui = (u / w) | 0, uj = u % w;
          for (var e = 0; e < 4; e++) {
            var i3 = ui + (e === 0 ? 1 : e === 1 ? -1 : 0), j3 = uj + (e === 2 ? 1 : e === 3 ? -1 : 0);
            if (i3 < 0 || j3 < 0 || i3 >= h || j3 >= w) continue;
            var v = i3 * w + j3, cost = okm[v] ? 1 : soft[v] ? 3 : 6, nd = dcur + cost;
            if (nd < dist[v]) { dist[v] = nd; prev[v] = u; (B[nd] || (B[nd] = [])).push(v); }
          }
        }
      }
      if (found < 0) break;
      for (var p = found; p >= 0 && !reach[p]; p = prev[p]) if (!okm[p]) doorZ.push([cx(p % w) - 0.26, cz((p / w) | 0) - 0.26, cx(p % w) + 0.26, cz((p / w) | 0) + 0.26]);
    }
    furnOn = fo;
  }
  // мебель не должна перекрывать путь в комнату: такие предметы становятся «проходимыми»
  function connectFurn() {
    var b = A.box, st = 0.1, w = Math.ceil((b[2] - b[0]) / st), h = Math.ceil((b[3] - b[1]) / st), N = w * h;
    var cx = function (j) { return b[0] + (j + 0.5) * st; }, cz = function (i) { return b[1] + (i + 0.5) * st; };
    var roomOf = new Int8Array(N).fill(-1);
    for (var i = 0; i < h; i++) for (var j = 0; j < w; j++) { var rm = roomAtL(cx(j), cz(i)); if (rm) roomOf[i * w + j] = A.rooms.indexOf(rm); }
    var fo = furnOn, emp = new Uint8Array(N);
    furnOn = false; for (var k = 0; k < N; k++) emp[k] = ok(cx(k % w) * mir, cz((k / w) | 0)) ? 1 : 0;
    for (var iter = 0; iter < 10; iter++) {
      furnOn = true;
      var okm = new Uint8Array(N); for (k = 0; k < N; k++) okm[k] = emp[k] && ok(cx(k % w) * mir, cz((k / w) | 0)) ? 1 : 0;
      var reach = new Uint8Array(N), q = [], s0 = -1, sj = Math.floor((A.spawn[0] - b[0]) / st), si = Math.floor((A.spawn[1] - b[1]) / st);
      for (var rr = 0; rr < 12 && s0 < 0; rr++) for (var di = -rr; di <= rr && s0 < 0; di++) for (var dj = -rr; dj <= rr; dj++) { var ii = si + di, jj = sj + dj; if (ii >= 0 && jj >= 0 && ii < h && jj < w && okm[ii * w + jj]) { s0 = ii * w + jj; break; } }
      if (s0 < 0) break;
      reach[s0] = 1; q.push(s0);
      while (q.length) { var c = q.pop(), ci = (c / w) | 0, cj = c % w; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var i2 = ci + d[0], j2 = cj + d[1]; if (i2 < 0 || j2 < 0 || i2 >= h || j2 >= w) return; var n2 = i2 * w + j2; if (!reach[n2] && okm[n2]) { reach[n2] = 1; q.push(n2); } }); }
      var got = {}; for (k = 0; k < N; k++) if (reach[k] && roomOf[k] >= 0) got[roomOf[k]] = 1;
      var want = {}, any = false; A.rooms.forEach(function (_, i) { if (!got[i]) { want[i] = 1; any = true; } });
      if (!any) break;
      // кратчайший путь по пустой квартире от достижимого до недоступной комнаты
      var prev = new Int32Array(N).fill(-2), Q = [], found = -1;
      for (k = 0; k < N; k++) if (reach[k]) { prev[k] = -1; Q.push(k); }
      for (var qi = 0; qi < Q.length && found < 0; qi++) {
        var u = Q[qi]; if (emp[u] && want[roomOf[u]]) { found = u; break; }
        var ui = (u / w) | 0, uj = u % w;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var i3 = ui + d[0], j3 = uj + d[1]; if (i3 < 0 || j3 < 0 || i3 >= h || j3 >= w) return; var v = i3 * w + j3; if (prev[v] === -2 && emp[v]) { prev[v] = u; Q.push(v); } });
      }
      if (found < 0) break;
      var hit = false;
      for (var p = found; p >= 0; p = prev[p]) {
        var px = cx(p % w), pz = cz((p / w) | 0);
        A.furn.forEach(function (f, fi) {
          if (NOCOLLIDE[f[0]] || ghost[fi]) return;
          var hw = (f[5] % 2 ? f[4] : f[3]) / 2 + R + 0.02, hd = (f[5] % 2 ? f[3] : f[4]) / 2 + R + 0.02;
          if (Math.abs(px - f[1]) < hw && Math.abs(pz - f[2]) < hd) { ghost[fi] = 1; hit = true; }
        });
      }
      if (!hit) break;
    }
    furnOn = fo;
  }
  function setAO() { if (aoT) [M.parquet, M.tile, M.tileg].forEach(function (m) { m.aoMap = aoT[furnOn ? 1 : 0]; }); }

  /* ───────── столкновения ───────── */
  function free(x, z) { return freeL(x * mir, z, furnOn); }
  function freeL(lx, z, withFurn) {
    var g = A.grid, inDoor = false;
    for (var dz = 0; dz < doorZ.length; dz++) { var q0 = doorZ[dz]; if (lx > q0[0] && lx < q0[2] && z > q0[1] && z < q0[3]) { inDoor = true; break; } }
    var ix = Math.floor((lx - g.x) / g.s), iz = Math.floor((z - g.z) / g.s);
    if (!inDoor) {
      if (ix < 0 || iz < 0 || ix >= g.w || iz >= g.h) return false;
      var k = iz * g.w + ix;
      if (!((g.bytes[k >> 3] >> (7 - (k & 7))) & 1)) return false;
    }
    for (var s = 0; s < solids.length; s++) { var q = solids[s]; if (lx > q[0] && lx < q[2] && z > q[1] && z < q[3]) return false; }
    if (withFurn) for (var j = 0; j < items.length; j++) {
      var u = items[j].userData;
      if (NOCOLLIDE[u.kind] || u.ghost || u.t < 1) continue;
      if (lx > u.x0 && lx < u.x1 && z > u.z0 && z < u.z1) return false;
    }
    if (withFurn === true && !items.length) for (var f = 0; f < A.furn.length; f++) {           // при сборке мебель ещё не создана
      var ff = A.furn[f]; if (NOCOLLIDE[ff[0]] || ghost[f]) continue;
      var hw = (ff[5] % 2 ? ff[4] : ff[3]) / 2, hd = (ff[5] % 2 ? ff[3] : ff[4]) / 2;
      if (lx > ff[1] - hw && lx < ff[1] + hw && z > ff[2] - hd && z < ff[2] + hd) return false;
    }
    return true;
  }
  function ok(x, z) {
    for (var a = 0; a < 8; a++) if (!free(x + Math.cos(a * Math.PI / 4) * R, z + Math.sin(a * Math.PI / 4) * R)) return false;
    return free(x, z);
  }
  function move(dx, dz) {
    if (ok(pos.x + dx, pos.z + dz)) { pos.x += dx; pos.z += dz; return true; }
    var moved = false;
    if (ok(pos.x + dx, pos.z)) { pos.x += dx; moved = true; }
    if (ok(pos.x, pos.z + dz)) { pos.z += dz; moved = true; }
    return moved;
  }

  /* ───────── комната под ногами ───────── */
  function inPoly(x, z, p) {
    var c = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c;
    }
    return c;
  }
  function roomAt(x, z) { return roomAtL(x * mir, z); }
  function roomAtL(lx, z) {
    for (var i = 0; i < A.rooms.length; i++) for (var j = 0; j < A.rooms[i].poly.length; j++) if (inPoly(lx, z, A.rooms[i].poly[j])) return A.rooms[i];
    return null;
  }

  /* ───────── мини-карта ───────── */
  var mapS, mapO;
  var ROOMCOL = { bath: '#9fc3d3', hall: '#d9d2c4', kitchen: '#e6cf97', kitliv: '#e3b58f', living: '#b8d1a8', bedroom: '#d9b3b7', kids: '#b9d8cf', studio: '#c9bde3', loggia: '#e9e6d6', closet: '#c9c4ba' };
  function drawMap() {
    var cx = mapC.getContext('2d'), Wc = mapC.width, Hc = mapC.height, b = A.box;
    var sx = (Wc - 20) / (b[2] - b[0]), sz = (Hc - 20) / (b[3] - b[1]);
    mapS = Math.min(sx, sz); mapO = [10 + ((Wc - 20) - (b[2] - b[0]) * mapS) / 2, 10 + ((Hc - 20) - (b[3] - b[1]) * mapS) / 2];
    var P = function (x, z) { var lx = mir < 0 ? b[0] + b[2] - x : x; return [mapO[0] + (lx - b[0]) * mapS, mapO[1] + (z - b[1]) * mapS]; };
    cx.clearRect(0, 0, Wc, Hc);
    A.rooms.forEach(function (rm) {
      cx.fillStyle = ROOMCOL[rm.k] || '#ddd';
      rm.poly.forEach(function (p) { cx.beginPath(); p.forEach(function (q, i) { var v = P(q[0], q[1]); if (i) cx.lineTo(v[0], v[1]); else cx.moveTo(v[0], v[1]); }); cx.closePath(); cx.fill(); });
    });
    cx.fillStyle = '#2b3a30';
    W.walls.forEach(function (r) { if (!inBox(r, b, 0.3)) return; var a = P(r[0], r[1]), c = P(r[2], r[3]); cx.fillRect(Math.min(a[0], c[0]), a[1], Math.abs(c[0] - a[0]) + 0.6, c[1] - a[1] + 0.6); });
    cx.fillStyle = '#7fb1c9';
    W.win.forEach(function (r) { if (!inBox(r, b, 0.3)) return; var a = P(r[0], r[1]), c = P(r[2], r[3]); cx.fillRect(Math.min(a[0], c[0]), a[1], Math.abs(c[0] - a[0]) + 0.6, c[1] - a[1] + 0.6); });
    if (furnOn) {
      cx.fillStyle = 'rgba(90,70,45,.5)';
      A.furn.forEach(function (f) { if (NOCOLLIDE[f[0]]) return; var hw = (f[5] % 2 ? f[4] : f[3]) / 2, hd = (f[5] % 2 ? f[3] : f[4]) / 2; var a = P(f[1] - hw, f[2] - hd), c = P(f[1] + hw, f[2] + hd); cx.fillRect(Math.min(a[0], c[0]), a[1], Math.abs(c[0] - a[0]), c[1] - a[1]); });
    }
    mapC._P = P;
  }
  function drawPlayer() {
    var cx = mapC.getContext('2d');
    drawMap();
    var v = mapC._P(pos.x * mir, pos.z);
    var dir = -yaw * (mir < 0 ? -1 : 1);
    cx.save(); cx.translate(v[0], v[1]);
    var fx = -Math.sin(yaw) * mir, fz = -Math.cos(yaw);
    var ang = Math.atan2(fz, fx * (mir < 0 ? -1 : 1));
    cx.rotate(ang);
    var g = cx.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, 'rgba(201,169,106,.55)'); g.addColorStop(1, 'rgba(201,169,106,0)');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(0, 0); cx.arc(0, 0, 34, -0.6, 0.6); cx.closePath(); cx.fill();
    cx.fillStyle = '#c9a96a'; cx.strokeStyle = '#06170d'; cx.lineWidth = 2; cx.beginPath(); cx.arc(0, 0, 5.5, 0, 7); cx.fill(); cx.stroke();
    cx.restore();
  }

  /* ───────── мебель: волна появления от игрока ───────── */
  function setFurniture(on) {
    furnOn = on; setAO();
    furnBtn.classList.toggle('is-on', on);
    furnBtn.setAttribute('aria-pressed', String(on));
    var now = performance.now();
    items.forEach(function (g) {
      var u = g.userData, d = Math.hypot(u.x0 + (u.x1 - u.x0) / 2 - pos.x * mir, u.z0 + (u.z1 - u.z0) / 2 - pos.z);
      u.from = g.scale.x; u.to = on ? 1 : 0.0001; u.start = now + d * (on ? 70 : 35); u.dur = on ? 520 : 300;
      u.t = on ? 0.5 : 0; g.visible = true;
    });
    drawPlayer();
    kick();
  }
  function backOut(t) { var s = 1.4; t -= 1; return t * t * ((s + 1) * t + s) + 1; }

  /* ───────── ввод ───────── */
  var look = null, tap = null, joy = null;
  function bind() {
    window.addEventListener('keydown', function (e) {
      if (!root.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (loading) return;
      if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') { setFurniture(!furnOn); return; }
      keys[e.code] = true; target = null; kick();
      if (/Arrow|Space/.test(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.45) return;   // зона джойстика
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!look || e.pointerId !== look.id) return;
      var dx = e.clientX - look.x, dy = e.clientY - look.y;
      if (!look.moved && Math.hypot(dx, dy) < 5) return;
      look.moved = true;
      var k = e.pointerType === 'touch' ? 0.006 : 0.0042;
      yaw = look.yaw + dx * k; pitch = Math.max(-1.1, Math.min(1.0, look.pitch + dy * k));
      hideHelp(); kick();
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!look || e.pointerId !== look.id) return;
      var l = look; look = null;
      if (l.moved) return;
      // клик по полу — идём туда
      var r = canvas.getBoundingClientRect(), v = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      var ray = new T.Raycaster(); ray.setFromCamera(v, camera);
      var hit = ray.intersectObjects(floors, false)[0];
      if (hit && hit.distance < 14) { target = { x: hit.point.x, z: hit.point.z }; hideHelp(); kick(); }
    });
    // джойстик
    var knob = stick.firstElementChild;
    function jmove(e) {
      var r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy), max = r.width / 2 - 18;
      if (m > max) { dx *= max / m; dy *= max / m; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      mv.x = dx / max; mv.y = dy / max; target = null; kick();
    }
    stick.addEventListener('pointerdown', function (e) { joy = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (_) {} jmove(e); hideHelp(); });
    stick.addEventListener('pointermove', function (e) { if (e.pointerId === joy) jmove(e); });
    var jend = function (e) { if (e.pointerId !== joy) return; joy = null; mv.x = mv.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', jend); stick.addEventListener('pointercancel', jend);
    mapC.addEventListener('click', function (e) {
      var r = mapC.getBoundingClientRect(), b = A.box;
      var mx = (e.clientX - r.left) * mapC.width / r.width, mz = (e.clientY - r.top) * mapC.height / r.height;
      var lx = b[0] + (mx - mapO[0]) / mapS, z = b[1] + (mz - mapO[1]) / mapS;
      var x = mir < 0 ? -(b[0] + b[2] - lx) : lx;
      if (ok(x, z)) { pos.x = x; pos.z = z; target = null; drawPlayer(); kick(); }
    });
    furnBtn.addEventListener('click', function () { if (!loading) setFurniture(!furnOn); });
    $('#wkClose').addEventListener('click', close);
    $('#wkPhotos').addEventListener('click', function () { if (window.ALTA_openTour && info.tour) window.ALTA_openTour(info.tour); });
    window.addEventListener('resize', function () { if (root.classList.contains('is-open')) { resize(); kick(); } });
  }
  var helpT;
  function hideHelp() { help.classList.add('is-off'); }

  /* ───────── цикл ───────── */
  function kick() { if (loading) return; if (!running) { running = true; clock.getDelta(); requestAnimationFrame(tick); } }
  function tick() {
    if (!root.classList.contains('is-open') || loading) { running = false; return; }
    var dt = Math.min(0.05, clock.getDelta()), now = performance.now(), active = false;
    var fwd = 0, side = 0, turn = 0;
    if (keys.KeyW || keys.ArrowUp) fwd += 1; if (keys.KeyS || keys.ArrowDown) fwd -= 1;
    if (keys.KeyD) side += 1; if (keys.KeyA) side -= 1;
    if (keys.ArrowLeft || keys.KeyQ) turn += 1; if (keys.ArrowRight || keys.KeyE) turn -= 1;
    fwd -= mv.y; side += mv.x;
    var speed = (keys.ShiftLeft || keys.ShiftRight ? 2.6 : 1.45) * dt;
    if (turn) { yaw += turn * 1.8 * dt; active = true; }
    if (target) {
      var dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.08) target = null;
      else {
        var want = Math.atan2(-dx, -dz), dy = ((want - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        yaw += dy * Math.min(1, dt * 6);
        if (!move(dx / d * Math.min(d, speed), dz / d * Math.min(d, speed))) target = null;
        active = true;
      }
    }
    if (fwd || side) {
      var l = Math.hypot(fwd, side); if (l > 1) { fwd /= l; side /= l; }
      var sx = -Math.sin(yaw), sz = -Math.cos(yaw);
      move((sx * fwd + Math.cos(yaw) * side) * speed, (sz * fwd - Math.sin(yaw) * side) * speed);
      hideHelp(); active = true;
    }
    // мебель
    items.forEach(function (g) {
      var u = g.userData; if (u.start == null) return;
      var k = (now - u.start) / u.dur;
      if (k < 0) { active = true; if (u.to > 0.5) g.scale.setScalar(0.0001); return; }
      if (k >= 1) { g.scale.setScalar(u.to); g.visible = u.to > 0.5; u.t = u.to > 0.5 ? 1 : 0; u.start = null; return; }
      var e = u.to > 0.5 ? backOut(k) : 1 - k * k;
      g.scale.setScalar(Math.max(0.0001, u.to > 0.5 ? e : u.from * e)); active = true;
    });
    var bob = (fwd || side || target) ? Math.sin(now / 160) * 0.018 : 0;
    camera.position.set(pos.x, EYE + bob, pos.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    var rm = roomAt(pos.x, pos.z), name = rm ? rm.name : '';
    if (name !== lastRoom) { lastRoom = name; roomEl.textContent = name; roomEl.classList.remove('is-in'); void roomEl.offsetWidth; if (name) roomEl.classList.add('is-in'); }
    if (active || look || joy != null) drawPlayer();
    if (active || look || joy != null || keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD) requestAnimationFrame(tick);
    else running = false;
  }

  function resize() {
    var w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 78 : 66; camera.updateProjectionMatrix();
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var mw = phone() ? 132 : 210;
    mapC.width = mw * dpr; mapC.height = Math.round(mw * 0.72) * dpr;
    mapC.style.width = mw + 'px'; mapC.style.height = Math.round(mw * 0.72) + 'px';
    if (A) drawPlayer();
  }

  // мягкое окружение для отражений и рассеянного света (как студийный «бокс» с окном)
  function envMap() {
    var es = new T.Scene(), Bm = function (r, g, b) { var m = new T.MeshBasicMaterial({ side: T.BackSide }); m.color.setRGB(r, g, b); return m; };
    var room = new T.Mesh(new T.BoxGeometry(12, 6, 12), Bm(0.66, 0.63, 0.58)); room.position.y = 3; es.add(room);
    var fl = new T.Mesh(new T.PlaneGeometry(12, 12), new T.MeshBasicMaterial({ color: 0xc9b496 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; es.add(fl);
    var panel = function (w, h, x, y, z, ry, k) { var m = new T.MeshBasicMaterial({ side: T.DoubleSide }); m.color.setRGB(k, k * 0.98, k * 0.93); var p = new T.Mesh(new T.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; es.add(p); };
    panel(7, 3.2, -5.9, 3, 0, Math.PI / 2, 5.5);         // большое окно
    panel(4, 2.5, 0, 3, 5.9, 0, 2.2);
    var c = new T.Mesh(new T.PlaneGeometry(5, 5), Bm(1.6, 1.55, 1.45)); c.rotation.x = Math.PI / 2; c.position.y = 5.95; es.add(c);
    var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.04);
    pm.dispose(); es.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return rt.texture;
  }

  function init() {
    if (inited) return true;
    T = window.THREE;
    if (!T || !window.ALTA_WALK) return false;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone() ? 1.5 : 2));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    if ('toneMapping' in renderer) { renderer.toneMapping = T.AgXToneMapping || T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; }
    renderer.shadowMap.enabled = !phone();
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color(0xcfd9df);
    camera = new T.PerspectiveCamera(66, 1, 0.05, 400);
    clock = new T.Clock();
    BOX = new T.BoxGeometry(1, 1, 1);
    LEAF = new T.SphereGeometry(1, 10, 8);
    LAMP = new T.CylinderGeometry(0.24, 0.24, 0.035, 40);
    SKYGEO = new T.CylinderGeometry(90, 90, 120, 64, 1, true);
    GROUNDGEO = new T.CircleGeometry(90, 48); GROUNDGEO.rotateX(-Math.PI / 2);
    mats();
    scene.environment = envMap();
    scene.add(new T.HemisphereLight(0xfff3e0, 0xeadfcd, 0.5));
    var sun = new T.DirectionalLight(0xffe2b8, 2.1);
    sun.position.set(-30, 40, 25); sun.castShadow = !phone();
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    scene.userData.sun = sun;
    bind();
    inited = true;
    return true;
  }

  /* ───────── загрузка: всё тяжёлое делаем под заставкой, показываем готовую сцену ───────── */
  var loading = false, token = 0, loadEl = $('#wkLoad'), barEl = $('#wkBar'), stepEl = $('#wkLoadS');
  function setLoad(k, text) { barEl.style.transform = 'scaleX(' + k + ')'; if (text) stepEl.textContent = text; }
  function next(fn) { requestAnimationFrame(function () { setTimeout(fn, 0); }); }   // дать браузеру отрисовать заставку

  function open(o) {
    if (!window.ALTA_WALK || !window.ALTA_WALK[o.st] || !window.ALTA_WALK[o.st].apts[o.n]) return;
    info = o; var my = ++token;
    root.classList.add('is-open'); root.classList.remove('is-ready'); root.inert = false; root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('walk-open');
    $('#wkTitle').innerHTML = '<b>Квартира ' + o.n + '</b><span>' + o.name + ', ' + o.total.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) + ' м², этаж ' + o.floor + '</span>';
    $('#wkLoadT').textContent = 'Квартира ' + o.n;
    loading = true; keys = {}; target = null;
    barEl.style.transition = 'none'; setLoad(0.04, 'Загружаем планировку'); void barEl.offsetWidth; barEl.style.transition = '';
    next(function () {
      if (my !== token) return;
      if (!init()) { close(); alert('3D-прогулка недоступна в этом браузере.'); return; }
      W = window.ALTA_WALK[o.st]; A = W.apts[o.n];
      mir = o.mirror ? -1 : 1;
      furnOn = true; furnBtn.classList.add('is-on'); furnBtn.setAttribute('aria-pressed', 'true');
      setLoad(0.22, 'Возводим стены и проёмы');
      next(function () {
        if (my !== token) return;
        build();
        var b = A.box, sun = scene.userData.sun;
        sun.target.position.set(mir * (b[0] + b[2]) / 2, 0, (b[1] + b[3]) / 2); sun.position.set(sun.target.position.x - 30, 40, sun.target.position.z + 25);
        pos.x = A.spawn[0] * mir; pos.z = A.spawn[1];
        yaw = Math.atan2(-Math.sin(A.spawn[2]) * mir, -Math.cos(A.spawn[2]));
        bestView();
        pitch = -0.06; lastRoom = '';
        resize();
        camera.position.set(pos.x, EYE, pos.z); camera.rotation.set(pitch, yaw, 0, 'YXZ');
        setLoad(0.6, 'Расставляем мебель и свет');
        next(function () {
          if (my !== token) return;
          var done = function () {
            if (my !== token) return;
            setLoad(0.85, 'Почти готово');
            next(function () {
              if (my !== token) return;
              renderer.render(scene, camera);                      // первый кадр (тени, текстуры) — тоже под заставкой
              items.forEach(function (g) { g.scale.setScalar(0.0001); });
              renderer.render(scene, camera);
              setLoad(1, 'Готово');
              setTimeout(function () {
                if (my !== token) return;
                loading = false;
                root.classList.add('is-ready');
                help.classList.remove('is-off');
                help.innerHTML = phone()
                  ? '<span><b>Джойстик</b> — идти</span><span><b>Свайп</b> — осмотреться</span><span><b>Касание пола</b> — перейти</span>'
                  : '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> идти</span><span><kbd>Мышь</kbd> осмотреться</span><span><kbd>Клик по полу</kbd> перейти</span><span><kbd>Shift</kbd> быстрее</span><span><kbd>F</kbd> мебель</span>';
                clearTimeout(helpT); helpT = setTimeout(hideHelp, 9000);
                kick();
                setTimeout(function () { if (my === token) setFurniture(true); }, 380);
              }, 260);
            });
          };
          Promise.all(texWait).then(function () {
            if (my !== token) return;
            if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(done, done);
            else { renderer.compile(scene, camera); done(); }
          });
        });
      });
    });
  }
  function close() {
    token++; loading = false;
    root.classList.remove('is-open', 'is-ready'); root.inert = true; root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('walk-open');
    keys = {}; target = null;
    if (renderer) { dispose(); items = []; floors = []; solids = []; renderer.renderLists.dispose(); }
    if (window.ALTA_pickerRender) window.ALTA_pickerRender();
  }
  // первая точка: угол главной комнаты, взгляд по диагонали через всю комнату к окнам
  function ray(x, z, y) { var d = 0; while (d < 12 && freeL(x - Math.sin(y) * d, z - Math.cos(y) * d, false)) d += 0.1; return d; }
  function nearTall(x, z, q) {                               // высокая мебель/растения рядом с камерой закрывают кадр
    for (var i = 0; i < A.furn.length; i++) {
      var f = A.furn[i]; if (!/plant|shelf|wardrobe|fridge/.test(f[0])) continue;
      var hw = (f[5] % 2 ? f[4] : f[3]) / 2 + (f[0] === 'plant' ? 0.3 : 0.05), hd = (f[5] % 2 ? f[3] : f[4]) / 2 + (f[0] === 'plant' ? 0.3 : 0.05);
      if (Math.abs(x - f[1]) < hw + q && Math.abs(z - f[2]) < hd + q) return true;
    }
    return false;
  }
  function bestView() {
    var pref = A.rooms.filter(function (r) { return /living|kitliv|studio/.test(r.k); });
    var rm = (pref.length ? pref : A.rooms.filter(function (r) { return r.k !== 'loggia' && r.k !== 'bath'; })).sort(function (a, b) { return b.a - a.a; })[0];
    if (!rm) return;
    var bx = [1e9, 1e9, -1e9, -1e9];
    rm.poly.forEach(function (p) { p.forEach(function (q) { bx[0] = Math.min(bx[0], q[0]); bx[1] = Math.min(bx[1], q[1]); bx[2] = Math.max(bx[2], q[0]); bx[3] = Math.max(bx[3], q[1]); }); });
    // окна этой комнаты: куда смотреть
    W._wm = W._wm || merge(W.win);
    var ws = W._wm.filter(function (r) {
      if (!inBox(r, bx, 0.8)) return false;
      var cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, t = (r[2] - r[0]) < (r[3] - r[1]);
      return [0.45, -0.45].some(function (o) { return roomAtL(t ? (o > 0 ? r[2] : r[0]) + o : cx, t ? cz : (o > 0 ? r[3] : r[1]) + o) === rm; });
    });
    var tx = rm.c[0], tz = rm.c[1];
    if (ws.length) { tx = 0; tz = 0; var tw = 0; ws.forEach(function (r) { var L = Math.max(r[2] - r[0], r[3] - r[1]); tx += (r[0] + r[2]) / 2 * L; tz += (r[1] + r[3]) / 2 * L; tw += L; }); tx /= tw; tz /= tw; }
    // встаём как можно дальше от окна, но так, чтобы окно было видно; смотрим между окном и центром комнаты
    var best = null, lx = tx * 0.75 + rm.c[0] * 0.25, lz = tz * 0.75 + rm.c[1] * 0.25;
    for (var x = bx[0] + 0.25; x < bx[2]; x += 0.15) for (var z = bx[1] + 0.25; z < bx[3]; z += 0.15) {
      if (roomAtL(x, z) !== rm || !ok(x * mir, z)) continue;
      var cl = 0.6;                                         // запас до мебели и стен
      for (var c = 0; c < 8; c++) for (var q = 0.25; q < cl; q += 0.05) if (!free(x * mir + Math.cos(c * 0.785) * q, z + Math.sin(c * 0.785) * q) || nearTall(x, z, q)) { cl = q; break; }
      if (cl < 0.3) continue;
      if (W._wm.some(function (r) { return Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3])) < 0.9; })) continue;
      var d = Math.hypot(tx - x, tz - z), y = Math.atan2(-(lx - x), -(lz - z));
      if (ray(x, z, y) < Math.hypot(lx - x, lz - z) * 0.9) continue;
      var dl = Math.hypot(lx - x, lz - z), blocked = false;
      for (var tt = 0.3; tt < Math.min(dl, 3.5) && !blocked; tt += 0.15) blocked = nearTall(x + (lx - x) / dl * tt, z + (lz - z) / dl * tt, 0);
      if (blocked) continue;
      var sc = d + 0.4 * Math.min(ray(x, z, y + 0.5), ray(x, z, y - 0.5), 4) + 4 * cl;
      if (!best || sc > best.s) best = { s: sc, x: x, z: z, y: y };
    }
    if (!best) return;
    pos.x = best.x * mir; pos.z = best.z;
    yaw = mir < 0 ? -best.y : best.y;
  }
  window.ALTA_openWalk = open;
  window.__wkReach = function (withFurn) {             // проверка: из точки входа достижимы ли все комнаты
    var fo = furnOn; furnOn = withFurn; var b = A.box, st = 0.1, w = Math.ceil((b[2] - b[0]) / st), h = Math.ceil((b[3] - b[1]) / st);
    var seen = new Uint8Array(w * h), q = [], got = {};
    var sx = Math.floor((A.spawn[0] - b[0]) / st), sz = Math.floor((A.spawn[1] - b[1]) / st);
    var okc = function (i, j) { return ok((b[0] + (j + 0.5) * st) * mir, b[1] + (i + 0.5) * st); };
    // ближайшая проходимая клетка к точке входа
    for (var r = 0; r < 10 && !q.length; r++) for (var di = -r; di <= r; di++) for (var dj = -r; dj <= r; dj++) if (!q.length && okc(sz + di, sx + dj)) { q.push([sz + di, sx + dj]); seen[(sz + di) * w + sx + dj] = 1; }
    while (q.length) { var c = q.pop(); var rm = roomAtL(b[0] + (c[1] + 0.5) * st, b[1] + (c[0] + 0.5) * st); if (rm) got[rm.k + '@' + rm.c] = 1;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var i = c[0] + d[0], j = c[1] + d[1]; if (i < 0 || j < 0 || i >= h || j >= w || seen[i * w + j]) return; seen[i * w + j] = 1; if (okc(i, j)) q.push([i, j]); }); }
    furnOn = fo;
    var all = A.rooms.map(function (r) { return r.k + '@' + r.c; });
    return all.filter(function (k) { return !got[k]; });
  };
  window.__wkRun = function () { return JSON.stringify({ running: running, frames: window.__fr, keys: keys, look: !!look, joy: joy }); };
  window.__wkDbg = function () { return { pos: [pos.x, pos.z], yaw: yaw, okHere: ok(pos.x, pos.z), fwd: [0.1, 0.3, 0.5].map(function (d) { return ok(pos.x - Math.sin(yaw) * d, pos.z - Math.cos(yaw) * d); }), freeHere: free(pos.x, pos.z) }; };
  window.__wkInfo = function () { return renderer && { geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, prog: renderer.info.programs.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; };
  // для проверки: встать в точку (локальные координаты) и посмотреть в самую дальнюю сторону
  window.__wkTeleport = function (lx, lz) {
    pos.x = lx * mir; pos.z = lz;
    var best = 0, by = 0;
    for (var a = 0; a < 16; a++) { var y = a / 16 * Math.PI * 2, d = 0; while (d < 8 && free(pos.x - Math.sin(y) * d, pos.z - Math.cos(y) * d)) d += 0.1; if (d > best) { best = d; by = y; } }
    yaw = by; pitch = -0.12;
    var back = 0; while (back < 2.2 && ok(pos.x + Math.sin(by) * 0.1, pos.z + Math.cos(by) * 0.1)) { pos.x += Math.sin(by) * 0.1; pos.z += Math.cos(by) * 0.1; back += 0.1; }
    hideHelp(); kick();
  };
})();
