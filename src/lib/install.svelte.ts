import { toast } from './toast.svelte';

/** Chrome/Edge/Android's install prompt event (not in TypeScript's DOM types yet). */
type BeforeInstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
	interface Window {
		/** Set by the inline script in app.html if the prompt fires before the app starts. */
		__installPrompt?: BeforeInstallPromptEvent;
	}
}

export const install = $state({
	/** Set once the browser checks below have run (the prerendered page can't know). */
	checked: false,
	/** Running as the installed app (home screen), not in a browser tab. */
	installed: false,
	/** The browser offered an install prompt we can show from a button. */
	canPrompt: false,
	/** iPhone/iPad: no prompt API, so show Add to Home Screen steps instead. */
	ios: false
});

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;

/** iPadOS reports itself as a Mac, so a Mac with touch is an iPad. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
	return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Call once in the browser (root layout). */
export function startInstallSupport(): void {
	if (started) return;
	started = true;
	install.installed =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
	install.ios = isIos(navigator.userAgent, navigator.maxTouchPoints);
	install.checked = true;

	const capture = (event: Event) => {
		event.preventDefault();
		deferred = event as BeforeInstallPromptEvent;
		install.canPrompt = true;
	};
	if (window.__installPrompt) capture(window.__installPrompt);
	window.addEventListener('beforeinstallprompt', capture);
	window.addEventListener('appinstalled', () => {
		install.installed = true;
		install.canPrompt = false;
		deferred = null;
		toast('xcwds is installed.');
	});
}

/** Shows the browser's install dialog (must be called from a tap). */
export async function promptInstall(): Promise<void> {
	if (!deferred) return;
	const event = deferred;
	deferred = null;
	install.canPrompt = false;
	await event.prompt();
	const { outcome } = await event.userChoice;
	if (outcome === 'accepted') install.installed = true;
}
