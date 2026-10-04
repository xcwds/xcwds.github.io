import {
	emptyShortcuts,
	sameShortcuts,
	withPinMoved,
	withPinToggled,
	withVisit,
	type HomeShortcuts
} from './home';
import { hasUnsavedChanges, saveResult } from './persist.svelte';
import { entries, latest, read, update } from './storage';
import { toast } from './toast.svelte';
import { tools } from './utils/tools';

const entry = entries.homeShortcuts;

/** Tools pinned to Home and the recently opened ones. Reactive; change it with the functions below. */
export const shortcuts = $state<HomeShortcuts>(emptyShortcuts());

function load() {
	Object.assign(shortcuts, read(entry) ?? emptyShortcuts());
}

/** Re-reads the shortcuts after this tab cleared or imported data (other tabs get `storage`). */
export const reloadShortcuts = load;

let started = false;
/** Call once in the browser (root layout): loads the shortcuts and follows other tabs' changes. */
export function startShortcuts() {
	if (started) return;
	started = true;
	load();
	window.addEventListener('storage', (event) => {
		if (event.key === null || event.key === entry.key) load();
	});
}

/**
 * Applies `change` to the latest saved shortcuts (so another tab's changes aren't lost) and saves
 * the result, unless nothing changed. Returns whether the result is saved.
 */
function apply(
	change: (latest: HomeShortcuts) => HomeShortcuts,
	{ explicit = false } = {}
): boolean {
	const unsaved = hasUnsavedChanges(entry);
	const current = $state.snapshot(shortcuts);
	// Same starting point as update() below, so "nothing changed" is judged on what it would save.
	const base = latest(entry, current, { unsaved }) ?? emptyShortcuts();
	if (sameShortcuts(base, change(base))) {
		Object.assign(shortcuts, base);
		return true;
	}
	const { value, saved } = update(entry, current, (v) => change(v ?? emptyShortcuts()), {
		unsaved
	});
	Object.assign(shortcuts, value);
	return saveResult(entry, saved, { explicit });
}

/** Records opening a page; only tools that allow it become "Recently used". */
export function recordVisit(pathname: string) {
	const path = pathname.replace(/\/+$/, '') || '/';
	if (!tools.some((t) => t.path === path)) return;
	apply((s) => withVisit(s, path, tools));
}

export function togglePin(path: string) {
	const pinned = shortcuts.pins.includes(path);
	if (apply((s) => withPinToggled(s, path), { explicit: true }))
		toast(pinned ? 'Removed from Home.' : 'Pinned to Home.');
}

export function movePin(path: string, by: -1 | 1) {
	apply((s) => withPinMoved(s, path, by), { explicit: true });
}
