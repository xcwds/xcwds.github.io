import { onMount } from 'svelte';
import { read, remove, write, type Entry } from './storage';
import { toast, toasts } from './toast.svelte';

export const SAVE_FAILED =
	"Couldn't save on this device: storage is full or blocked. Download a backup from Settings.";

/** Entries whose last write failed; each is reported once until a write succeeds again. */
const failing: Record<string, boolean> = {};

/**
 * Tells the user a save failed. Repeated background (autosave) failures of the same entry stay
 * quiet; a failed `explicit` action (one the user tapped, like Finish workout) always reports.
 * The toast is never shown twice at once (one action can fail to save several entries).
 */
export function reportSaveFailure(entry?: Entry<unknown>, { explicit = false } = {}): void {
	if (entry) {
		if (failing[entry.key] && !explicit) return;
		failing[entry.key] = true;
	}
	if (!toasts.some((t) => t.message === SAVE_FAILED)) toast(SAVE_FAILED, { durationMs: 6000 });
}

/** Whether the last write of `entry` failed, so this tab holds changes storage doesn't have. */
export function hasUnsavedChanges(entry: Entry<unknown>): boolean {
	return failing[entry.key] ?? false;
}

/**
 * Records the outcome of a write of `entry`, reporting a failure. Pass `explicit` for actions
 * that confirm a save, so every failure is reported. Returns `saved`.
 */
export function saveResult(
	entry: Entry<unknown>,
	saved: boolean,
	options: { explicit?: boolean } = {}
): boolean {
	if (saved) delete failing[entry.key];
	else reportSaveFailure(entry, options);
	return saved;
}

/**
 * Keeps component state in sync with a storage entry: loads it after mount (so prerendered
 * HTML and hydration agree), then saves only when the value actually changes. Just opening a
 * page never writes, so "nothing saved yet" stays meaningful (e.g. for tool defaults).
 * Returning `undefined` from `get` removes the entry. Call during component init.
 *
 * Changes saved by another tab are loaded as they happen, so a stale copy here never
 * overwrites them; `cleared` runs when another tab removes the entry. `set` may then receive a
 * value with fields missing (another tab dropped them, e.g. Settings forgetting a choice):
 * treat a missing field as "back to the default", not "keep what I have", or the next save here
 * writes the old value back. Pass `sync: false` for
 * per-window UI state (e.g. the open tab) that shouldn't follow other windows. A failed save
 * shows a toast once (see `reportSaveFailure`).
 *
 *   persist(entries.coffeeDuration, () => custom, (v) => (custom = v));
 *
 * Returns `markSaved()`: call it right after saving the current value yourself (e.g. with
 * `update()` from storage.ts, to report the result), so it isn't written a second time.
 */
export function persist<T>(
	entry: Entry<T>,
	get: () => T | undefined,
	set: (value: T) => void,
	{ cleared, sync = true }: { cleared?: () => void; sync?: boolean } = {}
): { markSaved: () => void } {
	let loaded = $state(false);
	/** JSON of the value as last loaded or saved; unchanged values aren't written again. */
	let baseline: string | undefined;

	function load() {
		const saved = read(entry);
		if (saved !== undefined) set(saved);
		else if (loaded) cleared?.();
		baseline = JSON.stringify(get());
	}

	onMount(() => {
		load();
		loaded = true;
		if (!sync) return;
		// Fires in every *other* tab when this one saves; `key` is null when storage is cleared.
		const onStorage = (event: StorageEvent) => {
			if (event.key === null || event.key === entry.key) load();
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});

	$effect(() => {
		// Serializing inside the effect tracks every nested field of the value.
		const json = JSON.stringify(get());
		if (!loaded || json === baseline) return;
		baseline = json;
		saveResult(entry, json === undefined ? remove(entry) : write(entry, JSON.parse(json) as T));
	});

	return {
		markSaved() {
			baseline = JSON.stringify(get());
		}
	};
}
