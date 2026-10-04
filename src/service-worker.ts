/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';
import { shareTargetRedirect } from '$lib/utils/share';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
// The whole site is prerendered, so everything can be cached for offline use.
const ASSETS = [...build, ...files, ...prerendered];
const PRECACHED = new Set(ASSETS);
// The adapter's fallback page (svelte.config.js): it boots the app on any URL, so offline
// navigations to pages that aren't cached still get the app shell and its error page.
const FALLBACK = '/404.html';

// A new version installs and then waits, so it never swaps code out from under a running
// timer. The app shows an "Update available" banner and sends SKIP_WAITING when the user taps
// Update (src/lib/app-update.svelte.ts). The very first install activates right away.
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then(async (cache) => {
			// Bypass the HTTP cache: GitHub Pages lets browsers keep pages for 10 minutes, and a new
			// version must not precache the previous version's HTML.
			await cache.addAll(ASSETS.map((asset) => new Request(asset, { cache: 'reload' })));
			// Best-effort: `vite dev` and `vite preview` don't serve 404.html, and $app/environment
			// can't be imported here to tell them apart. A failure only costs the offline not-found
			// page, so log it rather than fail the install (e2e/errors.test.ts covers the real build).
			await cache.add(FALLBACK).catch((error) => {
				console.warn(`Couldn't cache ${FALLBACK}; offline not-found pages won't work.`, error);
			});
		})
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	// Android share target: move the shared link from ?query to #hash before any request is
	// made, so it never reaches the server (or its logs).
	const redirect = shareTargetRedirect(url);
	if (redirect) {
		event.respondWith(Response.redirect(redirect, 303));
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Everything this version precached (pages, build assets, static files) is served from
			// its own cache first. That keeps the active version consistent, and makes the waiting
			// worker the only way new code arrives: nothing changes until the user taps Update.
			if (PRECACHED.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}
			// Anything else (e.g. a URL that isn't a page): network, then cache, then the offline
			// fallback page for navigations.
			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic' && !PRECACHED.has(url.pathname))
					void cache.put(request, response.clone());
				return response;
			} catch (error) {
				const cached =
					(await cache.match(request)) ??
					(await cache.match(url.pathname)) ??
					(request.mode === 'navigate' ? await cache.match(FALLBACK) : undefined);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});
