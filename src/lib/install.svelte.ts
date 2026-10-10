import { getApp } from '@xcwds/sveltekit';

/** Install support from `@xcwds/plugin-install`, as reactive state for the page. */
export const install = $state({
	/** Set once the browser checks have run (the prerendered page can't know). */
	checked: false,
	/** Running as the installed app (home screen), not in a browser tab. */
	installed: false,
	/** The browser offered an install prompt we can show from a button. */
	canPrompt: false,
	/** iPhone/iPad: no prompt API, so show Add to Home Screen steps instead. */
	ios: false
});

let started = false;

/** Call once in the browser (root layout). */
export function startInstallSupport(): void {
	if (started) return;
	started = true;
	getApp().install?.subscribe((state) => {
		install.checked = state.checked;
		install.installed = state.installed;
		install.canPrompt = state.available;
		install.ios = state.ios;
	});
}

/** Shows the browser's install dialog (must be called from a tap). */
export async function promptInstall(): Promise<void> {
	await getApp().install?.prompt();
}
