// sw.js — Atlantas Dev Portal Service Worker (Real-Time)
var CACHE = 'atl-dev-v3';
var ASSETS = ['/', 'index.html', 'dev.js', 'config.js', 'pwa.js', 'manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }).catch(function() {}));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('firebaseio.com') !== -1 ||
      e.request.url.indexOf('googleapis.com') !== -1 ||
      e.request.url.indexOf('gstatic.com') !== -1 ||
      e.request.url.indexOf('cloudinary.com') !== -1) {
    e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetched = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200 && resp.type !== 'opaque') {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function() {});
      return cached || fetched;
    })
  );
});

// ── PUSH NOTIFICATIONS ──────────────────────────────────────
self.addEventListener('push', function(e) {
  var data = { title: 'Atlantas Dev', body: 'Developer portal update.', icon: 'https://i.imgur.com/iN8T10D.jpeg', badge: 'https://i.imgur.com/iN8T10D.jpeg', tag: 'atl-dev' };
  try { if (e.data) { var d = e.data.json(); data = Object.assign(data, d); } } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon, badge: data.badge,
      tag: data.tag, requireInteraction: false,
      data: data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
      for (var i = 0; i < cls.length; i++) { if (cls[i].url && cls[i].focus) { cls[i].focus(); return; } }
      if (clients.openWindow) return clients.openWindow(e.notification.data || '/');
    })
  );
});

// ── REAL-TIME: relay messages to open clients ────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'PING') {
    self.clients.matchAll().then(function(cls) {
      cls.forEach(function(c) { c.postMessage({ type: 'PONG' }); });
    });
  }
});

self.addEventListener('sync', function(e) {
  if (e.tag === 'atl-dev-sync') {
    e.waitUntil(
      self.clients.matchAll().then(function(cls) {
        cls.forEach(function(c) { c.postMessage({ type: 'SYNC' }); });
      })
    );
  }
});
