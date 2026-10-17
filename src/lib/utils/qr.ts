/** The QR codes tool (#211): a scanned link cleaned like the URL sanitizer does, and its links. */
import { buildLink, parseLink, readParams, trackingPathSegment, unwrapRedirect } from './url';

export type CleanedLink = {
	/** The link with known trackers removed and redirect wrappers unwrapped. */
	link: string;
	/** How many trackers were removed (params, and Amazon's `/ref=…` segment). */
	removed: number;
	/** The redirect service the link was unwrapped from, if any. */
	via: string | null;
};

/** `text` (a scanned link) cleaned with the URL sanitizer's rules, or null when it isn't a link. */
export function cleanLink(text: string): CleanedLink | null {
	const parsed = parseLink(text);
	if (!parsed) return null;
	const inner = unwrapRedirect(parsed);
	const url = inner?.url ?? parsed;
	const params = readParams(url);
	const segment = trackingPathSegment(url);
	return {
		link: buildLink(url, params, true),
		removed: params.filter((p) => !p.keep).length + (segment ? 1 : 0),
		via: inner?.via ?? null
	};
}

/**
 * The fragment that opens the tool with `text` to show as a code: `#text=<encoded>`. In the
 * fragment, never the query, so the text never reaches a server (the app's rule for links).
 */
export const qrFragment = (text: string) => `#text=${encodeURIComponent(text)}`;

/** The text in a `#text=…` fragment (everything after `text=`, decoded whole), or null. */
export function textFromFragment(hash: string): string | null {
	if (!hash.startsWith('#text=')) return null;
	try {
		return decodeURIComponent(hash.slice('#text='.length));
	} catch {
		return null;
	}
}
