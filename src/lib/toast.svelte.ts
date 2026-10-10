import { getApp } from '@xcwds/sveltekit';

/**
 * App-wide toasts: short confirmations like "Link copied." in the shell's notification stack
 * (`app.toast` from `@xcwds/plugin-shell`). With an `action`, a link to an app page (plus an
 * optional `#hash`) shows next to the message, and the toast stays longer so it can be tapped.
 */
export function toast(
	message: string,
	options: { action?: { label: string; path: string; hash?: string }; durationMs?: number } = {}
): void {
	getApp().toast?.(message, options);
}
