/* TON Home Inspector service worker — app-shell precache + runtime caching. */
const VERSION = "v1";
const SHELL = `ton-shell-${VERSION}`;
const STATIC = `ton-static-${VERSION}`;
const ROUTES = ["/", "/projects", "/project", "/property", "/inspect", "/checklist", "/profile", "/login", "/register", "/forgot-password", "/reset-password"];
const ASSET_RE = /\/_next\/static\/[^"'\s)]+/g;

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = new Set(["/manifest.webmanifest", "/icons/icon-192.png", "/fonts/Sarabun-Regular.ttf", "/fonts/Sarabun-Medium.ttf", "/fonts/Sarabun-SemiBold.ttf", "/fonts/Sarabun-Bold.ttf"]);
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok || res.redirected) return;
        const html = await res.clone().text();
        for (const m of html.match(ASSET_RE) ?? []) assets.add(m.replace(/\\u0026/g, "&"));
        await shell.put(route, res);
      } catch {
        /* offline during install: runtime caching fills in later */
      }
    }),
  );
  const staticCache = await caches.open(STATIC);
  await Promise.all([...assets].map((a) => staticCache.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ton-") && k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res.ok && !res.redirected && res.type === "basic") await cache.put(url.pathname, res.clone());
    return res;
  } catch {
    // Pages use ?id= query params, so one cached HTML per route serves every record offline.
    return (await cache.match(url.pathname)) || (await cache.match("/")) || new Response("ออฟไลน์ — ยังไม่มีหน้านี้ในเครื่อง", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase & other origins: never cached
  if (url.pathname.startsWith("/auth/")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  // RSC payloads for client navigation: let them fail offline so Next falls back to full navigation.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

/* Background Sync: wake open clients so the page-side engine pushes the outbox. */
self.addEventListener("sync", (event) => {
  if (event.tag !== "ton-sync") return;
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((clients) => clients.forEach((c) => c.postMessage("SYNC_REQUESTED"))));
});
