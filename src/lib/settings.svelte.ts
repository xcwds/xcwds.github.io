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

/** Call once in the browser (root layout): loads settings, applies the theme, saves changes. */
export function startSettings() {
	if (started) return;
	started = true;
	reloadSettings();
	settingsStatus.ready = true;
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
		applyTheme(settings.theme)
	);
	$effect.root(() => {
		$effect(() => {
			// Snapshot reads every nested field, so changes to lists and objects are saved too.
			const snapshot = $state.snapshot(settings);
			applyTheme(snapshot.theme);
			// Don't recreate saved data just by visiting: only save once something differs.
			const untouched = JSON.stringify(snapshot) === JSON.stringify(defaultSettings);
			if (!untouched || read(entries.settings) !== undefined) write(entries.settings, snapshot);
		});
	});
}
