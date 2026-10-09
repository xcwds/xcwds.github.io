import { BRAND, TAGLINE } from '$lib/brand';
import { routeInfo } from '$lib/nav';
import { toast } from '$lib/toast.svelte';
import { tools } from '$lib/utils/tools';

export type ShareTarget = { title: string; text: string; url: string };

/** Pages with nothing worth sending someone. */
const UNSHAREABLE = ['/settings'];

/**
 * What the header's Share button sends for a page (#89), or null when the page shouldn't be
 * shared: Settings, and private tools (`recents: false`), whose link shouldn't leave the device
 * by accident. The link is the origin and path only: never the query or hash, which can hold
 * what you typed (a link pasted into the URL sanitizer is `#url=…`).
 */
export function shareTarget(
	url: URL,
	toolList: readonly { path: string; recents?: boolean }[] = tools
): ShareTarget | null {
	const path = url.pathname.replace(/\/+$/, '') || '/';
	if (UNSHAREABLE.includes(path)) return null;
	if (toolList.some((t) => t.path === path && t.recents === false)) return null;
	const { title } = routeInfo(path);
	const link = `${url.origin}${path === '/' ? '/' : path}`;
	if (path === '/') return { title: BRAND, text: `${BRAND}: ${TAGLINE}`, url: link };
	return { title, text: `${title} on ${BRAND}`, url: link };
}

/**
 * Opens the system share sheet, or copies the link where there isn't one. Call from a tap
 * (browsers only allow sharing from one). Closing the share sheet isn't an error.
 */
export async function share(target: ShareTarget): Promise<void> {
	if (typeof navigator.share === 'function') {
		try {
			await navigator.share(target);
			return;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			// Not allowed here (e.g. some desktop installs): copy the link instead.
		}
	}
	try {
		await navigator.clipboard.writeText(target.url);
		toast('Link copied.');
	} catch {
		toast("Couldn't share or copy the link.");
	}
}
