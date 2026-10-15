/* App core: state, persistence, layout, wheels, spin flow, winner dialog, results, toolbar, boot. */
(function () {
  'use strict';

  var D = window.DATA, U = window.UI, I18N = window.I18N, t = I18N.t;
  var $ = U.$, $$ = U.$$;
  var HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  var App = window.App = {
    group: null,          // { wheelConfigs: [], shareMode, title, description }
    winners: [],          // results tab (memory only, like the original)
    tab: 'entries-0',     // 'entries-<i>' | 'results'
    busy: new Set(),      // wheel indexes that are spinning
    editorHidden: false,
    fullscreen: false,
    shared: null,         // { mode } when opened from a share link
    prefs: null,
    wheels: [],
    overlayHidden: [],
    undo: null
  };

  // ---------------------------------------------------------------- preferences
  var PREF_DEFAULTS = { appTheme: 'system', showWheelOverlay: true, showLanguageTip: true, wheelLocation: null, newWheelTheme: '', lang: null };
  App.prefs = Object.assign({}, PREF_DEFAULTS, Store.loadOptions());
  App.savePrefs = function () { Store.saveOptions(App.prefs); };

  // ---------------------------------------------------------------- normalizing configs (accepts original .wheel files too)
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hex6(c) {
    var m = HEX.exec(String(c || '').trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return '#' + h.slice(0, 6).toUpperCase();
  }
  App.hex6 = hex6;

  function normalizeEntry(e) {
    if (typeof e === 'string' || typeof e === 'number') e = { text: String(e) };
    if (!e || typeof e !== 'object') return null;
    var text = e.text == null ? '' : String(e.text).replace('\n', '').replace('\r', '');
    var out = { id: typeof e.id === 'string' && e.id ? e.id : U.entryId(), text: text.slice(0, 1000) };
    if (typeof e.image === 'string' && e.image) out.image = e.image;
    var c = hex6(e.color);
    if (c) out.color = c;
    if (e.weight != null && +e.weight > 0) out.weight = Math.min(9999, +e.weight);
    if ('enabled' in e) out.enabled = e.enabled !== false;
    if (typeof e.sound === 'string' && e.sound) out.sound = e.sound;
    if (typeof e.message === 'string' && e.message) out.message = e.message.slice(0, 100);
    if (!out.text && !out.image && !('enabled' in e)) return null;
    return out;
  }
  App.normalizeEntry = normalizeEntry;

  function normalizeConfig(c) {
    var d = D.defaultConfig();
    if (!c || typeof c !== 'object') return d;
    var out = d;
    Object.keys(d).forEach(function (k) {
      if (c[k] !== undefined && c[k] !== null && typeof c[k] === typeof d[k]) out[k] = c[k];
    });
    var src = Array.isArray(c.entries) ? c.entries : Array.isArray(c.names) ? c.names : null;
    if (src) out.entries = src.map(normalizeEntry).filter(Boolean);
    if (c.playTicks === false) out.duringSpinSound = 'no-sound';
    if (c.playCheers === false) out.afterSpinSound = 'no-sound';
    out.spinTime = clamp(Math.round(Number(c.spinTime)) || d.spinTime, 1, 60);
    out.maxNames = clamp(Math.round(Number(c.maxNames)) || 1000, 4, 1000);
    out.duringSpinSoundVolume = clamp(Number(out.duringSpinSoundVolume) || 0, 0, 100);
    out.afterSpinSoundVolume = clamp(Number(out.afterSpinSoundVolume) || 0, 0, 100);
    if (c.showTitle === undefined) out.showTitle = true;
    if (c.drawShadow === undefined) out.drawShadow = true;
    if (Array.isArray(c.colorSettings) && c.colorSettings.length) {
      var cs = c.colorSettings.map(function (x) { return { color: hex6(x && x.color) || '#000000', enabled: !!(x && x.enabled) }; }).slice(0, D.PALETTE_SLOTS);
      while (cs.length < D.PALETTE_SLOTS) cs.push({ color: '#000000', enabled: false });
      out.colorSettings = cs;
    }
    if (!D.HUB_SIZES[out.hubSize]) out.hubSize = 'S';
    if (out.type !== 'image') out.type = 'color';
    if (['never', 'always', 'on-image'].indexOf(out.hideEntryText) < 0) out.hideEntryText = 'never';
    out.pageBackgroundColor = hex6(out.pageBackgroundColor) || '#FFFFFF';
    // Sounds that only exist as audio files on the original site fall back to our synthesized ones.
    if (!Sound.has(out.duringSpinSound)) out.duringSpinSound = 'random-music'; // the original's music tracks
    if (!Sound.has(out.afterSpinSound)) out.afterSpinSound = 'applause-sound-soft';
    out.title = out.title.slice(0, 100);
    out.winnerMessage = out.winnerMessage.slice(0, 100);
    return out;
  }
  App.normalizeConfig = normalizeConfig;

  // Accepts {wheelConfigs}, legacy {wheels:[{wheelConfig}]}, {wheelConfig} or a bare config.
  function normalizeGroup(g) {
    if (!g || typeof g !== 'object') return null;
    var configs = null;
    if (Array.isArray(g.wheelConfigs)) configs = g.wheelConfigs;
    else if (Array.isArray(g.wheels)) configs = g.wheels.map(function (w) { return w && (w.wheelConfig || w); });
    else if (g.wheelConfig) configs = [g.wheelConfig];
    else if (Array.isArray(g.entries) || Array.isArray(g.names)) configs = [g];
    if (!configs || !configs.length) return null;
    return {
      wheelConfigs: configs.slice(0, D.MAX_WHEELS).map(normalizeConfig),
      shareMode: typeof g.shareMode === 'string' ? g.shareMode : 'private',
      title: typeof g.title === 'string' ? g.title : '',
      description: typeof g.description === 'string' ? g.description : ''
    };
  }
  App.normalizeGroup = normalizeGroup;

  function themeColors(name) {
    for (var i = 0; i < D.THEMES.length; i++) {
      var hit = D.THEMES[i].themes.find(function (x) { return x[0] === name; });
      if (hit) return hit[1];
    }
    return null;
  }
  App.themeColors = themeColors;

  App.defaultConfig = function () {
    var c = D.defaultConfig();
    var colors = App.prefs.newWheelTheme && themeColors(App.prefs.newWheelTheme);
    if (colors) c.colorSettings = D.colorSettingsFrom(colors);
    c.entries.forEach(function (e) { e.id = U.entryId(); });
    return c;
  };
  App.defaultGroup = function () { return { wheelConfigs: [App.defaultConfig()], shareMode: 'private', title: '', description: '' }; };

  App.cfg = function (i) { return App.group.wheelConfigs[i]; };
  App.isMulti = function () { return App.group.wheelConfigs.length > 1; };
  App.isBusy = function () { return App.busy.size > 0; };
  App.activeIndex = function () {
    var m = /^entries-(\d+)$/.exec(App.tab);
    var i = m ? +m[1] : App.lastEntriesIndex || 0;
    return Math.min(i, App.group.wheelConfigs.length - 1);
  };
  App.palette = function (cfg) {
    var p = cfg.colorSettings.filter(function (c) { return c.enabled; }).map(function (c) { return c.color; });
    return p.length ? p : [D.NO_COLOR];
  };

  // ---------------------------------------------------------------- persistence
  var storageWarned = false;
  App.persist = U.debounce(function () {
    if (App.shared) return;
    if (!Store.saveCurrent(App.group) && !storageWarned) {
      storageWarned = true;
      U.toast(t('Bộ nhớ trình duyệt đã đầy nên bánh xe không được tự động lưu. Hãy bớt hình ảnh hoặc lưu thành tệp.'), { timeout: 8000 });
    }
  }, 300);

  // ---------------------------------------------------------------- images on the wheel
  App.coverSrc = function (cfg) {
    if (cfg.type !== 'image') return null;
    if (cfg.coverImageType === 'uploaded' && cfg.customCoverImageDataUri) return cfg.customCoverImageDataUri;
    var id = D.COVER_PICTURES.some(function (p) { return p[0] === cfg.coverImageName; }) ? cfg.coverImageName : 'cookie';
    return U.picture(id);
  };
  App.centerSrc = function (cfg) {
    if ((cfg.pictureType === 'uploaded' || cfg.pictureType === 'text') && cfg.customPictureDataUri) return cfg.customPictureDataUri;
    if (cfg.pictureType === 'gallery' && /^(https?:|data:)/.test(cfg.galleryPicture)) return cfg.galleryPicture;
    return null;
  };
  App.wheelOptions = function (cfg) {
    return {
      entries: cfg.entries, colors: App.palette(cfg), isAdvanced: cfg.isAdvanced, allowDuplicates: cfg.allowDuplicates,
      maxNames: cfg.maxNames, spinTime: cfg.spinTime, slowSpin: cfg.slowSpin, type: cfg.type, hubSize: cfg.hubSize,
      drawOutlines: cfg.drawOutlines, drawShadow: cfg.drawShadow, pointerChangesColor: cfg.pointerChangesColor,
      hideEntryText: cfg.hideEntryText, font: cfg.font, coverImage: App.coverSrc(cfg), centerImage: App.centerSrc(cfg)
    };
  };

  // ---------------------------------------------------------------- theme & page background
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  App.applyTheme = function () {
    var p = App.prefs.appTheme;
    document.documentElement.dataset.theme = p === 'system' ? (darkQuery.matches ? 'dark' : 'light') : p;
  };
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', function () { if (App.prefs.appTheme === 'system') App.applyTheme(); });

  function rgba(hex, a) {
    var h = hex6(hex) || '#CCCCCC';
    var n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  App.applyPageBackground = function () {
    var cfg = App.cfg(0), page = $('#page');
    var bg = (cfg.pageBackgroundColor || '#FFFFFF').toUpperCase();
    page.style.setProperty('--page-bg-color', bg === '#FFFFFF' ? 'transparent' : bg);
    var pal = App.palette(cfg);
    var c1 = pal[0], c2 = pal.length > cfg.entries.length && cfg.entries.length ? pal[cfg.entries.length - 1] : pal[pal.length - 1];
    if (pal.join() === '#3369E8,#D50F25,#EEB211,#009925') { c1 = '#3369E8'; c2 = '#D50F25'; }
    page.style.setProperty('--grad-a', rgba(c1, 0.3));
    page.style.setProperty('--grad-b', rgba(c2, 0.3));
    page.classList.toggle('no-gradient', !cfg.pageGradient);
  };

  // ---------------------------------------------------------------- layout
  App.layout = function () {
    var W = document.documentElement.clientWidth, H = window.innerHeight;
    var landscape = W >= 900 && H >= 450 && W >= H;
    var configs = App.group.wheelConfigs, n = configs.length, multi = n > 1;
    var body = document.body;
    body.classList.toggle('landscape', landscape);
    body.classList.toggle('portrait', !landscape);
    body.classList.toggle('multi', multi);
    body.classList.toggle('editor-hidden', App.editorHidden && landscape);
    body.classList.toggle('is-fullscreen', App.fullscreen);
    var showLeft = !!App.shared || (!multi && !(App.editorHidden && landscape) && !App.fullscreen && App.cfg(0).showTitle);
    body.classList.toggle('has-left', showLeft);
    var headerH = App.shared ? 0 : 50;
    var cols, colW, availH;
    if (landscape) {
      var unit = (W - 32) / 4;
      var span = App.shared ? 2 : App.fullscreen || App.editorHidden ? 4 : multi ? 3 : 2;
      colW = unit * span;
      availH = H - headerH - 32;
      cols = n <= 3 ? n : Math.ceil(n / 2);
    } else {
      colW = W - 32;
      availH = Math.max(260, H - headerH - 32 - (showLeft ? 60 : 0));
      cols = Math.min(n, 2);
    }
    var rows = Math.ceil(n / cols);
    var titleH = multi && configs.some(function (c) { return c.showTitle && c.title; }) ? 36 : 0;
    var gap = multi ? 12 : 0;
    var size = Math.floor(Math.min((colW - gap * (cols - 1)) / cols, (availH - rows * titleH - gap * (rows - 1)) / rows));
    if (!landscape && !multi) size = Math.floor(Math.min(colW, availH * 0.92));
    size = Math.max(110, size);
    var center = $('#centerCol');
    center.style.setProperty('--wheel-size', size + 'px');
    center.style.setProperty('--wheel-cols', cols);
  };

  // ---------------------------------------------------------------- wheels on the page
  function overlaySvg(i) {
    return '<svg class="wheel-overlay" viewBox="-100 -100 200 200" aria-hidden="true">' +
      '<defs><path id="ovTop' + i + '" d="M -52 0 A 1 1 0 0 1 52 0"/><path id="ovBot' + i + '" d="M -60 0 A 1 1 0 0 0 60 0"/></defs>' +
      '<text><textPath href="#ovTop' + i + '" startOffset="50%" text-anchor="middle"><tspan class="ov-click">' + U.esc(t('Nhấp để quay')) + '</tspan><tspan class="ov-tap">' + U.esc(t('Nhấn để quay')) + '</tspan></textPath></text>' +
      '<text><textPath href="#ovBot' + i + '" startOffset="50%" text-anchor="middle">' + U.esc(t('hoặc nhấn Ctrl+Enter')) + '</textPath></text></svg>';
  }

  App.renderWheels = function () {
    var center = $('#centerCol');
    var configs = App.group.wheelConfigs;
    if (App.wheels.length !== configs.length) {
      App.wheels.forEach(function (w) { w.destroy(); });
      center.innerHTML = '';
      App.wheels = configs.map(function (cfg, i) {
        var box = document.createElement('div');
        box.className = 'wheel-container';
        box.innerHTML = '<div class="wheel-title-sm"></div><div class="wheel-wrap"><canvas role="button" tabindex="0"></canvas>' + overlaySvg(i) + '</div>';
        center.appendChild(box);
        var canvas = $('canvas', box);
        var w = new Wheel(canvas, {
          onSpinStart: function () { spinStarted(i); },
          onIndexChange: function () { onIndexChange(i); },
          onStop: function (entry, slice) { spinStopped(i, entry, slice); }
        });
        canvas.addEventListener('click', function () { App.spinWheel(i); });
        canvas.addEventListener('keydown', function (e) {
          if ((e.key === 'Enter' || e.key === ' ') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); App.spinWheel(i); }
        });
        w.box = box;
        return w;
      });
    }
    configs.forEach(function (cfg, i) { App.refreshWheel(i); });
    App.layout();
  };

  App.refreshWheel = function (i) {
    var w = App.wheels[i], cfg = App.cfg(i);
    if (!w) return;
    w.configure(App.wheelOptions(cfg));
    var multi = App.isMulti();
    var title = $('.wheel-title-sm', w.box);
    title.textContent = cfg.title || '';
    title.hidden = !(multi && cfg.showTitle && cfg.title);
    $('canvas', w.box).setAttribute('aria-label', t('Bánh xe') + (multi ? ' ' + (i + 1) : '') + (cfg.title ? ': ' + cfg.title : ''));
    $('.wheel-overlay', w.box).classList.toggle('is-hidden', !App.prefs.showWheelOverlay || !!App.overlayHidden[i] || !cfg.entries.length);
    if (i === 0) { App.applyPageBackground(); App.renderTitle(); }
  };

  App.renderTitle = function () {
    var cfg = App.cfg(0);
    var block = $('#titleBlock');
    block.hidden = !cfg.showTitle || App.isMulti() || !!App.shared;
    $('#wheelTitle').textContent = cfg.title;
    $('#wheelDesc').textContent = cfg.description;
    $('#wheelTitle').hidden = !cfg.title;
    $('#wheelDesc').hidden = !cfg.description;
    document.title = (cfg.title ? cfg.title + ' | ' : '') + t('Vòng Quay Tên') + ' | ' + t('Công cụ chọn tên ngẫu nhiên');
  };

  // ---------------------------------------------------------------- spinning
  var round = null; // { first, queue, music }

  App.spinWheel = function (i) {
    var w = App.wheels[i], cfg = App.cfg(i);
    if (!w || !cfg || U.anyDialogOpen()) return;
    if (!cfg.entries.length) return;
    Sound.unlock();
    w.spin();
  };
  App.spinAll = function () {
    if (U.anyDialogOpen()) return;
    App.wheels.forEach(function (w, i) { setTimeout(function () { App.spinWheel(i); }, i * 100); });
  };

  function spinStarted(i) {
    if (!round) {
      round = { first: i, queue: [] };
      var cfg = App.cfg(i);
      if (Sound.isLoop(cfg.duringSpinSound)) round.music = Sound.startLoop(cfg.duringSpinSound, cfg.duringSpinSoundVolume);
    }
    App.busy.add(i);
    Confetti.stop();
    App.overlayHidden[i] = true;
    $('.wheel-overlay', App.wheels[i].box).classList.add('is-hidden');
    App.wheels[i].box.classList.add('is-busy');
    App.renderBusy();
  }

  function onIndexChange(i) {
    if (!round || round.first !== i || !App.busy.has(i)) return;
    var cfg = App.cfg(i);
    if (cfg.duringSpinSound === 'ticking-sound') Sound.tick(cfg.duringSpinSoundVolume);
  }

  function spinStopped(i, entry, slice) {
    var cfg = App.cfg(i);
    App.busy.delete(i);
    App.wheels[i].box.classList.remove('is-busy');
    if (!entry || !round) { App.renderBusy(); return; }
    var copy = U.clone(entry);
    App.winners.push(copy);
    round.queue.push({ entry: copy, wheelIndex: i, color: slice ? slice.drawnColor || slice.color : '#CCCCCC', message: entry.message || cfg.winnerMessage });
    if (cfg.autoRemoveWinner) startAutoRemove(i, copy);
    if (!App.busy.size) finishRound();
    App.renderBusy();
    App.renderResults();
  }

  function finishRound() {
    var r = round;
    round = null;
    var lead = App.cfg(r.first);
    if (r.music) r.music.stop(1000);
    var last = r.queue[r.queue.length - 1];
    var sound = (last && last.entry.sound) || lead.afterSpinSound;
    Sound.play(sound, lead.afterSpinSoundVolume, r.queue.map(function (q) { return q.entry.text; }).join(', '), I18N.lang);
    if (lead.displayWinnerDialog) showWinnerDialog(r.queue, r.first);
    if (lead.animateWinner && r.queue[0]) animateWinner(r.queue[0].entry.text);
    if (lead.launchConfetti) Confetti.launch(App.palette(lead));
  }

  App.renderBusy = function () {
    var busy = App.isBusy();
    document.body.classList.toggle('is-busy', busy);
    $$('#tbNav .tb-btn, #mobileMenu .menu-item, #btnBurger').forEach(function (b) { b.disabled = busy; });
    if (App.renderEditorBusy) App.renderEditorBusy(busy);
  };

  // ---------------------------------------------------------------- winner dialog
  var pending = null; // { queue, lead }
  function linkify(el, text) {
    var parts = String(text).split(/(\s+)/);
    parts.forEach(function (p) {
      if (/^https?:\/\/\S+$/.test(p)) {
        var a = document.createElement('a');
        a.href = p; a.target = '_new'; a.rel = 'noopener'; a.textContent = p;
        el.appendChild(a);
      } else el.appendChild(document.createTextNode(p));
    });
  }
  function occurrences(i, text) {
    var tt = String(text).trim();
    return App.cfg(i).entries.filter(function (e) { return String(e.text).trim() === tt; }).length;
  }
  function showWinnerDialog(queue, firstIndex) {
    var lead = App.cfg(firstIndex);
    pending = { queue: queue, lead: lead };
    var dlg = $('#dlgWinner');
    var head = $('#winnerHead');
    $('#winnerMessage').textContent = queue[0].message || t('Chúng ta có một người chiến thắng!');
    if (queue.length === 1) {
      head.style.background = queue[0].color;
      head.style.color = Wheel.textColorFor(queue[0].color);
    } else { head.style.background = ''; head.style.color = ''; }
    var body = $('#winnerBody');
    body.innerHTML = '';
    queue.forEach(function (q) {
      var row = document.createElement('div');
      row.className = 'winner-row';
      if (q.entry.image) { var img = document.createElement('img'); img.src = q.entry.image; img.alt = ''; img.className = 'winner-img'; row.appendChild(img); }
      var name = document.createElement('div');
      name.className = 'winner-name';
      linkify(name, q.entry.text);
      row.appendChild(name);
      body.appendChild(row);
    });
    var canRemove = lead.displayRemoveButton && !lead.autoRemoveWinner;
    var hasDupes = canRemove && queue.some(function (q) { return occurrences(q.wheelIndex, q.entry.text) > 1; });
    $('#btnWinnerRemove').hidden = !canRemove;
    $('#btnWinnerRemoveAll').hidden = !hasDupes;
    $('#btnWinnerHide').hidden = !(lead.isAdvanced && lead.displayHideButton && !lead.autoRemoveWinner);
    U.openDialog(dlg);
    if (canRemove) setTimeout(function () { $('#btnWinnerRemove').focus(); }, 100);
  }

  App.removedFeedback = function (names, lead) {
    if (lead && lead.playClickWhenWinnerRemoved) Sound.click(lead.afterSpinSoundVolume);
    U.toast(t('Đã xóa {name}', { name: names.join(', ') }));
  };

  $('#btnWinnerRemove').addEventListener('click', function () {
    if (!pending) return;
    var names = [];
    pending.queue.forEach(function (q) {
      var cfg = App.cfg(q.wheelIndex);
      var i = cfg.entries.findIndex(function (e) { return e.id === q.entry.id; });
      if (i >= 0) { cfg.entries.splice(i, 1); names.push(q.entry.text); }
      App.afterEntriesChanged(q.wheelIndex);
    });
    U.closeDialog('dlgWinner');
    App.removedFeedback(names, pending.lead);
  });
  $('#btnWinnerRemoveAll').addEventListener('click', function () {
    if (!pending) return;
    var names = [];
    pending.queue.forEach(function (q) {
      var cfg = App.cfg(q.wheelIndex), tt = String(q.entry.text).trim();
      cfg.entries = cfg.entries.filter(function (e) { return !(String(e.text).trim() === tt || (q.entry.image && e.image === q.entry.image)); });
      names.push(q.entry.text);
      App.afterEntriesChanged(q.wheelIndex);
    });
    U.closeDialog('dlgWinner');
    App.removedFeedback(names, pending.lead);
  });
  $('#btnWinnerHide').addEventListener('click', function () {
    if (!pending) return;
    pending.queue.forEach(function (q) {
      var e = App.cfg(q.wheelIndex).entries.find(function (x) { return x.id === q.entry.id; });
      if (e) e.enabled = false;
      App.afterEntriesChanged(q.wheelIndex);
    });
    U.closeDialog('dlgWinner');
  });

  // Auto-remove: countdown toast, removal after 5 s.
  function startAutoRemove(i, entry) {
    var left = 5;
    var cfg = App.cfg(i);
    var tst = U.toast(t('Xóa người chiến thắng sau {seconds} giây', { seconds: left }), { persistent: true });
    var iv = setInterval(function () {
      left--;
      if (left > 0) { tst.set(t('Xóa người chiến thắng sau {seconds} giây', { seconds: left })); return; }
      clearInterval(iv);
      tst.close();
      var list = App.group.wheelConfigs[i] === cfg ? cfg.entries : null;
      var k = list ? list.findIndex(function (e) { return e.id === entry.id; }) : -1;
      if (k >= 0) { list.splice(k, 1); App.afterEntriesChanged(i); App.removedFeedback([entry.text], cfg); }
    }, 1000);
  }

  function animateWinner(text) {
    if (!text) return;
    var el = $('#winnerAnim');
    $('#winnerAnimText').textContent = text;
    el.hidden = false;
    el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
    clearTimeout(animateWinner.tm);
    animateWinner.tm = setTimeout(function () { el.hidden = true; el.classList.remove('run'); }, 6000);
  }
  $('#winnerAnim').addEventListener('click', function () { this.hidden = true; });

  // ---------------------------------------------------------------- results tab
  App.renderResults = function () {
    var box = $('#resultsBox');
    box.innerHTML = App.winners.map(function (w) {
      return '<div>' + (w.image ? '<img src="' + U.esc(w.image) + '" alt="">' : '') + U.esc(w.text) + '</div>';
    }).join('');
    if (App.renderTabs) App.renderTabs();
  };
  $('#btnSortResults').addEventListener('click', function () {
    App.winners.sort(function (a, b) { return String(a.text).localeCompare(String(b.text), 'en', { numeric: true, sensitivity: 'base' }); });
    App.renderResults();
  });
  $('#btnClearResults').addEventListener('click', function () { App.winners = []; App.renderResults(); });
  $('#btnExportResults').addEventListener('click', function () {
    var name = (App.cfg(0).title || 'wheel') + ' results.txt';
    U.download(name, new Blob([App.winners.map(function (w) { return w.text; }).join('\n')], { type: 'text/plain;charset=utf-8' }));
  });

  // ---------------------------------------------------------------- whole-group changes
  // Replace everything on screen (new, open, gallery, share-link copy).
  App.setGroup = function (g, o) {
    o = o || {};
    App.group = g;
    App.winners = [];
    App.tab = 'entries-0';
    App.lastEntriesIndex = 0;
    App.renderWheels();
    App.wheels.forEach(function (w) { w.resetRotation(); });
    if (App.renderEditor) App.renderEditor();
    App.renderResults();
    if (!o.noPersist) App.persist();
  };
  App.snapshot = function () { return U.clone(App.group); };
  App.undoToast = function (msg, before) {
    U.toast(msg, { action: t('Hoàn tác'), onAction: function () { App.setGroup(before); } });
  };

  // ---------------------------------------------------------------- title & description
  function openTitleDialog(i) {
    var cfg = App.cfg(i);
    $('#titleDlgHead').textContent = App.isMulti() ? t('Đổi tên bánh xe {n}', { n: i + 1 }) : t('Chỉnh sửa tiêu đề và mô tả');
    $('#titleInput').value = cfg.title;
    $('#descInput').value = cfg.description;
    var dlg = U.openDialog('dlgTitle');
    dlg.dataset.wheel = i;
    setTimeout(function () { $('#titleInput').focus(); $('#titleInput').select(); }, 30);
  }
  App.openTitleDialog = openTitleDialog;
  $('#btnEditTitle').addEventListener('click', function () { openTitleDialog(0); });
  function saveTitle() {
    var dlg = $('#dlgTitle'), i = +dlg.dataset.wheel || 0, cfg = App.cfg(i);
    cfg.title = $('#titleInput').value.trim().slice(0, 50);
    cfg.description = $('#descInput').value.trim().slice(0, 200);
    U.closeDialog(dlg, 'ok');
    App.refreshWheel(i);
    if (App.renderTabs) App.renderTabs();
    App.persist();
  }
  $('#formTitle').addEventListener('submit', function (e) { e.preventDefault(); saveTitle(); });
  $('#descInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } });

  // ---------------------------------------------------------------- toolbar
  function newWheel() {
    var before = App.snapshot();
    App.setGroup(App.defaultGroup());
    App.undoToast(t('Đã tải tên và tùy chọn mặc định'), before);
  }
  App.newWheel = newWheel;

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  }
  document.addEventListener('fullscreenchange', function () {
    App.fullscreen = !!document.fullscreenElement;
    $$('.js-fs-icon').forEach(function (i) { i.className = 'fas ' + (App.fullscreen ? 'fa-compress' : 'fa-expand') + ' js-fs-icon'; });
    $('#btnFullscreen').title = App.fullscreen ? t('Thoát toàn màn hình') : t('Toàn màn hình');
    $('#btnFullscreen').setAttribute('aria-label', $('#btnFullscreen').title);
    App.layout();
  });
  if (/iPhone/.test(navigator.userAgent) || !document.documentElement.requestFullscreen) $$('.js-fullscreen').forEach(function (b) { b.hidden = true; });

  var ACTIONS = {
    customize: function () { App.openCustomize(App.activeIndex()); },
    'new': newWheel,
    open: function () { App.openWorkflow(); },
    save: function () { App.saveWorkflow(); },
    share: function () { App.shareWizard(); },
    gallery: function () { App.openGallery(); },
    fullscreen: toggleFullscreen,
    faq: function () { var f = $('#faq'); if (f) f.scrollIntoView({ behavior: 'smooth' }); },
    sheet: function () { App.openSheet(); },
    fairness: function () { App.openFairness(); },
    options: function () { App.openPreferences(); },
    language: function () { App.openLanguage(); }
  };
  App.ACTIONS = ACTIONS;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b || b.disabled || !ACTIONS[b.dataset.action]) return;
    if (b.closest('#mobileMenu')) { U.closeMenus(); $('#topbar').classList.remove('menu-open'); }
    ACTIONS[b.dataset.action]();
  });
  $('#btnMore').addEventListener('click', function () { U.toggleMenu('moreMenu', this); });
  $('#btnBurger').addEventListener('click', function () { U.toggleMenu('mobileMenu', this); });

  // Header slides away when scrolling down, comes back when scrolling up.
  var lastY = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    $('#topbar').classList.toggle('is-away', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  // Editor visibility (landscape only).
  $('#btnHideEditor').addEventListener('click', function () { setEditorHidden(true); });
  $('#btnShowEditor').addEventListener('click', function () { setEditorHidden(false); });
  function setEditorHidden(h) {
    var apply = function () { App.editorHidden = h; App.layout(); };
    if (document.startViewTransition) document.startViewTransition(apply); else apply();
  }

  // ---------------------------------------------------------------- keyboard & embedding
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      App.spinAll();
    }
  }, true);
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.name === 'spin') App.spinAll();
    else if (d.name === 'setEntries' && Array.isArray(d.entries) && !App.isBusy()) {
      var cfg = App.cfg(0);
      cfg.entries = d.entries.map(normalizeEntry).filter(Boolean);
      if (cfg.entries.some(function (x) { return x.color || x.weight || x.enabled === false || x.sound || x.message; })) cfg.isAdvanced = true;
      App.afterEntriesChanged(0);
      if (App.renderEditor) App.renderEditor();
    } else if ($('#dlgWinner').open) {
      var map = { closeWinnerDialog: '#btnWinnerClose', removeWinner: '#btnWinnerRemove', removeWinnerAll: '#btnWinnerRemoveAll', hideWinner: '#btnWinnerHide' };
      if (map[d.name]) $(map[d.name]).click();
    }
  });

  // Called by the editor whenever entries of wheel i changed.
  App.afterEntriesChanged = function (i) {
    App.refreshWheel(i);
    if (App.renderTabs) App.renderTabs();
    if (App.onEntriesChanged) App.onEntriesChanged(i);
    App.persist();
  };

  // ---------------------------------------------------------------- URL parameters and share links
  function applyQuery(cfg) {
    var q = new URLSearchParams(location.search);
    var used = false;
    var get = function (k) { if (q.has(k)) { used = true; return q.get(k); } return null; };
    var v;
    if ((v = get('title')) != null) cfg.title = v.slice(0, 50);
    if ((v = get('description')) != null) cfg.description = v.slice(0, 200);
    if ((v = get('winnerMessage')) != null) cfg.winnerMessage = v.slice(0, 100);
    if (get('displayWinnerDialog') === 'false') cfg.displayWinnerDialog = false;
    if ((v = get('entries')) != null) cfg.entries = v.split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return { id: U.entryId(), text: s }; });
    if ((v = get('colors')) != null) {
      var cols = v.split(',').map(function (s) { return hex6(s); }).filter(Boolean);
      if (cols.length) cfg.colorSettings = D.colorSettingsFrom(cols);
    }
    if ((v = get('pageBackgroundColor')) != null && hex6(v)) cfg.pageBackgroundColor = hex6(v);
    if (get('pageGradient') === 'false') cfg.pageGradient = false;
    if (get('removeBackground') === 'true') { cfg.pageBackgroundColor = '#FFFFFF'; cfg.pageGradient = false; }
    if ((v = get('spinTime')) != null && +v > 0) cfg.spinTime = clamp(Math.round(+v), 1, 60);
    if ((v = get('centerImage')) != null && /^(https:|data:image\/)/.test(v)) { cfg.pictureType = 'gallery'; cfg.galleryPicture = v; }
    if ((v = get('centerSize')) != null && D.HUB_SIZES[v]) cfg.hubSize = v;
    if ((v = get('backgroundImage')) != null && /^(https:|data:image\/)/.test(v)) { cfg.type = 'image'; cfg.coverImageType = 'uploaded'; cfg.customCoverImageDataUri = v; }
    if (get('confetti') === 'false') cfg.launchConfetti = false;
    if (get('lang') != null) used = true;
    return used;
  }

  async function loadShared() {
    var m = /^#w=([\w-]+)$/.exec(location.hash);
    if (!m) return null;
    try {
      var d = await Store.decodeShare(m[1]);
      var g = normalizeGroup(d.g || d);
      if (!g) throw new Error('empty');
      g.shareMode = d.m === 'spin-only' ? 'spin-only' : 'copyable';
      return g;
    } catch (e) {
      U.toast(t('Liên kết chia sẻ không hợp lệ hoặc đã bị hỏng.'));
      history.replaceState(null, '', location.pathname + location.search);
      return null;
    }
  }

  function enterSharedView(g) {
    App.shared = { mode: g.shareMode };
    document.body.classList.add('shared-view');
    var cfg = g.wheelConfigs[0];
    $('#sharedTitle').textContent = cfg.title || '';
    $('#sharedTitle').hidden = !(cfg.showTitle && cfg.title);
    $('#sharedDesc').textContent = cfg.description || '';
    $('#sharedDesc').hidden = !(cfg.showTitle && cfg.description);
    $('#btnSharedCopy').hidden = g.shareMode === 'spin-only';
    $('#btnSharedOwn').hidden = g.shareMode !== 'spin-only';
    $('#sharedMute').checked = !Sound.isMuted();
    $('#sharedSpinAll').hidden = g.wheelConfigs.length < 2;
  }
  function leaveSharedView(keepGroup) {
    var g = App.group;
    App.shared = null;
    document.body.classList.remove('shared-view');
    history.replaceState(null, '', location.pathname + location.search);
    if (keepGroup) {
      g.shareMode = 'private';
      g.wheelConfigs.forEach(function (c) { c.entries.forEach(function (e) { e.id = U.entryId(); }); });
      App.setGroup(g);
    } else App.setGroup(normalizeGroup(Store.loadCurrent()) || App.defaultGroup());
    App.layout();
  }
  $('#btnSharedCopy').addEventListener('click', function () { leaveSharedView(true); U.toast(t('Đã sao chép bánh xe. Giờ bạn có thể chỉnh sửa nó.')); });
  $('#btnSharedOwn').addEventListener('click', function () { leaveSharedView(false); });
  $('#sharedMute').addEventListener('change', function () { Sound.setMuted(!this.checked); });
  $('#sharedSpinAll').addEventListener('click', function () { App.spinAll(); });

  // ---------------------------------------------------------------- boot
  async function boot() {
    App.applyTheme();
    var shared = await loadShared();
    if (shared) {
      App.group = shared;
      enterSharedView(shared);
    } else {
      App.group = normalizeGroup(Store.loadCurrent()) || App.defaultGroup();
      if (applyQuery(App.group.wheelConfigs[0])) history.replaceState(null, '', location.pathname + location.hash);
    }
    App.renderWheels();
    if (App.renderEditor) App.renderEditor();
    App.renderResults();
    App.renderBusy();
    if (!shared) App.persist();
    window.addEventListener('resize', U.debounce(App.layout, 60));
    // Re-measure wheel text once Quicksand (incl. the Vietnamese subset) has loaded.
    if (document.fonts && document.fonts.load) {
      Promise.all(['Quicksand', '700 12px Roboto'].map(function (f) { return document.fonts.load(f.indexOf('px') > 0 ? f : '400 24px ' + f, 'AaĐđƯưẠạ'); })).then(function () {
        Wheel.clearMeasureCache();
        App.wheels.forEach(function (w, i) { App.refreshWheel(i); });
      }, function () {});
    }
    if (App.afterBoot) App.afterBoot();
  }
  // A share link pasted into this tab only changes the hash, so load it explicitly.
  window.addEventListener('hashchange', function () { if (/^#w=/.test(location.hash)) location.reload(); });
  document.addEventListener('DOMContentLoaded', boot);
})();
