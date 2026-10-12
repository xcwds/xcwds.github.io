import { describe, expect, it } from 'vitest';
import {
	buildLink,
	isTrackingParam,
	parseLink,
	readParams,
	trackingPathSegment,
	unwrapRedirect
} from './url';

describe('parseLink', () => {
	it('finds a link inside shared text', () => {
		expect(parseLink('Look at this! https://example.com/a?b=1 via app')?.href).toBe(
			'https://example.com/a?b=1'
		);
	});

	it('adds https to bare domains and rejects junk', () => {
		expect(parseLink('example.com/page?x=1')?.href).toBe('https://example.com/page?x=1');
		expect(parseLink('not a link')).toBeNull();
		expect(parseLink('')).toBeNull();
		expect(parseLink('javascript:alert(1)')).toBeNull();
	});

	it('leaves trailing punctuation from the surrounding text out of the link', () => {
		expect(parseLink('Look (https://example.com/a?b=1).')?.href).toBe('https://example.com/a?b=1');
		expect(parseLink('Read this: https://example.com/a?x=1, it is good')?.href).toBe(
			'https://example.com/a?x=1'
		);
		expect(parseLink('“https://example.com/a!”')?.href).toBe('https://example.com/a');
		expect(parseLink('example.com/page.')?.href).toBe('https://example.com/page');
	});

	it('keeps closing brackets that are balanced inside the link', () => {
		const wiki = 'https://en.wikipedia.org/wiki/Mercury_(planet)';
		expect(parseLink(wiki)?.href).toBe(wiki);
		expect(parseLink(`See (${wiki}).`)?.href).toBe(wiki);
	});

	it('needs a real TLD for bare domains', () => {
		expect(parseLink('e.g.')).toBeNull();
		expect(parseLink('i.e')).toBeNull();
		expect(parseLink('example.co.uk')?.href).toBe('https://example.co.uk/');
		expect(parseLink('192.168.1.1/admin')?.href).toBe('https://192.168.1.1/admin');
	});
});

describe('isTrackingParam', () => {
	it('flags common trackers and prefixes, case-insensitively', () => {
		for (const key of ['utm_source', 'UTM_Medium', 'fbclid', 'gclid', 'igsh', 'mc_eid', '_hsenc'])
			expect(isTrackingParam(key)).toBe(true);
		for (const key of ['q', 'id', 'v', 'page', 'ref']) expect(isTrackingParam(key)).toBe(false);
	});

	it('only flags ambiguous keys on the sites that use them for tracking', () => {
		expect(isTrackingParam('t', 'x.com')).toBe(true);
		expect(isTrackingParam('t', 'www.youtube.com')).toBe(false);
		expect(isTrackingParam('feature', 'www.youtube.com')).toBe(true);
		expect(isTrackingParam('feature', 'github.com')).toBe(false);
		expect(isTrackingParam('tag', 'www.amazon.co.uk')).toBe(true);
		expect(isTrackingParam('tag', 'example.com')).toBe(false);
		expect(isTrackingParam('tag', 'amazon.com')).toBe(true);
		expect(isTrackingParam('tag', 'smile.amazon.de')).toBe(true);
		expect(isTrackingParam('tag', 'notamazon.example')).toBe(false);
		expect(isTrackingParam('ref_', 'shop.notamazon.com')).toBe(false);
		expect(isTrackingParam('si', 'youtu.be')).toBe(true);
		expect(isTrackingParam('si', 'open.spotify.com')).toBe(true);
		expect(isTrackingParam('si', 'example.com')).toBe(false);
	});
});

describe('more trackers (#137)', () => {
	/** The params `readParams` drops from `link`. */
	const dropped = (link: string) =>
		readParams(new URL(link))
			.filter((p) => !p.keep)
			.map((p) => p.key);
	/** The params it keeps. */
	const kept = (link: string) =>
		readParams(new URL(link))
			.filter((p) => p.keep)
			.map((p) => p.key);

	it('drops ad, deep-link, Facebook, email and Microsoft trackers anywhere', () => {
		const keys = [
			'gad_source',
			'gad_campaignid',
			'_branch_match_id',
			'_branch_referrer',
			'mibextid',
			'fb_action_ids',
			'fb_action_types',
			'fb_ref',
			'fb_source',
			'action_object_map',
			'action_type_map',
			'action_ref_map',
			'__tn__',
			'__cft__[0]',
			'ck_subscriber_id',
			'__s',
			'_bta_tid',
			'_bta_c',
			'wt_mc',
			'wt_zmc',
			'nr_email_referer',
			'ocid',
			'cvid'
		];
		for (const key of keys) expect(isTrackingParam(key, 'example.com'), key).toBe(true);
	});

	it('cleans Google search links but keeps the search', () => {
		const link =
			'https://www.google.com/search?q=svelte&oq=svel&gs_lcp=abc&sca_esv=1&ei=x&ved=y&sxsrf=z&sourceid=chrome&ie=UTF-8';
		expect(kept(link)).toEqual(['q', 'ie']);
		expect(dropped('https://www.google.co.uk/search?q=a&rlz=1C1&aqs=chrome..69i57&uact=5')).toEqual(
			['rlz', 'aqs', 'uact']
		);
		// Elsewhere these names can mean something.
		expect(kept('https://example.com/?ei=1&oq=2&ved=3')).toEqual(['ei', 'oq', 'ved']);
	});

	it('cleans LinkedIn, TikTok, Threads and Instagram share links', () => {
		expect(
			dropped(
				'https://www.linkedin.com/posts/x?trackingId=a&refId=b&lipi=c&midToken=d&midSig=e&trkEmail=f&rcm=g'
			)
		).toHaveLength(7);
		expect(
			kept(
				'https://www.tiktok.com/@a/video/1?_r=1&_t=2&u_code=3&preview_pb=0&share_item_id=4&share_link_id=5&social_sharing=1&sec_user_id=6&lang=en'
			)
		).toEqual(['lang']);
		expect(dropped('https://www.threads.net/@a/post/b?xmt=1&slof=1')).toEqual(['xmt', 'slof']);
		expect(dropped('https://www.instagram.com/p/a/?xmt=1&slof=1')).toEqual(['xmt', 'slof']);
		expect(kept('https://example.com/?_r=1&_t=2&rcm=3&xmt=4')).toEqual(['_r', '_t', 'rcm', 'xmt']);
	});

	it("cleans Amazon search tracking but keeps the product's variant", () => {
		const link =
			'https://www.amazon.com/dp/B0?qid=1&sr=8-3&crid=X&sprefix=ab&dib=e&dib_tag=se&_encoding=UTF8&th=1&psc=1';
		expect(kept(link)).toEqual(['th', 'psc']);
		expect(kept('https://example.com/?sr=1&qid=2')).toEqual(['sr', 'qid']);
	});
});

describe('unwrapRedirect (#137)', () => {
	const unwrap = (link: string) => {
		const found = unwrapRedirect(new URL(link));
		return found && [found.via, found.url.href];
	};
	const target = 'https://news.example.org/story?id=7&utm_source=x';
	const enc = encodeURIComponent(target);

	it('unwraps the known redirect links', () => {
		expect(unwrap(`https://www.google.com/url?sa=t&q=${enc}&usg=abc`)).toEqual(['Google', target]);
		expect(unwrap(`https://www.google.co.uk/url?url=${enc}`)).toEqual(['Google', target]);
		expect(unwrap(`https://l.facebook.com/l.php?u=${enc}&h=AT0`)).toEqual(['Facebook', target]);
		expect(unwrap(`https://lm.facebook.com/l.php?u=${enc}`)).toEqual(['Facebook', target]);
		expect(unwrap(`https://l.instagram.com/?u=${enc}&e=AT0`)).toEqual(['Instagram', target]);
		expect(unwrap(`https://www.youtube.com/redirect?event=video&q=${enc}`)).toEqual([
			'YouTube',
			target
		]);
		expect(unwrap(`https://out.reddit.com/t3_abc?url=${enc}&token=x`)).toEqual(['Reddit', target]);
	});

	it('unwraps a wrapper inside a wrapper, naming the outer one', () => {
		const inner = `https://l.facebook.com/l.php?u=${enc}`;
		expect(unwrap(`https://www.google.com/url?q=${encodeURIComponent(inner)}`)).toEqual([
			'Google',
			target
		]);
	});

	it('leaves everything else alone', () => {
		// Google search, other Google hosts and look-alike domains.
		expect(unwrap(`https://www.google.com/search?q=${enc}`)).toBeNull();
		expect(unwrap(`https://mail.google.com/url?q=${enc}`)).toBeNull();
		expect(unwrap(`https://www.google.com.example.net/url?q=${enc}`)).toBeNull();
		expect(unwrap(`https://facebook.com/l.php?u=${enc}`)).toBeNull();
		expect(unwrap(`https://www.youtube.com/watch?v=1&q=${enc}`)).toBeNull();
		// Not an http(s) link, or no link at all.
		expect(unwrap('https://www.google.com/url?q=javascript:alert(1)')).toBeNull();
		expect(unwrap('https://www.google.com/url?q=hello')).toBeNull();
		expect(unwrap('https://l.instagram.com/')).toBeNull();
	});
});

describe("Amazon's /ref= path segment (#137)", () => {
	it('finds a trailing ref segment on Amazon only', () => {
		expect(trackingPathSegment(new URL('https://www.amazon.com/dp/B0/ref=sr_1_3?th=1'))).toBe(
			'ref=sr_1_3'
		);
		expect(trackingPathSegment(new URL('https://www.amazon.co.uk/gp/product/B0/ref=ppx_o/'))).toBe(
			'ref=ppx_o'
		);
		expect(trackingPathSegment(new URL('https://www.amazon.com/dp/B0'))).toBeNull();
		expect(trackingPathSegment(new URL('https://www.amazon.com/ref=a/dp/B0'))).toBeNull();
		expect(trackingPathSegment(new URL('https://example.com/dp/B0/ref=sr_1_3'))).toBeNull();
	});

	it('drops it from the cleaned link only when asked', () => {
		const url = new URL('https://www.amazon.com/Some-Thing/dp/B0/ref=sr_1_3?th=1&qid=2#x');
		const params = readParams(url);
		expect(buildLink(url, params, true)).toBe('https://www.amazon.com/Some-Thing/dp/B0?th=1#x');
		expect(buildLink(url, params)).toBe(
			'https://www.amazon.com/Some-Thing/dp/B0/ref=sr_1_3?th=1#x'
		);
		expect(buildLink(new URL('https://www.amazon.com/ref=nav_logo'), [], true)).toBe(
			'https://www.amazon.com/'
		);
	});
});

describe('readParams / buildLink', () => {
	const url = new URL(
		'https://www.youtube.com/watch?v=abc123&si=XYZ&utm_source=share&list=PL1&list=PL2#t=30'
	);

	it('removes tracking by default and keeps everything else, including duplicates and the hash', () => {
		const params = readParams(url);
		expect(params.map((p) => [p.key, p.keep])).toEqual([
			['v', true],
			['si', false],
			['utm_source', false],
			['list', true],
			['list', true]
		]);
		expect(buildLink(url, params)).toBe(
			'https://www.youtube.com/watch?v=abc123&list=PL1&list=PL2#t=30'
		);
	});

	it('applies edits and drops the ? when nothing is kept', () => {
		const params = readParams(url, false);
		params[0].value = 'edited value';
		expect(buildLink(url, params)).toContain('?v=edited+value&si=XYZ&');
		for (const p of params) p.keep = false;
		expect(buildLink(url, params)).toBe('https://www.youtube.com/watch#t=30');
	});

	it('keeps params exactly as shared, re-encoding only edited ones', () => {
		const shared = new URL('https://ex.com/s?q=hello%20world&flag&a=1,2:3&utm_source=z#top');
		const params = readParams(shared);
		expect(params.map((p) => [p.key, p.value])).toEqual([
			['q', 'hello world'],
			['flag', ''],
			['a', '1,2:3'],
			['utm_source', 'z']
		]);
		expect(buildLink(shared, params)).toBe('https://ex.com/s?q=hello%20world&flag&a=1,2:3#top');
		params[2].value = '4 5';
		expect(buildLink(shared, params)).toBe('https://ex.com/s?q=hello%20world&flag&a=4+5#top');
		params[1].key = 'flag2';
		expect(buildLink(shared, params)).toContain('&flag2=&');
	});
});
