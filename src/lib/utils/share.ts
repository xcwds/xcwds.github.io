export const SANITIZER_PATH = '/utils/url-sanitizer';

/**
 * Pulls a shared link out of the sanitizer page's address: `#url=<link>` (used by the iPhone
 * Shortcut; never sent to the server) or the Android share target's `?url=`/`?text=`/`?title=`.
 * Share sheets often put the link in `text` alongside a title, so all three are joined and
 * the link is found later by `parseLink`.
 */
export function readSharedText(location: URL): string | null {
	if (location.hash.startsWith('#url=')) {
		const raw = location.hash.slice('#url='.length);
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	const parts = ['url', 'text', 'title']
		.map((key) => location.searchParams.get(key)?.trim())
		.filter(Boolean);
	return parts.length ? parts.join(' ') : null;
}

/** For the service worker: the hash-based address to send an Android share to, if this is one. */
export function shareTargetRedirect(location: URL): string | null {
	if (location.pathname.replace(/\/$/, '') !== SANITIZER_PATH || !location.search) return null;
	const text = readSharedText(location);
	if (text === null) return null;
	return `${location.origin}${SANITIZER_PATH}#url=${encodeURIComponent(text)}`;
}
