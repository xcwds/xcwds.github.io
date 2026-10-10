import { getApp } from '@xcwds/sveltekit';
import { emptyShortcuts, type HomeShortcuts } from './home';

/**
 * Tools pinned to Home and the recently opened ones, from `@xcwds/plugin-tools` (saved as
 * `app:home:shortcuts`; opening a tool records it). Reactive; change it with the functions below.
 */
export const shortcuts = $state<HomeShortcuts>(emptyShortcuts());

const tools = () => getApp().tools?.shortcuts;

let started = false;
/** Call once in the browser (root layout): follows the saved shortcuts, here and in other tabs. */
export function startShortcuts() {
	if (started) return;
	started = true;
	tools()?.subscribe((state) => Object.assign(shortcuts, state));
}

/** Re-reads the shortcuts after this tab cleared or imported data. */
export const reloadShortcuts = () => tools()?.reload();

/** Pins or unpins a tool, with a toast. */
export const togglePin = (path: string) => void tools()?.togglePin(path);

export const movePin = (path: string, by: -1 | 1) => void tools()?.movePin(path, by);
