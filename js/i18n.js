/* i18n: the page is written in Vietnamese; EN maps each Vietnamese string to English.
   t('Đã xóa {name}', { name: x }) fills placeholders. */
(function () {
  'use strict';

  var LANGS = ['vi', 'en'];
  var EN = window.I18N_EN || {};

  function pickLang() {
    var q = /[?&]lang=(\w+)/.exec(location.search);
    if (q && LANGS.indexOf(q[1]) >= 0) return q[1];
    try {
      var saved = JSON.parse(localStorage.getItem('vqt_options') || '{}').lang;
      if (LANGS.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    return 'vi';
  }
  var lang = pickLang();

  function t(s, vars) {
    var out = lang === 'en' && EN[s] != null ? EN[s] : s;
    if (vars) out = String(out).replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
    return out;
  }

  // Static page text: translate text nodes and title/aria-label/placeholder/data-tip attributes once at load.
  var ATTRS = ['title', 'aria-label', 'placeholder', 'data-tip', 'label'];
  function translateStatic(root) {
    if (lang === 'vi') return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && /^(SCRIPT|STYLE|CODE|KBD)$/.test(n.nodeName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) {
        var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue);
        var key = m[2].replace(/\s+/g, ' ');
        if (key && EN[key] != null) n.nodeValue = m[1] + EN[key] + m[3];
      } else {
        for (var i = 0; i < ATTRS.length; i++) {
          var v = n.getAttribute(ATTRS[i]);
          if (v && EN[v] != null) n.setAttribute(ATTRS[i], EN[v]);
        }
      }
    }
    var meta = document.querySelector('meta[name="description"]');
    if (meta && EN[meta.content]) meta.content = EN[meta.content];
    if (EN[document.title]) document.title = EN[document.title];
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0) return;
    try {
      var o = JSON.parse(localStorage.getItem('vqt_options') || '{}');
      o.lang = next;
      localStorage.setItem('vqt_options', JSON.stringify(o));
    } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.delete('lang');
    if (next !== 'vi') url.searchParams.set('lang', next);
    location.href = url.toString();
  }

  document.documentElement.lang = lang;
  translateStatic(document.body);
  document.querySelectorAll('.js-lang-name').forEach(function (el) { el.textContent = lang === 'en' ? 'English' : 'Tiếng Việt'; });

  window.I18N = {
    t: t,
    setLang: setLang,
    lang: lang,
    locale: lang === 'en' ? 'en-US' : 'vi-VN'
  };
})();
