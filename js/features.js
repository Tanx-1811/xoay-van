/* Extras: team generator, keyboard shortcuts, light/dark toggle, wheel fonts, offline support. */
(function () {
  'use strict';

  var D = window.DATA, U = window.UI, App = window.App, t = window.I18N.t;
  var $ = U.$, $$ = U.$$;

  // ================================================================ light / dark toggle in the header
  function syncThemeIcon() {
    var dark = document.documentElement.dataset.theme === 'dark';
    $$('.js-theme-icon').forEach(function (i) { i.className = 'fas ' + (dark ? 'fa-sun' : 'fa-moon') + ' js-theme-icon'; });
  }
  var applyTheme = App.applyTheme;
  App.applyTheme = function () { applyTheme(); syncThemeIcon(); };
  App.toggleTheme = function () {
    App.prefs.appTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    App.savePrefs();
    App.applyTheme();
  };
  syncThemeIcon();

  // ================================================================ wheel fonts (Google Fonts, loaded when first used)
  var fontLoads = {};
  App.loadWheelFont = function (name) {
    var f = D.WHEEL_FONTS.find(function (x) { return x[0] === (name || ''); });
    if (!f || !f[2]) return Promise.resolve();
    if (!fontLoads[name]) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + f[2] + '&display=swap';
      fontLoads[name] = new Promise(function (resolve) { link.onload = resolve; link.onerror = resolve; })
        .then(function () { return document.fonts && document.fonts.load(f[1] + " 24px '" + name + "'", 'AaĐđƯưẠạ'); })
        .catch(function () {});
      document.head.appendChild(link);
    }
    return fontLoads[name];
  };
  // Load every font the wheels on screen use, then re-measure their labels.
  App.loadFontsInUse = function () {
    var names = Array.from(new Set(App.group.wheelConfigs.map(function (c) { return c.font || ''; }))).filter(Boolean);
    if (!names.length) return;
    Promise.all(names.map(App.loadWheelFont)).then(function () {
      Wheel.clearMeasureCache();
      App.wheels.forEach(function (w, i) { App.refreshWheel(i); });
    });
  };
  var setGroup = App.setGroup, addWheel = App.addWheel;
  App.setGroup = function (g, o) { setGroup(g, o); App.loadFontsInUse(); };
  App.addWheel = function (c) { addWheel(c); App.loadFontsInUse(); };

  // ================================================================ team generator
  var teams = [];
  function randInt(n) {
    var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }
  // The entries that are on the wheel right now: visible ones, duplicates only if the wheel shows them.
  function teamEntries() {
    var cfg = App.cfg(App.activeIndex()), seen = new Set();
    return cfg.entries.filter(function (e) {
      if (e.enabled === false || !(e.text || e.image)) return false;
      if (cfg.allowDuplicates === false) {
        var k = (e.text || '') + '||' + (e.image || '');
        if (seen.has(k)) return false;
        seen.add(k);
      }
      return true;
    });
  }
  // Fisher–Yates with crypto randomness, then dealt round-robin so group sizes differ by at most one.
  function makeTeams() {
    var list = teamEntries().slice();
    for (var k = list.length - 1; k > 0; k--) { var j = randInt(k + 1), tmp = list[k]; list[k] = list[j]; list[j] = tmp; }
    var n = Math.max(1, Math.min(50, Math.round(+$('#teamN').value) || 2));
    $('#teamN').value = n;
    var bySize = (($('input[name="teamMode"]:checked') || {}).value || 'count') === 'size';
    var count = bySize ? Math.max(1, Math.ceil(list.length / n)) : Math.max(1, Math.min(n, list.length));
    teams = Array.from({ length: count }, function () { return []; });
    list.forEach(function (e, k) { teams[k % count].push(e); });
    renderTeams(list.length);
  }
  function renderTeams(total) {
    var pal = App.palette(App.cfg(App.activeIndex()));
    $('#teamInfo').textContent = t('{n} mục, {g} nhóm', { n: total, g: total ? teams.length : 0 });
    $('#teamGrid').innerHTML = total ? teams.map(function (g, k) {
      var c = pal[k % pal.length];
      return '<section class="team-card" style="--c:' + U.esc(c) + ';--fg:' + Wheel.textColorFor(c) + '"><header><b>' + U.esc(t('Nhóm {n}', { n: k + 1 })) + '</b><span>' + U.esc(t('{n} người', { n: g.length })) + '</span></header><ul>' +
        g.map(function (e) { return '<li>' + (e.image ? '<img src="' + U.esc(e.image) + '" alt="">' : '') + U.esc(e.text) + '</li>'; }).join('') + '</ul></section>';
    }).join('') : '<p class="empty-note">' + U.esc(t('Không có mục nào')) + '</p>';
    ['#btnTeamCopy', '#btnTeamExport', '#btnTeamShuffle'].forEach(function (id) { $(id).disabled = !total; });
  }
  function teamsText() {
    return teams.map(function (g, k) {
      return t('Nhóm {n}', { n: k + 1 }) + '\n' + g.map(function (e) { return '- ' + (e.text || t('Ảnh')); }).join('\n');
    }).join('\n\n');
  }
  App.openTeams = function () {
    if (App.isBusy()) return;
    U.openDialog('dlgTeams');
    makeTeams();
  };
  $('#btnTeamShuffle').addEventListener('click', makeTeams);
  $('#teamN').addEventListener('change', makeTeams);
  $$('input[name="teamMode"]').forEach(function (r) { r.addEventListener('change', makeTeams); });
  $('#teamDec').addEventListener('click', function () { $('#teamN').value = Math.max(1, (+$('#teamN').value || 2) - 1); makeTeams(); });
  $('#teamInc').addEventListener('click', function () { $('#teamN').value = Math.min(50, (+$('#teamN').value || 2) + 1); makeTeams(); });
  $('#btnTeamCopy').addEventListener('click', async function () {
    try { await navigator.clipboard.writeText(teamsText()); U.toast(t('Đã sao chép danh sách nhóm')); }
    catch (e) { U.toast(t('Không sao chép được. Hãy dùng nút Tải về.')); }
  });
  $('#btnTeamExport').addEventListener('click', function () {
    var name = (App.cfg(App.activeIndex()).title || 'xoay-van') + ' - ' + t('nhóm') + '.txt';
    U.download(name, new Blob([teamsText()], { type: 'text/plain;charset=utf-8' }));
  });

  // ================================================================ keyboard shortcuts
  App.openShortcuts = function () { U.openDialog('dlgShortcuts'); };
  function typing(e) {
    var el = e.target;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }
  document.addEventListener('keydown', function (e) {
    if (App.shared || e.defaultPrevented) return;
    var mod = e.ctrlKey || e.metaKey, key = (e.key || '').toLowerCase();
    if (mod && !e.shiftKey && !e.altKey && (key === 's' || key === 'o')) {
      e.preventDefault(); // never the browser's own "save page" / "open file"
      if (U.anyDialogOpen() || App.isBusy()) return;
      if (key === 's') App.saveWorkflow(); else App.openWorkflow();
      return;
    }
    if (mod || e.altKey || typing(e) || U.anyDialogOpen()) return;
    if (key === 'f' && !$('#btnFullscreen').hidden) { e.preventDefault(); App.ACTIONS.fullscreen(); }
    else if (e.key === '?') { e.preventDefault(); App.openShortcuts(); }
  });

  // ================================================================ offline: cache the app with a service worker
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
