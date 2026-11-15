// Service worker minimal de l'application installée (PWA) : il ne met rien en cache, tout passe par le réseau
// (chaque mise à jour du jeu arrive tout de suite). Sa seule raison d'être : rendre le jeu installable.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
