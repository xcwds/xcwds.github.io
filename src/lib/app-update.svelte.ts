/**
 * In-app updates for the installed PWA. A new service worker installs in the background and
 * waits; `appUpdate.available` turns on and the layout shows a banner. Tapping Update tells the
 * waiting worker to take over (SKIP_WAITING) and reloads once it has.
 *
 * Pages doing something a reload would interrupt (a running timer) mark themselves busy with
 * `markBusy`, and the banner asks the user to finish first.
 *
 * When another tab or window applies the update, the new worker takes over this one too (its old
 * cache is gone, so its next lazy-loaded code would fail). A hidden, idle tab reloads quietly;
 * otherwise `appUpdate.reloadNeeded` turns on and the banner asks for a reload.
 */

import { changelogSince, latestChangelogId } from './changelog';
import { entries, read, write } from './storage';
import { toast } from './toast.svelte';

const JUST_UPDATED = 'app:just-updated';
const CHECK_EVERY_MS = 60 * 60 * 1000;

export const appUpdate = $state({
	/** A new version is installed and waiting. */
	available: false,
	/** Another tab applied the update; this one still runs the old version and should reload. */
	reloadNeeded: false
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
	// Replaced by an even newer version before the user tapped Update; that one gets offered instead.
	worker.addEventListener('statechange', () => {
		if (worker.state === 'redundant' && waiting === worker) {
			waiting = null;
			appUpdate.available = false;
		}
	});
}

/**
 * Set by the old version just before it reloads into the new one, with the newest changelog
 * entry it had, so the new version knows which entries are new.
 */
function markJustUpdated() {
	try {
		sessionStorage.setItem(JUST_UPDATED, JSON.stringify({ changelog: latestChangelogId }));
	} catch {
		// The update still applies; the "updated" note just won't show.
	}
}

/** A newer worker took over without this tab asking: another tab applied the update. */
function updatedElsewhere() {
	waiting = null;
	appUpdate.available = false;
	if (document.visibilityState === 'hidden' && busyReasons().length === 0) {
		markJustUpdated();
		location.reload();
	} else {
		appUpdate.reloadNeeded = true;
	}
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

/**
 * Whether the app just reloaded into a new version, and if so whether there's anything new to
 * show. Worked out when this module loads, before any page mounts (Settings marks entries seen
 * on mount); the toast waits for `startUpdateChecks`.
 */
const updateNote = typeof window === 'undefined' ? null : takeUpdateNote();

function takeUpdateNote(): { whatsNew: boolean } | null {
	let updatedFrom: string | null;
	try {
		updatedFrom = sessionStorage.getItem(JUST_UPDATED);
		sessionStorage.removeItem(JUST_UPDATED);
	} catch {
		return null; // sessionStorage blocked; skip the "updated" note.
	}
	if (!updatedFrom) return null;
	let previous: number;
	try {
		const parsed = JSON.parse(updatedFrom);
		// Versions before the changelog stored "1": treat the newest entry as the new one.
		previous = Number.isInteger(parsed?.changelog) ? parsed.changelog : latestChangelogId - 1;
	} catch {
		previous = latestChangelogId - 1;
	}
	const seen = read(entries.whatsNewSeen);
	// Remember where this update started, so What's new marks the newer entries until viewed.
	const since = Math.min(previous, seen ?? previous);
	if (seen === undefined && since < latestChangelogId) write(entries.whatsNewSeen, since);
	return { whatsNew: changelogSince(since).length > 0 };
}

/** Call once in the browser (root layout). */
export async function startUpdateChecks(): Promise<void> {
	if (started || !('serviceWorker' in navigator)) return;
	started = true;

	if (updateNote?.whatsNew) {
		toast('App updated.', {
			action: { label: "See what's new", path: '/settings', hash: '#whats-new' }
		});
	} else if (updateNote) {
		toast('App updated to the latest version.');
	}

	// The first install taking over an uncontrolled tab isn't an update.
	let controlled = !!navigator.serviceWorker.controller;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading) location.reload();
		else if (controlled) updatedElsewhere();
		controlled = true;
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
	markJustUpdated();
	waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** Finishes an update another tab applied by reloading into the new version. */
export function reloadForUpdate(): void {
	markJustUpdated();
	location.reload();
}
