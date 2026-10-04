import { describe, expect, it } from 'vitest';
import { buildLink, isTrackingParam, parseLink, readParams } from './url';

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
