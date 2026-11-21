// My Aloha Map service worker: makes the site installable ("Add to Home Screen"). Network first; it caches
// nothing, so visitors always get the live site.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () {});
