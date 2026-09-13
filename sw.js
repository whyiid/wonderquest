/* WonderQuest service worker.

   Two different strategies on purpose:

   · App shell (html/css/js/icon) — cache-first. It changes rarely; bump CACHE
     when it does.
   · Content JSON — network-first, falling back to cache. New articles are
     added far more often than code, and a cache-first content file means a
     child's iPad silently keeps showing last month's library until someone
     remembers to bump a version string. Network-first costs one fast request
     when online and still works completely offline. */
const CACHE = 'wonderquest-v2';
const isContent = (url) => url.pathname.indexOf('/content/') !== -1;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './progress.js',
  './ui.js',
  './daily.js',
  './article.js',
  './explore.js',
  './collection.js',
  './parent.js',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './content/index.json',
  './content/animals.json',
  './content/space.json',
  './content/body.json',
  './content/tech.json',
  './content/discoveries.json',
  './content/history.json',
  './content/people.json',
  './content/mysteries.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function keep(request, response) {
  if (response && response.ok && request.url.startsWith(self.location.origin)) {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (isContent(url)) {
    e.respondWith(
      fetch(e.request)
        .then(res => keep(e.request, res))
        .catch(() => caches.match(e.request).then(hit => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request)
      .then(res => keep(e.request, res))
      .catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
