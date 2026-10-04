export type Param = {
	id: number;
	key: string;
	value: string;
	keep: boolean;
	tracking: boolean;
	/** The `key=value` segment exactly as shared; kept byte-for-byte unless the param is edited. */
	raw: string;
};

const TRACKING_KEYS = new Set(
	[
		// Ads and click ids
		'fbclid',
		'gclid',
		'gclsrc',
		'dclid',
		'gbraid',
		'wbraid',
		'msclkid',
		'yclid',
		'twclid',
		'ttclid',
		'li_fat_id',
		'epik',
		'rdt_cid',
		'scclid',
		'irclickid',
		'rb_clickid',
		'wickedid',
		// Email and marketing platforms
		'mc_cid',
		'mc_eid',
		'mkt_tok',
		'_hsenc',
		'_hsmi',
		'hsctatracking',
		'vero_id',
		'vero_conv',
		'oly_anon_id',
		'oly_enc_id',
		'ml_subscriber',
		'ml_subscriber_hash',
		'sc_cid',
		's_cid',
		'cmpid',
		'ncid',
		'trk',
		'trkcampaign',
		'ss_source',
		'ss_campaign_id',
		// Analytics and cross-domain linking
		'_ga',
		'_gl',
		'_kx',
		'srsltid',
		'spm',
		'scm',
		// Share-sheet tags (Instagram, Spotify, YouTube, X, TikTok, Reddit, Amazon)
		'igshid',
		'igsh',
		'si',
		'feature',
		'pp',
		's',
		't',
		'ref_src',
		'ref_url',
		'share_id',
		'is_from_webapp',
		'sender_device',
		'share_app_id',
		'rdt',
		'ref_',
		'pd_rd_r',
		'pd_rd_w',
		'pd_rd_wg',
		'pd_rd_i',
		'pf_rd_p',
		'pf_rd_r',
		'content-id',
		'linkcode',
		'linkid',
		'tag'
	].map((key) => key.toLowerCase())
);

const TRACKING_PREFIXES = [
	'utm_',
	'pk_',
	'mtm_',
	'hsa_',
	'_hs',
	'ga_',
	'vero_',
	'pd_rd_',
	'pf_rd_'
];

/**
 * Keys that are only share tracking on some sites (e.g. Twitter/X's `s` and `t`); elsewhere they
 * are often meaningful. An entry ending in `.` matches that domain under any TLD (`amazon.co.uk`).
 */
const HOST_SPECIFIC = new Map<string, string[]>([
	['si', ['youtube.com', 'youtu.be', 'spotify.com']],
	['s', ['twitter.com', 'x.com']],
	['t', ['twitter.com', 'x.com']],
	['feature', ['youtube.com', 'youtu.be']],
	['pp', ['youtube.com', 'youtu.be']],
	['tag', ['amazon.']],
	['linkcode', ['amazon.']],
	['linkid', ['amazon.']],
	['content-id', ['amazon.']],
	['ref_', ['amazon.']]
]);

export function isTrackingParam(key: string, hostname = ''): boolean {
	const k = key.toLowerCase();
	const hosts = HOST_SPECIFIC.get(k);
	if (hosts) {
		const host = hostname.toLowerCase();
		return hosts.some((h) =>
			h.endsWith('.')
				? host.startsWith(h) || host.includes(`.${h}`)
				: host === h || host.endsWith(`.${h}`)
		);
	}
	return TRACKING_KEYS.has(k) || TRACKING_PREFIXES.some((prefix) => k.startsWith(prefix));
}

const TRAILING_PUNCTUATION = '.,;:!?”’»›';
const BRACKETS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

const count = (text: string, char: string) => text.split(char).length - 1;

/**
 * Drops punctuation that belongs to the surrounding prose, like linkifiers do: trailing `.,;:!?`
 * and closing quotes, and closing brackets without a match inside the link (so Wikipedia's
 * `Foo_(bar)` keeps its `)`).
 */
function trimTrailing(link: string): string {
	for (;;) {
		const last = link.at(-1) ?? '';
		const open = BRACKETS[last];
		if (TRAILING_PUNCTUATION.includes(last) || (open && count(link, last) > count(link, open)))
			link = link.slice(0, -1);
		else return link;
	}
}

/** A real-looking host: a TLD of at least two letters (so "e.g." isn't a domain) or an IPv4. */
const isPlausibleHost = (host: string) =>
	/\.(?:[a-z]{2,}|xn--[a-z0-9-]+)$/i.test(host) || /^\d+(?:\.\d+){3}$/.test(host);

/**
 * Finds a link in pasted text (share sheets often add a title around it) and parses it.
 * Bare domains like `example.com/page` get `https://`.
 */
export function parseLink(input: string): URL | null {
	const text = input.trim();
	if (!text) return null;
	const found = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
	const bare = !found && /^[^\s/]+\.[^\s]+$/.test(text);
	if (!found && !bare) return null;
	const candidate = trimTrailing(found ?? `https://${text}`);
	try {
		const url = new URL(candidate);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return bare && !isPlausibleHost(url.hostname) ? null : url;
	} catch {
		return null;
	}
}

/** Decodes one `key=value` query segment the way the browser does. */
function decodeSegment(raw: string): [string, string] {
	return [...new URLSearchParams(raw)][0] ?? ['', ''];
}

/** Lists query params in order (duplicates included), flagging known trackers. */
export function readParams(url: URL, removeTracking = true): Param[] {
	const segments = url.search.slice(1).split('&').filter(Boolean);
	return segments.map((raw, id) => {
		const [key, value] = decodeSegment(raw);
		const tracking = isTrackingParam(key, url.hostname);
		return { id, key, value, tracking, keep: !(removeTracking && tracking), raw };
	});
}

/**
 * Rebuilds the link from the kept params; the #fragment is kept. Unedited params come through
 * exactly as shared (no `%20` → `+`, no `flag` → `flag=`); only edited ones are re-encoded.
 */
export function buildLink(url: URL, params: Param[]): string {
	const next = new URL(url.href);
	const kept: string[] = [];
	for (const param of params) {
		if (!param.keep || param.key === '') continue;
		const [key, value] = decodeSegment(param.raw);
		kept.push(
			key === param.key && value === param.value
				? param.raw
				: new URLSearchParams([[param.key, param.value]]).toString()
		);
	}
	next.search = kept.join('&');
	return next.href;
}
