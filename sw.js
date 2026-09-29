const CACHE = "averta-vale-pwa-v2";

const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/averta-bag-logo.png",
  "./assets/alert-tone.mp3"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
    ])
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});

// Receive push notifications, even when the app is not open.
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Shopify",
      body: "You have a new test notification."
    };
  }

  const title = data.title || "Shopify";

  const options = {
    body: data.body || "Your test notification is ready.",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "averta-vale-push",
    data: {
      url: data.url || "./"
    },
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Open Averta Vale when the notification is tapped.
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "./",
    self.registration.scope
  ).href;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clients => {
      for (const client of clients) {
        if (client.url.startsWith(self.registration.scope)) {
          return client.focus();
        }
      }

      return self.clients.openWindow(target);
    })
  );
});
