import { getApp } from '@xcwds/sveltekit';
import { onMount } from 'svelte';

/**
 * Call during component init: marks `name` busy while `isBusy()` is true, so the update banner
 * asks before a reload interrupts it (`app.update.markBusy` from `@xcwds/plugin-update`).
 */
export function markBusy(name: string, isBusy: () => boolean): void {
	onMount(() => getApp().update?.markBusy(name, isBusy));
}
