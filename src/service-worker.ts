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
// The adapter's fallback page (svelte.config.js): it boots the app on any URL, so offline
// navigations to pages that aren't cached still get the app shell and its error page.
const FALLBACK = '/404.html';

// A new version installs and then waits, so it never swaps code out from under a running
// timer. The app shows an "Update available" banner and sends SKIP_WAITING when the user taps
// Update (src/lib/app-update.svelte.ts). The very first install activates right away.
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then(async (cache) => {
			await cache.addAll(ASSETS);
			// Only exists in builds (not `vite dev`), so a missing file mustn't fail the install.
			await cache.add(FALLBACK).catch(() => {});
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
			// Hashed build assets never change: serve from cache first.
			if (build.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}
			// Everything else: network first so content stays fresh, cache when offline.
			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic') void cache.put(request, response.clone());
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
