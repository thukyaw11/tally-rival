import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `tally-${version}`;
// Manifest paths are relative to the app root ('' is the home page).
const root = new URL('./', self.location.href);
const FILES = [...immutable, ...assets, ...prerendered].map(
	({ path }) => new URL(path, root).pathname
);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Build files and static files never change for this version, so serve them from cache.
			if (FILES.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			// Anything else: try the network, fall back to cache when offline.
			try {
				const res = await fetch(event.request);
				if (res.ok) cache.put(event.request, res.clone());
				return res;
			} catch (err) {
				const hit = (await cache.match(event.request)) ?? (await cache.match(root.pathname));
				if (hit) return hit;
				throw err;
			}
		})()
	);
});
