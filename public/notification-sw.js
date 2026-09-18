// Minimal service worker whose only job is background notification delivery.
// Chromium silently drops notifications constructed with `new Notification()` from a
// hidden tab; ServiceWorkerRegistration.showNotification() is the only reliable path
// for the tab-away case this feature exists for. No caching or offline behaviour.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data && event.notification.data.url;

    // Matched by path, not by full url: the tab has usually picked up a query or hash since the
    // notification was delivered, and treating that as a different page reloads the tab the
    // reader is already on — losing whatever they had typed.
    const samePath = (a, b) => {
        try {
            return new URL(a).pathname === new URL(b).pathname;
        } catch {
            return a === b;
        }
    };

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                const focusable = clients.filter((client) => 'focus' in client);
                const originating = targetUrl ? focusable.find((client) => samePath(client.url, targetUrl)) : undefined;

                if (originating) {
                    return originating.focus();
                }

                const existing = focusable[0];

                if (!existing) {
                    return self.clients.openWindow(targetUrl || '/');
                }

                return Promise.resolve(existing.focus()).then((focused) => {
                    const client = focused || existing;

                    if (targetUrl && typeof client.navigate === 'function' && !samePath(client.url, targetUrl)) {
                        // navigate() rejects for cross-origin targets and for clients the SW does not control
                        return Promise.resolve(client.navigate(targetUrl)).catch(() => client);
                    }

                    return client;
                });
            })
            // focus() rejects when the client is gone, or in Chromium paths without a user-activation token
            .catch(() => self.clients.openWindow(targetUrl || '/')),
    );
});
