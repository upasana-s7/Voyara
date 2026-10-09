
const CACHE_NAME = "voyara-cache-v9-name-access";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js"
];

// Install the service worker and cache the app's main files.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

// Activate the new service worker and remove old caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith("voyara-cache-") &&
              cacheName !== CACHE_NAME
            );
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );

  self.clients.claim();
});

// Handle requests so the app shell can work offline.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  // Leave external websites and APIs to the browser.
  // Live AI generation and other online services need internet access.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // For page navigation, try the network first.
  // If offline, load the cached app page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", responseCopy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match("./index.html");

          if (cachedPage) {
            return cachedPage;
          }

          return new Response(
            "Voyara is offline. Please reconnect to the internet and try again.",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }

  // For app files, use the cache first and the network as a fallback.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy);
          });
        }

        return response;
      });
    })
  );
});