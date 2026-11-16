// Kill-switch for the old app worker on the legacy hosts chipin.one and dev.chipin.one (spec 04
// §2.11 and §3.6, 04-4a1). vercel.json serves this file at /sw.js on those hosts only. It removes
// every cache of the origin and its own registration, then reloads the open windows so they load
// from the network. It has no fetch handler and never touches IndexedDB or localStorage.
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        self.caches
            .keys()
            .then(keys => Promise.all(keys.map(key => self.caches.delete(key))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => Promise.all(clients.map(client => client.navigate(client.url)))),
    );
});
