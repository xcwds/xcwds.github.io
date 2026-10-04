import { saveResult } from './persist.svelte';
import { defaultSettings, entries, read, write, type Settings, type Theme } from './storage';

/** App-wide settings. Reactive: read it anywhere, assign to change it (saved automatically). */
export const settings = $state<Settings>(structuredClone(defaultSettings));

/**
 * Settings load after the root layout mounts (pages mount first). Pages that seed their state
 * from settings (tool defaults) wait for `settingsStatus.ready`.
 */
export const settingsStatus = $state({ ready: false });

const THEME_COLORS = { light: '#bfdbfe', dark: '#030712' } as const;

export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
	return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
}

/** Sets the color scheme on <html> (see the dark variant in app.css) and the browser bar color. */
function applyTheme(theme: Theme) {
	const scheme = resolveTheme(theme, matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.colorScheme = scheme;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[scheme]);
}

/** Re-reads settings from storage, e.g. after an import or reset. */
export function reloadSettings() {
	Object.assign(settings, read(entries.settings) ?? structuredClone(defaultSettings));
}

let started = false;
/** JSON of the settings as last loaded or saved, so the same settings aren't written twice. */
let lastSaved: string | undefined;

/**
 * Saves the settings now rather than in the effect below, for actions that confirm a save
 * (e.g. Save as my defaults). Returns whether it was saved; a failure is reported once.
 */
export function saveSettings(): boolean {
	const snapshot = $state.snapshot(settings);
	lastSaved = JSON.stringify(snapshot);
	return saveResult(entries.settings, write(entries.settings, snapshot));
}

/** Call once in the browser (root layout): loads settings, applies the theme, saves changes. */
export function startSettings() {
	if (started) return;
	started = true;
	reloadSettings();
	lastSaved = JSON.stringify(settings);
	settingsStatus.ready = true;
	// Another tab changed the settings (or cleared all data): load them, so a stale copy here
	// isn't saved over them. `key` is null when storage is cleared.
	window.addEventListener('storage', (event) => {
		if (event.key !== null && event.key !== entries.settings.key) return;
		reloadSettings();
		lastSaved = JSON.stringify(settings);
	});
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
		applyTheme(settings.theme)
	);
	$effect.root(() => {
		$effect(() => {
			// Snapshot reads every nested field, so changes to lists and objects are saved too.
			const snapshot = $state.snapshot(settings);
			applyTheme(snapshot.theme);
			// Don't recreate saved data just by visiting: only save once something differs.
			const json = JSON.stringify(snapshot);
			if (json === lastSaved) return;
			const untouched = json === JSON.stringify(defaultSettings);
			if (untouched && read(entries.settings) === undefined) return;
			lastSaved = json;
			saveResult(entries.settings, write(entries.settings, snapshot));
		});
	});
}
