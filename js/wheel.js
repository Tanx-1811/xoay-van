/* Spinning wheel: canvas rendering (700×700 logical units), fixed-step spin physics, drag & flick to spin. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var SIZE = 700;
  var C = SIZE / 2;
  var R = 0.42 * SIZE;             // 294: slice radius
  var RIM = 26;                    // gilded rim with lights around the slices
  var BULBS = 24;
  var FPS = 60;
  var STEP_MS = 1000 / FPS;
  // Physics constants (rad per 1/60 s tick).
  var IDLE = 0.005, FINAL = 0.00015, SLOW_ACC = 0.001, ACC = 0.6, ACC_DIV = 3;
  var DEMO = 'demo', ACCEL = 'accel', DECEL = 'decel', STOPPED = 'stopped';
  var GEM = '#D9432F';
  var MAX_LABEL = 18;
  var BASE_FONT = "'Be Vietnam Pro', sans-serif";
  var CELEBRATE_MS = 4200;
  var FLICK = 2.2;                 // rad/s needed for a drag to count as a spin

  function rand() {
    var a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967295;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function now() { return window.performance ? performance.now() : Date.now(); }

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
  function mix(a, b, t) { return 'rgb(' + a.map(function (v, k) { return Math.round(v + (b[k] - v) * t); }).join(',') + ')'; }
  // Gold leaf: bright highlight, deep fold, warm edge.
  function gold(g, x0, y0, x1, y1) {
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#FCE7A8'); gr.addColorStop(0.28, '#D8A748'); gr.addColorStop(0.55, '#8F5D1E');
    gr.addColorStop(0.78, '#E5BD62'); gr.addColorStop(1, '#9A6824');
    return gr;
  }

  // ---------------------------------------------------------------- brushed gold plate (hides names being swapped in)
  var plateTile = null;
  function getPlateTile() {
    if (plateTile) return plateTile;
    var c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#EBCB7C'); grad.addColorStop(0.5, '#B48535'); grad.addColorStop(1, '#DDB765');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
    for (var y = 0; y < 128; y++) {
      for (var n = 0; n < 6; n++) {
        g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,245,215' : '70,40,10') + ',' + (Math.random() * 0.12) + ')';
        g.fillRect(Math.random() * 256, y, 30 + Math.random() * 160, 1);
      }
    }
    plateTile = c;
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
      var c = document.createElement('canvas');
      c.width = c.height = 1;
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
    return '600';
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
    this.phase = this.isStatic ? STOPPED : DEMO;
    this.ticksInPhase = 0;
    this.cfg = { colors: ['#CCCCCC'], entries: [], type: 'color', hubSize: 'S', maxNames: 1000, spinTime: 10 };
    this.all = []; this.visible = []; this.slices = [];
    this.indexAtPointer = 0;
    this.cache = null;
    this.raf = 0; this.last = 0; this.delta = 0; this.running = false;
    this.visibleOnScreen = true;
    this.destroyed = false;
    this.celebrateFrom = 0; this.celebrateUntil = 0;
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

  // opts: entries, colors (enabled palette), isAdvanced, allowDuplicates, maxNames, spinTime, slowSpin, type,
  // hubSize, drawOutlines, drawShadow, pointerChangesColor, hideEntryText, font, coverImage, centerImage
  Wheel.prototype.configure = function (opts) {
    if (this.isSpinning()) { this.pending = opts; return; }
    this.pending = null;
    this.cfg = opts;
    this.celebrateUntil = 0;
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
    this.cache = null;
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
  // dir < 0 turns the wheel counter-clockwise (after a backwards flick). The stopping
  // angle is still drawn uniformly at random, so the direction never changes the odds.
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
    this.celebrateUntil = 0;
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
      else if (winner) { this.celebrateFrom = now(); this.celebrateUntil = this.celebrateFrom + CELEBRATE_MS; }
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

  Wheel.prototype.onFrame = function (t) {
    if (this.destroyed) return;
    if (!this.last) this.delta = STEP_MS; else this.delta += t - this.last;
    this.last = t;
    while (this.delta >= STEP_MS) { this.tick(); this.delta -= STEP_MS; }
    this.draw();
    var celebrating = this.celebrateUntil > now();
    var idle = (this.phase === STOPPED && !celebrating) || (!this.visibleOnScreen && this.phase === DEMO);
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
  // Grab the wheel and turn it by hand; letting go fast enough starts a normal spin in that direction.
  Wheel.prototype.bindDrag = function () {
    var self = this, c = this.canvas, drag = null;
    function angleOf(e) {
      var r = c.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    }
    c.addEventListener('pointerdown', function (e) {
      if (self.isSpinning() || (e.pointerType === 'mouse' && e.button !== 0)) return;
      drag = { id: e.pointerId, a: angleOf(e), x: e.clientX, y: e.clientY, moved: false, total: 0, samples: [{ t: e.timeStamp, total: 0 }] };
    });
    c.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id || self.isSpinning()) return;
      var a = angleOf(e), d = a - drag.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      drag.a = a;
      drag.total += d;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.moved = true;
        self.dragging = true;
        try { c.setPointerCapture(e.pointerId); } catch (err) {}
        self.stopDemo();
        self.celebrateUntil = 0;
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
      var s0 = d.samples[0], s1 = d.samples[d.samples.length - 1];
      var dt = (s1.t - s0.t) / 1000;
      var v = dt > 0 && e.timeStamp - s1.t < 80 ? (s1.total - s0.total) / dt : 0;
      if (e.type === 'pointerup' && Math.abs(v) >= FLICK && self.hooks.onFlick) self.hooks.onFlick(v > 0 ? 1 : -1);
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  };
  // A click that ends a drag must not also start a spin.
  Wheel.prototype.justDragged = function () { return this.dragging || now() - this.dragEndAt < 350; };

  // ---------------------------------------------------------------- rendering
  Wheel.prototype.buildCache = function () {
    var self = this, cfg = this.cfg;
    var c = document.createElement('canvas');
    c.width = c.height = this.px;
    var g = c.getContext('2d');
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.translate(C, C);
    var hubR = this.hubR(), fam = this.family(), wt = this.weight();
    var isImageWheel = cfg.type === 'image';
    var pending = false;
    this.slices.forEach(function (s) {
      var e = s.entry;
      var img = e.image ? loadImage(e.image, self.redraw) : null;
      var imgReady = img && img.ready;
      if (img && !img.ready) pending = true;
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
        } else {
          g.fillStyle = textColorFor(s.color);
          if (g.fillStyle === '#ffffff') { g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 3; g.shadowOffsetY = 1; }
        }
        g.fillText(txt, R, 0);
      }
      g.restore();
    });
    // slice separators: a fine light line, or gold leaf when "contours" is on
    var n = this.slices.length;
    if (n > 1 && n <= 150) {
      g.save();
      g.lineCap = 'round';
      g.lineWidth = cfg.drawOutlines ? 2.6 : 1.2;
      g.strokeStyle = cfg.drawOutlines ? 'rgba(236,196,110,0.95)' : 'rgba(255,255,255,0.32)';
      g.beginPath();
      this.slices.forEach(function (s) {
        var a = s.center - s.half;
        g.moveTo(Math.cos(a) * hubR, Math.sin(a) * hubR);
        g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      });
      g.stroke();
      g.restore();
    }
    this.cache = c;
    this.cachePending = pending;
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

  Wheel.prototype.pointerColor = function () {
    var cfg = this.cfg;
    if (!cfg.pointerChangesColor || cfg.type === 'image' || this.slices.length > 80) return GEM;
    var s = this.sliceAtPointer();
    if (!s || s.entry.image) return GEM;
    return s.drawnColor || s.color;
  };

  // Gilded teardrop at 3 o'clock with a gem that takes the color of the slice below it.
  Wheel.prototype.drawPointer = function (g, celebrating) {
    var color = this.pointerColor();
    var cx = C + R + RIM / 2 + 4, cy = C, r = 21, tip = C + R - 26;
    var th = Math.acos(r / (cx - tip));
    g.save();
    g.beginPath();
    g.moveTo(tip, cy);
    g.arc(cx, cy, r, Math.PI - th, Math.PI + th, true);
    g.closePath();
    if (this.cfg.drawShadow !== false) {
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowOffsetY = 4 * this.scale;
      g.shadowBlur = 10 * this.scale;
    }
    g.fillStyle = gold(g, tip, cy - r, cx + r, cy + r);
    g.fill();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.lineJoin = 'round'; g.lineWidth = 1.5; g.strokeStyle = 'rgba(84,50,12,0.85)'; g.stroke();
    // gem
    if (celebrating) { g.shadowColor = color; g.shadowBlur = 18 * this.scale; }
    var gem = g.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 12);
    gem.addColorStop(0, adjust(color, 0.35)); gem.addColorStop(0.55, color); gem.addColorStop(1, adjust(color, -0.3));
    g.beginPath(); g.arc(cx, cy, 11.5, 0, TAU);
    g.fillStyle = gem; g.fill();
    g.shadowColor = 'transparent'; g.shadowBlur = 0;
    g.lineWidth = 2; g.strokeStyle = 'rgba(84,50,12,0.8)'; g.stroke();
    g.beginPath(); g.arc(cx - 4, cy - 4.5, 3, 0, TAU);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
    g.restore();
  };

  var BULB_OFF_IN = [168, 132, 78], BULB_OFF_OUT = [104, 70, 28], BULB_ON_IN = [255, 252, 232], BULB_ON_OUT = [255, 194, 64];
  function drawBulb(g, x, y, on) {
    g.beginPath(); g.arc(x, y, 7.2, 0, TAU);
    g.fillStyle = 'rgba(58,30,8,0.6)'; g.fill();
    if (on > 0.5) {
      var halo = g.createRadialGradient(x, y, 2, x, y, 17);
      halo.addColorStop(0, 'rgba(255,214,120,' + (0.6 * on).toFixed(3) + ')'); halo.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, 17, 0, TAU); g.fill();
    }
    var b = g.createRadialGradient(x - 1.6, y - 1.6, 0.4, x, y, 5.4);
    b.addColorStop(0, mix(BULB_OFF_IN, BULB_ON_IN, on)); b.addColorStop(1, mix(BULB_OFF_OUT, BULB_ON_OUT, on));
    g.beginPath(); g.arc(x, y, 5.2, 0, TAU);
    g.fillStyle = b; g.fill();
  }

  // Gilded rim with a ring of lights: they twinkle while idle, chase while spinning and flash for a winner.
  Wheel.prototype.drawRim = function (g, t, celebrating) {
    var out = R + RIM;
    g.beginPath(); g.arc(C, C, out, 0, TAU); g.arc(C, C, R, 0, TAU, true);
    g.fillStyle = gold(g, C - out, C - out, C + out, C + out);
    g.fill();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(70,40,10,0.6)';
    g.beginPath(); g.arc(C, C, R + 0.75, 0, TAU); g.stroke();
    g.beginPath(); g.arc(C, C, out - 0.75, 0, TAU); g.stroke();
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,240,200,0.5)';
    g.beginPath(); g.arc(C, C, out - 3, 0, TAU); g.stroke();
    var mid = R + RIM / 2, spinning = this.isSpinning(), step = Math.floor(t / 85);
    for (var i = 0; i < BULBS; i++) {
      var a = (i + 0.5) / BULBS * TAU;
      var on;
      if (celebrating) on = Math.floor(t / 170) % 2 ? 1 : 0.2;
      else if (spinning) { var k = mod(i - step * this.dir, 4); on = k === 0 ? 1 : k === 1 ? 0.55 : 0.12; }
      else if (this.phase === DEMO) on = 0.5 + 0.5 * Math.sin(t / 520 + i * 1.7);
      else on = i % 2 ? 0.4 : 0.95;
      drawBulb(g, C + Math.cos(a) * mid, C + Math.sin(a) * mid, on);
    }
  };

  // Eight-petal gold flower on the lacquered hub, turning with the wheel.
  Wheel.prototype.drawFlower = function (g, r) {
    g.save(); g.translate(C, C); g.rotate(this.angle);
    g.fillStyle = gold(g, -r, -r, r, r);
    g.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * TAU;
      g.moveTo(0, 0);
      g.quadraticCurveTo(Math.cos(a - 0.4) * r * 0.72, Math.sin(a - 0.4) * r * 0.72, Math.cos(a) * r, Math.sin(a) * r);
      g.quadraticCurveTo(Math.cos(a + 0.4) * r * 0.72, Math.sin(a + 0.4) * r * 0.72, 0, 0);
    }
    g.fill();
    g.beginPath(); g.arc(0, 0, r * 0.28, 0, TAU);
    g.fillStyle = '#B8301F'; g.fill();
    g.restore();
  };

  Wheel.prototype.drawHub = function (g, hubR) {
    var cfg = this.cfg;
    if (cfg.type === 'image' || hubR < 8) {
      // just a gilded pin
      g.beginPath(); g.arc(C, C, 15, 0, TAU);
      g.fillStyle = gold(g, C - 15, C - 15, C + 15, C + 15); g.fill();
      g.beginPath(); g.arc(C, C, 6, 0, TAU); g.fillStyle = '#B8301F'; g.fill();
      return;
    }
    var sh = g.createRadialGradient(C, C, hubR, C, C, hubR + 18);
    sh.addColorStop(0, 'rgba(0,0,0,0.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(C, C, hubR + 18, 0, TAU); g.fill();
    g.beginPath(); g.arc(C, C, hubR, 0, TAU);
    g.fillStyle = gold(g, C - hubR, C - hubR, C + hubR, C + hubR); g.fill();
    var inner = hubR - Math.max(3, Math.min(9, hubR * 0.12));
    var img = cfg.centerImage ? loadImage(cfg.centerImage, this.redraw) : null;
    if (img && img.ready) {
      g.save(); g.translate(C, C); g.rotate(this.angle);
      g.beginPath(); g.arc(0, 0, inner, 0, TAU); g.clip();
      g.fillStyle = '#FFFFFF'; g.fillRect(-inner, -inner, 2 * inner, 2 * inner);
      g.drawImage(img.img, -inner, -inner, 2 * inner, 2 * inner);
      g.restore();
    } else {
      var lq = g.createRadialGradient(C - inner * 0.35, C - inner * 0.4, 0, C, C, inner);
      lq.addColorStop(0, '#5E2C1D'); lq.addColorStop(0.6, '#2B140D'); lq.addColorStop(1, '#170A06');
      g.beginPath(); g.arc(C, C, inner, 0, TAU); g.fillStyle = lq; g.fill();
      if (inner > 14) this.drawFlower(g, inner * 0.64);
    }
    var gl = g.createRadialGradient(C - hubR * 0.35, C - hubR * 0.45, 0, C - hubR * 0.35, C - hubR * 0.45, hubR * 1.1);
    gl.addColorStop(0, 'rgba(255,255,255,0.32)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath(); g.arc(C, C, hubR, 0, TAU); g.fillStyle = gl; g.fill();
  };

  // After a stop: dim the other slices and outline the winner with a pulsing gold glow.
  Wheel.prototype.drawSpotlight = function (g, t) {
    var s = this.sliceAtPointer();
    if (!s || this.slices.length < 2) return;
    var a0 = s.center + this.angle - s.half, a1 = s.center + this.angle + s.half;
    var fade = Math.min(1, (t - this.celebrateFrom) / 350), pulse = 0.5 + 0.5 * Math.sin(t / 170);
    g.save();
    g.beginPath(); g.moveTo(C, C); g.arc(C, C, R, a1, a0 + TAU); g.closePath();
    g.fillStyle = 'rgba(12,6,3,' + (0.45 * fade).toFixed(3) + ')'; g.fill();
    g.beginPath(); g.moveTo(C, C); g.arc(C, C, R - 2.5, a0, a1); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 4 + 2 * pulse;
    g.strokeStyle = 'rgba(255,216,128,' + ((0.6 + 0.4 * pulse) * fade).toFixed(3) + ')';
    g.shadowColor = 'rgba(255,196,80,0.9)'; g.shadowBlur = 18 * this.scale;
    g.stroke();
    g.restore();
  };

  Wheel.prototype.draw = function () {
    var g = this.ctx, cfg = this.cfg, t = now();
    if (!this.cache) this.buildCache();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.px, this.px);
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    var disc = function () { g.beginPath(); g.arc(C, C, R, 0, TAU); };
    var hubR = this.hubR();
    // 1. soft drop shadow under the rim
    if (cfg.drawShadow !== false) {
      var sh = g.createRadialGradient(C, C + 7, R + RIM - 8, C, C + 7, R + RIM + 24);
      sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(C, C + 7, R + RIM + 24, 0, TAU); g.fill();
    }
    // 2. wheel background picture
    if (cfg.type === 'image' && cfg.coverImage) {
      var cov = loadImage(cfg.coverImage, this.redraw);
      if (cov && cov.ready) {
        g.save(); g.translate(C, C); g.rotate(this.angle);
        g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
        g.drawImage(cov.img, -R, -R, 2 * R, 2 * R);
        g.restore();
      }
    } else if (!this.slices.length) {
      g.fillStyle = 'rgba(128,128,128,0.25)'; disc(); g.fill();
    }
    // 3. slices (cached)
    g.save(); g.translate(C, C); g.rotate(this.angle);
    g.drawImage(this.cache, -C, -C, SIZE, SIZE);
    g.restore();
    // 4. depth: darker toward the rim, glossy light from the top left
    if (this.slices.length) {
      var edge = g.createRadialGradient(C, C, R * 0.7, C, C, R);
      edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.24)');
      g.fillStyle = edge; disc(); g.fill();
      var gl = g.createRadialGradient(C - R * 0.42, C - R * 0.5, 0, C - R * 0.42, C - R * 0.5, R * 1.05);
      gl.addColorStop(0, 'rgba(255,255,255,0.2)'); gl.addColorStop(0.55, 'rgba(255,255,255,0.04)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl; disc(); g.fill();
    }
    // 5. winner spotlight
    var celebrating = !this.isStatic && this.celebrateUntil > t;
    if (celebrating) this.drawSpotlight(g, t);
    // 6. brushed-gold plate hides where names are swapped in
    if (this.truncated() && this.visible.length) {
      var span = Math.max(4 * Math.PI / this.visible.length, Math.PI / 4);
      g.save();
      g.beginPath(); g.arc(C, C, (R + hubR) / 2, Math.PI - span / 2, Math.PI + span / 2);
      g.lineWidth = R - hubR + 10;
      g.strokeStyle = g.createPattern(getPlateTile(), 'repeat');
      g.shadowColor = 'rgba(40,20,5,0.6)'; g.shadowOffsetY = 4 * this.scale; g.shadowBlur = 10 * this.scale;
      g.stroke();
      g.restore();
    }
    // 7. rim with lights, 8. hub, 9. pointer
    this.drawRim(g, t, celebrating);
    this.drawHub(g, hubR);
    this.drawPointer(g, celebrating);
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
