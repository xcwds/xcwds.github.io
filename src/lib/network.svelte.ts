import { toast } from './toast.svelte';

export const network = $state({ online: true });

let started = false;

/** Call once in the browser (root layout). */
export function startNetworkStatus(): void {
	if (started) return;
	started = true;
	network.online = navigator.onLine;
	window.addEventListener('offline', () => (network.online = false));
	window.addEventListener('online', () => {
		network.online = true;
		toast('Back online.');
	});
}
