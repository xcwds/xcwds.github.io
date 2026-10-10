/**
 * Saved state for components, from @xcwds: `persist()` ties an entry to a piece of state (it
 * loads after mount, saves only when the value changes and follows other tabs), and a failed
 * save shows one toast (`@xcwds/plugin-shell` reports `app.storage.onSaveFailure`).
 */
import type { Entry } from '@xcwds/core';
import { getApp } from '@xcwds/sveltekit';

export { persist, type PersistOptions } from '@xcwds/sveltekit';

/** Whether the last write of `entry` failed, so this tab holds changes storage doesn't have. */
export const hasUnsavedChanges = (entry: Entry<unknown>): boolean =>
	getApp().storage.hasUnsavedChanges(entry);

/**
 * Records the outcome of a write of `entry`, reporting a failure. Pass `explicit` for actions
 * that confirm a save, so every failure is reported. Returns `saved`.
 */
export const saveResult = (
	entry: Entry<unknown>,
	saved: boolean,
	options: { explicit?: boolean } = {}
): boolean => getApp().storage.saveResult(entry, saved, options);
