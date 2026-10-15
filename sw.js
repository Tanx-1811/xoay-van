/* Xoay Vần service worker.
   The app's own files: network first, so an online visit always gets the latest version and the
   cached copy is only used offline. Fonts, icons and libraries from CDNs: cache first.
   Other paths on the same origin are left alone. */
var CACHE = 'xoay-van-v3';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'img/logo.svg',
  'js/data.js', 'js/i18n-en.js', 'js/i18n.js', 'js/store.js', 'js/ui.js', 'js/audio.js', 'js/confetti.js',
  'js/wheel.js', 'js/app.js', 'js/editor.js', 'js/dialogs.js', 'js/features.js'
];
var CDN = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/;
var BASE_PATH = new URL('./', self.location.href).pathname;

// Is this one of the app's own files (or the page itself)?
function isAppFile(url) {
  if (url.origin !== self.location.origin || url.pathname.indexOf(BASE_PATH) !== 0) return false;
  var rel = url.pathname.slice(BASE_PATH.length);
  return rel === '' || SHELL.indexOf(rel) >= 0 || /^img\/[\w.-]+$/.test(rel);
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // only our old versions: the origin (e.g. username.github.io) is shared with other sites
    return Promise.all(keys.filter(function (k) { return /^xoay-van-/.test(k) && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function store(req, res) {
  var copy = res.clone();
  caches.open(CACHE).then(function (c) { c.put(req, copy); });
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (isAppFile(url)) {
    e.respondWith(fetch(req).then(function (res) { return res.ok ? store(req, res) : res; }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
    }));
  } else if (CDN.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return res.ok || res.type === 'opaque' ? store(req, res) : res; });
    }));
  }
});
