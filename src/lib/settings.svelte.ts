import { getApp } from '@xcwds/sveltekit';
import { defaultSettings, parseSettings, type Settings } from './storage';

/**
 * App-wide settings (`app:settings`, the @xcwds kernel's settings). Reactive: read it anywhere,
 * assign to change it (saved automatically). The theme and navigation apply themselves
 * (`@xcwds/plugin-theme`, `@xcwds/plugin-shell`).
 */
export const settings = $state<Settings>(structuredClone(defaultSettings));

/**
 * Settings load after the root layout mounts (pages mount first). Pages that seed their state
 * from settings (tool defaults) wait for `settingsStatus.ready`.
 */
export const settingsStatus = $state({ ready: false });

/** JSON of the settings as last loaded or saved, so the same settings aren't saved twice. */
let lastSaved: string | undefined;

/** Copies the kernel's settings in (they hold only the fields the app knows about). */
function load(values: unknown) {
	Object.assign(settings, parseSettings(values) ?? structuredClone(defaultSettings));
	lastSaved = JSON.stringify(settings);
}

/** Re-reads the saved settings, e.g. after an import or reset. */
export function reloadSettings() {
	const app = getApp();
	app.settings.load();
	load(app.settings.get());
}

/**
 * Saves the settings now rather than in the background, for actions that confirm a save (e.g.
 * Save as my defaults). Returns whether it was saved; a failure is reported once.
 */
export function saveSettings(): boolean {
	const snapshot = $state.snapshot(settings);
	lastSaved = JSON.stringify(snapshot);
	const app = getApp();
	app.settings.set(snapshot);
	return app.settings.save();
}

let started = false;

/** Call once in the browser (root layout), once the kernel has loaded saved settings. */
export function startSettings() {
	if (started) return;
	started = true;
	const app = getApp();
	load(app.settings.get());
	settingsStatus.ready = true;
	// Changes from another tab, an import or a reset.
	app.settings.subscribe((next) => {
		if (JSON.stringify(parseSettings(next)) !== JSON.stringify($state.snapshot(settings)))
			load(next);
	});
	$effect.root(() => {
		$effect(() => {
			// Snapshot reads every nested field, so changes to lists and objects are saved too.
			const snapshot = $state.snapshot(settings);
			const json = JSON.stringify(snapshot);
			if (json === lastSaved) return;
			lastSaved = json;
			app.settings.set(snapshot);
		});
	});
}
