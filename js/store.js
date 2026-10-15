/* Persistence (localStorage) and share-link encoding. */
(function () {
  'use strict';

  var KEY_CURRENT = 'vqt_current';   // the wheels on screen
  var KEY_SAVED = 'vqt_saved';       // "Lưu vào trình duyệt" list
  var KEY_OPTIONS = 'vqt_options';   // app-level options (theme, click-to-spin text...)

  function uid(prefix) {
    var a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + a[0].toString(36) + a[1].toString(36).slice(0, 4);
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false; // quota exceeded or storage blocked
    }
  }

  // ---- Share links: JSON -> deflate-raw -> base64url, stored in the URL hash ----
  function toBase64Url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(str) {
    var s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function pipe(bytes, stream) {
    var res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }

  async function encodeShare(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'function') {
      return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    }
    return 'j' + toBase64Url(bytes);
  }

  async function decodeShare(str) {
    var kind = str.charAt(0);
    var bytes = fromBase64Url(str.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') throw new Error('Unknown share format');
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  window.Store = {
    uid: uid,
    loadCurrent: function () { return read(KEY_CURRENT, null); },
    saveCurrent: function (state) { return write(KEY_CURRENT, state); },
    loadOptions: function () { return read(KEY_OPTIONS, {}); },
    saveOptions: function (o) { return write(KEY_OPTIONS, o); },
    listSaved: function () { return read(KEY_SAVED, []); },
    upsertSaved: function (wheel) {
      var list = read(KEY_SAVED, []);
      var i = list.findIndex(function (w) { return w.id === wheel.id; });
      var copy = JSON.parse(JSON.stringify(wheel));
      copy.savedAt = Date.now();
      if (i >= 0) list.splice(i, 1);
      list.unshift(copy);
      return write(KEY_SAVED, list);
    },
    removeSaved: function (id) {
      write(KEY_SAVED, read(KEY_SAVED, []).filter(function (w) { return w.id !== id; }));
    },
    getSaved: function (id) {
      return read(KEY_SAVED, []).find(function (w) { return w.id === id; }) || null;
    },
    encodeShare: encodeShare,
    decodeShare: decodeShare
  };
})();
