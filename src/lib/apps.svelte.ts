import { getApp } from '@xcwds/sveltekit';

/**
 * Bumped whenever apps are turned on or off (here or in another tab) or tools come and go, so
 * anything that reads the tool list or `appIsOn` while rendering shows the change (#223).
 */
const changes = $state({ count: 0 });

let started = false;
/** Call once in the browser (root layout). */
export function startApps() {
	if (started) return;
	started = true;
	getApp().tools?.subscribe(() => changes.count++);
}

/** Registers a dependency on the apps that are on; returns nothing. */
export function trackApps(): void {
	void changes.count;
}

/** Whether the app `id` is on (`@xcwds/plugin-tools`' `apps` setting). Reactive. */
export function appIsOn(id: string): boolean {
	trackApps();
	return getApp().tools?.isOn(id) ?? true;
}
