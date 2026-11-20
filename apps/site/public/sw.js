// Kill-switch for the old app worker on chipin.one and dev.chipin.one once the site takes them
// (spec 04 §3.6, 04-3d; D26, D30). The site registers no worker; this file only replaces the old
// registration (scope `/`): it removes every cache of the origin and its own registration, then
// reloads the open windows (each on its own, except OAuth callbacks) so they load from the network.
// It has no fetch handler and never touches IndexedDB or localStorage. The code is the same as
// apps/app/public/sw-kill.js (04-4a1); swKillSwitch.test.ts fails if they drift apart.
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
            .then(clients =>
                Promise.allSettled(
                    clients
                        // A reload of an OAuth callback would replay its spent one-time code.
                        .filter(client => !new URL(client.url).pathname.startsWith('/oauth/'))
                        .map(client => client.navigate(client.url)),
                ),
            ),
    );
});
