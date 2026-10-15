/* Shared UI helpers: DOM shortcuts, toasts, dialogs, menus, image processing, procedural pictures. */
(function () {
  'use strict';

  var t = window.I18N.t;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function debounce(fn, ms) {
    var tm;
    return function () { var a = arguments; clearTimeout(tm); tm = setTimeout(function () { fn.apply(null, a); }, ms); };
  }
  // 10-character ids from the same alphabet as the original (no look-alike characters).
  var ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
  function entryId() {
    var s = '';
    for (var i = 0; i < 10; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
    return s;
  }
  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function isMobile() { return window.matchMedia('(max-width: 599px)').matches; }

  // ---------------------------------------------------------------- toasts (bottom on desktop, top on mobile)
  var toastBox = null;
  function toast(msg, o) {
    o = o || {};
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      if ('popover' in HTMLElement.prototype) toastBox.setAttribute('popover', 'manual');
      document.body.appendChild(toastBox);
    }
    // Re-open the popover so toasts stay above any modal dialog opened since.
    if (toastBox.showPopover) { try { if (toastBox.matches(':popover-open')) toastBox.hidePopover(); toastBox.showPopover(); } catch (e) {} }
    toastBox.classList.toggle('top', isMobile() || !!o.top);
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="toast-msg"></span>';
    $('.toast-msg', el).textContent = msg;
    (o.actions || (o.action ? [{ label: o.action, onClick: o.onAction, primary: true }] : [])).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act' + (a.primary ? ' is-primary' : '');
      b.textContent = a.label;
      b.addEventListener('click', function () { if (a.onClick) a.onClick(); h.close(); });
      el.appendChild(b);
    });
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'toast-x'; x.setAttribute('aria-label', t('Đóng'));
    x.innerHTML = '<i class="fas fa-times"></i>';
    x.addEventListener('click', function () { h.close(); });
    el.appendChild(x);
    toastBox.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    var timer = null;
    var h = {
      el: el,
      set: function (m) { $('.toast-msg', el).textContent = m; },
      close: function () {
        clearTimeout(timer);
        el.classList.remove('show');
        setTimeout(function () { el.remove(); }, 250);
        if (o.onClose) o.onClose();
      }
    };
    if (!o.persistent) timer = setTimeout(h.close, o.timeout || (o.action || o.actions ? 7000 : 3500));
    return h;
  }

  // ---------------------------------------------------------------- dialogs
  function openDialog(dlg) {
    if (typeof dlg === 'string') dlg = document.getElementById(dlg);
    if (!dlg.open) {
      dlg.showModal();
      // like Quasar: focus the dialog itself unless something inside asks for autofocus
      if (!dlg.querySelector('[autofocus]')) { dlg.tabIndex = -1; dlg.focus({ preventScroll: true }); }
    }
    return dlg;
  }
  function closeDialog(dlg, value) {
    if (typeof dlg === 'string') dlg = document.getElementById(dlg);
    if (dlg.open) dlg.close(value || '');
  }
  function anyDialogOpen() { return !!document.querySelector('dialog[open]'); }

  // Backdrop click and [data-close] buttons close any dialog.
  document.addEventListener('click', function (e) {
    var dlg = e.target.closest && e.target.closest('dialog');
    if (!dlg) return;
    if (e.target === dlg) {
      var r = dlg.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside && !dlg.hasAttribute('data-sticky')) dlg.close('backdrop');
    }
    var c = e.target.closest('[data-close]');
    if (c && dlg.contains(c)) dlg.close(c.getAttribute('data-close') || 'close');
  });

  // Confirm / yes-no built on #dlgConfirm. Resolves true for OK.
  function confirmBox(text, o) {
    o = o || {};
    var dlg = $('#dlgConfirm');
    $('#confirmTitle').textContent = o.title || t('Xác nhận');
    $('#confirmText').textContent = text;
    $('#confirmIcon').className = o.icon || 'fas fa-question-circle confirm-icon';
    $('#btnConfirmOk').textContent = o.ok || t('Đồng ý');
    $('#btnConfirmCancel').textContent = o.cancel || t('Hủy');
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (done) return; done = true; dlg.removeEventListener('close', onClose); resolve(v); }
      function onClose() { finish(dlg.returnValue === 'ok'); }
      dlg.addEventListener('close', onClose);
      $('#btnConfirmOk').onclick = function () { dlg.close('ok'); };
      openDialog(dlg);
      setTimeout(function () { $('#btnConfirmOk').focus(); }, 50);
    });
  }

  // ---------------------------------------------------------------- menus
  var openMenu = null;
  function toggleMenu(menu, anchor) {
    if (typeof menu === 'string') menu = document.getElementById(menu);
    if (openMenu && openMenu !== menu) closeMenus();
    var show = menu.hidden;
    menu.hidden = !show;
    if (anchor) anchor.setAttribute('aria-expanded', String(show));
    openMenu = show ? menu : null;
    if (show) {
      menu.classList.remove('flip-up');
      var r = menu.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8 && r.top > r.height + 40) menu.classList.add('flip-up');
      var first = menu.querySelector('.menu-item:not([disabled])');
      if (first) first.focus({ preventScroll: true });
    }
  }
  function closeMenus() {
    $$('.menu').forEach(function (m) { m.hidden = true; });
    $$('[aria-haspopup="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    openMenu = null;
  }
  document.addEventListener('click', function (e) {
    if (!openMenu) return;
    if (e.target.closest('.menu-anchor') && openMenu.closest('.menu-anchor') === e.target.closest('.menu-anchor') && !e.target.closest('.menu-item')) return;
    closeMenus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openMenu) { e.preventDefault(); closeMenus(); return; }
    if (!openMenu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    var items = $$('.menu-item:not([disabled])', openMenu);
    var i = items.indexOf(document.activeElement);
    i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
    if (items[i]) { e.preventDefault(); items[i].focus(); }
  });

  // Range inputs show their filled part through --fill.
  function syncRange(el) {
    var min = +el.min || 0, max = +el.max || 100;
    el.style.setProperty('--fill', ((+el.value - min) / (max - min) * 100) + '%');
  }
  document.addEventListener('input', function (e) { if (e.target.type === 'range') syncRange(e.target); });

  // ---------------------------------------------------------------- images
  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(fr.error); };
      fr.onload = function () { resolve(fr.result); };
      fr.readAsDataURL(file);
    });
  }
  function loadImg(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }
  function cornerTransparent(img) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 1;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, img.naturalWidth, img.naturalHeight);
      return g.getImageData(0, 0, 1, 1).data[3] < 255;
    } catch (e) { return false; }
  }
  function encode(canvas, transparent, original) {
    var out = transparent ? canvas.toDataURL('image/webp', 0.5) : canvas.toDataURL('image/jpeg', 0.5);
    if (transparent && out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/png');
    return original && original.length < out.length ? original : out;
  }
  // Entry images: shorter side 200 px, JPEG q .5 (WEBP when the corner is transparent). GIFs are kept.
  async function processEntryImage(file) {
    var src = await readFileAsDataURL(file);
    if (/gif/.test(file.type)) return src;
    var img = await loadImg(src);
    var k = Math.min(1, 200 / Math.min(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return encode(c, cornerTransparent(img), src);
  }
  // Center image: 370×370, contained; a blurred stretched copy fills the gaps for non-white transparent images.
  async function processCenterImage(file) {
    var src = await readFileAsDataURL(file);
    var img = await loadImg(src);
    var S = 370, c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    var transparent = cornerTransparent(img);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    if (!transparent) { g.filter = 'blur(4px)'; g.drawImage(img, -8, -8, S + 16, S + 16); g.filter = 'none'; }
    var k = Math.min(S / img.naturalWidth, S / img.naturalHeight);
    var w = img.naturalWidth * k, h = img.naturalHeight * k;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    return { data: encode(c, false), img: img };
  }
  // Wheel background picture: 700×700 "cover" crop.
  async function processCoverImage(file) {
    var src = await readFileAsDataURL(file);
    var img = await loadImg(src);
    var S = 700, c = document.createElement('canvas');
    c.width = c.height = S;
    var k = Math.max(S / img.naturalWidth, S / img.naturalHeight);
    var w = img.naturalWidth * k, h = img.naturalHeight * k;
    c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    return { data: encode(c, false), img: img };
  }
  // Center text rendered as a 300×300 white image, font stepped down until it fits 270 px.
  function centerTextImage(text, family) {
    var c = document.createElement('canvas');
    c.width = c.height = 300;
    var g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 300, 300);
    g.fillStyle = '#000000'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var f = 135;
    for (; f > 13.5; f--) { g.font = f + 'px ' + family; if (g.measureText(text).width <= 270) break; }
    g.font = f + 'px ' + family;
    g.fillText(text, 150, 150);
    return c.toDataURL('image/webp', 0.5).indexOf('data:image/webp') === 0 ? c.toDataURL('image/webp', 0.5) : c.toDataURL('image/png');
  }
  // Up to `n` prominent, distinct colors from an image.
  function prominentColors(img, n) {
    var c = document.createElement('canvas');
    var k = 64 / Math.max(img.naturalWidth, img.naturalHeight);
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    var d;
    try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return []; }
    var buckets = new Map();
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      var r = d[i], gg = d[i + 1], b = d[i + 2];
      var max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      if (max > 245 && min > 235) continue; // near white background
      var key = (r >> 4) << 8 | (gg >> 4) << 4 | (b >> 4);
      var v = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      v.n++; v.r += r; v.g += gg; v.b += b; v.sat += max - min;
      buckets.set(key, v);
    }
    var list = Array.from(buckets.values()).map(function (v) {
      return { n: v.n, rgb: [v.r / v.n, v.g / v.n, v.b / v.n], score: v.n * (0.4 + v.sat / v.n / 255) };
    }).sort(function (a, b) { return b.score - a.score; });
    var out = [];
    list.forEach(function (v) {
      if (out.length >= n) return;
      var far = out.every(function (o) { var dr = o[0] - v.rgb[0], dg = o[1] - v.rgb[1], db = o[2] - v.rgb[2]; return dr * dr + dg * dg + db * db > 2600; });
      if (far) out.push(v.rgb);
    });
    return out.map(function (rgb) { return '#' + rgb.map(function (x) { return Math.round(x).toString(16).padStart(2, '0'); }).join('').toUpperCase(); });
  }

  // ---------------------------------------------------------------- procedural wheel pictures
  var pictureCache = new Map();
  function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var PAINTERS = {
    cookie: function (g, S, r) {
      var grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, '#e6ae6a'); grad.addColorStop(0.75, '#cf8f4c'); grad.addColorStop(1, '#a8672f');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      for (var i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '255,230,180' : '120,70,30') + ',' + (r() * 0.25) + ')'; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
      for (var k = 0; k < 38; k++) {
        var x = r() * S, y = r() * S, rr = S * (0.025 + r() * 0.035);
        g.fillStyle = '#4a2814'; g.beginPath();
        for (var a = 0; a < 7; a++) { var ang = a / 7 * Math.PI * 2, q = rr * (0.7 + r() * 0.5); g.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q); }
        g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.3, 0, 7); g.fill();
      }
    },
    rainbow: function (g, S) {
      var cg = g.createConicGradient ? g.createConicGradient(0, S / 2, S / 2) : null;
      if (cg) { ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#5856d6', '#af52de', '#ff3b30'].forEach(function (c, i, a) { cg.addColorStop(i / (a.length - 1), c); }); g.fillStyle = cg; }
      else g.fillStyle = '#ff9500';
      g.fillRect(0, 0, S, S);
      var w = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      w.addColorStop(0, 'rgba(255,255,255,.85)'); w.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.fillStyle = w; g.fillRect(0, 0, S, S);
    },
    'night-sky': function (g, S, r) {
      var grad = g.createRadialGradient(S * 0.35, S * 0.3, 0, S / 2, S / 2, S * 0.75);
      grad.addColorStop(0, '#26306b'); grad.addColorStop(0.6, '#0d1233'); grad.addColorStop(1, '#04050f');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      for (var i = 0; i < 700; i++) { var s = r() * 1.8 + 0.3; g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')'; g.beginPath(); g.arc(r() * S, r() * S, s, 0, 7); g.fill(); }
      var neb = g.createRadialGradient(S * 0.65, S * 0.6, 0, S * 0.65, S * 0.6, S * 0.3);
      neb.addColorStop(0, 'rgba(180,90,220,.35)'); neb.addColorStop(1, 'rgba(180,90,220,0)');
      g.fillStyle = neb; g.fillRect(0, 0, S, S);
    },
    wood: function (g, S, r) {
      g.fillStyle = '#b07a45'; g.fillRect(0, 0, S, S);
      for (var y = 0; y < S; y += 2) {
        var v = Math.sin(y / 18 + Math.sin(y / 70) * 3) * 0.5 + 0.5;
        g.fillStyle = 'rgba(' + (v > 0.5 ? '90,50,20' : '230,180,120') + ',' + (Math.abs(v - 0.5) * 0.35 + r() * 0.05) + ')';
        g.fillRect(0, y, S, 2);
      }
      for (var k = 0; k < 4; k++) { var x = r() * S, yy = r() * S; var kn = g.createRadialGradient(x, yy, 0, x, yy, 26); kn.addColorStop(0, 'rgba(70,35,10,.6)'); kn.addColorStop(1, 'rgba(70,35,10,0)'); g.fillStyle = kn; g.fillRect(x - 30, yy - 30, 60, 60); }
    },
    marble: function (g, S, r) {
      g.fillStyle = '#f2f1ee'; g.fillRect(0, 0, S, S);
      g.lineCap = 'round';
      for (var i = 0; i < 26; i++) {
        g.strokeStyle = 'rgba(' + (r() < 0.3 ? '190,160,110' : '110,110,120') + ',' + (0.12 + r() * 0.25) + ')';
        g.lineWidth = 0.6 + r() * 2.2;
        g.beginPath();
        var x = r() * S, y = 0;
        g.moveTo(x, y);
        while (y < S) { x += (r() - 0.5) * 60; y += 20 + r() * 30; g.lineTo(x, y); }
        g.stroke();
      }
    },
    citrus: function (g, S) {
      g.fillStyle = '#ff9a1f'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, 7); g.fill();
      for (var i = 0; i < 12; i++) {
        g.save(); g.translate(S / 2, S / 2); g.rotate(i / 12 * Math.PI * 2);
        var seg = g.createRadialGradient(0, 0, S * 0.04, 0, 0, S * 0.44);
        seg.addColorStop(0, '#ffd27a'); seg.addColorStop(1, '#ff9f1c');
        g.fillStyle = seg;
        g.beginPath(); g.moveTo(S * 0.03, 0); g.arc(0, 0, S * 0.43, -0.22, 0.22); g.closePath(); g.fill();
        g.restore();
      }
    },
    pool: function (g, S, r) {
      var grad = g.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, '#1ec8e8'); grad.addColorStop(1, '#0a7fc2');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(255,255,255,.35)';
      for (var i = 0; i < 60; i++) {
        g.lineWidth = 1 + r() * 3;
        g.beginPath();
        var x = r() * S, y = r() * S;
        g.moveTo(x, y);
        g.bezierCurveTo(x + 40 * r(), y - 30 * r(), x + 80 * r(), y + 30 * r(), x + 120 * r(), y);
        g.stroke();
      }
    },
    candy: function (g, S) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      g.save(); g.translate(S / 2, S / 2);
      for (var i = 0; i < 16; i++) {
        g.fillStyle = ['#ff4f7b', '#ffffff', '#4fc3f7', '#ffffff'][i % 4];
        g.beginPath(); g.moveTo(0, 0);
        for (var t2 = 0; t2 <= 1.001; t2 += 0.05) { var a = (i + t2) / 16 * Math.PI * 2 + t2 * 1.2, rr = t2 * S * 0.75; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        for (var t3 = 1; t3 >= 0; t3 -= 0.05) { var a2 = (i + 1) / 16 * Math.PI * 2 + t3 * 1.2, r2 = t3 * S * 0.75; g.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2); }
        g.fill();
      }
      g.restore();
    }
  };
  // Data URL of a built-in picture at `size` px (cached).
  function picture(id, size) {
    size = size || 700;
    var key = id + '@' + size;
    if (pictureCache.has(key)) return pictureCache.get(key);
    var painter = PAINTERS[id] || PAINTERS.cookie;
    var c = document.createElement('canvas');
    c.width = c.height = 700;
    var g = c.getContext('2d');
    painter(g, 700, seeded(id.length * 7919 + 17));
    var out = c;
    if (size !== 700) { out = document.createElement('canvas'); out.width = out.height = size; out.getContext('2d').drawImage(c, 0, 0, size, size); }
    var url = out.toDataURL('image/jpeg', 0.85);
    pictureCache.set(key, url);
    return url;
  }

  window.UI = {
    $: $, $$: $$, esc: esc, clone: clone, debounce: debounce, entryId: entryId, download: download, isMobile: isMobile,
    toast: toast, openDialog: openDialog, closeDialog: closeDialog, anyDialogOpen: anyDialogOpen, confirm: confirmBox,
    toggleMenu: toggleMenu, closeMenus: closeMenus, syncRange: syncRange,
    readFileAsDataURL: readFileAsDataURL, loadImg: loadImg,
    processEntryImage: processEntryImage, processCenterImage: processCenterImage, processCoverImage: processCoverImage,
    centerTextImage: centerTextImage, prominentColors: prominentColors, picture: picture
  };
})();
