import { describe, expect, it } from 'vitest';
import { readSharedText, shareTargetRedirect } from './share';

const page = 'https://xcwds.com/utils/url-sanitizer';

describe('readSharedText', () => {
	it('reads an encoded or raw link from #url=', () => {
		const link = 'https://a.com/x?utm_source=y&b=2#frag';
		expect(readSharedText(new URL(`${page}#url=${encodeURIComponent(link)}`))).toBe(link);
		expect(readSharedText(new URL(`${page}#url=${link}`))).toBe(link);
		expect(readSharedText(new URL(`${page}#url=100%`))).toBe('100%');
	});

	it('joins Android share target params', () => {
		const shared = new URL(page);
		shared.searchParams.set('title', 'A story');
		shared.searchParams.set('text', 'Read this https://a.com/s?fbclid=1');
		expect(readSharedText(shared)).toBe('Read this https://a.com/s?fbclid=1 A story');
	});

	it('returns null when nothing was shared', () => {
		expect(readSharedText(new URL(page))).toBeNull();
		expect(readSharedText(new URL(`${page}#other`))).toBeNull();
	});
});

describe('shareTargetRedirect', () => {
	it('moves a shared link from the query to the hash', () => {
		const redirect = shareTargetRedirect(
			new URL(`${page}?url=${encodeURIComponent('https://a.com/?si=1')}`)
		);
		expect(redirect).toBe(`${page}#url=${encodeURIComponent('https://a.com/?si=1')}`);
	});

	it('ignores other pages and plain visits', () => {
		expect(shareTargetRedirect(new URL(page))).toBeNull();
		expect(shareTargetRedirect(new URL('https://xcwds.com/recipes?url=x'))).toBeNull();
		expect(shareTargetRedirect(new URL(`${page}?foo=1`))).toBeNull();
	});
});
