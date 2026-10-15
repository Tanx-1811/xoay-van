/* Entries panel: tabs, basic text box, advanced editor + dialog, add image, multi-wheel controls. */
(function () {
  'use strict';

  var D = window.DATA, U = window.UI, App = window.App, t = window.I18N.t;
  var $ = U.$, $$ = U.$$;
  var basic = $('#basicEditor');

  function cfgNow() { return App.cfg(App.activeIndex()); }

  // ---------------------------------------------------------------- tabs
  App.renderTabs = function () {
    var multi = App.isMulti();
    var html = App.group.wheelConfigs.map(function (cfg, i) {
      var id = 'entries-' + i;
      var label = multi ? t('Bánh xe {n}', { n: i + 1 }) : t('Mục');
      var badge = multi ? '' : ' <span class="badge">' + cfg.entries.length + '</span>';
      return '<button type="button" class="tab' + (App.tab === id ? ' is-active' : '') + '" role="tab" aria-selected="' + (App.tab === id) + '" data-tab="' + id + '">' + U.esc(label) + badge + '</button>';
    }).join('') +
      '<button type="button" class="tab' + (App.tab === 'results' ? ' is-active' : '') + '" role="tab" aria-selected="' + (App.tab === 'results') + '" data-tab="results">' + U.esc(t('Kết quả')) + ' <span class="badge">' + App.winners.length + '</span></button>';
    $('#editorTabs').innerHTML = html;
    var act = $('#editorTabs .tab.is-active');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  $('#editorTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    App.tab = b.dataset.tab;
    var m = /^entries-(\d+)$/.exec(App.tab);
    if (m) App.lastEntriesIndex = +m[1];
    App.renderEditor();
  });

  // ---------------------------------------------------------------- whole panel
  App.renderEditor = function () {
    var cfgs = App.group.wheelConfigs;
    if (App.tab !== 'results' && !/^entries-\d+$/.test(App.tab)) App.tab = 'entries-0';
    if (/^entries-/.test(App.tab) && App.activeIndex() !== +App.tab.split('-')[1]) App.tab = 'entries-' + App.activeIndex();
    App.renderTabs();
    var results = App.tab === 'results';
    $('#entriesPane').hidden = results;
    $('#resultsPane').hidden = !results;
    var i = App.activeIndex(), cfg = App.cfg(i), multi = cfgs.length > 1, n = i + 1;
    $('#chkAdvanced').checked = !!cfg.isAdvanced;
    $('#advancedWrap').hidden = !(cfg.entries.length < 200 || cfg.isAdvanced);
    $('#basicEditor').hidden = !!cfg.isAdvanced;
    $('#advEditor').hidden = !cfg.isAdvanced;
    if (cfg.isAdvanced) renderAdvanced(); else renderBasic(cfg);
    $('#btnSpinAll').hidden = !multi;
    $('#wheelActions').hidden = !multi;
    $('#lblCustomizeWheel').textContent = t('Tùy chỉnh bánh xe {n}', { n: n });
    $('#lblRenameWheel').textContent = t('Đổi tên bánh xe {n}', { n: n });
    $('#lblDeleteWheel').textContent = t('Xóa bánh xe {n}', { n: n });
    $('#btnAddWheel').disabled = cfgs.length >= D.MAX_WHEELS || App.isBusy();
    $('#btnAddWheelMenu').disabled = cfgs.length >= D.MAX_WHEELS || App.isBusy();
    App.renderEditorBusy(App.isBusy());
  };

  App.renderEditorBusy = function (busy) {
    $$('#editorCard .btn, #editorCard input, #editorCard .tab').forEach(function (el) {
      if (el.id === 'btnAddWheel' || el.id === 'btnAddWheelMenu') el.disabled = busy || App.group.wheelConfigs.length >= D.MAX_WHEELS;
      else el.disabled = busy;
    });
    basic.contentEditable = busy ? 'false' : 'true';
    basic.classList.toggle('is-locked', busy);
  };

  App.onEntriesChanged = function (i) {
    if (i !== App.activeIndex()) return;
    var cfg = App.cfg(i);
    $('#advancedWrap').hidden = !(cfg.entries.length < 200 || cfg.isAdvanced);
    if (cfg.isAdvanced) refreshAdvancedMeta();
  };

  // ---------------------------------------------------------------- basic editor (contenteditable, one <div> per entry)
  function lineHtml(e) {
    var img = e.image ? '<img src="' + U.esc(e.image) + '" alt="" style="height:25px">' : '';
    var text = e.text ? (/^ +$/.test(e.text) ? e.text.replace(/ /g, '&nbsp;') : U.esc(e.text)) : '';
    return '<div>' + img + (text || (img ? '' : '<br>')) + '</div>';
  }
  function renderBasic(cfg) {
    if (document.activeElement === basic && basic.dataset.wheel === String(App.activeIndex())) return;
    basic.dataset.wheel = App.activeIndex();
    basic.innerHTML = cfg.entries.map(lineHtml).join('');
  }
  App.rerenderBasic = function () { basic.dataset.wheel = ''; if (!cfgNow().isAdvanced) { var f = document.activeElement === basic; basic.blur(); renderBasic(cfgNow()); if (f) basic.focus(); } };

  var decoder = document.createElement('textarea');
  function unescapeHtml(s) { decoder.innerHTML = s; return decoder.value; }
  function parseBasic(html) {
    var out = [];
    html.split(/<div[^>]*>|<\/div>|<br\s*\/?>|<p[^>]*>|<\/p>/i).forEach(function (line) {
      var m = /<img[^>]*?\ssrc="([^"]*)"/i.exec(line);
      var text = line.replace(/<!--[\s\S]*?-->/g, '').replace(/<img[^>]*>/gi, '').replace(/<[^>]+>/g, '');
      text = unescapeHtml(text).replace(/ /g, ' ').replace(/[\r\n]/g, '');
      var image = m ? unescapeHtml(m[1]) : null;
      if (!text.trim() && !image) return;
      out.push({ text: text, image: image });
    });
    return out;
  }
  // Keep ids of unchanged lines so winners can still be removed after an edit.
  function reconcile(old, parsed) {
    var pool = new Map();
    old.forEach(function (e) { var k = e.text + '\u0000' + (e.image || ''); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(e); });
    return parsed.map(function (p) {
      var k = p.text + '\u0000' + (p.image || '');
      var list = pool.get(k);
      if (list && list.length) return list.shift();
      var e = { id: U.entryId(), text: p.text.slice(0, 1000) };
      if (p.image) e.image = p.image;
      return e;
    });
  }
  basic.addEventListener('input', function () {
    var i = App.activeIndex(), cfg = App.cfg(i);
    if (cfg.isAdvanced) return;
    cfg.entries = reconcile(cfg.entries, parseBasic(basic.innerHTML));
    App.afterEntriesChanged(i);
  });
  basic.addEventListener('beforeinput', function (e) {
    if (/^format(Bold|Italic|Underline)/.test(e.inputType)) e.preventDefault();
  });
  basic.addEventListener('paste', function (e) {
    var cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    var files = Array.from(cd.files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (files.length) { addImageEntries(files); return; }
    var html = cd.getData('text/html');
    var m = html && /<img[^>]*src="(data:image[^"]+)"/i.exec(html);
    if (m) { document.execCommand('insertHTML', false, '<img src="' + m[1] + '" alt="" style="height:25px">'); return; }
    var text = cd.getData('text/plain');
    if (text) document.execCommand('insertText', false, text.replace(/\r\n?/g, '\n'));
  });
  basic.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.from(e.dataTransfer.items || []).some(function (it) { return it.kind === 'file'; })) e.preventDefault(); });
  basic.addEventListener('drop', function (e) {
    var files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length) return;
    e.preventDefault();
    addImageEntries(files);
  });

  async function addImageEntries(files) {
    var i = App.activeIndex(), cfg = App.cfg(i);
    for (var k = 0; k < files.length; k++) {
      try {
        var data = await U.processEntryImage(files[k]);
        var e = { id: U.entryId(), text: '', image: data };
        if (cfg.isAdvanced) { e.weight = 1; e.enabled = true; e.color = await cornerColor(data); }
        cfg.entries.push(e);
      } catch (err) { U.toast(t('Không đọc được hình ảnh này.')); }
    }
    App.afterEntriesChanged(i);
    App.rerenderBasic();
    if (cfg.isAdvanced) renderAdvanced(true);
  }

  async function cornerColor(src) {
    try {
      var img = await U.loadImg(src);
      var c = document.createElement('canvas'); c.width = c.height = 1;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, img.naturalWidth, img.naturalHeight);
      var d = g.getImageData(0, 0, 1, 1).data;
      if (d[3] < 255) return undefined;
      if (d[0] > 230 && d[1] > 230 && d[2] > 230) return '#FFFFFF';
      return '#' + [d[0], d[1], d[2]].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('').toUpperCase();
    } catch (e) { return undefined; }
  }
  App.cornerColor = cornerColor;

  // ---------------------------------------------------------------- toolbar
  $('#btnShuffle').addEventListener('click', function () {
    var i = App.activeIndex(), list = App.cfg(i).entries;
    for (var k = list.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var tmp = list[k]; list[k] = list[j]; list[j] = tmp; }
    App.afterEntriesChanged(i); App.renderEditor(); App.rerenderBasic();
  });
  $('#btnSort').addEventListener('click', function () {
    var i = App.activeIndex();
    App.cfg(i).entries.sort(function (a, b) { return String(a.text).localeCompare(String(b.text), 'en', { numeric: true, sensitivity: 'base' }); });
    App.afterEntriesChanged(i); App.renderEditor(); App.rerenderBasic();
  });

  $('#chkAdvanced').addEventListener('click', async function (e) {
    e.preventDefault();
    var i = App.activeIndex(), cfg = App.cfg(i);
    var turnOn = !cfg.isAdvanced;
    var ok = await U.confirm(turnOn
      ? t('Bạn có chắc chắn muốn chuyển sang chế độ nâng cao không? Chế độ nâng cao cung cấp nhiều tùy chỉnh hơn, nhưng bạn không thể dán nhiều mục nhập cùng một lúc. Bạn luôn có thể quay lại bằng cách bỏ chọn hộp kiểm "Nâng cao".')
      : t('Nếu bạn quay lại từ chế độ nâng cao, bạn có thể mất một số màu. Bạn có chắc chắn muốn tiếp tục không?'));
    if (!ok) return;
    if (turnOn) {
      for (var k = 0; k < cfg.entries.length; k++) {
        var en = cfg.entries[k];
        en.weight = 1; en.enabled = true;
        if (en.image && !en.color) en.color = await cornerColor(en.image);
        if (!en.color) delete en.color;
      }
      cfg.isAdvanced = true;
    } else {
      cfg.entries = cfg.entries.map(function (en) { var o = { id: en.id, text: en.text }; if (en.image) o.image = en.image; return o; })
        .filter(function (en) { return en.text.trim() || en.image; });
      cfg.isAdvanced = false;
    }
    App.afterEntriesChanged(i);
    basic.dataset.wheel = '';
    App.renderEditor();
  });

  // ---------------------------------------------------------------- add image
  var imageTarget = null; // 'background' | 'center' | 'entry' | {entry}
  $('#btnAddImage').addEventListener('click', function () { U.toggleMenu('addImageMenu', $('#btnAddImageMenu')); });
  $('#btnAddImageMenu').addEventListener('click', function () { U.toggleMenu('addImageMenu', this); });
  $('#addImageMenu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-img]');
    if (!b) return;
    if (b.dataset.img === 'entry') { pickImages('entry', true); return; }
    imageTarget = b.dataset.img;
    $('#addImageTitle').textContent = imageTarget === 'center' ? t('Thêm hình ảnh trung tâm') : t('Thêm hình nền');
    U.openDialog('dlgAddImage');
  });
  $('#btnAddImageGallery').addEventListener('click', function () {
    U.closeDialog('dlgAddImage');
    App.pickPicture(function (id) {
      var i = App.activeIndex(), cfg = App.cfg(i), before = App.snapshot();
      if (imageTarget === 'center') {
        cfg.pictureType = 'gallery'; cfg.galleryPicture = U.picture(id, 370);
        if (cfg.hubSize === 'S') cfg.hubSize = 'L';
        App.refreshWheel(i); App.persist();
        App.undoToast(t('Đã cập nhật hình ảnh tâm bánh xe'), before);
      } else {
        cfg.type = 'image'; cfg.coverImageType = 'gallery'; cfg.coverImageName = id;
        App.refreshWheel(i); App.persist();
        App.undoToast(t('Đã cập nhật hình nền bánh xe'), before);
      }
    });
  });
  $('#btnAddImageUpload').addEventListener('click', function () { U.closeDialog('dlgAddImage'); pickImages(imageTarget, false); });

  function pickImages(target, multiple) {
    imageTarget = target;
    var inp = $('#fileImage');
    inp.multiple = !!multiple;
    inp.value = '';
    inp.click();
  }
  App.pickImages = pickImages;
  $('#fileImage').addEventListener('change', async function () {
    var files = Array.from(this.files || []).filter(function (f) { return /^image\//.test(f.type); });
    var target = imageTarget;
    imageTarget = null;
    if (!files.length || !target) return;
    if (target === 'entry') { addImageEntries(files); return; }
    if (typeof target === 'object' && target.onImage) {
      try { target.onImage(await U.processEntryImage(files[0])); } catch (err) { U.toast(t('Không đọc được hình ảnh này.')); }
      return;
    }
    if (target === 'center' || target === 'background') App.uploadWheelImage(target, files[0], App.activeIndex());
  });

  // Upload a center image or wheel background picture for wheel i (also used by Customize).
  App.uploadWheelImage = async function (target, file, i, onDone) {
    var cfg = App.cfg(i), before = App.snapshot();
    try {
      if (target === 'center') {
        var r = await U.processCenterImage(file);
        cfg.pictureType = 'uploaded'; cfg.customPictureDataUri = r.data; cfg.customPictureName = file.name;
        if (cfg.hubSize === 'S') cfg.hubSize = 'L';
        App.refreshWheel(i); App.persist();
        App.undoToast(t('Đã cập nhật hình ảnh tâm bánh xe'), before);
        if (onDone) onDone(cfg);
        if (!cfg.isAdvanced) {
          var colors = U.prominentColors(r.img, 6);
          if (colors.length && await U.confirm(t('Hình ảnh "{fileName}" của bạn đã được tải lên thành công. Bạn có muốn sử dụng các màu sắc nổi bật từ hình ảnh này cho các ô trên bánh xe của bạn không?', { fileName: file.name }), { title: t('Điều chỉnh màu sắc trên bánh xe?'), ok: t('Có'), cancel: t('Không') })) {
            cfg.colorSettings = D.colorSettingsFrom(colors);
            App.refreshWheel(i); App.persist();
            if (onDone) onDone(cfg);
          }
        }
      } else {
        var c = await U.processCoverImage(file);
        cfg.type = 'image'; cfg.coverImageType = 'uploaded'; cfg.customCoverImageDataUri = c.data; cfg.coverImageName = file.name;
        App.refreshWheel(i); App.persist();
        App.undoToast(t('Đã cập nhật hình nền bánh xe'), before);
        if (onDone) onDone(cfg);
      }
    } catch (err) { U.toast(t('Không đọc được hình ảnh này.')); }
  };

  // ---------------------------------------------------------------- advanced editor
  function probabilities(cfg) {
    var seen = new Set(), weights = new Map(), total = 0;
    cfg.entries.forEach(function (e) {
      var w = 0;
      if (e.enabled !== false) {
        var k = (e.text || '') + '||' + (e.image || '');
        if (cfg.allowDuplicates || !seen.has(k)) { w = e.weight > 0 ? e.weight : 1; seen.add(k); }
      }
      weights.set(e.id, w); total += w;
    });
    return function (e) { return total ? 100 * weights.get(e.id) / total : 0; };
  }
  App.probabilities = probabilities;

  function sliceColor(cfg, e, idx) {
    if (e.color) return e.color;
    var pal = App.palette(cfg), P = pal.length, n = cfg.entries.length;
    var c = pal[idx % P];
    if (n > 1 && idx === n - 1 && idx % P === 0 && P > 2) c = pal[1];
    return c;
  }
  App.sliceColor = sliceColor;

  function wideEditor() { return $('#editorCard').clientWidth > 356; }

  function rowHtml(cfg, e, idx, prob, wide) {
    var n = cfg.entries.length;
    var color = sliceColor(cfg, e, idx);
    var fg = Wheel.textColorFor(color);
    var colorBtn = cfg.type === 'image' ? '' :
      '<label class="adv-color" style="background:' + color + ';color:' + fg + '" title="' + U.esc(e.color ? t('Màu này đã được chỉ định thủ công') : t('Màu sắc này được thừa hưởng từ chủ đề')) + '">' +
      '<i class="fas ' + (e.color ? 'fa-paint-roller' : 'fa-palette') + '"></i><input type="color" data-act="color" value="' + (App.hex6(color) || '#cccccc').toLowerCase() + '" aria-label="' + U.esc(t('Màu')) + '"></label>';
    var img = e.image
      ? '<span class="adv-thumb"><img src="' + U.esc(e.image) + '" alt=""><button type="button" class="thumb-x" data-act="rmimg" aria-label="' + U.esc(t('Xóa hình ảnh')) + '"><i class="fas fa-times"></i></button></span>'
      : '<button type="button" class="rb rb-flat" data-act="img" aria-label="' + U.esc(t('Thêm ảnh')) + '" title="' + U.esc(t('Thêm ảnh')) + '"><i class="fas fa-image"></i></button>';
    var weight = wide
      ? '<span class="adv-weight-field"><i class="fas fa-balance-scale-left"></i><input type="number" data-act="weight" min="0" max="9999" step="any" value="' + (e.weight || 1) + '" aria-label="' + U.esc(t('Trọng số')) + '"><button type="button" data-act="dec" aria-label="-"><i class="fas fa-minus"></i></button><button type="button" data-act="inc" aria-label="+"><i class="fas fa-plus"></i></button></span><span class="adv-prob">' + Math.round(prob) + '%</span>'
      : '';
    return '<li class="adv-row' + (e.enabled === false ? ' is-faded' : '') + '" data-id="' + U.esc(e.id) + '">' +
      '<div class="adv-move">' +
      '<button type="button" class="rb" data-act="up" aria-label="▲"' + (idx === 0 ? ' disabled' : '') + '><i class="fas fa-arrow-up"></i></button>' +
      '<button type="button" class="rb" data-act="down" aria-label="▼"' + (idx === n - 1 ? ' disabled' : '') + '><i class="fas fa-arrow-down"></i></button></div>' +
      '<div class="adv-main"><input class="adv-text" data-act="text" value="' + U.esc(e.text) + '" aria-label="' + U.esc(t('Văn bản')) + '">' +
      '<div class="adv-tools">' + colorBtn + img + weight + '</div></div>' +
      '<button type="button" class="rb rb-round rb-primary adv-edit" data-act="edit" aria-label="' + U.esc(t('Chỉnh sửa')) + '" title="' + U.esc(t('Chỉnh sửa')) + '"><i class="fas fa-sliders"></i></button>' +
      '<div class="adv-side"><button type="button" class="rb" data-act="del" aria-label="' + U.esc(t('Xóa')) + '"><i class="fas fa-times"></i></button>' +
      '<input type="checkbox" data-act="enabled"' + (e.enabled === false ? '' : ' checked') + ' aria-label="' + U.esc(t('Hiển thị')) + '"></div></li>';
  }

  function renderAdvanced(scrollToEnd) {
    var cfg = cfgNow(), prob = probabilities(cfg), wide = wideEditor();
    var list = $('#advList');
    var focusId = document.activeElement && document.activeElement.closest && document.activeElement.closest('.adv-row') ? document.activeElement.closest('.adv-row').dataset.id : null;
    list.innerHTML = cfg.entries.map(function (e, i) { return rowHtml(cfg, e, i, prob(e), wide); }).join('');
    $('#btnRevealHidden').hidden = !cfg.entries.some(function (e) { return e.enabled === false; });
    if (scrollToEnd) list.scrollTop = list.scrollHeight;
    if (focusId) { var inp = $('.adv-row[data-id="' + focusId + '"] .adv-text', list); if (inp) inp.focus(); }
  }
  App.renderAdvanced = renderAdvanced;

  // Update percentages/colors in place while typing, without rebuilding rows.
  function refreshAdvancedMeta() {
    var cfg = cfgNow(), prob = probabilities(cfg);
    $$('#advList .adv-row').forEach(function (row) {
      var idx = cfg.entries.findIndex(function (e) { return e.id === row.dataset.id; });
      if (idx < 0) return;
      var e = cfg.entries[idx];
      var p = $('.adv-prob', row); if (p) p.textContent = Math.round(prob(e)) + '%';
      row.classList.toggle('is-faded', e.enabled === false);
    });
    $('#btnRevealHidden').hidden = !cfg.entries.some(function (e) { return e.enabled === false; });
  }

  function rowEntry(el) {
    var row = el.closest('.adv-row');
    if (!row) return null;
    var cfg = cfgNow();
    var idx = cfg.entries.findIndex(function (e) { return e.id === row.dataset.id; });
    return idx < 0 ? null : { cfg: cfg, idx: idx, e: cfg.entries[idx], row: row };
  }

  $('#advList').addEventListener('input', function (ev) {
    var r = rowEntry(ev.target);
    if (!r) return;
    var act = ev.target.dataset.act, i = App.activeIndex();
    if (act === 'text') { r.e.text = ev.target.value.slice(0, 1000); App.afterEntriesChanged(i); }
    else if (act === 'weight') {
      var w = parseFloat(ev.target.value);
      if (w > 0) { r.e.weight = Math.min(9999, w); App.afterEntriesChanged(i); }
    } else if (act === 'color') {
      r.e.color = ev.target.value.toUpperCase();
      var lab = ev.target.parentElement;
      lab.style.background = r.e.color; lab.style.color = Wheel.textColorFor(r.e.color);
      $('i', lab).className = 'fas fa-paint-roller';
      App.afterEntriesChanged(i);
    }
  });
  $('#advList').addEventListener('change', function (ev) {
    var r = rowEntry(ev.target);
    if (!r) return;
    if (ev.target.dataset.act === 'enabled') { r.e.enabled = ev.target.checked; App.afterEntriesChanged(App.activeIndex()); }
    if (ev.target.dataset.act === 'weight' && !(parseFloat(ev.target.value) > 0)) ev.target.value = r.e.weight || 1;
  });
  $('#advList').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]');
    if (!b) return;
    var r = rowEntry(b);
    if (!r) return;
    var list = r.cfg.entries, i = App.activeIndex(), act = b.dataset.act;
    if (act === 'up' && r.idx > 0) { list.splice(r.idx - 1, 0, list.splice(r.idx, 1)[0]); }
    else if (act === 'down' && r.idx < list.length - 1) { list.splice(r.idx + 1, 0, list.splice(r.idx, 1)[0]); }
    else if (act === 'del') { list.splice(r.idx, 1); }
    else if (act === 'inc') { r.e.weight = Math.min(9999, (r.e.weight || 1) + 1); }
    else if (act === 'dec') { r.e.weight = Math.max(1, (r.e.weight || 1) - 1); }
    else if (act === 'rmimg') { delete r.e.image; }
    else if (act === 'img') {
      pickImages({ onImage: async function (data) { r.e.image = data; if (!r.e.color) { var c = await cornerColor(data); if (c) r.e.color = c; } App.afterEntriesChanged(i); renderAdvanced(); } }, false);
      return;
    } else if (act === 'edit') { openAdvancedDialog(r.idx); return; }
    else return;
    App.afterEntriesChanged(i);
    renderAdvanced();
  });
  $('#advList').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.target.dataset.act !== 'text') return;
    ev.preventDefault();
    var r = rowEntry(ev.target);
    if (!r) return;
    var ne = { id: U.entryId(), text: '', weight: 1, enabled: true };
    r.cfg.entries.splice(r.idx + 1, 0, ne);
    App.afterEntriesChanged(App.activeIndex());
    renderAdvanced();
    var inp = $('.adv-row[data-id="' + ne.id + '"] .adv-text');
    if (inp) inp.focus();
  });
  $('#btnAddEntry').addEventListener('click', function () {
    var cfg = cfgNow(), ne = { id: U.entryId(), text: '', weight: 1, enabled: true };
    cfg.entries.push(ne);
    App.afterEntriesChanged(App.activeIndex());
    renderAdvanced(true);
    var inp = $('.adv-row[data-id="' + ne.id + '"] .adv-text');
    if (inp) inp.focus();
  });
  $('#btnRevealHidden').addEventListener('click', function () {
    cfgNow().entries.forEach(function (e) { e.enabled = true; });
    App.afterEntriesChanged(App.activeIndex());
    renderAdvanced();
  });

  // ---------------------------------------------------------------- advanced dialog (edits a copy, OK commits)
  var adv = null; // { entries, idx, wheel }
  function openAdvancedDialog(idx) {
    var i = App.activeIndex();
    adv = { entries: U.clone(App.cfg(i).entries), idx: idx, wheel: i };
    var sel = $('#advSound');
    sel.innerHTML = '<option value="">' + U.esc(t('Kế thừa từ bánh xe')) + '</option>' + D.AFTER_SOUNDS.map(function (s) { return '<option value="' + s[0] + '">' + U.esc(t(s[1])) + '</option>'; }).join('');
    renderAdvDialog();
    U.openDialog('dlgAdvanced');
  }
  function advCfg() { var c = U.clone(App.cfg(adv.wheel)); c.entries = adv.entries; return c; }
  function renderAdvDialog() {
    var n = adv.entries.length;
    $('#advEmpty').hidden = n > 0;
    $('#advForm').hidden = n === 0;
    $('#advNav').hidden = n === 0;
    if (!n) return;
    adv.idx = Math.max(0, Math.min(n - 1, adv.idx));
    var e = adv.entries[adv.idx], cfg = advCfg();
    $('#advPos').textContent = t('Mục') + ' ' + (adv.idx + 1) + ' / ' + n;
    $('#advPrev').disabled = adv.idx === 0;
    $('#advNext').disabled = adv.idx === n - 1;
    $('#advVisible').checked = e.enabled !== false;
    $('#advText').value = e.text;
    var color = sliceColor(cfg, e, adv.idx);
    var cb = $('#advColorBtn');
    cb.style.background = color; cb.style.color = Wheel.textColorFor(color);
    cb.title = e.color ? t('Màu này đã được chỉ định thủ công') : t('Màu sắc này được thừa hưởng từ chủ đề');
    $('#advColor').value = (App.hex6(color) || '#cccccc').toLowerCase();
    $('#advColorRow').hidden = cfg.type === 'image';
    $('#advResetColor').hidden = !e.color;
    $('#advColorFromImage').hidden = !(e.image && !e.color);
    $('#advImgPreview').hidden = !e.image;
    if (e.image) $('#advImg').src = e.image; else $('#advImg').removeAttribute('src');
    $('#advAddImage').hidden = !!e.image;
    $('#advSound').value = e.sound || '';
    $('#advMessageRow').hidden = !cfg.displayWinnerDialog;
    $('#advMessage').value = e.message || '';
    $('#advWeight').value = e.weight || 1;
    var p = probabilities(cfg)(e);
    $('#advProb').textContent = t('Xác suất') + ': ' + p.toFixed(1) + '%';
  }
  function advEntry() { return adv && adv.entries[adv.idx]; }
  $('#advPrev').addEventListener('click', function () { adv.idx--; renderAdvDialog(); });
  $('#advNext').addEventListener('click', function () { adv.idx++; renderAdvDialog(); });
  $('#advAddAfter').addEventListener('click', function () { adv.entries.splice(adv.idx + 1, 0, { id: U.entryId(), text: '', weight: 1, enabled: true }); adv.idx++; renderAdvDialog(); $('#advText').focus(); });
  $('#advAddFirst').addEventListener('click', function () { adv.entries.push({ id: U.entryId(), text: '', weight: 1, enabled: true }); adv.idx = adv.entries.length - 1; renderAdvDialog(); $('#advText').focus(); });
  $('#advVisible').addEventListener('change', function () { advEntry().enabled = this.checked; renderAdvDialog(); });
  $('#advDuplicate').addEventListener('click', function () { var c = U.clone(advEntry()); c.id = U.entryId(); adv.entries.splice(adv.idx + 1, 0, c); adv.idx++; renderAdvDialog(); });
  $('#advDelete').addEventListener('click', function () { adv.entries.splice(adv.idx, 1); renderAdvDialog(); });
  $('#advText').addEventListener('input', function () { advEntry().text = this.value.slice(0, 1000); });
  $('#advColor').addEventListener('input', function () { advEntry().color = this.value.toUpperCase(); renderAdvDialog(); });
  $('#advResetColor').addEventListener('click', function () { delete advEntry().color; renderAdvDialog(); });
  $('#advColorFromImage').addEventListener('click', async function () { var e = advEntry(); var c = await cornerColor(e.image); if (c) e.color = c; renderAdvDialog(); });
  $('#advRemoveImage').addEventListener('click', function () { delete advEntry().image; renderAdvDialog(); });
  $('#advAddImage').addEventListener('click', function () { pickImages({ onImage: function (data) { if (adv) { advEntry().image = data; renderAdvDialog(); } } }, false); });
  $('#advSound').addEventListener('change', function () { var e = advEntry(); if (this.value) e.sound = this.value; else delete e.sound; });
  $('#advMessage').addEventListener('input', function () { var e = advEntry(); if (this.value) e.message = this.value.slice(0, 100); else delete e.message; });
  $('#advWeight').addEventListener('input', function () { var w = parseFloat(this.value); if (w > 0) { advEntry().weight = Math.min(9999, w); $('#advProb').textContent = t('Xác suất') + ': ' + probabilities(advCfg())(advEntry()).toFixed(1) + '%'; } });
  $('#advWeightDec').addEventListener('click', function () { var e = advEntry(); e.weight = Math.max(1, (e.weight || 1) - 1); renderAdvDialog(); });
  $('#advWeightInc').addEventListener('click', function () { var e = advEntry(); e.weight = Math.min(9999, (e.weight || 1) + 1); renderAdvDialog(); });
  $('#btnAdvancedOk').addEventListener('click', function () {
    if (!adv) return;
    App.cfg(adv.wheel).entries = adv.entries;
    App.afterEntriesChanged(adv.wheel);
    U.closeDialog('dlgAdvanced', 'ok');
    renderAdvanced();
  });
  $('#dlgAdvanced').addEventListener('close', function () { adv = null; });

  // ---------------------------------------------------------------- multi-wheel controls
  $('#btnAddWheel').addEventListener('click', function () { addWheel(App.defaultConfig()); });
  $('#btnAddWheelMenu').addEventListener('click', function () { U.toggleMenu('addWheelMenu', this); });
  $('#addWheelMenu').addEventListener('click', function (e) { if (e.target.closest('[data-act="add-open"]')) App.openWorkflow({ append: true }); });
  function addWheel(cfg) {
    if (App.group.wheelConfigs.length >= D.MAX_WHEELS || App.isBusy()) return;
    App.group.wheelConfigs.push(cfg);
    App.tab = 'entries-' + (App.group.wheelConfigs.length - 1);
    App.lastEntriesIndex = App.group.wheelConfigs.length - 1;
    App.renderWheels();
    App.renderEditor();
    App.persist();
  }
  App.addWheel = addWheel;
  $('#btnSpinAll').addEventListener('click', function () { App.spinAll(); });
  $('#btnCustomizeWheel').addEventListener('click', function () { App.openCustomize(App.activeIndex()); });
  $('#btnRenameWheel').addEventListener('click', function () { App.openTitleDialog(App.activeIndex()); });
  $('#btnDeleteWheel').addEventListener('click', async function () {
    var i = App.activeIndex();
    if (!App.isMulti() || App.isBusy()) return;
    if (!await U.confirm(t('Bạn có chắc chắn muốn xóa Bánh xe {n} không?', { n: i + 1 }))) return;
    App.group.wheelConfigs.splice(i, 1);
    App.overlayHidden.splice(i, 1);
    App.tab = 'entries-' + Math.max(0, i - 1);
    App.lastEntriesIndex = Math.max(0, i - 1);
    App.renderWheels();
    App.renderEditor();
    App.persist();
  });

  window.addEventListener('resize', U.debounce(function () {
    if (cfgNow() && cfgNow().isAdvanced && $('#advList').children.length) {
      var wide = wideEditor();
      if (wide !== !!$('#advList .adv-weight-field')) renderAdvanced();
    }
  }, 150));

  // Advanced wheels that use no advanced feature go back to basic mode shortly after loading.
  App.afterBootEditor = function () {
    setTimeout(function () {
      App.group.wheelConfigs.forEach(function (cfg, i) {
        if (!cfg.isAdvanced) return;
        var used = cfg.entries.some(function (e) { return e.color || (e.weight && e.weight !== 1) || e.enabled === false || e.sound || e.message; });
        if (!used) {
          cfg.isAdvanced = false;
          cfg.entries = cfg.entries.filter(function (e) { return e.text.trim() || e.image; }).map(function (e) { var o = { id: e.id, text: e.text }; if (e.image) o.image = e.image; return o; });
          App.refreshWheel(i);
        }
      });
      basic.dataset.wheel = '';
      App.renderEditor();
    }, 200);
  };
})();
