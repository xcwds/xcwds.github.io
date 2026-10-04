/**
 * In-app updates for the installed PWA. A new service worker installs in the background and
 * waits; `appUpdate.available` turns on and the layout shows a banner. Tapping Update tells the
 * waiting worker to take over (SKIP_WAITING) and reloads once it has.
 *
 * Pages doing something a reload would interrupt (a running timer) mark themselves busy with
 * `markBusy`, and the banner asks the user to finish first.
 */

const JUST_UPDATED = 'app:just-updated';
const CHECK_EVERY_MS = 60 * 60 * 1000;

export const appUpdate = $state({
	/** A new version is installed and waiting. */
	available: false,
	/** The page was just reloaded into a new version. */
	updated: false
});

const busy = $state<Record<string, boolean>>({});

/** Names of things a reload would interrupt right now. */
export function busyReasons(): string[] {
	return Object.keys(busy).filter((id) => busy[id]);
}

/** Call during component init: marks `id` busy while `isBusy()` is true. */
export function markBusy(id: string, isBusy: () => boolean): void {
	$effect(() => {
		busy[id] = isBusy();
		return () => {
			delete busy[id];
		};
	});
}

let waiting: ServiceWorker | null = null;
let reloading = false;
let started = false;

function offer(worker: ServiceWorker) {
	// With no controller this is the first install, which activates on its own.
	if (!navigator.serviceWorker.controller) return;
	waiting = worker;
	appUpdate.available = true;
}

function watch(registration: ServiceWorkerRegistration) {
	if (registration.waiting) offer(registration.waiting);
	registration.addEventListener('updatefound', () => {
		const worker = registration.installing;
		worker?.addEventListener('statechange', () => {
			if (worker.state === 'installed') offer(worker);
		});
	});
}

/** Call once in the browser (root layout). */
export async function startUpdateChecks(): Promise<void> {
	if (started || !('serviceWorker' in navigator)) return;
	started = true;

	try {
		if (sessionStorage.getItem(JUST_UPDATED)) {
			sessionStorage.removeItem(JUST_UPDATED);
			appUpdate.updated = true;
		}
	} catch {
		// sessionStorage blocked; skip the "updated" note.
	}

	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading) location.reload();
	});

	const registration = await navigator.serviceWorker.ready;
	watch(registration);

	const check = () => void registration.update().catch(() => {});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') check();
	});
	window.addEventListener('online', check);
	setInterval(check, CHECK_EVERY_MS);
	check();
}

/** Switches to the waiting version and reloads. */
export function applyUpdate(): void {
	if (!waiting) return;
	reloading = true;
	try {
		sessionStorage.setItem(JUST_UPDATED, '1');
	} catch {
		// The update still applies; the "updated" note just won't show.
	}
	waiting.postMessage({ type: 'SKIP_WAITING' });
}
