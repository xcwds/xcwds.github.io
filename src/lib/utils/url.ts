export type Param = {
	id: number;
	key: string;
	value: string;
	keep: boolean;
	tracking: boolean;
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

/** Twitter/X uses `s` and `t` for share tracking; elsewhere they are often meaningful. */
const HOST_SPECIFIC = new Map<string, string[]>([
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
			h.endsWith('.') ? host.includes(h) : host === h || host.endsWith(`.${h}`)
		);
	}
	return TRACKING_KEYS.has(k) || TRACKING_PREFIXES.some((prefix) => k.startsWith(prefix));
}

/**
 * Finds a link in pasted text (share sheets often add a title around it) and parses it.
 * Bare domains like `example.com/page` get `https://`.
 */
export function parseLink(input: string): URL | null {
	const text = input.trim();
	if (!text) return null;
	const candidate =
		text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ??
		(/^[^\s/]+\.[^\s]+$/.test(text) ? `https://${text}` : null);
	if (!candidate) return null;
	try {
		const url = new URL(candidate);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/** Lists query params in order (duplicates included), flagging known trackers. */
export function readParams(url: URL, removeTracking = true): Param[] {
	return [...url.searchParams].map(([key, value], id) => {
		const tracking = isTrackingParam(key, url.hostname);
		return { id, key, value, tracking, keep: !(removeTracking && tracking) };
	});
}

/** Rebuilds the link from the kept (and possibly edited) params; the #fragment is kept. */
export function buildLink(url: URL, params: Param[]): string {
	const next = new URL(url.href);
	const search = new URLSearchParams();
	for (const param of params) {
		if (param.keep && param.key !== '') search.append(param.key, param.value);
	}
	next.search = search.toString();
	return next.href;
}
