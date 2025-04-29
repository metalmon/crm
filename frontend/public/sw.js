import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// This line will be replaced by Vite PWA plugin with the precache manifest
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches (like in raven)
cleanupOutdatedCaches();

// Remove runtime caching logic
/*
// Basic Network falling back to cache strategy for navigation requests
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'crm-pages-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Example: Caching strategy for static assets (adjust pattern as needed)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'crm-static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      }),
    ],
  })
);

// Example: Caching strategy for images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'crm-image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// You can add more specific caching strategies here if needed,
// mirroring the logic previously in the vite.config.js workbox section
// or based on raven's sw.js if required.
*/

// Restore standard message listener for activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Comment out direct calls
// self.skipWaiting();
// clientsClaim();

console.log("CRM Service Worker Initialized (Standard Activation)"); 