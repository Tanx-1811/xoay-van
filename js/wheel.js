/* Spinning wheel: canvas rendering (700×700 logical units), fixed-step spin physics, drag & flick to spin.
   Per frame only three bitmaps are drawn: the turning face (rebuilt when the config changes),
   a still overlay (shadow, bevel, light) and a pointer sprite cached per color. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var SIZE = 700;
  var C = SIZE / 2;
  var R = 0.44 * SIZE;             // 308
  var FPS = 60;
  var STEP_MS = 1000 / FPS;
  // Physics constants (rad per 1/60 s tick).
  var IDLE = 0.005, FINAL = 0.00015, SLOW_ACC = 0.001, ACC = 0.6, ACC_DIV = 3;
  var DEMO = 'demo', ACCEL = 'accel', DECEL = 'decel', STOPPED = 'stopped';
  var POINTER_GREY = '#BBBBBB';
  var MAX_LABEL = 18;
  var BASE_FONT = 'Quicksand, sans-serif';
  var FLICK = 2.2;                 // rad/s needed for a released drag to start a spin
  var reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rand() {
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967295;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function now() { return window.performance ? performance.now() : Date.now(); }
  function canvasOf(px) { var c = document.createElement('canvas'); c.width = c.height = px; return c; }

  // ---------------------------------------------------------------- colors
  function hexRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) n = 0xcccccc;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  // WCAG relative luminance: black text on light colors, white on dark ones.
  function textColorFor(hex) {
    var L = hexRgb(hex).map(function (c) {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2] > 0.179 ? '#000000' : '#FFFFFF';
  }
  function adjust(hex, t) {
    var d = Math.round(255 * t);
    return 'rgb(' + hexRgb(hex).map(function (c) { return Math.max(0, Math.min(255, c + d)); }).join(',') + ')';
  }

  // ---------------------------------------------------------------- procedural textures
  var snowTile = null, metalTile = null;
  function getSnowTile() {
    if (snowTile) return snowTile;
    var c = canvasOf(160);
    var g = c.getContext('2d');
    var img = g.createImageData(160, 160);
    // soft mottled flakes: low-alpha white noise, a little denser in blotches
    for (var i = 0; i < img.data.length; i += 4) {
      var px = (i / 4) % 160, py = Math.floor(i / 4 / 160);
      var blotch = 0.5 + 0.5 * Math.sin(px * 0.11 + Math.sin(py * 0.07) * 2) * Math.cos(py * 0.09 + Math.sin(px * 0.05));
      var on = Math.random() < 0.1 + blotch * 0.12;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = on ? Math.round(30 + Math.random() * 90) : 0;
    }
    g.putImageData(img, 0, 0);
    for (var k = 0; k < 40; k++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.1 + Math.random() * 0.25) + ')';
      g.beginPath(); g.arc(Math.random() * 160, Math.random() * 160, 0.6 + Math.random() * 1.2, 0, TAU); g.fill();
    }
    snowTile = c;
    return c;
  }
  function getMetalTile() {
    if (metalTile) return metalTile;
    var c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#c9ced3'); grad.addColorStop(0.5, '#9ea4aa'); grad.addColorStop(1, '#c2c7cc');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
    for (var y = 0; y < 128; y++) {
      for (var n = 0; n < 6; n++) {
        g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',' + (Math.random() * 0.12) + ')';
        g.fillRect(Math.random() * 256, y, 30 + Math.random() * 160, 1);
      }
    }
    metalTile = c;
    return c;
  }

  // ---------------------------------------------------------------- images
  var imgCache = new Map();
  function loadImage(src, onload) {
    if (!src) return null;
    var e = imgCache.get(src);
    if (!e) {
      e = { img: new Image(), ready: false, corner: null, waiters: [] };
      e.img.decoding = 'async';
      if (!/^data:/.test(src)) e.img.crossOrigin = 'anonymous';
      e.img.onload = function () {
        e.ready = true;
        e.corner = cornerPixel(e.img);
        e.waiters.splice(0).forEach(function (f) { f(); });
      };
      e.img.src = src;
      imgCache.set(src, e);
    }
    if (!e.ready && onload && e.waiters.indexOf(onload) < 0) e.waiters.push(onload);
    return e;
  }
  // Top-left pixel decides transparency handling and the auto slice color.
  function cornerPixel(img) {
    try {
      var c = canvasOf(1);
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, Math.max(1, img.naturalWidth), Math.max(1, img.naturalHeight), 0, 0, Math.max(1, img.naturalWidth), Math.max(1, img.naturalHeight));
      var d = g.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    } catch (e) { return { r: 255, g: 255, b: 255, a: 255 }; }
  }
  function cornerHex(p) {
    if (p.r > 230 && p.g > 230 && p.b > 230) return '#FFFFFF';
    return '#' + [p.r, p.g, p.b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  // ---------------------------------------------------------------- text fitting
  function fontStack(font) { return font ? "'" + String(font).replace(/['"]/g, '') + "', " + BASE_FONT : BASE_FONT; }
  function fontWeight(font) {
    var list = (window.DATA && window.DATA.WHEEL_FONTS) || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === (font || '')) return list[i][1];
    return '400';
  }
  var measureCtx = document.createElement('canvas').getContext('2d');
  var sizeMemo = new Map();
  function fits(f, half, width, hubR) {
    var inner = Math.max(f * Math.cos(half) / (2 * Math.sin(half)), hubR);
    return Math.sqrt(R * R - (f / 2) * (f / 2)) - inner >= width;
  }
  function bestSize(label, family, weight, half, hubR) {
    var key = label + '|' + weight + ' ' + family + '|' + hubR + '|' + half.toFixed(6);
    var memo = sizeMemo.get(key);
    if (memo) return memo;
    var lo = 3, hi = 200, mid = 3;
    while (hi - lo >= 2) {
      mid = Math.round((lo + hi) / 2);
      measureCtx.font = weight + ' ' + mid + 'px ' + family;
      if (fits(mid, half, measureCtx.measureText(' ' + label + ' ').width, hubR)) lo = mid; else hi = mid;
    }
    if (sizeMemo.size > 20000) sizeMemo.clear();
    sizeMemo.set(key, mid);
    return mid;
  }
  function labelOf(text) {
    text = String(text || '');
    return text.length > MAX_LABEL ? text.slice(0, MAX_LABEL - 1) + '…' : text;
  }

  // ---------------------------------------------------------------- Wheel
  function Wheel(canvas, hooks, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};
    this.isStatic = !!(opts && opts.static);
    this.dpr = this.isStatic ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.px = (opts && opts.size) || SIZE * this.dpr;
    canvas.width = canvas.height = this.px;
    this.scale = this.px / SIZE;
    this.angle = 0;
    this.speed = IDLE;
    this.dir = 1;
    this.phase = this.isStatic || reducedMotion ? STOPPED : DEMO;
    this.ticksInPhase = 0;
    this.cfg = { colors: ['#CCCCCC'], entries: [], type: 'color', hubSize: 'S', maxNames: 1000, spinTime: 10 };
    this.all = []; this.visible = []; this.slices = [];
    this.indexAtPointer = 0;
    this.cache = null; this.overlay = null; this.sprites = new Map();
    this.raf = 0; this.last = 0; this.delta = 0; this.running = false;
    this.visibleOnScreen = true;
    this.destroyed = false;
    this.dragging = false; this.dragEndAt = 0;
    var self = this;
    this.frame = function (t) { self.onFrame(t); };
    this.redraw = function () { self.cache = null; self.requestDraw(); };
    if (!this.isStatic) {
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver(function (es) {
          self.visibleOnScreen = es[es.length - 1].isIntersecting;
          if (self.visibleOnScreen) self.ensureLoop();
        });
        this.io.observe(canvas);
      }
      this.bindDrag();
    }
  }

  Wheel.prototype.isSpinning = function () { return this.phase === ACCEL || this.phase === DECEL; };

  // Match the bitmap to the size on screen (× device pixel ratio, capped at 2) instead of a fixed 700 × dpr.
  Wheel.prototype.setDisplaySize = function (cssPx) {
    if (this.isStatic || !(cssPx > 0)) return;
    var px = Math.round(Math.max(160, Math.min(1600, cssPx * this.dpr)));
    if (Math.abs(px - this.px) < 4) return;
    this.px = px;
    this.canvas.width = this.canvas.height = px;
    this.scale = px / SIZE;
    this.cache = null; this.overlay = null; this.sprites.clear();
    this.requestDraw();
  };

  // opts: entries, colors (enabled palette), isAdvanced, allowDuplicates, maxNames, spinTime, slowSpin, type,
  // hubSize, drawOutlines, drawShadow, pointerChangesColor, hideEntryText, font, coverImage, centerImage
  Wheel.prototype.configure = function (opts) {
    if (this.isSpinning()) { this.pending = opts; return; }
    this.pending = null;
    this.cfg = opts;
    var seen = new Set();
    this.all = (opts.entries || []).filter(function (e) {
      if (e.enabled === false) return false;
      if (opts.allowDuplicates === false) {
        var k = (e.text || '') + '||' + (e.image || '');
        if (seen.has(k)) return false;
        seen.add(k);
      }
      return true;
    });
    var max = Math.max(1, opts.maxNames || 1000);
    this.visible = this.all.slice(0, max);
    this.maxSlices = max;
    this.layout();
    this.cache = null; this.overlay = null;
    this.indexAtPointer = this.indexAt(this.angle);
    this.requestDraw();
  };

  Wheel.prototype.truncated = function () { return this.all.length > this.maxSlices; };
  Wheel.prototype.hubR = function () { return this.cfg.type === 'image' ? 0 : Math.round((window.DATA.HUB_SIZES[this.cfg.hubSize] || 0.2) * R); };
  Wheel.prototype.family = function () { return fontStack(this.cfg.font); };
  Wheel.prototype.weight = function () { return fontWeight(this.cfg.font); };

  // Slice geometry, colors and font sizes for the visible entries.
  Wheel.prototype.layout = function () {
    var cfg = this.cfg, vis = this.visible, n = vis.length;
    var pal = cfg.colors && cfg.colors.length ? cfg.colors : ['#CCCCCC'];
    var P = pal.length;
    var weighted = cfg.isAdvanced && !this.truncated();
    var total = weighted ? vis.reduce(function (s, e) { return s + (e.weight > 0 ? e.weight : 1); }, 0) : n;
    var center = 0, prevW = 0;
    this.weighted = weighted;
    this.slices = vis.map(function (e, i) {
      var w = weighted ? TAU * (e.weight > 0 ? e.weight : 1) / total : TAU / n;
      if (i > 0) center -= (prevW + w) / 2;
      prevW = w;
      var color = pal[i % P];
      if (n > 1 && i === n - 1 && i % P === 0 && P > 2) color = pal[1];
      if (cfg.isAdvanced && e.color) color = e.color;
      return { entry: e, center: center, width: w, half: w / 2, color: color, label: labelOf(e.text) };
    });
    // winner/pointer bounds: b0 = w0/2, bk = b(k-1) + wk
    var b = 0;
    this.bounds = this.slices.map(function (s, i) { b += i === 0 ? s.width / 2 : s.width; return b; });
    this.computeFontSizes();
  };

  Wheel.prototype.showText = function (e) {
    var h = this.cfg.hideEntryText;
    if (h === 'always') return false;
    if (h === 'on-image' && e.image) return false;
    return !!(e.text && String(e.text).length);
  };

  // Best size per slice, then quantized into tiers that are each more than 2× the previous one.
  Wheel.prototype.computeFontSizes = function () {
    var self = this, fam = this.family(), wt = this.weight(), hubR = this.hubR();
    var byHalf = new Map();
    this.slices.forEach(function (s) {
      var key = s.half.toFixed(6);
      if (!byHalf.has(key)) byHalf.set(key, { half: s.half, slices: [] });
      byHalf.get(key).slices.push(s);
    });
    var labels = this.slices.filter(function (s) { return self.showText(s.entry); }).map(function (s) { return s.label; });
    var uniq = Array.from(new Set(labels));
    byHalf.forEach(function (grp) {
      var sizes = uniq.map(function (l) { return bestSize(l, fam, wt, grp.half, hubR); }).sort(function (a, b) { return a - b; });
      var tiers = [];
      sizes.forEach(function (sz) { if (!tiers.length || sz > 2 * tiers[tiers.length - 1]) tiers.push(sz); });
      grp.slices.forEach(function (s) {
        var own = bestSize(s.label, fam, wt, s.half, hubR);
        var pick = tiers[0] || own;
        for (var i = 0; i < tiers.length; i++) if (tiers[i] <= own) pick = tiers[i];
        s.fontSize = pick;
      });
    });
  };

  // Index of the slice under the pointer (3 o'clock) for rotation θ.
  Wheel.prototype.indexAt = function (theta) {
    var n = this.slices.length;
    if (!n) return 0;
    theta = mod(theta, TAU);
    if (!this.weighted) return Math.round(theta / (TAU / n)) % n;
    for (var k = 0; k < this.bounds.length; k++) if (theta < this.bounds[k]) return k;
    return 0;
  };
  Wheel.prototype.entryAtPointer = function () { var s = this.slices[this.indexAtPointer]; return s ? s.entry : null; };
  Wheel.prototype.sliceAtPointer = function () { return this.slices[this.indexAtPointer] || null; };

  // ---------------------------------------------------------------- spin control
  // dir < 0 turns the wheel counter-clockwise (after a backwards flick). The stopping angle is
  // still drawn uniformly at random when the wheel starts slowing down, so direction never changes the odds.
  Wheel.prototype.spin = function (dir) {
    if (this.isStatic || this.isSpinning() || !this.visible.length) return false;
    var spinTime = Math.max(0.1, +this.cfg.spinTime || 10);
    this.F = Math.min(FPS, spinTime * FPS / ACC_DIV);
    this.I = this.cfg.slowSpin ? SLOW_ACC : ACC / FPS;
    this.L = spinTime * FPS - this.F;
    this.D = Math.pow(FINAL / (IDLE + (this.F + 1) * this.I), 1 / this.L);
    if (this.phase === STOPPED) this.speed = 0;
    this.dir = dir < 0 && !this.truncated() ? -1 : 1;
    this.phase = ACCEL;
    this.ticksInPhase = 0;
    if (this.hooks.onSpinStart) this.hooks.onSpinStart();
    this.ensureLoop();
    return true;
  };

  Wheel.prototype.resetRotation = function () { this.angle = 0; this.indexAtPointer = this.indexAt(0); this.requestDraw(); };
  Wheel.prototype.stopDemo = function () { if (this.phase === DEMO) { this.phase = STOPPED; this.speed = 0; } };

  // Re-pick the visible window from a random offset when the list is longer than maxNames.
  Wheel.prototype.rewindow = function () {
    var all = this.all, M = this.maxSlices, start = Math.floor(rand() * all.length);
    var out = [];
    for (var i = 0; i < M; i++) out.push(all[(start + i) % all.length]);
    this.visible = out;
    this.layout();
    this.cache = null;
  };

  // New names scroll in on the far side as the pointer advances.
  Wheel.prototype.conveyor = function (from, to) {
    if (!this.truncated()) return;
    var M = this.visible.length, all = this.all;
    var steps = mod(to - from, M);
    if (!steps) return;
    var ids = new Map(all.map(function (e, i) { return [e, i]; }));
    for (var k = 1; k <= steps; k++) {
      var idx = from + k;
      var j = Math.floor(idx + M / 2) % M;
      var prev = this.visible[mod(j - 1, M)];
      var pi = ids.has(prev) ? ids.get(prev) : -1;
      this.visible[j] = all[(pi + 1) % all.length];
    }
    this.layout();
    this.cache = null;
  };

  Wheel.prototype.tick = function () {
    this.angle = mod(this.angle + this.dir * this.speed, TAU);
    var stoppedNow = false;
    if (this.phase === DEMO) this.speed = IDLE;
    else if (this.phase === ACCEL) {
      if (this.ticksInPhase > this.F) {
        this.phase = DECEL; this.ticksInPhase = 0;
        this.angle = rand() * TAU;
        this.speed = this.I * (this.F + 1);
        if (this.truncated()) this.rewindow();
      } else this.speed += this.I;
    } else if (this.phase === DECEL) {
      if (this.ticksInPhase > this.L) { this.phase = STOPPED; this.ticksInPhase = 0; stoppedNow = true; }
      else this.speed *= this.D;
    } else this.speed = 0;
    var prev = this.indexAtPointer;
    var idx = this.indexAt(this.angle);
    if (idx !== prev && this.dir > 0) this.conveyor(prev, idx);
    this.indexAtPointer = this.indexAt(this.angle);
    this.ticksInPhase++;
    if (stoppedNow) {
      var winner = this.entryAtPointer(), slice = this.sliceAtPointer();
      if (this.hooks.onStop) this.hooks.onStop(winner, slice);
      if (this.pending) this.configure(this.pending);
    }
    if (this.indexAtPointer !== prev && this.hooks.onIndexChange) this.hooks.onIndexChange(this.indexAtPointer);
  };

  Wheel.prototype.ensureLoop = function () {
    if (this.running || this.destroyed || this.isStatic) return;
    if (!this.visibleOnScreen && !this.isSpinning()) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  };

  // Physics runs at a fixed 60 Hz; every display frame is drawn, with the angle carried forward by the
  // time since the last physics step so the motion stays smooth at 120/144 Hz and with uneven frames.
  Wheel.prototype.onFrame = function (t) {
    if (this.destroyed) return;
    if (!this.last) this.delta = STEP_MS; else this.delta += t - this.last;
    this.last = t;
    while (this.delta >= STEP_MS) { this.tick(); this.delta -= STEP_MS; }
    this.draw();
    var idle = this.phase === STOPPED || (!this.visibleOnScreen && this.phase === DEMO);
    if (idle) { this.running = false; return; }
    this.raf = requestAnimationFrame(this.frame);
  };

  Wheel.prototype.requestDraw = function () {
    if (this.isStatic) { this.draw(); return; }
    if (this.running) return;
    if (this.phase === DEMO) { this.ensureLoop(); return; }
    var self = this;
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(function () { self.drawQueued = false; if (!self.destroyed) self.draw(); });
  };

  Wheel.prototype.destroy = function () {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.io) this.io.disconnect();
  };

  // ---------------------------------------------------------------- drag & flick
  // Grab the wheel and turn it by hand; letting go while moving fast starts a normal spin in that direction.
  Wheel.prototype.bindDrag = function () {
    var self = this, c = this.canvas, drag = null;
    function angleOf(e) {
      var r = c.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    }
    c.addEventListener('pointerdown', function (e) {
      if (self.isSpinning() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      // fingers wobble more than a mouse before a tap counts as a drag
      drag = { id: e.pointerId, a: angleOf(e), x: e.clientX, y: e.clientY, t0: e.timeStamp, slop: e.pointerType === 'mouse' ? 6 : 14, moved: false, total: 0, samples: [{ t: e.timeStamp, total: 0 }] };
    });
    c.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id || self.isSpinning()) return;
      var a = angleOf(e), d = a - drag.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      drag.a = a;
      drag.total += d;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < drag.slop) return;
        drag.moved = true;
        self.dragging = true;
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        self.stopDemo();
        if (self.hooks.onDragStart) self.hooks.onDragStart();
      }
      var prev = self.indexAtPointer;
      self.angle = mod(self.angle + d, TAU);
      self.indexAtPointer = self.indexAt(self.angle);
      if (prev !== self.indexAtPointer && self.hooks.onDragTick) self.hooks.onDragTick();
      drag.samples.push({ t: e.timeStamp, total: drag.total });
      while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 120) drag.samples.shift();
      self.requestDraw();
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      self.dragging = false;
      self.dragEndAt = now();
      if (e.type !== 'pointerup' || !self.hooks.onFlick) return;
      // a short, small wobble was meant as a tap: spin as a click would
      if (Math.abs(d.total) < 0.08 && e.timeStamp - d.t0 < 350) { self.hooks.onFlick(1); return; }
      var s0 = d.samples[0], s1 = d.samples[d.samples.length - 1];
      var dt = (s1.t - s0.t) / 1000;
      var v = dt > 0 && e.timeStamp - s1.t < 80 ? (s1.total - s0.total) / dt : 0;
      if (Math.abs(v) >= FLICK) self.hooks.onFlick(v > 0 ? 1 : -1);
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  };
  // A click that ends a drag must not also start a spin.
  Wheel.prototype.justDragged = function () { return this.dragging || now() - this.dragEndAt < 350; };

  // ---------------------------------------------------------------- rendering
  // The turning face: wheel picture, slices, labels, texture, hub and center image.
  Wheel.prototype.buildCache = function () {
    var self = this, cfg = this.cfg;
    var c = canvasOf(this.px);
    var g = c.getContext('2d');
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.translate(C, C);
    var hubR = this.hubR(), fam = this.family(), wt = this.weight();
    var isImageWheel = cfg.type === 'image';
    if (isImageWheel && cfg.coverImage) {
      var cov = loadImage(cfg.coverImage, this.redraw);
      if (cov && cov.ready) {
        g.save();
        g.beginPath(); g.arc(0, 0, R - 1, 0, TAU); g.clip();
        g.drawImage(cov.img, -R, -R, 2 * R, 2 * R);
        g.restore();
      }
    }
    this.slices.forEach(function (s) {
      var e = s.entry;
      var img = e.image ? loadImage(e.image, self.redraw) : null;
      var imgReady = img && img.ready;
      g.save();
      g.rotate(s.center);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, -s.half, s.half);
      g.lineTo(0, 0);
      g.closePath();
      var outlineText = isImageWheel || !!imgReady;
      if (!isImageWheel) {
        var fill = s.color;
        if (imgReady && img.corner.a >= 128) fill = (cfg.isAdvanced && e.color) || cornerHex(img.corner);
        g.fillStyle = fill;
        g.fill();
        s.drawnColor = fill;
      }
      if (imgReady) self.drawSliceImage(g, img.img, s.half, hubR);
      if (self.showText(e)) {
        g.font = wt + ' ' + s.fontSize + 'px ' + fam;
        g.textAlign = 'end';
        g.textBaseline = 'middle';
        var txt = ' ' + s.label + ' ';
        if (outlineText) {
          g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#000000';
          g.strokeText(txt, R, 0);
          g.fillStyle = '#FFFFFF';
        } else g.fillStyle = textColorFor(s.color);
        g.fillText(txt, R, 0);
      }
      if (cfg.drawOutlines) {
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -s.half, s.half); g.lineTo(0, 0); g.closePath();
        g.lineWidth = 1; g.strokeStyle = '#333333'; g.stroke();
      }
      g.restore();
    });
    // texture, baked in so it turns with the wheel
    if (this.slices.length) {
      g.save();
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
      var pat = g.createPattern(getSnowTile(), 'repeat');
      g.globalAlpha = 0.15;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = pat; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.scale(-1, -1);
      g.globalCompositeOperation = 'difference';
      g.fillRect(-R, -R, 2 * R, 2 * R);
      g.restore();
    }
    if (!isImageWheel) {
      g.beginPath(); g.arc(0, 0, hubR, 0, TAU);
      g.fillStyle = '#FFFFFF'; g.fill();
      if (cfg.drawOutlines) { g.lineWidth = 2; g.strokeStyle = '#333333'; g.stroke(); }
      var ci = cfg.centerImage && hubR > 1 ? loadImage(cfg.centerImage, this.redraw) : null;
      if (ci && ci.ready) {
        g.save();
        g.beginPath(); g.arc(0, 0, hubR - 1, 0, TAU); g.clip();
        g.drawImage(ci.img, -hubR, -hubR, 2 * hubR, 2 * hubR);
        g.restore();
      }
    }
    this.cache = c;
  };

  // Image's long axis follows the radius, starting at the inner limit, as large as it fits.
  Wheel.prototype.drawSliceImage = function (g, img, half, hubR) {
    var a = (img.naturalHeight || 1) / (img.naturalWidth || 1);
    var w = R;
    for (; w > 1; w--) if (fits(w * a, half, w, hubR)) break;
    var h = w * a;
    var x = Math.max(h * Math.cos(half) / (2 * Math.sin(half)), hubR);
    g.drawImage(img, x, -h / 2, w, h);
  };

  // The still layer drawn over the face: drop shadow, rim bevel, shading ring, light, and the metal plate.
  Wheel.prototype.buildOverlay = function () {
    var cfg = this.cfg, c = canvasOf(this.px), g = c.getContext('2d');
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    var disc = function () { g.beginPath(); g.arc(C, C, R, 0, TAU); };
    // 1. drop shadow ring (only outside the face, which is opaque)
    if (cfg.drawShadow !== false) {
      var sh = g.createRadialGradient(C, C, R, C, C + 4, R + 8);
      sh.addColorStop(0, 'rgba(0,0,0,0.204)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.beginPath(); g.rect(0, 0, SIZE, SIZE); g.arc(C, C, R - 0.5, 0, TAU, true);
      g.fillStyle = sh; g.fill();
    }
    if (this.slices.length) {
      // 2. rim bevel
      var rim = g.createRadialGradient(C, C, 0.99 * R, C, C, R);
      rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,0.533)');
      g.fillStyle = rim; disc(); g.fill();
      // 3. bevel shading ring
      if (g.createConicGradient) {
        var ring = g.createConicGradient(0, C, C);
        ring.addColorStop(0.125, 'rgba(0,0,0,0.1)'); ring.addColorStop(0.333, 'rgba(0,0,0,0)');
        ring.addColorStop(0.417, 'rgba(255,255,255,0)'); ring.addColorStop(0.625, 'rgba(255,255,255,0.25)');
        ring.addColorStop(0.833, 'rgba(255,255,255,0)'); ring.addColorStop(0.917, 'rgba(0,0,0,0)');
        g.beginPath(); g.arc(C, C, R - 2, 0, TAU);
        g.lineWidth = 4; g.strokeStyle = ring; g.stroke();
      }
      // 4. face shadow (lower right) and 5. light from the top left
      var fs = g.createRadialGradient(C - R / 2, C - R, R, C - R / 2, C - R, 2 * R);
      fs.addColorStop(0.75, 'rgba(0,0,0,0)'); fs.addColorStop(1, 'rgba(0,0,0,0.157)');
      g.fillStyle = fs; disc(); g.fill();
      var lt = g.createRadialGradient(C - R / 2, C - R, 0, C - R / 2, C - R, R);
      lt.addColorStop(0, 'rgba(255,255,255,0.212)'); lt.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lt; disc(); g.fill();
    }
    // 6. brushed-metal plate hides where names are swapped in
    if (this.truncated() && this.visible.length) {
      var hubR = this.hubR(), span = Math.max(4 * Math.PI / this.visible.length, Math.PI / 4);
      g.save();
      g.beginPath(); g.arc(C, C, (R + hubR) / 2, Math.PI - span / 2, Math.PI + span / 2);
      g.lineWidth = R - hubR + 10;
      g.strokeStyle = g.createPattern(getMetalTile(), 'repeat');
      g.shadowColor = '#444'; g.shadowOffsetY = 4 * this.scale; g.shadowBlur = 10 * this.scale;
      g.stroke();
      g.restore();
    }
    this.overlay = c;
  };

  Wheel.prototype.pointerColor = function () {
    var cfg = this.cfg;
    if (!cfg.pointerChangesColor || cfg.type === 'image' || this.slices.length > 80) return POINTER_GREY;
    var s = this.sliceAtPointer();
    if (!s) return POINTER_GREY;
    if (s.entry.image) return POINTER_GREY;
    return s.color;
  };

  // Pointer at 3 o'clock, pre-rendered once per color into a small sprite (origin = rim at 3 o'clock).
  var SPRITE_X = 30, SPRITE_W = 80, SPRITE_H = 80;
  Wheel.prototype.pointerSprite = function (color) {
    var shadow = this.cfg.drawShadow !== false, key = color + (shadow ? '|s' : '');
    var hit = this.sprites.get(key);
    if (hit) return hit;
    var c = document.createElement('canvas');
    c.width = Math.ceil(SPRITE_W * this.scale); c.height = Math.ceil(SPRITE_H * this.scale);
    var g = c.getContext('2d');
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.translate(SPRITE_X, SPRITE_H / 2);
    var tip = [-15, 0], ub = [25, -20], notch = [20, 0], lb = [25, 20];
    var fill = g.createLinearGradient(0, -20, 0, 20);
    fill.addColorStop(0, adjust(color, 0.2));
    fill.addColorStop(1, adjust(color, -0.2));
    g.beginPath();
    g.moveTo(tip[0], tip[1]); g.lineTo(ub[0], ub[1]); g.lineTo(notch[0], notch[1]); g.lineTo(lb[0], lb[1]); g.closePath();
    if (shadow) {
      g.shadowColor = 'rgba(0,0,0,0.533)';
      g.shadowOffsetY = 4 * this.scale;
      g.shadowBlur = 10 * this.scale;
    }
    g.fillStyle = fill;
    g.fill();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    var front = g.createLinearGradient(0, -20, 0, 20);
    front.addColorStop(0, adjust(color, 0.3)); front.addColorStop(0.49, adjust(color, 0.2));
    front.addColorStop(0.51, adjust(color, -0.2)); front.addColorStop(1, adjust(color, -0.3));
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(lb[0], lb[1]); g.lineTo(tip[0], tip[1]); g.lineTo(ub[0], ub[1]);
    g.lineWidth = 3; g.strokeStyle = front; g.stroke();
    var back = g.createLinearGradient(0, -20, 0, 20);
    back.addColorStop(0, adjust(color, -0.2)); back.addColorStop(0.49, adjust(color, -0.1));
    back.addColorStop(0.51, adjust(color, 0.1)); back.addColorStop(1, adjust(color, 0.2));
    g.beginPath(); g.moveTo(ub[0], ub[1]); g.lineTo(notch[0], notch[1]); g.lineTo(lb[0], lb[1]);
    g.lineWidth = 2; g.strokeStyle = back; g.stroke();
    if (this.sprites.size > 64) this.sprites.clear();
    this.sprites.set(key, c);
    return c;
  };

  Wheel.prototype.draw = function () {
    var g = this.ctx, px = this.px, k = this.scale;
    if (!this.cache) this.buildCache();
    if (!this.overlay) this.buildOverlay();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, px, px);
    var angle = this.angle;
    if (this.running && this.speed) angle += this.dir * this.speed * Math.min(1, this.delta / STEP_MS);
    g.save();
    g.translate(px / 2, px / 2); g.rotate(angle);
    g.drawImage(this.cache, -px / 2, -px / 2);
    g.restore();
    g.drawImage(this.overlay, 0, 0);
    g.drawImage(this.pointerSprite(this.pointerColor()), Math.round((C + R - SPRITE_X) * k), Math.round((C - SPRITE_H / 2) * k));
  };

  // Draws a still thumbnail of a wheel config into `canvas` (gallery, saved wheels, share themes).
  Wheel.renderStatic = function (canvas, size, opts) {
    var w = new Wheel(canvas, {}, { static: true, size: size });
    w.configure(opts);
    return w;
  };

  Wheel.textColorFor = textColorFor;
  Wheel.fontStack = fontStack;
  Wheel.fontWeight = fontWeight;
  Wheel.clearMeasureCache = function () { sizeMemo.clear(); };
  Wheel.loadImage = loadImage;
  Wheel.SIZE = SIZE;
  Wheel.R = R;
  Wheel.rand = rand;
  // Same physics without rendering: final rotation of one spin, for the fairness test.
  Wheel.simulateIndex = function (wheel) {
    return wheel.indexAt(rand() * TAU + wheel.decelTravel());
  };
  Wheel.prototype.decelTravel = function () {
    var spinTime = Math.max(0.1, +this.cfg.spinTime || 10);
    var F = Math.min(FPS, spinTime * FPS / ACC_DIV), I = this.cfg.slowSpin ? SLOW_ACC : ACC / FPS, L = spinTime * FPS - F;
    var D = Math.pow(FINAL / (IDLE + (F + 1) * I), 1 / L);
    // after the random jump: L slowing ticks plus the stopping tick, each first advancing by the current speed
    var v = I * (F + 1), travel = 0;
    for (var k = 0; k <= L; k++) { travel += v; v *= D; }
    return travel;
  };

  window.Wheel = Wheel;
})();
