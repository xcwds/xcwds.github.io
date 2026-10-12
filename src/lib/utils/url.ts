export type Param = {
	id: number;
	key: string;
	value: string;
	keep: boolean;
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
		'gad_source',
		'gad_campaignid',
		// Branch deep links
		'_branch_match_id',
		'_branch_referrer',
		// Facebook share links
		'mibextid',
		'fb_action_ids',
		'fb_action_types',
		'fb_ref',
		'fb_source',
		'action_object_map',
		'action_type_map',
		'action_ref_map',
		'__tn__',
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
		'ck_subscriber_id',
		'__s',
		'_bta_tid',
		'_bta_c',
		'wt_mc',
		'wt_zmc',
		'nr_email_referer',
		// Microsoft and Bing shares
		'ocid',
		'cvid',
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
	'pf_rd_',
	// Facebook's `__cft__[0]`, `__cft__[1]`…
	'__cft__'
];

/**
 * Keys that are only tracking on some sites (e.g. Twitter/X's `s` and `t`); elsewhere they are
 * often meaningful. Hosts match as in `onHost`.
 */
const SITE_TRACKERS: [hosts: string[], keys: string[]][] = [
	[['youtube.com', 'youtu.be', 'spotify.com'], ['si']],
	[
		['twitter.com', 'x.com'],
		['s', 't']
	],
	[
		['youtube.com', 'youtu.be'],
		['feature', 'pp']
	],
	[
		['amazon.'],
		// Not `th` or `psc`, which pick the product variant.
		[
			'tag',
			'linkCode',
			'linkId',
			'content-id',
			'ref_',
			'qid',
			'sr',
			'crid',
			'sprefix',
			'dib',
			'dib_tag',
			'_encoding'
		]
	],
	// Search result tracking; `q` is the search itself.
	[
		['google.'],
		[
			'ved',
			'ei',
			'sxsrf',
			'gs_lcp',
			'gs_lp',
			'sca_esv',
			'sca_upv',
			'oq',
			'aqs',
			'rlz',
			'sourceid',
			'uact',
			'sclient'
		]
	],
	[['linkedin.com'], ['trackingId', 'refId', 'lipi', 'midToken', 'midSig', 'trkEmail', 'rcm']],
	[
		['tiktok.com'],
		[
			'_r',
			'_t',
			'u_code',
			'preview_pb',
			'share_item_id',
			'share_link_id',
			'social_sharing',
			'sec_user_id'
		]
	],
	[
		['threads.net', 'threads.com', 'instagram.com'],
		['xmt', 'slof']
	]
];

/** Lowercased key → the hosts it is tracking on. */
const HOST_SPECIFIC = new Map<string, string[]>();
for (const [hosts, keys] of SITE_TRACKERS)
	for (const key of keys) {
		const k = key.toLowerCase();
		HOST_SPECIFIC.set(k, [...(HOST_SPECIFIC.get(k) ?? []), ...hosts]);
	}

/**
 * Whether `hostname` is on one of `hosts`: the domain or a subdomain of it. An entry ending in `.`
 * matches that domain under any TLD (`amazon.` matches `www.amazon.co.uk`).
 */
function onHost(hostname: string, hosts: string[]): boolean {
	const host = hostname.toLowerCase();
	return hosts.some((h) =>
		h.endsWith('.')
			? host.startsWith(h) || host.includes(`.${h}`)
			: host === h || host.endsWith(`.${h}`)
	);
}

export function isTrackingParam(key: string, hostname = ''): boolean {
	const k = key.toLowerCase();
	const hosts = HOST_SPECIFIC.get(k);
	if (hosts) return onHost(hostname, hosts);
	return TRACKING_KEYS.has(k) || TRACKING_PREFIXES.some((prefix) => k.startsWith(prefix));
}

/**
 * Redirect wrappers whose only job is to log the click: the real link is in one of their params.
 * Hosts match exactly (no other subdomains), so `l.facebook.com` doesn't catch `facebook.com`.
 */
const REDIRECTS: {
	name: string;
	hosts: (host: string) => boolean;
	path: RegExp;
	keys: string[];
}[] = [
	{
		name: 'Google',
		// www.google.com, google.co.uk… but not mail.google.com or google.com.example.net.
		hosts: (host) => /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host),
		path: /^\/url$/,
		keys: ['q', 'url']
	},
	{
		name: 'Facebook',
		hosts: (host) => ['l.facebook.com', 'lm.facebook.com', 'l.messenger.com'].includes(host),
		path: /^\/l\.php$/,
		keys: ['u']
	},
	{
		name: 'Instagram',
		hosts: (host) => host === 'l.instagram.com',
		path: /^\/?$/,
		keys: ['u']
	},
	{
		name: 'YouTube',
		hosts: (host) => ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host),
		path: /^\/redirect$/,
		keys: ['q']
	},
	{
		name: 'Reddit',
		hosts: (host) => host === 'out.reddit.com',
		path: /^\//,
		keys: ['url']
	}
];

/** Parses an http(s) link exactly as given, or null. */
function httpLink(text: string): URL | null {
	try {
		const url = new URL(text);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/**
 * The link a known redirect wrapper (Google's `/url?q=`, Facebook's `l.php?u=`…) points to, and
 * whose wrapper it was, or null for anything else (#137). The wrapper itself is the tracking, so
 * the page cleans the real link instead. Wrappers inside wrappers are unwrapped too.
 */
export function unwrapRedirect(url: URL): { url: URL; via: string } | null {
	let current: URL = url;
	let via: string | null = null;
	// A few levels at most, so a link that wraps itself can't loop.
	for (let i = 0; i < 5; i++) {
		const next = redirectTarget(current);
		if (!next) break;
		via ??= next.via;
		current = next.url;
	}
	return via ? { url: current, via } : null;
}

/** One level of `unwrapRedirect`. */
function redirectTarget(url: URL): { url: URL; via: string } | null {
	const host = url.hostname.toLowerCase();
	const wrapper = REDIRECTS.find((r) => r.hosts(host) && r.path.test(url.pathname));
	for (const key of wrapper?.keys ?? []) {
		const target = httpLink(url.searchParams.get(key)?.trim() ?? '');
		if (wrapper && target) return { url: target, via: wrapper.name };
	}
	return null;
}

/**
 * Amazon's tracking path segment: product links end in `/ref=sr_1_3` (or `/ref=…`), which says
 * where the click came from. Returns that last segment (without its slash), or null (#137).
 */
export function trackingPathSegment(url: URL): string | null {
	if (!onHost(url.hostname, ['amazon.'])) return null;
	return url.pathname.match(/\/(ref=[^/]*)\/?$/)?.[1] ?? null;
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

/**
 * Lists query params in order (duplicates included); known trackers start unkept. Whether a param
 * is tracking isn't stored on it: the key can be edited, so ask `isTrackingParam` each time (#68).
 */
export function readParams(url: URL, removeTracking = true): Param[] {
	const segments = url.search.slice(1).split('&').filter(Boolean);
	return segments.map((raw, id) => {
		const [key, value] = decodeSegment(raw);
		const keep = !(removeTracking && isTrackingParam(key, url.hostname));
		return { id, key, value, keep, raw };
	});
}

/**
 * Rebuilds the link from the kept params, without Amazon's `/ref=…` segment when
 * `dropPathSegment` is set; the #fragment is kept. Unedited params come through
 * exactly as shared (no `%20` → `+`, no `flag` → `flag=`); only edited ones are re-encoded.
 */
export function buildLink(url: URL, params: Param[], dropPathSegment = false): string {
	const next = new URL(url.href);
	const segment = dropPathSegment && trackingPathSegment(url);
	if (segment) next.pathname = next.pathname.replace(/\/ref=[^/]*\/?$/, '') || '/';
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
