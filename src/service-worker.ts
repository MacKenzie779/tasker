/// <reference lib="webworker" />
// Offline support: app shell + last known data are served from cache when the network is gone.
// Writes are not handled here — the client keeps its own op queue and syncs when back online.
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;
const STATIC = `static-${version}`;
const RUNTIME = 'runtime-v1';
const PRECACHE = [...immutable.map((f) => f.path), ...assets.map((f) => f.path)].map(
	(p) => '/' + p.replace(/^\//, '')
);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(STATIC)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== STATIC && k !== RUNTIME).map((k) => caches.delete(k)))
			)
			.then(() => sw.clients.claim())
	);
});

async function networkFirst(request: Request, fallbackUrl?: string): Promise<Response> {
	const cache = await caches.open(RUNTIME);
	try {
		const response = await fetch(request);
		if (response.ok && response.type === 'basic' && !response.redirected)
			cache.put(request, response.clone());
		return response;
	} catch (err) {
		const cached =
			(await cache.match(request)) ?? (fallbackUrl ? await cache.match(fallbackUrl) : undefined);
		if (cached) return cached;
		throw err;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/ics/') || url.pathname.startsWith('/login')) return;

	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r ?? fetch(request)));
		return;
	}
	if (request.mode === 'navigate') {
		// every app page is the same client-rendered shell, so any cached one works offline
		event.respondWith(networkFirst(request, '/inbox'));
		return;
	}
	if (url.pathname.endsWith('/__data.json') || url.pathname === '/api/data') {
		event.respondWith(networkFirst(request));
	}
});
