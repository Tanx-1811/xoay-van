/* Dialogs: customize, open/save, share wizard, gallery, preferences, language, sheet import, fairness, changelog. */
(function () {
  'use strict';

  var D = window.DATA, U = window.UI, App = window.App, I18N = window.I18N, t = I18N.t;
  var $ = U.$, $$ = U.$$;

  function themeSwatch(colors) {
    return '<span class="theme-swatch">' + colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>';
  }
  function staticWheel(canvas, size, cfg) {
    var c = App.normalizeConfig(U.clone(cfg));
    Wheel.renderStatic(canvas, size, App.wheelOptions(c));
  }
  function timeAgo(ts) {
    var s = Math.round((ts - Date.now()) / 1000);
    var rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(I18N.locale, { numeric: 'auto' }) : null;
    if (!rtf) return new Date(ts).toLocaleString(I18N.locale);
    var a = Math.abs(s);
    if (a < 60) return rtf.format(s, 'second');
    if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (a < 2592000) return rtf.format(Math.round(s / 86400), 'day');
    return new Date(ts).toLocaleDateString(I18N.locale);
  }

  // ================================================================ Customize
  var cust = null; // { i, cfg (edited copy), loop }

  function fillSelects() {
    $('#cfgDuringSound').innerHTML = D.DURING_SOUNDS.map(function (g) {
      return '<optgroup label="' + U.esc(t(g.group)) + '">' + g.items.map(function (s) { return '<option value="' + U.esc(s[0]) + '">' + U.esc(t(s[1])) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    $('#cfgAfterSound').innerHTML = D.AFTER_SOUNDS.map(function (s) { return '<option value="' + s[0] + '">' + U.esc(t(s[1])) + '</option>'; }).join('');
    $('#cfgHubSize').innerHTML = Object.keys(D.HUB_SIZES).map(function (k) { return '<option>' + k + '</option>'; }).join('');
    $('#cfgTextDisplay').innerHTML = D.TEXT_DISPLAY.map(function (o) { return '<option value="' + o[0] + '">' + U.esc(t(o[1])) + '</option>'; }).join('');
    $('#cfgFont').innerHTML = D.WHEEL_FONTS.map(function (f) { return '<option value="' + U.esc(f[0]) + '">' + U.esc(f[0] || t('Quicksand (mặc định)')) + '</option>'; }).join('');
    $('#themesMenu').innerHTML = D.THEMES.map(function (g) {
      return '<div class="menu-group">' + U.esc(t(g.group)) + '</div>' + g.themes.map(function (th) {
        return '<button type="button" class="menu-item theme-item" data-theme="' + U.esc(th[0]) + '"><span>' + U.esc(th[0]) + '</span>' + themeSwatch(th[1]) + '</button>';
      }).join('');
    }).join('');
    $('#coverImageMenu').innerHTML =
      '<button type="button" class="menu-item" data-cover="upload"><i class="fas fa-upload"></i><span>' + U.esc(t('Tải ảnh lên')) + '</span></button><hr class="menu-sep">' +
      D.COVER_PICTURES.map(function (p) { return '<button type="button" class="menu-item" data-cover="' + p[0] + '"><img class="menu-avatar" src="' + U.picture(p[0], 80) + '" alt=""><span>' + U.esc(t(p[1])) + '</span></button>'; }).join('');
  }

  App.openCustomize = function (i) {
    if (App.isBusy()) return;
    if (!$('#cfgDuringSound').options.length) fillSelects();
    cust = { i: i, cfg: U.clone(App.cfg(i)), loop: null };
    var multi = App.isMulti(), n = i + 1;
    $('#bannerDuring').hidden = !multi;
    $('#bannerAfter').hidden = !multi;
    $('#bannerDuring').textContent = i === 0 ? t('Bạn đang ở chế độ nhiều bánh xe. Âm thanh của bánh xe này (Bánh xe 1) sẽ phát khi bạn nhấn "Quay tất cả bánh xe".') : t('Bạn đang ở chế độ nhiều bánh xe. Âm thanh của bánh xe này (Bánh xe {n}) sẽ chỉ phát khi bạn quay bánh xe này một mình.', { n: n });
    $('#bannerAfter').textContent = i === 0 ? t('Bạn đang ở chế độ nhiều bánh xe. Các cài đặt "Sau khi quay" cho bánh xe này (Bánh xe 1) sẽ được sử dụng khi bạn nhấn "Quay tất cả bánh xe".') : t('Bạn đang ở chế độ nhiều bánh xe. Các cài đặt "Sau khi quay" cho bánh xe này (Bánh xe {n}) sẽ chỉ được sử dụng khi bạn quay bánh xe này một mình.', { n: n });
    showCtab('during');
    syncCustomize();
    layoutMarks();
    $('#modePicture').style.backgroundImage = 'url(' + U.picture('cookie', 120) + ')';
    U.openDialog('dlgCustomize');
  };

  function showCtab(name) {
    $$('#custTabs .tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.ctab === name); });
    $$('#dlgCustomize [data-ctab-body]').forEach(function (s) { s.hidden = s.dataset.ctabBody !== name; });
    $('#custScroll').scrollTop = 0;
  }
  $('#custTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-ctab]'); if (b) showCtab(b.dataset.ctab); });

  function unequalWeights(cfg) {
    if (!cfg.isAdvanced) return false;
    var w = cfg.entries.map(function (e) { return e.weight || 1; });
    return w.some(function (x) { return x !== w[0]; });
  }

  function syncCustomize() {
    var c = cust.cfg;
    $$('#dlgCustomize [data-cfg]').forEach(function (el) {
      var k = el.dataset.cfg, v = c[k];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = el.type === 'color' ? String(v).toLowerCase() : v;
      if (el.type === 'range') U.syncRange(el);
    });
    $$('#dlgCustomize [data-out]').forEach(function (o) { o.textContent = c[o.dataset.out]; positionLabel(o); });
    var noPreviewDuring = ['no-sound', 'ticking-sound', 'random-music'].indexOf(c.duringSpinSound) >= 0;
    $('#btnPlayDuring').disabled = noPreviewDuring;
    $('#btnPlayAfter').disabled = c.afterSpinSound === 'no-sound';
    var weights = unequalWeights(c);
    $('[data-cfg="maxNames"]').disabled = weights;
    $('#maxNamesHelp').hidden = !weights;
    $('[data-cfg="winnerMessage"]').disabled = !c.displayWinnerDialog;
    $('[data-cfg="displayRemoveButton"]').disabled = !c.displayWinnerDialog;
    $('#hideButtonOpt').hidden = !c.isAdvanced;
    $('[data-cfg="displayHideButton"]').disabled = !c.displayWinnerDialog;
    var image = c.type === 'image';
    $('#cfgImageMode').checked = image;
    $('#colorModeOpts').hidden = image;
    $('#imageModeOpts').hidden = !image;
    $('#pointerColorOpt').hidden = image;
    renderPalette();
    var center = App.centerSrc(c);
    $('#centerThumb').innerHTML = center ? '<img src="' + U.esc(center) + '" alt="">' : '<i class="fas fa-image"></i>';
    $('#centerRemove').hidden = !center;
    $('#centerTextInput').value = c.centerText || '';
    var cover = App.coverSrc(Object.assign({}, c, { type: 'image' }));
    $('#coverThumb').innerHTML = '<img src="' + U.esc(cover) + '" alt="">';
    var bg = (c.pageBackgroundColor || '#FFFFFF');
    $('#pageBgBtn').style.background = bg;
    $('#pageBgBtn').style.color = Wheel.textColorFor(bg);
  }

  // Tick labels sit exactly under their values (1, 10, 20… are not evenly spaced on 1–60).
  function layoutMarks() {
    $$('#dlgCustomize .slider-marks').forEach(function (m) {
      var r = m.parentElement.querySelector('input[type=range]');
      var min = +r.min, max = +r.max;
      $$('span', m).forEach(function (s) {
        var v = parseFloat(s.textContent);
        s.style.left = ((v - min) / (max - min) * 100) + '%';
      });
    });
  }

  // Slider value bubble above the thumb.
  function positionLabel(o) {
    var r = o.parentElement.querySelector('input[type=range]');
    if (!r) return;
    var p = (r.value - r.min) / (r.max - r.min);
    o.style.left = 'calc(' + (p * 100) + '% + ' + (7 - p * 14) + 'px)';
  }

  function renderPalette() {
    var c = cust.cfg;
    $('#paletteEditor').innerHTML = c.colorSettings.map(function (s, k) {
      return '<div class="pal-slot"><input type="checkbox" data-pal-on="' + k + '"' + (s.enabled ? ' checked' : '') + ' aria-label="' + U.esc(t('Màu')) + ' ' + (k + 1) + '">' +
        '<label class="color-btn' + (s.enabled ? '' : ' is-disabled') + '" style="background:' + s.color + ';color:' + Wheel.textColorFor(s.color) + '"><i class="fas fa-palette"></i>' +
        '<input type="color" data-pal="' + k + '" value="' + s.color.toLowerCase() + '"' + (s.enabled ? '' : ' disabled') + ' aria-label="' + U.esc(t('Màu')) + ' ' + (k + 1) + '"></label></div>';
    }).join('');
  }
  $('#paletteEditor').addEventListener('input', function (e) {
    var k = e.target.dataset.pal;
    if (k == null) return;
    cust.cfg.colorSettings[+k].color = e.target.value.toUpperCase();
    var lab = e.target.parentElement;
    lab.style.background = e.target.value; lab.style.color = Wheel.textColorFor(e.target.value);
  });
  $('#paletteEditor').addEventListener('change', function (e) {
    var k = e.target.dataset.palOn;
    if (k == null) return;
    cust.cfg.colorSettings[+k].enabled = e.target.checked;
    renderPalette();
  });

  function onCfgInput(e) {
    var el = e.target, k = el.dataset && el.dataset.cfg;
    if (!k || !cust) return;
    var c = cust.cfg;
    if (el.type === 'checkbox') c[k] = el.checked;
    else if (el.type === 'range') c[k] = +el.value;
    else if (el.type === 'color') c[k] = el.value.toUpperCase();
    else c[k] = el.value;
    if (k === 'duringSpinSound' || k === 'afterSpinSound') stopPreview();
    if (k === 'font' && App.loadWheelFont) App.loadWheelFont(c.font);
    syncCustomize();
  }
  $('#dlgCustomize').addEventListener('input', onCfgInput);
  $('#dlgCustomize').addEventListener('change', onCfgInput);

  function stopPreview() { if (cust && cust.loop) { cust.loop.stop(200); cust.loop = null; } Sound.stopAll(); }
  $('#btnPlayDuring').addEventListener('click', function () {
    stopPreview();
    Sound.unlock();
    cust.loop = Sound.startLoop(cust.cfg.duringSpinSound, cust.cfg.duringSpinSoundVolume);
  });
  $('#btnPlayAfter').addEventListener('click', function () {
    stopPreview();
    Sound.unlock();
    Sound.play(cust.cfg.afterSpinSound, cust.cfg.afterSpinSoundVolume, cust.cfg.entries[0] ? cust.cfg.entries[0].text : 'Ali', I18N.lang);
  });
  $$('#dlgCustomize [data-stop]').forEach(function (b) { b.addEventListener('click', stopPreview); });

  // wheel type: one color per section vs wheel background image
  function setType(type) {
    var c = cust.cfg;
    c.type = type;
    if (type === 'image' && !c.coverImageType) { c.coverImageType = 'gallery'; c.coverImageName = 'cookie'; }
    syncCustomize();
  }
  $('#cfgImageMode').addEventListener('change', function () { setType(this.checked ? 'image' : 'color'); });
  $$('#dlgCustomize [data-mode]').forEach(function (b) { b.addEventListener('click', function () { setType(b.dataset.mode); }); });

  $('#btnThemes').addEventListener('click', function () { U.toggleMenu('themesMenu', this); });
  $('#themesMenu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme]');
    if (!b) return;
    cust.cfg.colorSettings = D.colorSettingsFrom(App.themeColors(b.dataset.theme));
    syncCustomize();
  });

  $('#btnCenterImage').addEventListener('click', function () { U.toggleMenu('centerImageMenu', this); });
  $('#centerImageMenu').addEventListener('click', function (e) {
    if (e.target.closest('.menu-row')) { e.stopPropagation(); return; }
    var b = e.target.closest('[data-center]');
    if (!b) return;
    var c = cust.cfg;
    if (b.dataset.center === 'remove') { c.pictureType = 'none'; c.customPictureDataUri = ''; c.customPictureName = ''; c.galleryPicture = ''; c.centerText = ''; syncCustomize(); }
    else if (b.dataset.center === 'gallery') App.pickPicture(function (id) { c.pictureType = 'gallery'; c.galleryPicture = U.picture(id, 370); if (c.hubSize === 'S') c.hubSize = 'L'; syncCustomize(); });
    else if (b.dataset.center === 'upload') App.pickImages({ onImage: null, raw: true, apply: 'center' }, false);
  });
  function saveCenterText() {
    var c = cust.cfg, txt = $('#centerTextInput').value.trim().slice(0, 20);
    if (!txt) return;
    var fam = Wheel.fontStack(c.font);
    c.centerText = txt; c.pictureType = 'text'; c.customPictureDataUri = U.centerTextImage(txt, fam);
    if (c.hubSize === 'S') c.hubSize = 'L';
    U.closeMenus();
    syncCustomize();
  }
  $('#btnCenterTextSave').addEventListener('click', saveCenterText);
  $('#centerTextInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveCenterText(); } });

  $('#btnCoverImage').addEventListener('click', function () { U.toggleMenu('coverImageMenu', this); });
  $('#coverImageMenu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cover]');
    if (!b) return;
    if (b.dataset.cover === 'upload') { App.pickImages({ raw: true, apply: 'cover' }, false); return; }
    cust.cfg.coverImageType = 'gallery'; cust.cfg.coverImageName = b.dataset.cover; cust.cfg.customCoverImageDataUri = '';
    syncCustomize();
  });

  // File picks started from inside Customize write into the edited copy, not the live wheel.
  var origPick = App.pickImages;
  App.pickImages = function (target, multiple) {
    if (target && target.raw) {
      var inp = $('#fileImage');
      inp.multiple = false; inp.value = '';
      inp.dataset.customize = target.apply;
      inp.click();
      return;
    }
    $('#fileImage').dataset.customize = '';
    origPick(target, multiple);
  };
  $('#fileImage').addEventListener('change', async function (e) {
    var mode = this.dataset.customize;
    if (!mode || !cust) return;
    e.stopImmediatePropagation();
    this.dataset.customize = '';
    var f = this.files && this.files[0];
    if (!f) return;
    try {
      var c = cust.cfg;
      if (mode === 'center') {
        var r = await U.processCenterImage(f);
        c.pictureType = 'uploaded'; c.customPictureDataUri = r.data; c.customPictureName = f.name;
        if (c.hubSize === 'S') c.hubSize = 'L';
      } else {
        var cv = await U.processCoverImage(f);
        c.coverImageType = 'uploaded'; c.customCoverImageDataUri = cv.data; c.coverImageName = f.name;
      }
      syncCustomize();
    } catch (err) { U.toast(t('Không đọc được hình ảnh này.')); }
  }, true);

  $('#btnCustomizeOk').addEventListener('click', function () {
    if (!cust) return;
    App.group.wheelConfigs[cust.i] = cust.cfg;
    App.refreshWheel(cust.i);
    App.renderEditor();
    App.persist();
    if (App.loadFontsInUse) App.loadFontsInUse();
    U.closeDialog('dlgCustomize', 'ok');
  });
  $('#dlgCustomize').addEventListener('close', function () { stopPreview(); U.closeMenus(); cust = null; });

  // ================================================================ picture picker (built-in pictures)
  App.pickPicture = function (cb) {
    $('#pictureGrid').innerHTML = D.COVER_PICTURES.map(function (p) {
      return '<button type="button" class="picture-card" data-pic="' + p[0] + '"><img src="' + U.picture(p[0], 272) + '" alt=""><span>' + U.esc(t(p[1])) + '</span></button>';
    }).join('');
    App.pickPicture.cb = cb;
    U.openDialog('dlgPictures');
  };
  $('#pictureGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pic]');
    if (!b) return;
    U.closeDialog('dlgPictures');
    if (App.pickPicture.cb) App.pickPicture.cb(b.dataset.pic);
  });

  // ================================================================ Open / Save
  var locMode = null; // { kind: 'open'|'save', opts }
  function chooseLocation(kind, opts) {
    var pref = App.prefs.wheelLocation;
    if (pref === 'browser') return kind === 'open' ? openBrowser(opts) : saveBrowser();
    if (pref === 'local') return kind === 'open' ? openLocal(opts) : saveLocal();
    locMode = { kind: kind, opts: opts };
    var open = kind === 'open';
    $('#locIcon').className = open ? 'fa fa-folder-open' : 'fa fa-save';
    $('#locTitle').textContent = open ? t('Mở bánh xe') : t('Lưu bánh xe');
    $('#locBrowserLabel').textContent = open ? t('Mở từ trình duyệt (được khuyến nghị)') : t('Lưu vào trình duyệt (được khuyến nghị)');
    $('#locFileLabel').textContent = open ? t('Mở một tập tin cục bộ') : t('Lưu vào một tệp cục bộ');
    U.openDialog('dlgLocation');
  }
  $('#btnLocBrowser').addEventListener('click', function () {
    App.prefs.wheelLocation = 'browser'; App.savePrefs();
    U.closeDialog('dlgLocation');
    if (locMode.kind === 'open') openBrowser(locMode.opts); else saveBrowser();
  });
  $('#btnLocFile').addEventListener('click', function () {
    App.prefs.wheelLocation = 'local'; App.savePrefs();
    U.closeDialog('dlgLocation');
    if (locMode.kind === 'open') openLocal(locMode.opts); else saveLocal();
  });
  $('#btnHelpChoose').addEventListener('click', function () { U.openDialog('dlgHelpStorage'); });

  App.openWorkflow = function (opts) { if (!App.isBusy()) chooseLocation('open', opts || {}); };
  App.saveWorkflow = function () { if (!App.isBusy()) chooseLocation('save'); };

  // Load a group from a file or the saved list. In multi-wheel mode (or when appending) ask add/switch.
  async function loadGroup(g, opts, title) {
    opts = opts || {};
    if (opts.append || App.isMulti()) {
      var add = opts.append;
      if (!add) {
        add = await U.confirm(t('Bạn muốn thêm "{wheelTitle}" vào nhóm bánh xe hiện tại hay chuyển sang chỉ sử dụng bánh xe đó?', { wheelTitle: title || '?' }), { title: t('Thêm hay thay thế?'), ok: t('Thêm bánh xe'), cancel: t('Chuyển sang bánh xe') });
      }
      if (add) {
        g.wheelConfigs.forEach(function (c) { if (App.group.wheelConfigs.length < D.MAX_WHEELS) App.addWheel(c); });
        return;
      }
    }
    App.setGroup(g);
  }

  var openOpts = {};
  function savedTitle(w) { return w.title || (w.wheelConfigs && w.wheelConfigs[0] && w.wheelConfigs[0].title) || '?'; }
  function openBrowser(opts) {
    openOpts = opts || {};
    $('#savedSearch').value = '';
    renderSaved();
    U.openDialog('dlgMyWheels');
  }
  function renderSaved() {
    var q = $('#savedSearch').value.trim().toLowerCase();
    var sort = $('#savedSort').value;
    var all = Store.listSaved();
    var list = all.filter(function (w) { return !q || savedTitle(w).toLowerCase().indexOf(q) >= 0; });
    list.sort(function (a, b) {
      if (sort === 'title-asc') return savedTitle(a).localeCompare(savedTitle(b), I18N.locale, { numeric: true });
      if (sort === 'title-desc') return savedTitle(b).localeCompare(savedTitle(a), I18N.locale, { numeric: true });
      if (sort === 'updated-asc') return (a.savedAt || 0) - (b.savedAt || 0);
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
    $('#savedEmpty').hidden = all.length > 0;
    $('#myWheelsTools').hidden = !all.length;
    $('#savedList').innerHTML = list.map(function (w) {
      return '<li class="saved-item" data-id="' + U.esc(w.id) + '"><button type="button" class="saved-open"><canvas width="50" height="50"></canvas><span class="info"><b>' + U.esc(savedTitle(w)) + '</b><small>' + U.esc(t('Đã cập nhật {timeAgo}', { timeAgo: timeAgo(w.savedAt || Date.now()) })) + ' · ' + U.esc(t('{n} bánh xe', { n: (w.wheelConfigs || []).length })) + '</small></span></button>' +
        '<button type="button" class="icon-btn" data-del aria-label="' + U.esc(t('Xóa')) + '"><i class="fas fa-trash-alt"></i></button></li>';
    }).join('');
    $$('#savedList .saved-item').forEach(function (li) {
      var w = all.find(function (x) { return x.id === li.dataset.id; });
      if (w && w.wheelConfigs && w.wheelConfigs[0]) staticWheel($('canvas', li), 50, w.wheelConfigs[0]);
    });
  }
  $('#savedSearch').addEventListener('input', renderSaved);
  $('#savedSort').addEventListener('change', renderSaved);
  $('#savedList').addEventListener('click', async function (e) {
    var li = e.target.closest('.saved-item');
    if (!li) return;
    var w = Store.getSaved(li.dataset.id);
    if (!w) return;
    if (e.target.closest('[data-del]')) {
      if (await U.confirm(t('Bạn có chắc chắn muốn xóa "{wheelTitle}" không? Thao tác này không thể hoàn tác.', { wheelTitle: savedTitle(w) }))) { Store.removeSaved(w.id); renderSaved(); }
      U.openDialog('dlgMyWheels');
      return;
    }
    var g = App.normalizeGroup(w);
    if (!g) return;
    g.savedId = w.id;
    U.closeDialog('dlgMyWheels');
    loadGroup(g, openOpts, savedTitle(w));
  });
  $('#btnOpenLocalInstead').addEventListener('click', function () {
    App.prefs.wheelLocation = 'local'; App.savePrefs();
    U.closeDialog('dlgMyWheels');
    openLocal(openOpts);
  });

  function openLocal(opts) {
    openOpts = opts || {};
    var inp = $('#fileWheel');
    inp.value = '';
    inp.click();
  }
  $('#fileWheel').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var g = null;
      try { g = App.normalizeGroup(JSON.parse(String(fr.result).replace(/^﻿/, ''))); } catch (err) { g = null; }
      if (!g) { U.toast(t('Không mở được tệp này. Hãy chọn một tệp .wheel hoặc .json.')); return; }
      loadGroup(g, openOpts, f.name.replace(/\.(wheel|json)$/i, ''));
    };
    fr.readAsText(f);
  });

  function groupForFile() {
    var g = App.group;
    return { wheelConfigs: g.wheelConfigs, shareMode: 'private', title: g.wheelConfigs[0].title || g.title || '', description: g.wheelConfigs[0].description || g.description || '' };
  }
  function defaultName() { return App.cfg(0).title || (App.isMulti() ? App.group.wheelConfigs.map(function (c, i) { return c.title || t('Bánh xe {n}', { n: i + 1 }); }).join(' + ') : App.cfg(0).entries.slice(0, 3).map(function (e) { return e.text; }).join(', ')) || t('Bánh xe'); }

  function saveBrowser() {
    var list = Store.listSaved();
    $('#saveAsInput').value = defaultName().slice(0, 50);
    $('#saveExisting').innerHTML = '<option value="">' + U.esc(t('Chọn một bánh xe')) + '</option>' + list.map(function (w) { return '<option value="' + U.esc(w.id) + '">' + U.esc(savedTitle(w)) + '</option>'; }).join('');
    U.openDialog('dlgSaveBrowser');
    setTimeout(function () { $('#saveAsInput').select(); }, 30);
  }
  $('#saveExisting').addEventListener('change', function () { var w = Store.getSaved(this.value); if (w) $('#saveAsInput').value = savedTitle(w); });
  $('#formSaveBrowser').addEventListener('submit', async function (e) {
    e.preventDefault();
    var title = $('#saveAsInput').value.trim().slice(0, 50);
    if (!title) return;
    var existing = Store.listSaved().find(function (w) { return savedTitle(w) === title; });
    if (existing && !await U.confirm(t('Bạn sắp ghi đè lên một bánh xe hiện có. Bạn có chắc chắn muốn tiếp tục không?'))) { U.openDialog('dlgSaveBrowser'); return; }
    var rec = groupForFile();
    rec.id = existing ? existing.id : Store.uid('w');
    rec.title = title;
    if (!App.cfg(0).title && !App.isMulti()) { App.cfg(0).title = title; App.refreshWheel(0); App.persist(); }
    if (Store.upsertSaved(rec)) {
      U.closeDialog('dlgSaveBrowser');
      U.toast(t('Bánh xe "{wheelTitle}" đã được lưu thành công', { wheelTitle: title }));
    } else U.toast(t('Bộ nhớ trình duyệt đã đầy. Hãy lưu vào một tệp cục bộ.'), { timeout: 7000 });
  });
  $('#btnSaveLocalInstead').addEventListener('click', function () {
    App.prefs.wheelLocation = 'local'; App.savePrefs();
    U.closeDialog('dlgSaveBrowser'); saveLocal();
  });

  function saveLocal() {
    $('#fileNameInput').value = defaultName().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 50);
    U.openDialog('dlgSaveLocal');
    setTimeout(function () { $('#fileNameInput').select(); }, 30);
  }
  $('#formSaveLocal').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#fileNameInput').value.trim().replace(/[\\/:*?"<>|]+/g, ' ') || 'wheel';
    U.download(name + '.wheel', new Blob([JSON.stringify(groupForFile())], { type: 'application/json' }));
    U.closeDialog('dlgSaveLocal');
    U.toast(t('Bánh xe "{wheelTitle}" đã được lưu thành công', { wheelTitle: name }));
  });
  $('#btnSaveBrowserInstead').addEventListener('click', function () {
    App.prefs.wheelLocation = 'browser'; App.savePrefs();
    U.closeDialog('dlgSaveLocal'); saveBrowser();
  });

  // ================================================================ Share wizard
  var share = null; // { steps, at, themes, pick, url }
  var STEP_INFO = {
    info: ['fas fa-info', 'Chia sẻ'], theme: ['fas fa-palette', 'Chủ đề'],
    visibility: ['fas fa-cog', 'Chế độ hiển thị'], link: ['fas fa-link', 'Liên kết']
  };
  function usesDefaultPalette(cfg) { return App.palette(cfg).join() === D.DEFAULT_COLORS.join() && cfg.colorSettings.filter(function (c) { return c.enabled; }).length === 4; }
  App.shareWizard = function () {
    if (App.isBusy()) return;
    var cfg = App.cfg(0);
    var themeStep = !App.isMulti() && cfg.type === 'color' && usesDefaultPalette(cfg) && !cfg.entries.every(function (e) { return e.image; });
    share = { steps: ['info'].concat(themeStep ? ['theme'] : [], ['visibility', 'link']), at: 0, pick: 0 };
    if (themeStep) pickShareThemes();
    $('#shareTitle').value = cfg.title || '';
    $('#shareShowTitle').checked = cfg.showTitle;
    $('#shareTitleError').hidden = true;
    renderShareStep();
    U.openDialog('dlgShare');
  };
  // Current theme + 3 random themes whose size suits the entry count.
  function pickShareThemes() {
    var n = Math.max(1, App.cfg(0).entries.length);
    var pool = [];
    D.THEMES.forEach(function (g) { if (g.group === 'Pride') return; g.themes.forEach(function (th) { var P = th[1].length; if (P <= n && (n % P !== 1 || P <= 2) && th[1].join() !== D.DEFAULT_COLORS.join()) pool.push(th); }); });
    if (pool.length < 3) D.THEMES.forEach(function (g) { g.themes.forEach(function (th) { pool.push(th); }); });
    var picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    share.themes = [[t('Chủ đề màu hiện tại'), App.palette(App.cfg(0))]].concat(picks.map(function (p, k) { return [t('Chủ đề màu {n}', { n: k + 1 }), p[1]]; }));
    share.pick = 0;
    renderShareThemes();
  }
  function renderShareThemes() {
    $('#shareThemes').innerHTML = share.themes.map(function (th, k) {
      return '<button type="button" class="theme-card' + (k === share.pick ? ' is-selected' : '') + '" data-k="' + k + '"><canvas width="200" height="200"></canvas><span>' + U.esc(th[0]) + '</span></button>';
    }).join('');
    $$('#shareThemes .theme-card').forEach(function (b, k) {
      var cfg = U.clone(App.cfg(0));
      cfg.colorSettings = D.colorSettingsFrom(share.themes[k][1]);
      staticWheel($('canvas', b), 200, cfg);
    });
  }
  $('#shareThemes').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { share.pick = +b.dataset.k; renderShareThemes(); } });
  $('#btnRefreshThemes').addEventListener('click', pickShareThemes);

  function renderShareStep() {
    var cur = share.steps[share.at];
    $('#shareStepper').innerHTML = share.steps.map(function (s, k) {
      var info = STEP_INFO[s];
      return (k ? '<i class="step-line"></i>' : '') + '<div class="step' + (k === share.at ? ' is-active' : k < share.at ? ' is-done' : '') + '"><span class="step-dot"><i class="' + (k < share.at ? 'fas fa-check' : info[0]) + '"></i></span><span>' + U.esc(t(info[1])) + '</span></div>';
    }).join('');
    $$('#dlgShare [data-share-step]').forEach(function (s) { s.hidden = s.dataset.shareStep !== cur; });
    $('#btnShareBack').hidden = share.at === 0 || cur === 'link';
    $('#btnShareCancel').hidden = cur === 'link';
    $('#btnShareNext').textContent = cur === 'link' ? t('Đóng') : t('Tiếp tục');
    if (cur === 'visibility') setTimeout(function () { $('#shareTitle').focus(); }, 30);
  }
  $('#btnShareBack').addEventListener('click', function () { share.at = Math.max(0, share.at - 1); renderShareStep(); });
  $('#shareTitle').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#btnShareNext').click(); } });
  $('#btnShareNext').addEventListener('click', async function () {
    var cur = share.steps[share.at];
    if (cur === 'link') { U.closeDialog('dlgShare'); return; }
    if (cur === 'theme' && share.pick > 0) {
      App.cfg(0).colorSettings = D.colorSettingsFrom(share.themes[share.pick][1]);
      App.refreshWheel(0); App.persist();
    }
    if (cur === 'visibility') {
      var title = $('#shareTitle').value.trim().slice(0, 50);
      if (!title) { $('#shareTitleError').hidden = false; $('#shareTitle').focus(); return; }
      var cfg = App.cfg(0);
      cfg.title = title;
      cfg.showTitle = $('#shareShowTitle').checked;
      App.refreshWheel(0); App.persist();
      if (App.renderTabs) App.renderTabs();
      await buildShareLink(($('input[name="shareMode"]:checked') || {}).value || 'copyable');
    }
    share.at++;
    renderShareStep();
  });

  // Share links carry the whole group in the URL hash; uploaded images are left out (too big).
  async function buildShareLink(mode) {
    var dropped = false;
    var configs = App.group.wheelConfigs.map(function (c) {
      var x = U.clone(c);
      x.entries = x.entries.map(function (e) {
        if (e.image && /^data:/.test(e.image)) { dropped = true; delete e.image; }
        delete e.id;
        return e;
      }).filter(function (e) { return e.text || e.image; });
      if (x.pictureType === 'uploaded' || (x.pictureType === 'gallery' && /^data:/.test(x.galleryPicture))) { if (x.pictureType === 'uploaded') dropped = true; x.pictureType = 'none'; x.customPictureDataUri = ''; x.galleryPicture = ''; }
      if (x.pictureType === 'text') x.customPictureDataUri = ''; // regenerated from centerText
      if (x.coverImageType === 'uploaded') { dropped = true; x.coverImageType = 'gallery'; x.coverImageName = 'cookie'; x.customCoverImageDataUri = ''; }
      return x;
    });
    var payload = { v: 1, m: mode, g: { wheelConfigs: configs, title: configs[0].title, description: configs[0].description } };
    var url = location.origin + location.pathname + (I18N.lang !== 'vi' ? '?lang=' + I18N.lang : '') + '#w=' + await Store.encodeShare(payload);
    share.url = url;
    $('#shareUrl').value = url;
    var warn = [];
    if (dropped) warn.push(t('Hình ảnh tải lên từ máy của bạn không đi kèm liên kết vì quá lớn.'));
    if (url.length > 8000) warn.push(t('Liên kết này rất dài, một số ứng dụng có thể cắt mất một phần.'));
    $('#shareWarn').textContent = warn.join(' ');
    $('#shareWarn').hidden = !warn.length;
    $('#btnNativeShare').hidden = !navigator.share;
    renderQr(url);
  }

  // QR code of the share link (qrcode-generator from cdnjs, loaded the first time it is needed).
  var qrLib = null, lastQr = null;
  function loadQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLib) {
      qrLib = new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
        sc.onload = function () { resolve(window.qrcode); };
        sc.onerror = function () { qrLib = null; reject(new Error('QR library unavailable')); };
        document.head.appendChild(sc);
      });
    }
    return qrLib;
  }
  function renderQr(url) {
    var box = $('#shareQr');
    box.hidden = true; box.innerHTML = ''; lastQr = null;
    $('#btnDownloadQr').hidden = true;
    $('#shareQrHint').hidden = true;
    if (url.length > 1500) return; // too dense to scan from a screen
    loadQrLib().then(function (qrcode) {
      var qr = qrcode(0, 'L');
      qr.addData(url);
      qr.make();
      lastQr = qr;
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: t('Mã QR của liên kết') });
      box.hidden = false;
      $('#btnDownloadQr').hidden = false;
      $('#shareQrHint').hidden = false;
    }).catch(function () {});
  }
  $('#btnDownloadQr').addEventListener('click', function () {
    if (!lastQr) return;
    var n = lastQr.getModuleCount(), cell = 10, pad = 4, c = document.createElement('canvas');
    c.width = c.height = (n + pad * 2) * cell;
    var g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (lastQr.isDark(r, k)) g.fillRect((k + pad) * cell, (r + pad) * cell, cell, cell);
    c.toBlob(function (b) { if (b) U.download((App.cfg(0).title || 'xoay-van') + ' QR.png', b); });
  });
  $('#btnNativeShare').addEventListener('click', function () {
    if (!navigator.share || !share || !share.url) return;
    navigator.share({ title: App.cfg(0).title || 'Xoay Vần', url: share.url }).catch(function () {});
  });
  $('#btnCopyShare').addEventListener('click', async function () {
    var v = $('#shareUrl').value;
    try { await navigator.clipboard.writeText(v); }
    catch (e) { $('#shareUrl').select(); document.execCommand('copy'); }
    U.toast(t('Đã sao chép liên kết vào bộ nhớ tạm'));
  });

  // Center text pictures are regenerated after loading a shared link.
  App.restoreCenterText = function () {
    App.group.wheelConfigs.forEach(function (c, i) {
      if (c.pictureType !== 'text' || !c.centerText || c.customPictureDataUri) return;
      App.fontsReady(c.font).then(function () {
        if (App.cfg(i) !== c || c.customPictureDataUri) return;
        c.customPictureDataUri = U.centerTextImage(c.centerText, Wheel.fontStack(c.font));
        App.refreshWheel(i);
      });
    });
  };

  // ================================================================ Gallery (built-in example wheels)
  App.openGallery = function () {
    if (App.isBusy()) return;
    $('#gallerySearch').value = '';
    renderGallery();
    U.openDialog('dlgGallery');
    setTimeout(function () { $('#gallerySearch').focus(); }, 30);
  };
  function galleryConfig(item) {
    var c = App.defaultConfig();
    c.title = item.title;
    c.description = item.desc;
    c.entries = item.entries.map(function (txt) { return { id: U.entryId(), text: txt }; });
    var colors = item.colors || (item.theme && App.themeColors(item.theme));
    if (colors) c.colorSettings = D.colorSettingsFrom(colors);
    return c;
  }
  function renderGallery() {
    var q = $('#gallerySearch').value.trim().toLowerCase();
    var items = D.GALLERY.filter(function (g) { return !q || (g.title + ' ' + g.desc + ' ' + g.entries.join(' ')).toLowerCase().indexOf(q) >= 0; });
    $('#galleryCount').textContent = t('{resultCount} bánh xe đã được tìm thấy.', { resultCount: items.length });
    $('#galleryGrid').innerHTML = items.map(function (g) {
      return '<div class="gallery-card" data-g="' + g.id + '"><canvas width="160" height="160"></canvas><b>' + U.esc(g.title) + '</b><small>' + U.esc(g.desc) + '</small><button type="button" class="btn btn-primary btn-xs" data-spin>' + U.esc(t('Quay bánh xe này')) + '</button></div>';
    }).join('');
    $$('#galleryGrid .gallery-card').forEach(function (card) {
      var g = D.GALLERY.find(function (x) { return x.id === card.dataset.g; });
      staticWheel($('canvas', card), 160, galleryConfig(g));
    });
  }
  $('#gallerySearch').addEventListener('input', U.debounce(renderGallery, 150));
  $('#galleryGrid').addEventListener('click', function (e) {
    var card = e.target.closest('.gallery-card');
    if (!card) return;
    var g = D.GALLERY.find(function (x) { return x.id === card.dataset.g; });
    var before = App.snapshot();
    U.closeDialog('dlgGallery');
    App.setGroup({ wheelConfigs: [galleryConfig(g)], shareMode: 'private', title: g.title, description: g.desc });
    App.undoToast(t('Đã mở "{wheelTitle}"', { wheelTitle: g.title }), before);
  });

  // ================================================================ Preferences
  App.openPreferences = function () {
    var p = App.prefs;
    $$('input[name="appTheme"]').forEach(function (r) { r.checked = r.value === p.appTheme; });
    $('#prefOverlay').checked = p.showWheelOverlay;
    $('#prefLangTip').checked = p.showLanguageTip;
    var sel = $('#prefNewTheme');
    sel.innerHTML = '<option value="">' + U.esc(t('Mặc định')) + '</option>' + D.THEMES.map(function (g) {
      return '<optgroup label="' + U.esc(t(g.group)) + '">' + g.themes.map(function (th) { return '<option value="' + U.esc(th[0]) + '">' + U.esc(th[0]) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    sel.value = p.newWheelTheme || '';
    U.openDialog('dlgPreferences');
  };
  $$('input[name="appTheme"]').forEach(function (r) { r.addEventListener('change', function () { App.prefs.appTheme = r.value; App.savePrefs(); App.applyTheme(); }); });
  $('#prefOverlay').addEventListener('change', function () { App.prefs.showWheelOverlay = this.checked; App.savePrefs(); App.wheels.forEach(function (w, i) { App.refreshWheel(i); }); });
  $('#prefLangTip').addEventListener('change', function () { App.prefs.showLanguageTip = this.checked; App.savePrefs(); });
  $('#prefNewTheme').addEventListener('change', function () { App.prefs.newWheelTheme = this.value; App.savePrefs(); });

  // ================================================================ Language
  var LANGS = [['vi', 'Tiếng Việt', 'Vietnamese'], ['en', 'English', 'English']];
  App.openLanguage = function () {
    var device = (navigator.languages || [navigator.language || '']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    var suggested = LANGS.filter(function (l) { return device.indexOf(l[0]) >= 0; });
    if (!suggested.length) suggested = LANGS.slice();
    var item = function (l) { return '<button type="button" class="language' + (l[0] === I18N.lang ? ' is-current' : '') + '" data-lang="' + l[0] + '">' + U.esc(l[1]) + '</button>'; };
    $('#langSuggested').innerHTML = suggested.map(item).join('');
    $('#langSearch').value = '';
    var renderAll = function () {
      var q = $('#langSearch').value.trim().toLowerCase();
      $('#langAll').innerHTML = LANGS.filter(function (l) { return !q || (l[1] + ' ' + l[2]).toLowerCase().indexOf(q) >= 0; }).map(item).join('');
    };
    $('#langSearch').oninput = renderAll;
    renderAll();
    U.openDialog('dlgLanguage');
  };
  $('#dlgLanguage').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) I18N.setLang(b.dataset.lang);
  });

  // Offer the device language once per session.
  function languageTip() {
    if (!App.prefs.showLanguageTip || sessionStorage.getItem('vqt_langtip')) return;
    var device = String((navigator.languages || [navigator.language])[0] || '').slice(0, 2).toLowerCase();
    var target = LANGS.find(function (l) { return l[0] === device; });
    if (!target || target[0] === I18N.lang) return;
    try { sessionStorage.setItem('vqt_langtip', '1'); } catch (e) {}
    setTimeout(function () {
      var tip = { vi: ['Trang này có sẵn bằng tiếng Việt', 'Chuyển sang tiếng Việt', 'Đừng hỏi lại nữa'], en: ['This page is available in English', 'Switch to English', "Don't ask again"] }[target[0]];
      U.toast(tip[0], {
        top: true, timeout: 7000,
        actions: [
          { label: tip[1], primary: true, onClick: function () { I18N.setLang(target[0]); } },
          { label: tip[2], onClick: function () { App.prefs.showLanguageTip = false; App.savePrefs(); } }
        ]
      });
    }, 3000);
  }

  // ================================================================ Sheet import (paste from Sheets/Excel or a CSV file)
  var sheetRows = [];
  App.openSheet = function () {
    if (App.isBusy() || App.isMulti()) return;
    $('#sheetText').value = '';
    $('#sheetHeader').checked = false;
    parseSheet();
    U.openDialog('dlgSheet');
    setTimeout(function () { $('#sheetText').focus(); }, 30);
  };
  function parseRows(text) {
    text = String(text).replace(/^﻿/, '');
    var first = text.split('\n')[0];
    var delim = first.indexOf('\t') >= 0 ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (c) { return c.trim(); }); }).filter(function (r) { return r.some(function (c) { return c; }); });
  }
  function colName(k) { return String.fromCharCode(65 + k); }
  function parseSheet() {
    sheetRows = parseRows($('#sheetText').value);
    var width = sheetRows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var header = $('#sheetHeader').checked && sheetRows.length ? sheetRows[0] : null;
    var colSel = $('#sheetColumn'), wSel = $('#sheetWeights');
    var prevCol = colSel.value, prevW = wSel.value;
    var label = function (k) { return colName(k) + (header && header[k] ? ' · ' + header[k] : ''); };
    colSel.innerHTML = Array.from({ length: Math.max(1, width) }, function (_, k) { return '<option value="' + k + '">' + U.esc(label(k)) + '</option>'; }).join('');
    if (prevCol && +prevCol < width) colSel.value = prevCol;
    var body = header ? sheetRows.slice(1) : sheetRows;
    var numeric = [];
    for (var k = 0; k < width; k++) {
      if (body.length && body.every(function (r) { return r[k] !== undefined && r[k] !== '' && +r[k] > 0; })) numeric.push(k);
    }
    wSel.innerHTML = '<option value="">' + U.esc(t('Không nhập trọng số')) + '</option>' + numeric.map(function (k) { return '<option value="' + k + '">' + U.esc(label(k)) + '</option>'; }).join('');
    if (prevW && numeric.indexOf(+prevW) >= 0) wSel.value = prevW;
    var entries = sheetEntries();
    $('#sheetPreview').textContent = entries.length ? t('Sẽ nhập {n} mục: {list}', { n: entries.length, list: entries.slice(0, 5).map(function (e) { return e.text; }).join(', ') + (entries.length > 5 ? '…' : '') }) : '';
    $('#btnSheetImport').disabled = !entries.length;
  }
  function sheetEntries() {
    var col = +$('#sheetColumn').value || 0, wc = $('#sheetWeights').value;
    var body = $('#sheetHeader').checked ? sheetRows.slice(1) : sheetRows;
    return body.map(function (r) {
      var txt = r[col];
      if (!txt) return null;
      var e = { id: U.entryId(), text: txt.slice(0, 1000) };
      if (wc !== '') { e.weight = +r[+wc] > 0 ? Math.min(9999, +r[+wc]) : 1; e.enabled = true; }
      return e;
    }).filter(Boolean);
  }
  $('#sheetText').addEventListener('input', U.debounce(parseSheet, 150));
  ['#sheetHeader', '#sheetColumn', '#sheetWeights'].forEach(function (s) { $(s).addEventListener('change', parseSheet); });
  $('#btnSheetFile').addEventListener('click', function () { $('#fileCsv').value = ''; $('#fileCsv').click(); });
  $('#fileCsv').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { $('#sheetText').value = fr.result; $('#sheetHeader').checked = true; parseSheet(); };
    fr.readAsText(f);
  });
  $('#btnSheetImport').addEventListener('click', function () {
    var entries = sheetEntries();
    if (!entries.length) return;
    var i = App.activeIndex(), cfg = App.cfg(i), before = App.snapshot();
    var weighted = $('#sheetWeights').value !== '';
    cfg.entries = entries;
    cfg.isAdvanced = weighted;
    App.afterEntriesChanged(i);
    App.rerenderBasic();
    App.renderEditor();
    U.closeDialog('dlgSheet');
    App.undoToast(t('Đã nhập {n} mục', { n: entries.length }), before);
  });

  // ================================================================ Fairness audit
  App.openFairness = function () {
    $('#fairOut').innerHTML = '';
    U.openDialog('dlgFairness');
  };
  $('#btnRunFairness').addEventListener('click', function () {
    var cfg = App.cfg(App.activeIndex());
    var out = $('#fairOut');
    var canvas = document.createElement('canvas');
    var w = Wheel.renderStatic(canvas, 10, App.wheelOptions(cfg));
    if (!w.slices.length) { out.innerHTML = '<p class="empty-note">' + U.esc(t('Không có mục nào')) + '</p>'; return; }
    var spins = +$('#fairSpins').value, runs = +$('#fairRuns').value;
    var travel = w.decelTravel(), n = w.slices.length;
    var results = [];
    for (var r = 0; r < runs; r++) {
      var counts = new Array(n).fill(0);
      var buf = new Uint32Array(4096), left = 0;
      for (var k = 0; k < spins; k++) {
        if (!left) { crypto.getRandomValues(buf); left = buf.length; }
        counts[w.indexAt(buf[--left] / 4294967295 * Math.PI * 2 + travel)]++;
      }
      results.push(counts);
    }
    var total = w.slices.reduce(function (s, x) { return s + x.width; }, 0);
    var chi = 0;
    var rows = w.slices.slice(0, 200).map(function (s, idx) {
      var p = s.width / total, exp = spins * p;
      var avg = results.reduce(function (a, c) { return a + c[idx]; }, 0) / runs;
      results.forEach(function (c) { chi += Math.pow(c[idx] - exp, 2) / exp; });
      return '<tr><td><span class="dot" style="background:' + s.color + '"></span>' + U.esc(s.label || '(' + t('Ảnh') + ')') + '</td><td>' + exp.toFixed(1) + '</td>' +
        results.map(function (c) { return '<td>' + c[idx] + '</td>'; }).join('') + '<td>' + avg.toFixed(1) + '</td></tr>';
    });
    var df = (n - 1) * runs;
    // Wilson–Hilferty approximation of the χ² p-value
    var z = (Math.pow(chi / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
    var pval = df > 0 ? 0.5 * erfc(z / Math.SQRT2) : 1;
    var ok = pval >= 0.01;
    out.innerHTML = '<p class="fair-summary ' + (ok ? 'pass' : 'warn') + '">' + U.esc(t('{total} lượt quay mô phỏng. χ² = {chi}, bậc tự do = {df}, p = {p}. {verdict}', {
      total: (spins * runs).toLocaleString(I18N.locale), chi: chi.toFixed(2), df: df, p: pval.toFixed(3),
      verdict: ok ? t('Kết quả phù hợp với một bánh xe công bằng.') : t('Lệch nhiều hơn bình thường, hãy chạy lại để kiểm tra.')
    })) + '</p>' +
      '<div class="table-wrap"><table class="fair-table"><thead><tr><th>' + U.esc(t('Ô bánh xe')) + '</th><th>' + U.esc(t('Kỳ vọng')) + '</th>' +
      results.map(function (c, k) { return '<th>' + U.esc(t('Chạy thử {n}', { n: k + 1 })) + '</th>'; }).join('') + '<th>' + U.esc(t('Trung bình')) + '</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  });
  function erfc(x) {
    var z = Math.abs(x), tt = 1 / (1 + z / 2);
    var r = tt * Math.exp(-z * z - 1.26551223 + tt * (1.00002368 + tt * (0.37409196 + tt * (0.09678418 + tt * (-0.18628806 + tt * (0.27886807 + tt * (-1.13520398 + tt * (1.48851587 + tt * (-0.82215223 + tt * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }

  // ================================================================ misc
  $('#btnChangelog').addEventListener('click', function () { U.openDialog('dlgChangelog'); });

  App.afterBoot = function () {
    if (App.afterBootEditor) App.afterBootEditor();
    App.restoreCenterText();
    languageTip();
  };
})();
