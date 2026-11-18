// Service Worker: hält die Seite offline verfügbar.
// Bei Änderungen an der Seite diese Versionsnummer erhöhen.
const VERSION = "truhe-v4";
const DATEIEN = [
  "./", "index.html", "styles.css", "app.js", "szene.js", "sha256.js", "icon.svg",
  "fonts/comicneue-400.woff2", "fonts/comicneue-700.woff2", "fonts/chewy.woff2", "fonts/great-vibes.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // Online-Stand nie aus dem Zwischenspeicher

  // Erst aus dem Netz (damit Änderungen ankommen), sonst aus dem Zwischenspeicher
  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(VERSION).then((c) => c.put(e.request, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
